import mongoose from 'mongoose';
import { notifyWorkspace } from '../../services/workspaceNotify.js';
import BurialChamaProfile from '../../models/BurialChamaProfile.js';
import BenefitPlan from '../../models/BenefitPlan.js';
import Beneficiary from '../../models/Beneficiary.js';
import BurialCase from '../../models/BurialCase.js';
import Household from '../../models/Household.js';
import PenaltyWaiver from '../../models/PenaltyWaiver.js';
import MeetingRecord from '../../models/MeetingRecord.js';
import MemberCommunicationPreferences from '../../models/MemberCommunicationPreferences.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import Fund from '../../models/Fund.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import BurialChamaRulesEngine from './burialChamaRules.service.js';
import { ensurePlanLedgerAccount } from '../contributionPlan/index.js';
import { financeService } from '../finance/index.js';
import { Decimal } from 'decimal.js';
import NextOfKin from '../../models/NextOfKin.js';
import ApprovalRequest from '../../models/ApprovalRequest.js';
import approvalService from '../approval/index.js';
import mpesaService from '../../payment/providers/mpesa/mpesa.service.js';
import FinancialAccount from '../../models/FinancialAccount.js';
import FinancialTransaction from '../../models/FinancialTransaction.js';
import { accountingService } from '../finance/index.js';
import { encryptField, hashField } from '../../utils/fieldEncryption.js';

// ======================================================
// BURIAL CHAMA SERVICE
// ======================================================
// This service handles all burial chama operations
// including setup, configuration, and management.
// ======================================================

class BurialChamaService {
  static mandatoryCaseDocuments = ['death_certificate', 'burial_permit', 'deceased_id', 'relationship_proof', 'matanga_photo'];
  static async createCaseLevyObligations(burialCase, profile) {
    const model = profile.funding_rules?.funding_model || 'fixed_annual';
    const levy = new Decimal(profile.funding_rules?.per_death_levy?.toString?.() || profile.funding_rules?.per_death_levy || 0);
    if (!['per_death_levy', 'hybrid'].includes(model) || !levy.gt(0)) return { levyExpected: '0', obligationCount: 0 };

    if (burialCase.case_money?.levy_plan_id) {
      const count = await ContributionObligation.countDocuments({ case_id: burialCase._id });
      return { levyExpected: burialCase.case_money.levy_expected?.toString?.() || '0', obligationCount: count };
    }

    let memberships = await ChamaMembership.find({ chama_id: burialCase.chama_id, status: 'active' }).select('_id');
    if (['household', 'hybrid'].includes(profile.membership_model)) {
      const households = await Household.find({ chama_id: burialCase.chama_id, status: 'active' }).select('primary_member_id members.membership_id contribution_config.primary_contributor_id').lean();
      const householdMembers = new Set(households.flatMap((item) => item.members.map((member) => String(member.membership_id))));
      const householdChargers = new Set(households.map((item) => String(item.contribution_config?.primary_contributor_id || item.primary_member_id)));
      memberships = memberships.filter((membership) => !householdMembers.has(String(membership._id)) || householdChargers.has(String(membership._id)));
    }
    if (!memberships.length) return { levyExpected: '0', obligationCount: 0 };

    const amount = levy.toDecimalPlaces(2).toFixed(2);
    const now = new Date();
    const dueDate = new Date(now.getTime() + Number(profile.funding_rules?.case_levy_due_days || 14) * 86400000);
    const plan = await ContributionPlan.create({
      owner_type: 'Chama', owner_id: burialCase.chama_id, participant_type: 'ChamaMembership',
      created_by: burialCase.reported_by, name: `Case levy ${burialCase.case_number}`.slice(0, 100),
      description: `Per-death welfare levy for ${burialCase.case_number}`, contribution_type: 'fixed',
      frequency: 'once', amount: Number(amount), currency: profile.funding_rules?.currency || 'KES',
      behavior: 'welfare', start_date: now, is_permanent: false, status: 'active', activated_at: now,
    });
    const ledgerAccount = await ensurePlanLedgerAccount(plan, { actorUserId: burialCase.reported_by });
    if (!ledgerAccount) throw new Error('Could not create the case levy ledger account');
    const fund = await Fund.create({
      owner_type: 'Chama', owner_id: burialCase.chama_id, name: `Case fund ${burialCase.case_number}`.slice(0, 100),
      kind: 'case', settlement: 'retained', ledger_account_id: ledgerAccount._id, created_by: burialCase.reported_by,
    });
    plan.fund_id = fund._id;
    await plan.save();

    let existing = await ContributionObligation.countDocuments({ case_id: burialCase._id });
    if (!existing) {
      const rows = memberships.map((membership) => ({
        plan_id: plan._id, owner_type: 'Chama', owner_id: burialCase.chama_id,
        participant_type: 'ChamaMembership', participant_id: membership._id, case_id: burialCase._id,
        expected_amount: mongoose.Types.Decimal128.fromString(amount), paid_amount: mongoose.Types.Decimal128.fromString('0'),
        currency: profile.funding_rules?.currency || 'KES', due_date: dueDate, period_start: now, period_end: dueDate,
        period_key: `CASE-${burialCase._id}`, status: 'pending', notes: `Welfare levy for ${burialCase.case_number}`,
      }));
      try { await ContributionObligation.insertMany(rows, { ordered: false }); }
      catch (error) { if (error?.code !== 11000 && !error?.writeErrors?.every((item) => item.code === 11000)) throw error; }
    }
    const levyExpected = levy.times(memberships.length).toFixed(2);
    burialCase.case_money.funding_model = model;
    burialCase.case_money.levy_expected = mongoose.Types.Decimal128.fromString(levyExpected);
    burialCase.case_money.levy_plan_id = plan._id;
    await burialCase.save();
    notifyWorkspace('Chama', burialCase.chama_id, 'BURIAL_CONTRIBUTION_REQUIRED', {
      message: `A welfare levy of KES ${amount} is due from each active member for case ${burialCase.case_number} by ${dueDate.toLocaleDateString('en-KE')}.`,
      entityType: 'BurialCase', entityId: burialCase._id,
    });
    return { levyExpected, obligationCount: memberships.length };
  }

  static redactCaseForMember(burialCase, membershipId, role) {
    const record = burialCase?.toObject ? burialCase.toObject() : { ...burialCase };
    const privileged = ['chairperson', 'treasurer', 'secretary'].includes(role);
    const ownsCase = String(record.member?.membership_id) === String(membershipId);
    if (!privileged && !ownsCase) {
      if (record.deceased) {
        delete record.deceased.national_id;
        delete record.deceased.national_id_encrypted;
        delete record.deceased.national_id_hash;
      }
      if (record.claimant) delete record.claimant.national_id;
      if (Array.isArray(record.documents)) record.documents = record.documents.map(({ document_url, document_number, ...document }) => ({ ...document, document_url: null, document_number: null }));
    }
    if (record.deceased) {
      delete record.deceased.national_id_encrypted;
      delete record.deceased.national_id_hash;
      delete record.deceased.national_id;
    }
    return record;
  }

  static async listBurialCases(chamaId, membershipId, role) {
    const cases = await BurialCase.find({ chama_id: chamaId }).sort({ reported_at: -1 }).limit(200).lean();
    return cases.map((item) => this.redactCaseForMember(item, membershipId, role));
  }

  static async getBurialCase(caseId, chamaId, membershipId, role) {
    const burialCase = await BurialCase.findOne({ _id: caseId, chama_id: chamaId }).lean();
    if (!burialCase) throw new Error('Burial case not found');
    return this.redactCaseForMember(burialCase, membershipId, role);
  }

  static async addCaseDocuments(caseId, chamaId, userId, documents) {
    const burialCase = await BurialCase.findOne({ _id: caseId, chama_id: chamaId });
    if (!burialCase) throw new Error('Burial case not found');
    if (!Array.isArray(documents) || documents.length < 1 || documents.length > 10) throw new Error('Provide between one and ten documents');
    const allowedTypes = ['death_certificate', 'death_notification', 'member_id', 'national_id', 'deceased_id', 'matanga_photo', 'relationship_proof', 'chiefs_letter', 'hospital_document', 'burial_permit', 'other'];
    for (const item of documents) {
      if (!allowedTypes.includes(item.document_type)) throw new Error('Unsupported document type');
      if (!item.document_url || typeof item.document_url !== 'string') throw new Error('Upload each evidence file before submitting it');
      burialCase.documents.push({ document_type: item.document_type, document_url: String(item.document_url).slice(0, 2000), document_number: String(item.document_number || '').replace(/\d(?=\d{4})/g, '•').slice(0, 100), notes: String(item.notes || '').slice(0, 500), status: 'submitted', submitted_at: new Date() });
    }
    burialCase.updated_by = userId;
    await burialCase.save();
    return burialCase;
  }

  static async verifyCaseDocument(caseId, documentId, chamaId, userId, membership, verified) {
    const burialCase = await BurialCase.findOne({ _id: caseId, chama_id: chamaId });
    if (!burialCase) throw new Error('Burial case not found');
    if (membership?.role !== 'treasurer') throw new Error('Only the treasurer can verify claim evidence');
    if (String(membership._id) === String(burialCase.member.membership_id)) throw new Error('A claimant cannot verify their own family claim');
    const document = burialCase.documents.id(documentId);
    if (!document) throw new Error('Case document not found');
    document.status = verified ? 'verified' : 'rejected';
    document.verified_at = new Date();
    document.verified_by = userId;
    burialCase.updated_by = userId;
    await burialCase.save();
    return burialCase;
  }

