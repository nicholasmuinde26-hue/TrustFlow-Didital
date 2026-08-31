import crypto from "node:crypto";
import AppError from "../../utils/AppError.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ChamaProfile from "../../models/ChamaProfile.js";
import ChamaGoal from "../../models/ChamaGoal.js";
import ChamaLoan from "../../models/ChamaLoan.js";
import ChamaMemberKyc from "../../models/ChamaMemberKyc.js";
import ChamaMeetingRecord from "../../models/ChamaMeetingRecord.js";
import ChamaInvitation from "../../models/ChamaInvitation.js";

// officialRoles gates broad chama-management permissions (dashboard's
// "officials" widget, who can create invites/goals/meeting records —
// see official() in chamaOperations.controller.js and canManage()
// below). Deliberately NOT expanded to committee_member/patron: those
// roles are governance/voting and advisory respectively, not general
// management officials.
export const officialRoles = ["chairperson", "treasurer", "secretary"];
export const canManage = (membership) => officialRoles.includes(membership.role);
export const requireRole = (membership, roles) => { if (!roles.includes(membership.role)) throw new AppError("You do not have permission for this Chama action", 403); };

// Separate from officialRoles: this is every role assignOfficial() is
// allowed to hand out via PUT /officials/:membershipId, which is a
// distinct, broader concern from "who counts as an official" above —
// mirrors ALLOWED_ROLES in member.service.js's updateMemberRole (the
// Members-page role dropdown covers the same full role set).
export const ASSIGNABLE_ROLES = ["member", "chairperson", "treasurer", "secretary", "auditor", "committee_member", "patron"];

export async function dashboard(chamaId, membership) {
  const [profile, goals, loans, kyc, meetings, officials, members] = await Promise.all([
    ChamaProfile.findOne({ chama_id: chamaId }), ChamaGoal.find({ chama_id: chamaId, status: "active" }).sort({ createdAt: -1 }),
    ChamaLoan.find(canManage(membership) ? { chama_id: chamaId } : { chama_id: chamaId, membership_id: membership._id }).sort({ createdAt: -1 }), ChamaMemberKyc.findOne({ chama_id: chamaId, membership_id: membership._id }),
    ChamaMeetingRecord.find({ chama_id: chamaId }).sort({ createdAt: -1 }).limit(5), ChamaMembership.find({ chama_id: chamaId, status: "active", role: { $in: officialRoles } }).populate("user_id", "name phone"), ChamaMembership.find({ chama_id: chamaId, status: "active" }).populate("user_id", "name phone")
  ]);
  return { profile, goals, loans, kyc, meetings, officials, members, membership };
}
export async function getProfile(chamaId) {
  let profile = await ChamaProfile.findOne({ chama_id: chamaId });
  if (!profile) {
    profile = await ChamaProfile.findOneAndUpdate(
      { chama_id: chamaId },
      { $setOnInsert: { chama_id: chamaId, contribution_cycle: "monthly", fine_amount: 0 } },
      { upsert: true, new: true }
    );
  }
  return profile;
}

export async function updateProfile(chamaId, data) { return ChamaProfile.findOneAndUpdate({ chama_id: chamaId }, { $set: { ...data, chama_id: chamaId } }, { new: true, upsert: true, runValidators: true }); }
export async function assignOfficial(chamaId, membershipId, role) { if (!ASSIGNABLE_ROLES.includes(role)) throw new AppError(`Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}`, 400); const update = { role, ...(role === "patron" ? { payout_position: null } : {}) }; const member = await ChamaMembership.findOneAndUpdate({ _id: membershipId, chama_id: chamaId, status: "active" }, update, { new: true }); if (!member) throw new AppError("Active member not found", 404); return member; }
export async function createGoal(chamaId, userId, data) { if (!data.name || Number(data.target_amount) <= 0) throw new AppError("Goal name and target amount are required", 400); return ChamaGoal.create({ chama_id: chamaId, name: data.name, target_amount: data.target_amount, target_date: data.target_date || null, created_by: userId }); }
export async function submitKyc(chamaId, membershipId, data) { if (!data.id_number || !data.selfie_url || !data.id_document_url) throw new AppError("ID number, ID document URL, and selfie URL are required", 400); return ChamaMemberKyc.findOneAndUpdate({ chama_id: chamaId, membership_id: membershipId }, { $set: { id_number: data.id_number, selfie_url: data.selfie_url, id_document_url: data.id_document_url, status: "pending", reviewed_by: null, reviewed_at: null } }, { upsert: true, new: true, runValidators: true }); }
export async function reviewKyc(chamaId, membershipId, userId, status) { if (!["verified", "rejected"].includes(status)) throw new AppError("Invalid KYC review status", 400); const kyc = await ChamaMemberKyc.findOneAndUpdate({ chama_id: chamaId, membership_id: membershipId }, { status, reviewed_by: userId, reviewed_at: new Date() }, { new: true }); if (!kyc) throw new AppError("KYC submission not found", 404); return kyc; }
export async function createInvite(chamaId, userId, data) { const token = crypto.randomBytes(24).toString("hex"); const invitation = await ChamaInvitation.create({ chama_id: chamaId, phone: data.phone || null, role: data.role || "member", token, invited_by: userId, expires_at: new Date(Date.now() + 7 * 86400000) }); return { invitation, token, join_path: `/chamas/join?token=${token}` }; }