  static async listChamaBeneficiaries(chamaId) {
    return Beneficiary.find({ chama_id: chamaId, eligibility_status: 'eligible' }).select('-national_id -national_id_encrypted -national_id_hash').sort({ first_name: 1 }).limit(500).lean();
  }

  static async listHouseholds(chamaId) {
    const profile = await BurialChamaProfile.findOne({ chama_id: chamaId }).select('membership_model').lean();
    if (!profile || !['household', 'hybrid'].includes(profile.membership_model)) return { membership_model: profile?.membership_model || 'individual', households: [] };
    const households = await Household.find({ chama_id: chamaId, status: { $ne: 'dissolved' } })
      .populate({ path: 'primary_member_id', select: 'user_id', populate: { path: 'user_id', select: 'first_name last_name phone_number' } })
      .populate({ path: 'members.membership_id', select: 'user_id', populate: { path: 'user_id', select: 'first_name last_name phone_number' } })
      .sort({ createdAt: -1 }).limit(500).lean();
    return { membership_model: profile.membership_model, households };
  }

  static async getHousehold(householdId, chamaId) {
    const household = await Household.findOne({ _id: householdId, chama_id: chamaId, status: { $ne: 'dissolved' } })
      .populate({ path: 'primary_member_id', select: 'user_id', populate: { path: 'user_id', select: 'first_name last_name phone_number' } })
      .populate({ path: 'members.membership_id', select: 'user_id', populate: { path: 'user_id', select: 'first_name last_name phone_number' } }).lean();
    if (!household) throw new Error('Household not found');
    return household;
  }

  static async validateHouseholdMembers(chamaId, memberIds, householdId = null) {
    const ids = [...new Set(memberIds.map(String))];
    if (!ids.length) throw new Error('A household must have at least one member');
    const memberships = await ChamaMembership.find({ _id: { $in: ids }, chama_id: chamaId, status: 'active' }).select('_id').lean();
    if (memberships.length !== ids.length) throw new Error('Every household member must be an active member of this chama');
    const occupied = await Household.findOne({ chama_id: chamaId, status: 'active', 'members.membership_id': { $in: ids }, ...(householdId ? { _id: { $ne: householdId } } : {}) }).select('_id household_name').lean();
    if (occupied) throw new Error('A member can belong to only one active household');
  }
  static async listPenaltyWaivers(chamaId) { return PenaltyWaiver.find({ chama_id: chamaId }).sort({ createdAt: -1 }).limit(500).lean(); }
  static async listMeetingRecords(chamaId) { return MeetingRecord.find({ chama_id: chamaId }).sort({ meeting_date: -1, createdAt: -1 }).limit(500).lean(); }

  static async getMemberCoverage(membershipId) {
    const membership = await ChamaMembership.findById(membershipId);
    if (!membership) throw new Error('Membership not found');
    const profile = await BurialChamaProfile.findOne({ chama_id: membership.chama_id });
    if (!profile) throw new Error('Burial chama profile not found');
    const now = new Date();
    const joinedAt = membership.joined_at ? new Date(membership.joined_at) : now;
    const waitingDays = Math.max(0, Number(profile.waiting_period_rules?.waiting_period_days || 0));
    const waitingEnds = new Date(joinedAt.getTime() + waitingDays * 86400000);
    const daysRemaining = Math.max(0, Math.ceil((waitingEnds - now) / 86400000));
    const household = await Household.findOne({ chama_id: membership.chama_id, status: 'active', 'members.membership_id': membership._id })
      .select('household_name primary_member_id contribution_config.method contribution_config.primary_contributor_id').lean();
    const sharedHouseholdMethod = household && ['single_primary', 'combined'].includes(household.contribution_config?.method);
    const arrearsMembershipId = sharedHouseholdMethod ? (household.contribution_config?.primary_contributor_id || household.primary_member_id) : membership._id;
    const arrears = await BurialChamaRulesEngine.checkArrears(arrearsMembershipId, profile);
    const suspensionMonths = Number(profile.arrears_policy?.suspension_threshold_months || 3);
    const arrearsThreshold = profile.arrears_policy?.arrears_threshold;
    const amountOverThreshold = profile.arrears_policy?.arrears_threshold_type === 'amount' && arrearsThreshold != null && new Decimal(arrears.arrears_amount).gt(arrearsThreshold.toString());
    let status = 'covered';
    let lapseReason = null;
    if (membership.status !== 'active') {
      status = 'lapsed';
      lapseReason = `Membership is ${membership.status}`;
    } else if (daysRemaining > 0 && !profile.waiting_period_rules?.partial_coverage_during_waiting) {
      status = 'waiting_period';
    } else if (profile.eligibility_rules?.good_standing_required !== false && arrears.has_arrears) {
      status = amountOverThreshold
        ? 'out_of_good_standing'
        : ((!arrearsThreshold || profile.arrears_policy?.arrears_threshold_type !== 'amount') && arrears.arrears_months >= suspensionMonths ? 'lapsed' : 'at_risk');
      if (status === 'lapsed') lapseReason = 'Contribution arrears exceed the cover suspension threshold';
      if (status === 'out_of_good_standing') lapseReason = `Contribution arrears exceed ${arrearsThreshold.toString()}`;
    }
    const coveredSince = status === 'waiting_period' ? waitingEnds : (membership.burial_coverage?.covered_since || waitingEnds);
    membership.burial_coverage = {
      status,
      covered_since: waitingDays === 0 ? joinedAt : waitingEnds,
      waiting_period_ends_at: waitingEnds,
      last_assessed_at: now,
      lapse_reason: lapseReason,
      reinstated_at: membership.burial_coverage?.reinstated_at || null,
    };
    await membership.save();
    const beneficiaries = await Beneficiary.find({ membership_id: membershipId, eligibility_status: { $ne: 'ineligible' }, $or: [{ effective_to: null }, { effective_to: { $gt: now } }] }).select('first_name last_name relationship eligibility_status effective_from').lean();
    return {
      status, covered: status === 'covered', covered_since: coveredSince,
      waiting_period_ends_at: waitingEnds, days_remaining: daysRemaining,
      arrears_amount: arrears.arrears_amount, arrears_months: arrears.arrears_months,
      lapse_reason: lapseReason, dependants: beneficiaries,
      household: household ? { _id: household._id, name: household.household_name, contribution_method: household.contribution_config?.method } : null,
      arrears_assessed_membership_id: arrearsMembershipId,
    };
  }

  static async getNextOfKin(membershipId, chamaId, userId, role) {
    const membership = await ChamaMembership.findOne({ _id: membershipId, chama_id: chamaId });
    if (!membership) throw new Error('Membership not found');
    const official = ['chairperson', 'treasurer', 'secretary'].includes(role);
    if (String(membership.user_id) !== String(userId) && !official) throw new Error('You may only view your own next-of-kin records');
    return NextOfKin.find({ membership_id: membershipId, chama_id: membership.chama_id, is_active: true })
      .select('-national_id_encrypted').sort({ createdAt: 1 }).lean();
  }

  static async replaceNextOfKin(membershipId, chamaId, entries, userId, role) {
    const membership = await ChamaMembership.findOne({ _id: membershipId, chama_id: chamaId });
    if (!membership) throw new Error('Membership not found');
    const official = ['chairperson', 'treasurer', 'secretary'].includes(role);
    if (String(membership.user_id) !== String(userId) && !official) throw new Error('You may only manage your own next-of-kin records');
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 5) throw new Error('Add between one and five next-of-kin contacts');
    const totalShare = entries.reduce((sum, entry) => sum + Number(entry.share_percentage || 0), 0);
    if (entries.some((entry) => !entry.full_name || !entry.relationship || !entry.phone || !entry.national_id || Number(entry.share_percentage) <= 0)) throw new Error('Each next-of-kin contact needs a name, relationship, phone, ID and share');
    if (Math.abs(totalShare - 100) > 0.01) throw new Error('Next-of-kin shares must add up to 100%');
    const records = entries.map((entry, index) => {
      const encrypted = encryptField(String(entry.national_id).trim());
      return {
        chama_id: membership.chama_id, membership_id: membership._id,
        full_name: String(entry.full_name).trim().slice(0, 200), relationship: String(entry.relationship).trim().slice(0, 100),
        phone: String(entry.phone).trim().slice(0, 30), national_id_encrypted: encrypted.ciphertext,
        national_id_last4: encrypted.last4, share_percentage: Number(entry.share_percentage), is_primary: index === 0,
        created_by: userId
      };
    });
    await NextOfKin.updateMany({ membership_id: membership._id, chama_id: membership.chama_id, is_active: true }, { $set: { is_active: false } });
    return NextOfKin.insertMany(records);
  }

  static async recordHomeVisit(caseId, chamaId, membership, userId, completed, notes = '') {
    const burialCase = await BurialCase.findOne({ _id: caseId, chama_id: chamaId });
    if (!burialCase) throw new Error('Burial case not found');
    if (!['chairperson', 'secretary'].includes(membership?.role)) throw new Error('Only the chairperson or secretary can record a home visit');
    if (String(membership._id) === String(burialCase.member.membership_id)) throw new Error('A claimant cannot verify their own family claim');
    burialCase.home_visit = { completed: Boolean(completed), verified_by: completed ? userId : null, verified_at: completed ? new Date() : null, notes: String(notes || '').slice(0, 1000) };
    await burialCase.save();
    return burialCase;
  }

  static async resolveFraudFlag(caseId, flagId, chamaId, membership, userId, resolutionNote) {
    const burialCase = await BurialCase.findOne({ _id: caseId, chama_id: chamaId });
    if (!burialCase) throw new Error('Burial case not found');
    if (!['chairperson', 'secretary'].includes(membership?.role)) throw new Error('Only the chairperson or secretary can resolve a duplicate-claim alert');
    if (String(membership._id) === String(burialCase.member.membership_id)) throw new Error('A claimant cannot resolve their own family claim alert');
    if (!resolutionNote || String(resolutionNote).trim().length < 8) throw new Error('Record a reason for resolving this alert');
    const flag = burialCase.fraud_flags.id(flagId);
    if (!flag) throw new Error('Fraud alert not found');
    flag.resolved_at = new Date();
    flag.resolved_by = userId;
    flag.note = `${flag.note || ''} | Resolved: ${String(resolutionNote).slice(0, 350)}`.slice(0, 500);
    await burialCase.save();
    return burialCase;
  }

  static async requestBurialPayoutApproval(caseId, chamaId, membership, userId) {
    const burialCase = await BurialCase.findOne({ _id: caseId, chama_id: chamaId });
    if (!burialCase) throw new Error('Burial case not found');
    if (!['treasurer', 'chairperson'].includes(membership?.role)) throw new Error('Only the treasurer or chairperson can submit a payout for approval');
    if (burialCase.status !== 'approved') throw new Error('The case must be approved by the committee before requesting payout approval');
    if (String(membership._id) === String(burialCase.member.membership_id)) throw new Error('A member cannot initiate a payout for their own family claim');
    if (burialCase.payout?.approval_request_id) {
      const previous = await ApprovalRequest.findById(burialCase.payout.approval_request_id);
      if (previous?.status === 'pending' || previous?.status === 'approved') return previous;
    }
    const approval = await approvalService.createRequest({
      chamaId, resourceType: 'BURIAL_BENEFIT', resourceId: burialCase._id,
      action: 'BURIAL_BENEFIT_DISBURSEMENT', title: `Bereavement payout ${burialCase.case_number}`,
      description: `Approve KES ${burialCase.benefit?.approved_amount || 0} payout for ${burialCase.deceased.full_name}`,
      amount: burialCase.benefit?.approved_amount, initiatedByMembershipId: membership._id,
      requiredApprovals: 2, eligibleRoles: ['chairperson', 'secretary'], allowInitiatorApproval: false,
      permissionKey: 'burial.benefit.disburse', metadata: { burial_case_id: String(burialCase._id) }
    });
    burialCase.payout.status = 'awaiting_approval';
    burialCase.payout.approval_request_id = approval._id;
    await burialCase.save();
    return approval;
  }

  static async availableBurialFundAllocations(burialCase, amount, profile) {
    const reserveFloor = Number(profile.funding_rules?.reserve_floor || 0);
    const funds = await Fund.find({ owner_type: 'Chama', owner_id: burialCase.chama_id, kind: { $in: ['case', 'welfare'] } }).lean();
    const caseFundId = burialCase.case_money?.levy_plan_id
      ? (await ContributionPlan.findById(burialCase.case_money.levy_plan_id).select('fund_id').lean())?.fund_id
      : null;
    const orderedFunds = [
      ...funds.filter((fund) => String(fund._id) === String(caseFundId)),
      ...funds.filter((fund) => fund.kind === 'welfare')
    ];
    const seen = new Set();
    const balances = [];
    let welfareTotal = 0;
    for (const fund of orderedFunds) {
      if (!fund.ledger_account_id || seen.has(String(fund.ledger_account_id))) continue;
      seen.add(String(fund.ledger_account_id));
      const account = await FinancialAccount.findOne({ _id: fund.ledger_account_id, owner_type: 'Chama', owner_id: burialCase.chama_id }).select('_id current_balance').lean();
      const balance = Math.max(0, Number(account?.current_balance?.toString?.() ?? account?.current_balance ?? 0));
      balances.push({ account_id: fund.ledger_account_id, kind: fund.kind, balance });
      if (fund.kind === 'welfare') welfareTotal += balance;
    }
    let remaining = Number(amount);
    let welfareRemaining = Math.max(0, welfareTotal - reserveFloor);
    const allocations = [];
    for (const item of balances) {
      const usable = item.kind === 'welfare' ? welfareRemaining : item.balance;
      const available = Math.min(item.balance, usable);
      const draw = Math.min(remaining, available);
      if (draw > 0) allocations.push({ account_id: item.account_id, amount: draw.toFixed(2) });
      if (item.kind === 'welfare') welfareRemaining -= draw;
      remaining -= draw;
      if (remaining <= 0.005) break;
    }
    if (remaining > 0.005) throw new Error(`Burial funds are short by KES ${remaining.toFixed(2)} after preserving the reserve`);
    return allocations;
  }

  static async disburseBurialBenefit(caseId, chamaId, membership, userId) {
    const burialCase = await BurialCase.findOne({ _id: caseId, chama_id: chamaId });
    if (!burialCase) throw new Error('Burial case not found');
    if (!['treasurer', 'chairperson'].includes(membership?.role)) throw new Error('Only the treasurer or chairperson can submit the M-Pesa payout');
    if (String(membership._id) === String(burialCase.member.membership_id)) throw new Error('A member cannot disburse their own family claim');
    const approval = await ApprovalRequest.findOne({ _id: burialCase.payout?.approval_request_id, chama_id: chamaId, resource_type: 'BURIAL_BENEFIT', resource_id: burialCase._id, status: 'approved' });
    if (!approval) throw new Error('Two independent approvals are required before disbursement');
    if (approval.approvals.some((item) => String(item.approver_id) === String(membership._id))) throw new Error('An approver cannot also submit the payout');
    if (!['approved', 'payment_authorized', 'disbursement'].includes(burialCase.status)) throw new Error('Case is not authorized for payment');
    const amount = Number(burialCase.benefit?.approved_amount?.toString?.() ?? burialCase.benefit?.approved_amount);
    const profile = await BurialChamaProfile.findById(burialCase.burial_chama_profile_id);
    const member = await ChamaMembership.findOne({ _id: burialCase.member.membership_id, chama_id: chamaId }).populate('user_id');
    let recipients;
    if (burialCase.deceased.relationship_to_member === 'self') {
      const contacts = await NextOfKin.find({ membership_id: burialCase.member.membership_id, chama_id: chamaId, is_active: true }).lean();
      if (!contacts.length || Math.abs(contacts.reduce((sum, item) => sum + Number(item.share_percentage || 0), 0) - 100) > 0.01) throw new Error('Complete next-of-kin records with shares totaling 100% before a member-death payout');
      recipients = contacts.map((item) => ({ full_name: item.full_name, phone: item.phone, share_percentage: item.share_percentage, amount: (amount * Number(item.share_percentage) / 100).toFixed(2), status: 'queued' }));
      const assigned = recipients.reduce((sum, item) => sum + Number(item.amount), 0);
      recipients[recipients.length - 1].amount = (Number(recipients[recipients.length - 1].amount) + amount - assigned).toFixed(2);
    } else {
      const recipientName = member?.user_id?.name || `${member?.user_id?.first_name || ''} ${member?.user_id?.last_name || ''}`.trim();
      recipients = [{ full_name: recipientName, phone: member?.user_id?.phone || burialCase.member.phone, share_percentage: 100, amount: amount.toFixed(2), status: 'queued' }];
    }
    if (recipients.some((item) => !item.phone)) throw new Error('A verified M-Pesa phone number is required for each recipient');
    let allocations = burialCase.payout.fund_allocations?.length
      ? burialCase.payout.fund_allocations.map((item) => ({ account_id: item.account_id, amount: Number(item.amount?.toString?.() ?? item.amount) }))
      : await this.availableBurialFundAllocations(burialCase, amount, profile);
    if (!burialCase.payout.recipients?.length) {
      let remainingAllocations = allocations.map((item) => ({ ...item }));
      for (const recipient of recipients) {
        let remaining = Number(recipient.amount);
        const recipientAllocations = [];
        for (const fund of remainingAllocations) {
          const draw = Math.min(remaining, fund.amount);
          if (draw > 0) recipientAllocations.push({ account_id: fund.account_id, amount: draw.toFixed(2) });
          fund.amount -= draw;
          remaining -= draw;
          if (remaining <= 0.005) break;
        }
        if (remaining > 0.005) throw new Error('Could not allocate the approved payout across the available burial funds');
        recipient.fund_allocations = recipientAllocations;
      }
      burialCase.payout.recipients = recipients;
      burialCase.payout.fund_allocations = allocations;
    }
    burialCase.payout.status = 'processing';
    burialCase.payout.initiated_by = userId;
    burialCase.payout.recipient_name = recipients.map((item) => item.full_name).join(', ').slice(0, 200);
    burialCase.payout.recipient_phone = recipients[0]?.phone || null;
    burialCase.status = 'disbursement';
    await burialCase.save();
    let failed = false;
    for (const recipient of burialCase.payout.recipients) {
      if (recipient.conversation_id || recipient.status === 'paid' || recipient.status === 'processing' || recipient.status === 'settling') continue;
      try {
        const result = await mpesaService.initiateB2cPayment({ amount: Number(recipient.amount?.toString?.() ?? recipient.amount), phoneNumber: recipient.phone, remarks: 'Burial benefit / rambirambi', occasion: `Burial ${burialCase.case_number}`, commandId: 'BusinessPayment' });
        recipient.conversation_id = result.conversationId;
        recipient.status = 'processing';
      } catch (error) {
        recipient.status = 'failed';
        recipient.failure_reason = String(error.message || 'M-Pesa payout failed').slice(0, 500);
        failed = true;
      }
      await burialCase.save();
    }
    if (failed) {
      burialCase.payout.status = burialCase.payout.recipients.some((item) => item.status === 'processing') ? 'processing' : 'failed';
      await burialCase.save();
    }
    return burialCase.payout;
  }

  static async reconcileBurialBenefitB2c(result) {
    const conversationId = result?.Result?.ConversationID;
    if (!conversationId) return false;
    const claim = await BurialCase.findOne({ 'payout.recipients.conversation_id': conversationId });
    if (!claim) return false;
    const recipient = claim.payout.recipients.find((item) => item.conversation_id === conversationId);
    if (!recipient) return false;
    const success = Number(result?.Result?.ResultCode) === 0;
    if (!success) {
      recipient.status = 'failed';
      recipient.failure_reason = String(result?.Result?.ResultDesc || 'M-Pesa payout failed').slice(0, 500);
      claim.payout.status = claim.payout.recipients.some((item) => item.status === 'processing' || item.status === 'paid') ? 'processing' : 'failed';
      if (!claim.payout.recipients.some((item) => item.status === 'paid')) claim.status = 'payment_authorized';
      await claim.save();
      return true;
    }
    if (recipient.status === 'paid' || recipient.status === 'settling') return true;
    recipient.status = 'settling';
    await claim.save();
    try {
      const amount = Number(recipient.amount?.toString?.() ?? recipient.amount);
      let transaction = await FinancialTransaction.findOne({ owner_type: 'Chama', owner_id: claim.chama_id, source_type: 'BurialCaseRecipient', source_id: recipient._id, transaction_type: 'burial_benefit_disbursement', status: 'posted' }).select('_id').lean();
      if (!transaction) {
      const posted = await accountingService.post({
        owner_type: 'Chama', owner_id: claim.chama_id, created_by: claim.payout.initiated_by || claim.reported_by,
        transactionType: 'burial_benefit_disbursement', referenceType: 'BURIAL_BENEFIT_DISBURSEMENT',
        source_type: 'BurialCaseRecipient', source_id: recipient._id, caseId: claim._id, amount, currency: claim.benefit?.currency || 'KES',
        externalReference: result?.Result?.ResultParameters?.ResultParameter?.find((item) => item.Key === 'TransactionReceipt')?.Value || null,
        reference: `BURIAL-${claim.case_number}-${String(recipient._id).slice(-8)}`, description: `Bereavement benefit paid to ${recipient.full_name} for case ${claim.case_number}`,
        fundAllocations: recipient.fund_allocations.map((item) => ({ account_id: item.account_id, amount: Number(item.amount?.toString?.() ?? item.amount) }))
      });
      transaction = { _id: posted.transactionId };
      }
      recipient.status = 'paid';
      recipient.receipt = result?.Result?.ResultParameters?.ResultParameter?.find((item) => item.Key === 'TransactionReceipt')?.Value || null;
      claim.payout.mpesa_receipt = recipient.receipt;
      claim.payout.completed_at = new Date();
      claim.case_money.related_transactions.addToSet(transaction._id);
      if (claim.payout.recipients.every((item) => item.status === 'paid')) {
        const previousStatus = claim.status;
        claim.payout.status = 'paid';
        claim.status_history.push({ from: previousStatus, to: 'confirmed', changed_by: claim.payout.initiated_by || claim.reported_by, changed_at: new Date(), note: `All M-Pesa recipients paid; latest receipt ${recipient.receipt || 'confirmed'}` });
        claim.status_history.push({ from: 'confirmed', to: 'closed', changed_by: claim.payout.initiated_by || claim.reported_by, changed_at: new Date() });
        claim.status = 'closed';
        claim.closed_at = new Date();
      } else {
        claim.payout.status = 'processing';
      }
      await claim.save();
      notifyWorkspace('Chama', claim.chama_id, 'BURIAL_PAYOUT_COMPLETED', { message: `Bereavement payout for ${claim.case_number} has been sent to ${recipient.full_name}.`, entityType: 'BurialCase', entityId: claim._id });
      return true;
    } catch (error) {
      claim.payout.status = 'settlement_pending';
      claim.payout.failure_reason = `M-Pesa paid but ledger settlement needs review: ${String(error.message || '').slice(0, 350)}`;
      await claim.save();
      return true;
    }
  }
  /**
   * Create or update burial chama profile
   */
  static async createOrUpdateProfile(chamaId, profileData, userId) {
    try {
      let profile;
      
      const existingProfile = await BurialChamaProfile.findOne({ chama_id: chamaId });
      
      if (existingProfile) {
        // Update existing profile
        profile = await BurialChamaProfile.findByIdAndUpdate(
          existingProfile._id,
          {
            ...profileData,
            updated_by: userId,
            version: existingProfile.version + 1
          },
          { returnDocument: 'after', runValidators: true }
        );
      } else {
        // Create new profile
        profile = new BurialChamaProfile({
          chama_id: chamaId,
          ...profileData,
          created_by: userId
        });
        await profile.save();
      }

      return profile;
    } catch (error) {
      throw new Error(`Failed to create/update burial chama profile: ${error.message}`);
    }
  }

  /**
   * Get burial chama profile
   */
  static async getProfile(chamaId) {
    try {
      const profile = await BurialChamaProfile.findOne({ chama_id: chamaId });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }
      return profile;
    } catch (error) {
      throw new Error(`Failed to get burial chama profile: ${error.message}`);
    }
  }

  /**
   * Activate burial chama profile
   */
  static async activateProfile(chamaId, userId) {
    try {
      const profile = await BurialChamaProfile.findOneAndUpdate(
        { chama_id: chamaId },
        {
          status: 'active',
          activated_at: new Date(),
          activated_by: userId
        },
        { returnDocument: 'after' }
      );

      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      return profile;
    } catch (error) {
      throw new Error(`Failed to activate burial chama profile: ${error.message}`);
    }
  }

  /**
   * Add beneficiary to a member
   */
  static async addBeneficiary(membershipId, beneficiaryData, userId, requesterRole, chamaId) {
    try {
      const membership = await ChamaMembership.findOne({ _id: membershipId, chama_id: chamaId });
      if (!membership) {
        throw new Error('Membership not found');
      }
      const isOfficial = ['treasurer', 'chairperson', 'secretary', 'committee_member'].includes(requesterRole);
      if (String(membership.user_id) !== String(userId) && !isOfficial) {
        throw new Error('You can only add beneficiaries to your own membership');
      }

      const profile = await BurialChamaProfile.findOne({ chama_id: membership.chama_id });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      // Validate beneficiary relationship
      const validation = BurialChamaRulesEngine.validateBeneficiaryRelationship(
        beneficiaryData.relationship,
        profile
      );

      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      const age = beneficiaryData.date_of_birth ? Math.floor((Date.now() - new Date(beneficiaryData.date_of_birth).getTime()) / 31557600000) : null;
      const familyValidation = await BurialChamaRulesEngine.validateFamilyLimit(membershipId, beneficiaryData.relationship, profile, { age, educationStatus: beneficiaryData.education_status });
      if (!familyValidation.valid) throw new Error(familyValidation.reason);

      const nationalIdHash = beneficiaryData.national_id ? hashField(beneficiaryData.national_id) : null;
      if (nationalIdHash && await Beneficiary.exists({ chama_id: membership.chama_id, national_id_hash: nationalIdHash })) throw new Error('This ID is already registered to a dependent in this chama');
      const encryptedId = beneficiaryData.national_id ? encryptField(String(beneficiaryData.national_id).trim()) : null;
      const beneficiary = new Beneficiary({
        ...beneficiaryData,
        national_id: null,
        national_id_encrypted: encryptedId?.ciphertext || null,
        national_id_hash: beneficiaryData.national_id ? hashField(beneficiaryData.national_id) : null,
        national_id_last4: encryptedId?.last4 || null,
        membership_id: membershipId,
        chama_id: membership.chama_id,
        changed_by: userId
      });

      await beneficiary.save();
      return beneficiary;
    } catch (error) {
      throw new Error(`Failed to add beneficiary: ${error.message}`);
    }
  }

  /**
   * Update beneficiary information
   */
  static async updateBeneficiary(beneficiaryId, updateData, userId, requesterRole, chamaId) {
    try {
      const beneficiary = await Beneficiary.findById(beneficiaryId);
      if (!beneficiary) {
        throw new Error('Beneficiary not found');
      }
      if (String(beneficiary.chama_id) !== String(chamaId)) throw new Error('Beneficiary does not belong to this chama workspace');
      const membership = await ChamaMembership.findById(beneficiary.membership_id);
      const isOfficial = ['treasurer', 'chairperson', 'secretary', 'committee_member'].includes(requesterRole);
      if (!membership || (String(membership.user_id) !== String(userId) && !isOfficial)) {
        throw new Error('You can only update beneficiaries on your own membership');
      }

      // Store previous record for history
      if (updateData.relationship || updateData.date_of_birth || updateData.education_status) {
        const profile = await BurialChamaProfile.findOne({ chama_id: membership.chama_id });
        const relationship = updateData.relationship || beneficiary.relationship;
        const dob = updateData.date_of_birth || beneficiary.date_of_birth;
        const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null;
        const familyValidation = await BurialChamaRulesEngine.validateFamilyLimit(membership._id, relationship, profile, { excludeId: beneficiary._id, age, educationStatus: updateData.education_status || beneficiary.education_status });
        if (!familyValidation.valid) throw new Error(familyValidation.reason);
      }

      const previousBeneficiary = new Beneficiary({
        ...beneficiary.toObject(),
        _id: undefined,
        effective_to: new Date(),
        previous_beneficiary_id: beneficiary._id
      });
      await previousBeneficiary.save();

      // Update current beneficiary
      const updatedBeneficiary = await Beneficiary.findByIdAndUpdate(
        beneficiaryId,
        {
          first_name: updateData.first_name,
          last_name: updateData.last_name,
          other_names: updateData.other_names,
          relationship: updateData.relationship,
          custom_relationship: updateData.custom_relationship,
          date_of_birth: updateData.date_of_birth,
          education_status: updateData.education_status,
          gender: updateData.gender,
          phone: updateData.phone,
          email: updateData.email,
          national_id: null,
          other_identifier: updateData.other_identifier,
          identifier_type: updateData.identifier_type,
          residence: updateData.residence,
          county: updateData.county,
          sub_county: updateData.sub_county,
          village: updateData.village,
          changed_by: userId,
          effective_from: new Date()
        },
        { returnDocument: 'after', runValidators: true }
      );

      if (updateData.national_id) {
        const nationalIdHash = hashField(updateData.national_id);
        if (await Beneficiary.exists({ chama_id: membership.chama_id, national_id_hash: nationalIdHash, _id: { $ne: beneficiary._id } })) throw new Error('This ID is already registered to another dependent in this chama');
        const encryptedId = encryptField(String(updateData.national_id).trim());
        updatedBeneficiary.national_id_encrypted = encryptedId.ciphertext;
        updatedBeneficiary.national_id_hash = nationalIdHash;
        updatedBeneficiary.national_id_last4 = encryptedId.last4;
        await updatedBeneficiary.save();
      }
      return updatedBeneficiary;
    } catch (error) {
      throw new Error(`Failed to update beneficiary: ${error.message}`);
    }
  }

  /**
   * Get member beneficiaries
   */
  static async getMemberBeneficiaries(membershipId, userId, requesterRole, chamaId) {
    try {
      const membership = await ChamaMembership.findOne({ _id: membershipId, chama_id: chamaId });
      const isOfficial = ['treasurer', 'chairperson', 'secretary', 'committee_member'].includes(requesterRole);
      if (!membership || (String(membership.user_id) !== String(userId) && !isOfficial)) {
        throw new Error('You can only view beneficiaries on your own membership');
      }
      const beneficiaries = await Beneficiary.find({
        membership_id: membershipId,
        eligibility_status: 'eligible',
        $or: [
          { effective_to: null },
          { effective_to: { $gt: new Date() } }
        ]
      }).sort({ relationship: 1, first_name: 1 });

      return beneficiaries;
    } catch (error) {
      throw new Error(`Failed to get member beneficiaries: ${error.message}`);
    }
  }

  /**
   * Create household
   */
  static async createHousehold(chamaId, householdData, userId) {
    try {
      const profile = await BurialChamaProfile.findOne({ chama_id: chamaId });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      if (profile.membership_model !== 'household' && profile.membership_model !== 'hybrid') {
        throw new Error('Households can only be created for household or hybrid membership models');
      }

      const members = Array.isArray(householdData.members) ? householdData.members : [];
      const primaryId = String(householdData.primary_member_id || '');
      if (!members.some((item) => String(item.membership_id) === primaryId)) members.push({ membership_id: primaryId, role_in_household: 'head', is_primary_contributor: true });
      await this.validateHouseholdMembers(chamaId, members.map((item) => item.membership_id));
      const household = new Household({
        ...householdData,
        chama_id: chamaId,
        members,
        created_by: userId
      });

      await household.save();
      return household;
    } catch (error) {
      throw new Error(`Failed to create household: ${error.message}`);
    }
  }

  static async updateHousehold(householdId, chamaId, data, userId) {
    const household = await Household.findOne({ _id: householdId, chama_id: chamaId, status: 'active' });
    if (!household) throw new Error('Active household not found');
    const editable = ['household_number', 'household_name', 'primary_phone', 'secondary_phone', 'email', 'residence', 'county', 'sub_county', 'village', 'landmark', 'notes', 'members', 'primary_member_id', 'contribution_config'];
    for (const key of editable) if (data[key] !== undefined) household[key] = data[key];
    if (!Array.isArray(household.members)) household.members = [];
    const primaryId = String(household.primary_member_id);
    if (!household.members.some((item) => String(item.membership_id) === primaryId)) household.members.push({ membership_id: household.primary_member_id, role_in_household: 'head', is_primary_contributor: true });
    household.members = household.members.map((item) => ({ ...item.toObject?.() || item, role_in_household: String(item.membership_id) === primaryId ? 'head' : (item.role_in_household === 'head' ? 'other' : item.role_in_household) }));
    await this.validateHouseholdMembers(chamaId, household.members.map((item) => item.membership_id), household._id);
    household.updated_by = userId;
    await household.save();
    return household;
  }

  static async removeHouseholdMember(householdId, chamaId, membershipId) {
    const household = await Household.findOne({ _id: householdId, chama_id: chamaId, status: 'active' });
    if (!household) throw new Error('Active household not found');
    if (String(household.primary_member_id) === String(membershipId)) throw new Error('Change the household head before removing them');
    household.members = household.members.filter((item) => String(item.membership_id) !== String(membershipId));
    if (household.members.length === 0) throw new Error('A household must retain at least one member');
    household.contribution_config.contribution_split = (household.contribution_config.contribution_split || []).filter((item) => String(item.membership_id) !== String(membershipId));
    if (household.contribution_config.method === 'split_members' && household.contribution_config.contribution_split.length) {
      const total = household.contribution_config.contribution_split.reduce((sum, item) => sum + Number(item.percentage), 0);
      household.contribution_config.contribution_split.forEach((item) => { item.percentage = item.percentage * 100 / total; });
    }
    await household.save();
    return household;
  }

  static async dissolveHousehold(householdId, chamaId, userId) {
    const household = await Household.findOne({ _id: householdId, chama_id: chamaId, status: 'active' });
    if (!household) throw new Error('Active household not found');
    const memberIds = household.members.map((item) => item.membership_id);
    const openCase = await BurialCase.exists({ chama_id: chamaId, 'member.membership_id': { $in: memberIds }, status: { $nin: ['disbursed', 'confirmed', 'closed', 'rejected', 'cancelled'] } });
    if (openCase) throw new Error('Resolve all open welfare cases for household members before dissolving this household');
    household.status = 'dissolved';
    household.dissolved_date = new Date();
    household.updated_by = userId;
    await household.save();
    return household;
  }

  /**
   * Add member to household
   */
  static async addMemberToHousehold(householdId, membershipId, roleData) {
    try {
      const household = await Household.findById(householdId);
      if (!household) {
        throw new Error('Household not found');
      }

      const membership = await ChamaMembership.findById(membershipId);
      if (!membership) {
        throw new Error('Membership not found');
      }

      if (membership.chama_id.toString() !== household.chama_id.toString()) {
        throw new Error('Membership does not belong to the same chama');
      }
      if (membership.status !== 'active' || household.status !== 'active') throw new Error('Only active chama members can be added to an active household');

      // Check if member already in household
      const existingMember = household.members.find(
        m => m.membership_id.toString() === membershipId.toString()
      );

      if (existingMember) {
        throw new Error('Member already in household');
      }

      await this.validateHouseholdMembers(household.chama_id, [membershipId], household._id);

      household.members.push({
        membership_id: membershipId,
        ...roleData
      });

      await household.save();
      return household;
    } catch (error) {
      throw new Error(`Failed to add member to household: ${error.message}`);
    }
  }

  /**
   * Create burial case
   */
  static async createBurialCase(caseData, userId, requesterMembership) {
    try {
      let profile = await BurialChamaProfile.findOne({ $or: [{ _id: caseData.burial_chama_profile_id }, { chama_id: caseData.burial_chama_profile_id }] });
      // Older burial workspaces can exist before their setup wizard has
      // created a profile. Bootstrap the schema defaults for that burial
      // chama so members can report a case; benefit amounts still require
      // the officials to complete the setup and benefit plan.
      if (!profile && mongoose.Types.ObjectId.isValid(caseData.burial_chama_profile_id)) {
        const chama = await Chama.findById(caseData.burial_chama_profile_id)
          .select('chama_type workspace_config.modules')
          .lean();
        const isBurialChama = chama && (
          chama.chama_type === 'burial' ||
          chama.workspace_config?.modules?.includes('burial_welfare')
        );
        if (isBurialChama) {
          profile = await BurialChamaProfile.findOneAndUpdate(
            { chama_id: chama._id },
            { $setOnInsert: { created_by: userId } },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
          );
        }
      }
      if (!profile) {
        throw new Error('Burial chama setup is missing. Ask a chairperson or treasurer to finish the burial setup before reporting a case.');
      }
      if (!requesterMembership || String(requesterMembership.chama_id) !== String(profile.chama_id)) throw new Error('The selected burial chama does not match your active workspace');

      // Generate case number
      const caseNumber = await this.generateCaseNumber(profile.chama_id);

    const allowed = ['burial_chama_profile_id', 'case_type', 'deceased', 'member', 'claimant', 'documents', 'emergency', 'fundraising', 'funeral_details', 'notes'];
      const safeData = Object.fromEntries(allowed.filter(key => caseData[key] !== undefined).map(key => [key, caseData[key]]));
      safeData.burial_chama_profile_id = profile._id;
      const deceasedFields = ['beneficiary_id', 'first_name', 'last_name', 'other_names', 'full_name', 'relationship_to_member', 'date_of_birth', 'date_of_death', 'national_id', 'cause_of_death'];
      safeData.deceased = Object.fromEntries(deceasedFields.filter((key) => safeData.deceased?.[key] !== undefined).map((key) => [key, safeData.deceased[key]]));
      const claimantFields = ['name', 'relationship', 'phone', 'email', 'national_id'];
      safeData.claimant = Object.fromEntries(claimantFields.filter((key) => safeData.claimant?.[key] !== undefined).map((key) => [key, safeData.claimant[key]]));
      const membershipId = safeData.member?.membership_id || requesterMembership?._id;
      const membership = membershipId && await ChamaMembership.findOne({ _id: membershipId, chama_id: profile.chama_id, status: 'active' }).populate('user_id');
      if (!membership) throw new Error('An active chama membership is required for the reported case');
      if (String(membership.user_id?._id || membership.user_id) !== String(userId) && !['chairperson', 'treasurer', 'secretary'].includes(requesterMembership?.role)) throw new Error('You may only report a case for your own membership');
      const eligibility = await BurialChamaRulesEngine.checkEligibility(membership._id, safeData.deceased?.beneficiary_id || null, profile._id);
      // Reporting a bereavement must remain possible even when the member is
      // still in a waiting period or has a coverage issue. Capture the check
      // at report time for the officials; benefit calculation and payout
      // continue to enforce the configured eligibility rules later.
      safeData.eligibility = {
        is_eligible: eligibility.is_eligible,
        checked_at: eligibility.checked_at || new Date(),
        checked_by: userId,
        waiting_period_satisfied: eligibility.waiting_period_satisfied,
        contribution_status: eligibility.contribution_status,
        arrears_impact: eligibility.arrears_impact,
        reasons: eligibility.reasons || []
      };
      const deceasedId = String(safeData.deceased?.national_id || '').trim();
      const deceasedIdHash = deceasedId ? hashField(deceasedId) : null;
      const deceasedName = String(safeData.deceased?.full_name || `${safeData.deceased?.first_name || ''} ${safeData.deceased?.last_name || ''}`).trim();
      const duplicateSince = new Date(Date.now() - 365 * 86400000);
      const duplicateQuery = {
        chama_id: profile.chama_id, reported_at: { $gte: duplicateSince },
        status: { $nin: ['rejected', 'cancelled'] },
        $or: [
          ...(deceasedIdHash ? [{ 'deceased.national_id_hash': deceasedIdHash }, { 'deceased.national_id': deceasedId }] : []),
          ...(deceasedName ? [{ $expr: { $eq: [{ $toLower: '$deceased.full_name' }, deceasedName.toLowerCase()] } }] : [])
        ]
      };
      const duplicateCase = duplicateQuery.$or.length ? await BurialCase.findOne(duplicateQuery).select('_id deceased.national_id deceased.national_id_hash deceased.full_name').lean() : null;
      if (duplicateCase) safeData.fraud_flags = [{
        flag_type: deceasedIdHash && (duplicateCase.deceased?.national_id_hash === deceasedIdHash || duplicateCase.deceased?.national_id === deceasedId) ? 'duplicate_deceased_id' : 'duplicate_deceased_name',
        related_case_id: duplicateCase._id,
        note: 'A matching deceased identity was claimed within the last 12 months; manual review required.'
      }];
      const memberUser = membership.user_id || {};
      if (deceasedId) {
        const encryptedId = encryptField(deceasedId);
        safeData.deceased.national_id = null;
        safeData.deceased.national_id_encrypted = encryptedId.ciphertext;
        safeData.deceased.national_id_hash = deceasedIdHash;
        safeData.deceased.national_id_last4 = encryptedId.last4;
      }
      const claimantId = String(safeData.claimant?.national_id || '').trim();
      if (claimantId) {
        const encryptedId = encryptField(claimantId);
        safeData.claimant.national_id = null;
        safeData.claimant.national_id_encrypted = encryptedId.ciphertext;
        safeData.claimant.national_id_hash = hashField(claimantId);
        safeData.claimant.national_id_last4 = encryptedId.last4;
      }
      safeData.member = {
        membership_id: membership._id,
        user_id: memberUser._id || membership.user_id,
        first_name: memberUser.first_name || memberUser.name?.split(' ')[0] || 'Member',
        last_name: memberUser.last_name || memberUser.name?.split(' ').slice(1).join(' ') || 'Unknown',
        phone: memberUser.phone || ''
      };
      safeData.deceased = { ...safeData.deceased, date_of_birth: safeData.deceased?.date_of_birth || safeData.deceased?.date_of_death };
      if (Array.isArray(safeData.documents)) safeData.documents = safeData.documents.map(({ document_type, document_url, document_number, notes }) => ({ document_type, document_url, document_number: document_number ? `••••${String(document_number).slice(-4)}` : undefined, notes, status: 'submitted', submitted_at: new Date() }));
      safeData.status = 'documents_pending';
      safeData.status_history = [{ from: null, to: 'documents_pending', changed_by: userId, changed_at: new Date() }];
      const burialCase = new BurialCase({
        ...safeData,
        case_number: caseNumber,
        chama_id: profile.chama_id,
        created_by: userId,
        reported_by: userId
      });

      await burialCase.save();
      notifyWorkspace('Chama', profile.chama_id, 'BURIAL_CASE_OPENED', {
        message: `A bereavement case (${caseNumber}) has been opened. Leadership will share arrangements and contribution details.`,
        entityType: 'BurialCase',
        entityId: burialCase._id
      });
      return burialCase;
    } catch (error) {
      throw new Error(`Failed to create burial case: ${error.message}`);
    }
  }

  /**
   * Update burial case status
   */
  static async updateBurialCaseStatus(caseId, chamaId, status, updateData, userId, membership) {
    try {
      const burialCase = await BurialCase.findOne({ _id: caseId, chama_id: chamaId });
      if (!burialCase) {
        throw new Error('Burial case not found');
      }

      const role = membership?.role;
      const transitions = {
        reported: ['documents_pending', 'under_review', 'cancelled'], documents_pending: ['under_review', 'cancelled'], under_review: ['verified', 'documentation_required', 'rejected', 'cancelled'],
        documentation_required: ['under_review', 'cancelled'], verified: ['eligibility_check', 'rejected'],
        eligibility_check: ['benefit_calculated', 'rejected'], benefit_calculated: ['committee_review', 'rejected'],
        committee_review: ['approved', 'rejected', 'appeal'], approved: ['payment_authorized', 'appeal'],
        payment_authorized: ['disbursement', 'cancelled'], disbursement: ['confirmed'], confirmed: ['closed'],
        rejected: ['appeal'], appeal: ['under_review', 'rejected', 'approved'], cancelled: []
      };
      const officials = ['chairperson', 'treasurer', 'secretary'];
      const authorizedRoles = ['verified', 'payment_authorized', 'disbursement', 'confirmed', 'closed', 'rejected'].includes(status) ? officials : ['chairperson', 'treasurer', 'secretary', 'committee_member'];
      if (!authorizedRoles.includes(role)) throw new Error('Your role cannot make this case transition');
      if (!(transitions[burialCase.status] || []).includes(status)) throw new Error(`Transition from ${burialCase.status} to ${status} is not allowed`);
      if (status === 'verified') {
        if (role !== 'treasurer') throw new Error('Treasurer verification is required at this stage');
        if (String(membership._id) === String(burialCase.member.membership_id)) throw new Error('A claimant cannot verify their own family claim');
        const submittedAndVerified = new Set(burialCase.documents.filter(document => document.status === 'verified').map(document => document.document_type));
        const missing = this.mandatoryCaseDocuments.filter(type => !submittedAndVerified.has(type));
        if (missing.length) throw new Error(`Upload and verify the required evidence first: ${missing.join(', ')}`);
        if ((burialCase.fraud_flags || []).some((flag) => !flag.resolved_at)) throw new Error('A duplicate-claim alert must be reviewed and resolved before verification');
        if (!burialCase.home_visit?.completed) throw new Error('A home visit must be recorded before treasurer verification');
        if (String(burialCase.home_visit.verified_by) === String(userId)) throw new Error('The home-visit verifier and treasurer must be different people');
      }

      const updateFields = {
        status,
        updated_by: userId
      };

      // Add status-specific timestamps and fields
      switch (status) {
        case 'under_review':
          updateFields.under_review_at = new Date();
          break;
        case 'verified':
          updateFields.verified_at = new Date();
          updateFields.verified_by = userId;
          break;
        case 'approved':
          updateFields.approved_at = new Date();
          updateFields.approved_by = userId;
          break;
        case 'rejected':
          updateFields.rejected_at = new Date();
          updateFields.rejected_by = userId;
          if (updateData.rejection_reason) {
            updateFields.rejection_reason = updateData.rejection_reason;
          }
          break;
        case 'closed':
          updateFields.closed_at = new Date();
          updateFields.closed_by = userId;
          break;
      }

      const safeUpdates = {};
      if (status === 'rejected' && typeof updateData.rejection_reason === 'string') safeUpdates.rejection_reason = updateData.rejection_reason.slice(0, 1000);
      if (typeof updateData.notes === 'string') safeUpdates.notes = updateData.notes.slice(0, 2000);
      if (status === 'approved') throw new Error('Committee approval must be reached through committee voting');
      if (['payment_authorized', 'disbursement', 'confirmed', 'closed'].includes(status)) throw new Error('Payout authorization and case closure are handled by the dual-approval M-Pesa payout flow');
      const previousStatus = burialCase.status;
      let dependentToMark = null;
      burialCase.set({ ...updateFields, ...safeUpdates });
      burialCase.status_history.push({ from: previousStatus, to: status, changed_by: userId, changed_at: new Date(), note: safeUpdates.rejection_reason || safeUpdates.notes });
      if (status === 'verified') {
        burialCase.treasurer_verification = { membership_id: membership._id, verified_at: new Date() };
        if (burialCase.deceased?.beneficiary_id) {
          const dependent = await Beneficiary.findOne({ _id: burialCase.deceased.beneficiary_id, membership_id: burialCase.member.membership_id, chama_id: burialCase.chama_id });
          if (!dependent) throw new Error('Claimed dependent does not belong to this membership');
          if (dependent.eligibility_status === 'deceased') throw new Error('This dependent has already been recorded as deceased');
          dependentToMark = dependent;
        }
      }
      const updatedCase = await burialCase.save();
      if (dependentToMark) {
        const marked = await Beneficiary.updateOne(
          { _id: dependentToMark._id, membership_id: burialCase.member.membership_id, chama_id: burialCase.chama_id, eligibility_status: { $ne: 'deceased' } },
          { $set: { eligibility_status: 'deceased', deceased_at: burialCase.deceased.date_of_death, deceased_case_id: burialCase._id } }
        );
        if (!marked.modifiedCount) throw new Error('This dependent was already marked deceased by another claim');
      }

      if (updatedCase && ['approved', 'rejected'].includes(status) && updatedCase.reported_by) {
        notifyWorkspace('Chama', updatedCase.chama_id, status === 'approved' ? 'CLAIM_APPROVED' : 'CLAIM_REJECTED', {
          message: status === 'approved'
            ? `The bereavement case you reported (${updatedCase.case_number}) has been approved.`
            : `The bereavement case you reported (${updatedCase.case_number}) was not approved.${updatedCase.rejection_reason ? ' Reason: ' + String(updatedCase.rejection_reason).slice(0, 120) : ''}`,
          userId: updatedCase.reported_by,
          entityType: 'BurialCase',
          entityId: updatedCase._id
        });
      }
      return updatedCase;
    } catch (error) {
      throw new Error(`Failed to update burial case status: ${error.message}`);
    }
  }

  /**
   * Calculate and set benefit for burial case
   */
  static async calculateCaseBenefit(caseId, chamaId, userId, exGratiaRequested = false, membership = null) {
    try {
      const current = await BurialCase.findOne({ _id: caseId, chama_id: chamaId });
      if (!current) throw new Error('Burial case not found');
      if (!['eligibility_check', 'verified'].includes(current.status)) throw new Error('Case must be verified and in eligibility review before benefit calculation');
      const profile = await BurialChamaProfile.findById(current.burial_chama_profile_id);
      const requiredDocuments = (profile.claim_rules?.required_documents || []).filter(document => document.is_required).map(document => document.document_type);
      const verifiedTypes = new Set(current.documents.filter(document => document.status === 'verified').map(document => document.document_type));
      const missingDocuments = requiredDocuments.filter(type => !verifiedTypes.has(type));
      if (missingDocuments.length) throw new Error(`Required documents are not verified: ${missingDocuments.join(', ')}`);
      const eligibility = await BurialChamaRulesEngine.checkEligibility(current.member.membership_id, current.deceased?.beneficiary_id || null, current.burial_chama_profile_id);
      const arrears = await BurialChamaRulesEngine.checkArrears(current.member.membership_id, profile);
      const arrearsOnlyReason = eligibility.reasons.length > 0 && eligibility.reasons.every((reason) => reason.toLowerCase().includes('arrears'));
      const partialDefault = arrears.has_arrears && arrears.arrears_months < Number(profile.arrears_policy?.suspension_threshold_months || 3);
      const exGratia = Boolean(exGratiaRequested) && ['treasurer', 'chairperson', 'secretary'].includes(membership?.role) && eligibility.waiting_period_satisfied && arrearsOnlyReason && partialDefault;
      if (!eligibility.is_eligible && !exGratia) throw new Error(`Member is not eligible: ${eligibility.reasons.join('; ')}`);
      if (arrears.has_arrears && profile.arrears_policy.effect === 'suspend' && (profile.arrears_policy.arrears_threshold_type !== 'amount' || (profile.arrears_policy.arrears_threshold && new Decimal(arrears.arrears_amount).gt(profile.arrears_policy.arrears_threshold.toString()))) && !exGratia) throw new Error('Member arrears suspend benefit eligibility');
      const benefitCalculation = await BurialChamaRulesEngine.calculateBenefit(caseId);
      let approvedAmount = new Decimal(benefitCalculation.calculated_amount);
      if (exGratia) approvedAmount = approvedAmount.div(2);
      const benefitCap = profile.funding_rules?.maximum_benefit_per_case;
      if (benefitCap && approvedAmount.gt(benefitCap.toString())) approvedAmount = new Decimal(benefitCap.toString());
      const finance = await financeService.getSummary('Chama', current.chama_id);
      const fundAvailable = Number(finance.fund_available_for_cases ?? 0);
      const fundingModel = profile.funding_rules?.funding_model || 'fixed_annual';
      const hybridLimit = Number(profile.funding_rules?.hybrid_fund_limit || 0);
      const available = fundingModel === 'per_death_levy'
        ? 0
        : fundingModel === 'hybrid' && hybridLimit > 0
          ? Math.min(fundAvailable, hybridLimit)
          : fundAvailable;
      const reserve = Number(finance.fund_reserve_floor ?? profile.funding_rules?.reserve_floor ?? 0);
      const shortfall = Decimal.max(approvedAmount.minus(available), 0);

      const previousStatus = current.status;
      current.benefit = {
        calculated_amount: benefitCalculation.calculated_amount,
        approved_amount: approvedAmount.toFixed(2),
        currency: benefitCalculation.currency,
        calculation_method: benefitCalculation.calculation_method,
        calculation_details: { ...benefitCalculation.calculation_details, ...(exGratia ? { ex_gratia: true, standard_entitlement: benefitCalculation.calculated_amount, reduction_percentage: 50 } : {}) },
        ex_gratia: exGratia
      };
      current.status = 'benefit_calculated';
      current.eligibility = { is_eligible: eligibility.is_eligible || exGratia, checked_at: new Date(), checked_by: userId, waiting_period_satisfied: eligibility.waiting_period_satisfied, contribution_status: eligibility.contribution_status, arrears_impact: exGratia ? 'ex_gratia_50_percent' : eligibility.arrears_impact, reasons: eligibility.reasons };
      current.case_money.funding_model = fundingModel;
      current.case_money.approved_benefit = mongoose.Types.Decimal128.fromString(approvedAmount.toFixed(2));
      current.case_money.fund_balance_before = mongoose.Types.Decimal128.fromString(Number(finance.welfare_fund_balance || 0).toFixed(2));
      current.case_money.reserve_floor = mongoose.Types.Decimal128.fromString(reserve.toFixed(2));
      current.case_money.surplus_shortfall = mongoose.Types.Decimal128.fromString(shortfall.toFixed(2));
      current.status_history.push({ from: previousStatus, to: 'benefit_calculated', changed_by: userId, changed_at: new Date() });
      await current.save();
      return current;
    } catch (error) {
      throw new Error(`Failed to calculate case benefit: ${error.message}`);
    }
  }

  /**
   * Submit committee vote for burial case
   */
  static async submitCommitteeVote(caseId, voteData, userId) {
    try {
      const burialCase = await BurialCase.findById(caseId);
      if (!burialCase) {
        throw new Error('Burial case not found');
      }

      const membership = await ChamaMembership.findOne({
        user_id: userId,
        chama_id: burialCase.chama_id,
        status: 'active'
      });

      if (!membership) {
        throw new Error('User is not a member of this chama');
      }
      if (!['chairperson', 'treasurer', 'secretary', 'committee_member'].includes(membership.role)) throw new Error('Only committee members may vote on burial cases');
      if (String(membership.user_id) === String(burialCase.member.user_id)) throw new Error('A member cannot vote on their own family claim');
      if (!['yes', 'no', 'abstain'].includes(voteData.vote)) throw new Error('Vote must be yes, no, or abstain');
      if (burialCase.status !== 'committee_review') throw new Error('Case is not open for committee voting');

      // Check if already voted
      const existingVote = burialCase.committee_review.votes.find(
        v => v.committee_member_id.toString() === membership._id.toString()
      );

      if (existingVote) {
        throw new Error('Member has already voted');
      }

      burialCase.committee_review.votes.push({
        committee_member_id: membership._id,
        vote: voteData.vote,
        comments: voteData.comments
      });

      const profile = await BurialChamaProfile.findById(burialCase.burial_chama_profile_id);
      const committeeRoles = profile?.committee_rules?.structure || [];
      const configuredCount = committeeRoles.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
      const committeeSize = configuredCount || await ChamaMembership.countDocuments({ chama_id: burialCase.chama_id, status: 'active', role: { $in: ['chairperson', 'treasurer', 'secretary', 'committee_member'] } });
      const quorumRule = profile?.committee_rules?.quorum_requirements || 'simple_majority';
      const quorumRatio = quorumRule === 'two_thirds' ? 2 / 3 : quorumRule === 'three_quarters' ? 3 / 4 : quorumRule === 'custom' ? (Number(profile?.committee_rules?.custom_quorum_percentage) || 50) / 100 : 0.5;
      const quorumMet = burialCase.committee_review.votes.length >= Math.ceil(committeeSize * quorumRatio);
      burialCase.committee_review.quorum_met = quorumMet;
      const totalVotes = burialCase.committee_review.votes.length;
      const yesVotes = burialCase.committee_review.votes.filter(v => v.vote === 'yes').length;
      const noVotes = burialCase.committee_review.votes.filter(v => v.vote === 'no').length;

      const threshold = profile?.committee_rules?.voting_method === 'unanimous' ? 1 : profile?.committee_rules?.voting_method === 'two_thirds' ? 2 / 3 : 0.5;
      if (quorumMet && yesVotes + noVotes > 0) {
        burialCase.committee_review.approved = yesVotes / (yesVotes + noVotes) >= threshold;
        if (burialCase.committee_review.approved) {
          const previousStatus = burialCase.status;
          burialCase.status = 'approved';
          burialCase.approved_by = userId;
          burialCase.approved_at = new Date();
          burialCase.status_history.push({ from: previousStatus, to: 'approved', changed_by: userId, changed_at: new Date() });
        }
      }

      await burialCase.save();
      if (burialCase.status === 'approved') {
        const profile = await BurialChamaProfile.findById(burialCase.burial_chama_profile_id);
        await this.createCaseLevyObligations(burialCase, profile);
      }
      return burialCase;
    } catch (error) {
      throw new Error(`Failed to submit committee vote: ${error.message}`);
    }
  }

  /**
   * Request penalty waiver
   */
  static async requestPenaltyWaiver(waiverData, userId) {
    try {
      const waiver = new PenaltyWaiver({
        ...waiverData,
        approval: {
          ...waiverData.approval,
          requested_by: userId,
          requested_at: new Date()
        },
        created_by: userId
      });

      await waiver.save();
      return waiver;
    } catch (error) {
      throw new Error(`Failed to request penalty waiver: ${error.message}`);
    }
  }

  /**
   * Approve penalty waiver
   */
  static async approvePenaltyWaiver(waiverId, chamaId, approvalData, userId) {
    try {
      const waiver = await PenaltyWaiver.findOne({ _id: waiverId, chama_id: chamaId });
      if (!waiver) {
        throw new Error('Penalty waiver not found');
      }

      if (waiver.approval.status !== 'pending') {
        throw new Error('Waiver is not in pending status');
      }
      if (!['approved', 'rejected'].includes(approvalData.status)) {
        throw new Error('Waiver decision must be approved or rejected');
      }
      if (approvalData.status === 'rejected' && !String(approvalData.rejection_reason || '').trim()) {
        throw new Error('A reason is required when declining a waiver');
      }

      let obligation = null;
      let updatedExpected = null;
      let updatedObligationStatus = null;
      if (approvalData.status === 'approved') {
        obligation = await ContributionObligation.findOne({ _id: waiver.obligation_id, owner_type: 'Chama', owner_id: chamaId });
        if (!obligation) throw new Error('The contribution penalty linked to this waiver could not be found');
        const requestedWaiver = new Decimal(waiver.waiver?.waived_amount?.toString?.() || waiver.waiver?.waived_amount || 0);
        const currentExpected = new Decimal(obligation.expected_amount?.toString?.() || obligation.expected_amount || 0);
        const alreadyPaid = new Decimal(obligation.paid_amount?.toString?.() || obligation.paid_amount || 0);
        const currentOutstanding = currentExpected.minus(alreadyPaid).max(0);
        if (!requestedWaiver.gt(0) || requestedWaiver.gt(currentOutstanding)) {
          throw new Error('The requested waiver exceeds the unpaid penalty balance');
        }
        updatedExpected = currentExpected.minus(requestedWaiver).toDecimalPlaces(2);
        updatedObligationStatus = updatedExpected.lte(alreadyPaid) ? (alreadyPaid.gt(0) ? 'paid' : 'cancelled') : obligation.status;
      }

      const updatedWaiver = await PenaltyWaiver.findOneAndUpdate(
        { _id: waiverId, chama_id: chamaId, 'approval.status': 'pending' },
        {
          'approval.status': approvalData.status,
          'approval.approved_by': userId,
          'approval.approved_at': new Date(),
          'approval.approval_role': approvalData.approval_role,
          'approval.rejection_reason': approvalData.status === 'rejected' ? String(approvalData.rejection_reason).trim().slice(0, 500) : null
        },
        { returnDocument: 'after' }
      );
      if (!updatedWaiver) throw new Error('Waiver was already decided by another official');

      if (approvalData.status === 'approved') {
        const expectedAmount = mongoose.Types.Decimal128.fromString(updatedExpected.toFixed(2));
        const waiverNote = `Penalty waiver ${waiver._id} approved: KES ${waiver.waiver.waived_amount.toString()} waived.`;
        const updatedObligation = await ContributionObligation.updateOne(
          { _id: obligation._id, owner_type: 'Chama', owner_id: chamaId, expected_amount: obligation.expected_amount, paid_amount: obligation.paid_amount },
          {
            $set: {
              expected_amount: expectedAmount,
              status: updatedObligationStatus,
              notes: `${obligation.notes || ''}${obligation.notes ? ' | ' : ''}${waiverNote}`.slice(-500)
            }
          }
        );
        if (!updatedObligation.modifiedCount) {
          await PenaltyWaiver.updateOne({ _id: waiver._id, 'approval.status': 'approved', 'approval.approved_by': userId }, { $set: { 'approval.status': 'pending', 'approval.approved_by': null, 'approval.approved_at': null, 'approval.approval_role': null } });
          throw new Error('The penalty balance changed during review. Refresh and review the current balance.');
        }
      }

      return updatedWaiver;
    } catch (error) {
      throw new Error(`Failed to approve penalty waiver: ${error.message}`);
    }
  }

  /**
   * Create meeting record
   */
  static async createMeetingRecord(meetingData, userId) {
    try {
      const profile = await BurialChamaProfile.findOne({ chama_id: meetingData.chama_id });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      // Generate meeting number
      const meetingNumber = await this.generateMeetingNumber(meetingData.chama_id);

      const meeting = new MeetingRecord({
        ...meetingData,
        meeting_number: meetingNumber,
        called_by: userId,
        created_by: userId
      });

      await meeting.save();
      return meeting;
    } catch (error) {
      throw new Error(`Failed to create meeting record: ${error.message}`);
    }
  }

  /**
   * Update member communication preferences
   */
  static async updateCommunicationPreferences(membershipId, preferencesData, userId) {
    try {
      let preferences;

      const existing = await MemberCommunicationPreferences.findOne({ membership_id: membershipId });

      if (existing) {
        preferences = await MemberCommunicationPreferences.findByIdAndUpdate(
          membershipId,
          {
            ...preferencesData,
            last_updated_by: userId,
            preferences_confirmed_at: new Date()
          },
          { returnDocument: 'after', runValidators: true }
        );
      } else {
        const membership = await ChamaMembership.findById(membershipId);
        if (!membership) {
          throw new Error('Membership not found');
        }

        preferences = new MemberCommunicationPreferences({
          membership_id: membershipId,
          chama_id: membership.chama_id,
          user_id: membership.user_id,
          ...preferencesData,
          last_updated_by: userId,
          preferences_confirmed_at: new Date()
        });

        await preferences.save();
      }

      return preferences;
    } catch (error) {
      throw new Error(`Failed to update communication preferences: ${error.message}`);
    }
  }

  /**
   * Get chama statistics
   */
  static async getChamaStatistics(chamaId) {
    try {
      const profile = await BurialChamaProfile.findOne({ chama_id: chamaId });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      const totalMembers = await ChamaMembership.countDocuments({
        chama_id: chamaId,
        status: 'active'
      });

      const totalBeneficiaries = await Beneficiary.countDocuments({
        chama_id: chamaId,
        eligibility_status: 'eligible'
      });

      const activeCases = await BurialCase.countDocuments({
        chama_id: chamaId,
        status: { $in: ['reported', 'under_review', 'verified', 'benefit_calculated', 'committee_review'] }
      });

      const completedCases = await BurialCase.countDocuments({
        chama_id: chamaId,
        status: 'closed'
      });

      const totalHouseholds = await Household.countDocuments({
        chama_id: chamaId,
        status: 'active'
      });

      return {
        total_members: totalMembers,
        total_beneficiaries: totalBeneficiaries,
        active_cases: activeCases,
        completed_cases: completedCases,
        total_households: totalHouseholds,
        membership_model: profile.membership_model,
        profile_status: profile.status
      };
    } catch (error) {
      throw new Error(`Failed to get chama statistics: ${error.message}`);
    }
  }

  static async assignMembershipClass(chamaId, membershipId, className, assignedByMembershipId) {
    const profile = await BurialChamaProfile.findOne({ chama_id: chamaId }).select('membership_classes');
    if (!profile) throw new Error('Burial chama profile not found');
    const targetClass = (profile.membership_classes || []).find(
      (item) => item.is_active !== false && item.name.toLowerCase() === String(className || '').trim().toLowerCase()
    );
    if (!targetClass) throw new Error('Choose an active membership class configured for this chama');
    const membership = await ChamaMembership.findOneAndUpdate(
      { _id: membershipId, chama_id: chamaId },
      { $set: { burial_membership_class: targetClass.name.toLowerCase(), burial_class_assigned_at: new Date(), burial_class_assigned_by: assignedByMembershipId } },
      { new: true, runValidators: true }
    );
    if (!membership) throw new Error('Membership not found in this burial chama');
    return membership;
  }

  /**
   * Helper: Generate case number
   */
  static async generateCaseNumber(chamaId) {
    const count = await BurialCase.countDocuments({ chama_id: chamaId });
    const year = new Date().getFullYear();
    return `BC-${chamaId.toString().slice(-4)}-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Helper: Generate meeting number
   */
  static async generateMeetingNumber(chamaId) {
    const count = await MeetingRecord.countDocuments({ chama_id: chamaId });
    const year = new Date().getFullYear();
    return `MT-${chamaId.toString().slice(-4)}-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

export default BurialChamaService;