// ========================================
// PREVIEW INVITE (PUBLIC, UNAUTHENTICATED)
// ========================================
//
// Lets the join-link landing page show "You've been invited to join
// <Chama name>" BEFORE the visitor logs in or creates an account.
// Deliberately exposes only non-sensitive fields — no financial data,
// no member list.
//
// ========================================

export async function previewInvite(token) {
  const invite = await ChamaInvitation.findOne({ token })
    .populate("chama_id", "name status")
    .populate("invited_by", "name");

  if (!invite) {
    throw new AppError("This invite link is invalid", 404);
  }

  const expired = invite.expires_at.getTime() < Date.now();
  const chamaActive = invite.chama_id?.status === "active";

  return {
    valid: Boolean(!expired && chamaActive && invite.chama_id),
    expired,
    chama: invite.chama_id ? { id: invite.chama_id._id, name: invite.chama_id.name } : null,
    role: invite.role,
    invited_by: invite.invited_by ? { name: invite.invited_by.name } : null,
    expires_at: invite.expires_at,
  };
}

// ========================================
// ACCEPT INVITE -> REQUEST TO JOIN
// ========================================
//
// A join link may be shared with many people (it's not a one-time-use
// code — ChamaInvitation.phone is informational only, not enforced),
// so accepting it does NOT immediately grant membership. It creates a
// ChamaMembership with status "pending", which requireChamaMember
// rejects until the Treasurer or Chairperson approves it (see
// member.service.js updateMemberStatus / member.routes.js
// GET /:chamaId/members/join-requests).
//
// ========================================

export async function acceptInvite(token, userId) {
  const invite = await ChamaInvitation.findOne({ token, expires_at: { $gt: new Date() } });
  if (!invite) throw new AppError("This invite link is invalid or has expired", 404);

  const existing = await ChamaMembership.findOne({ chama_id: invite.chama_id, user_id: userId });

  if (existing && existing.status === "active") {
    throw new AppError("You are already a member of this Chama", 409);
  }
  if (existing && existing.status === "pending") {
    throw new AppError("Your request to join this Chama is already pending approval", 409);
  }

  const member = await ChamaMembership.findOneAndUpdate(
    { chama_id: invite.chama_id, user_id: userId },
    {
      $setOnInsert: { invited_by: invite.invited_by, joined_at: new Date() },
      $set: { role: invite.role, status: "pending", payout_position: null, accepted_at: null, removed_at: null, removed_by: null },
    },
    { upsert: true, new: true }
  );

  // Records that the link has been used at least once. Informational
  // only — does NOT invalidate the link for the next person, since a
  // Chairperson/Treasurer's join link is meant to be shared with the
  // whole prospective membership, not a single named invitee.
  invite.accepted_at = new Date();
  await invite.save();

  await member.populate("chama_id", "name");

  return member;
}

// ========================================
// MY PENDING JOIN REQUESTS
// ========================================
//
// Lets a user who requested to join a Chama (and then navigated away)
// check whether they're still waiting on approval.
//
// ========================================

export async function getMyPendingRequests(userId) {
  return ChamaMembership.find({ user_id: userId, status: "pending" })
    .populate("chama_id", "name")
    .sort({ createdAt: -1 });
}
// Loan application/approval/disbursement now live in modules/loans/*
// (loanApplication.service.js, loanApproval.service.js, loanDisbursement.service.js).
// `dashboard()` above still reads ChamaLoan directly for the command-center feed.
export async function createMeetingRecord(chamaId, userId, data) { if (!data.title) throw new AppError("Meeting title is required", 400); return ChamaMeetingRecord.create({ chama_id: chamaId, title: data.title, agenda: (data.agenda || []).map((text) => ({ text })), status: "live", created_by: userId }); }
export async function checkIn(chamaId, meetingId, membership) { const meeting = await ChamaMeetingRecord.findOne({ _id: meetingId, chama_id: chamaId, status: "live" }); if (!meeting) throw new AppError("Live meeting not found", 404); if (!meeting.attendance.some((item) => String(item.membership_id) === String(membership._id))) meeting.attendance.push({ membership_id: membership._id, checked_in_at: new Date(), check_in_code: crypto.randomUUID() }); await meeting.save(); return meeting; }
export async function vote(chamaId, meetingId, membership, voteIndex, option) { const meeting = await ChamaMeetingRecord.findOne({ _id: meetingId, chama_id: chamaId, status: "live" }); const vote = meeting?.votes?.[Number(voteIndex)]; if (!vote || !vote.options.includes(option)) throw new AppError("Vote or option not found", 404); if (vote.ballots.some((item) => String(item.membership_id) === String(membership._id))) throw new AppError("You have already voted", 409); vote.ballots.push({ membership_id: membership._id, option }); await meeting.save(); return meeting; }
export async function updateMeetingRecord(chamaId, meetingId, data) { const meeting = await ChamaMeetingRecord.findOne({ _id: meetingId, chama_id: chamaId }); if (!meeting) throw new AppError("Meeting record not found", 404); if (data.minutes !== undefined) meeting.minutes = data.minutes; if (data.new_vote?.question && Array.isArray(data.new_vote.options)) meeting.votes.push({ question: data.new_vote.question, options: data.new_vote.options, ballots: [] }); if (data.close) { meeting.status = "closed"; meeting.votes.forEach((vote) => { const totals = vote.ballots.reduce((all, ballot) => ({ ...all, [ballot.option]: (all[ballot.option] || 0) + 1 }), {}); vote.resolution = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] || "No votes cast"; }); } await meeting.save(); return meeting; }