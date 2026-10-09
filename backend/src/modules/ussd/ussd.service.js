import bcrypt from 'bcryptjs';
import UssdSession from '../../models/UssdSession.js';
import User from '../../models/User.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import PlatformInquiry from '../../models/PlatformInquiry.js';
import Meeting from '../../models/Meeting.js';
import Beneficiary from '../../models/Beneficiary.js';
import BurialChamaProfile from '../../models/BurialChamaProfile.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import ChamaMeetingRecord from '../../models/ChamaMeetingRecord.js';
import Announcement from '../../models/Announcement.js';
import ChamaGoal from '../../models/ChamaGoal.js';
import phoneUtil from '../../utils/phone.js';
import { listPayablePlans, initiatePlanPayment } from './ussd.payments.js';
import { getMemberSavingsBalance } from '../savingsShareout/savingsShareout.service.js';
import { toDecimal } from '../../shared/decimal.js';
import { applyForLoan } from '../loans/Loanapplication.service.js';
import { getMemberLoanSummary } from '../loans/Loandashboard.service.js';
import { getCurrentPayout } from '../payout/payout.service.js';
import { isModuleEnabled } from '../../constants/workspaceModules.constants.js';
import { t, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './ussd.i18n.js';

// ======================================================================
// CHAMA-FIRST USSD MENU SERVICE  (v3)
// ======================================================================
//
// FLOW
//   dial -> PIN -> choose chama -> that chama's own menu
//
// The menu a member sees is decided by the chama they picked:
//
//   STANDARD chama                BURIAL chama
//   1. My account                 1. My account
//   2. Contribute                 2. Contribute          (welfare plans first)
//   3. Loans  (if module on)      3. Recent payments
//   4. Meetings & news            4. Beneficiaries
//   5. Goals & payout             5. Report death / claim
//   6. Support                    6. Support
//   7. Language                   7. Language
//
// Items are built per chama (see menuItemsFor) and the number the member
// presses indexes into THAT list, so a chama with Loans switched off simply
// has no Loans line. A member with exactly one chama skips the chama
// picker. An unknown number only sees "1. Register".
//
// PAYING: "Contribute" lists the chama's active contribution plans and pays
// through the same contribution product as the app (previewContributionPayment
// + paymentService.initiate), so savings, dues, fees, fines and burial
// welfare levies all go through one path and settle oldest-obligation-first.
// The plan's `behavior` - not USSD - decides how the money is treated.
//
// AUTHENTICATION, STATELESSNESS, AUDIT: unchanged from v2.
//   - 4-digit USSD PIN is always the first token of the accumulated text;
//     3 wrong attempts lock it for 30 minutes (atomic counter).
//   - every screen is re-derived from text.split('*'); the PIN is never
//     logged or routed on.
//   - loan applications, support tickets and claim notices are submit-once
//     per session so a retried webhook cannot duplicate them.
// ======================================================================

const MAX_CHAMAS_SHOWN = 5;
const MAX_CHAMA_NAME = 20;
const MAX_ISSUE_LENGTH = 140;
const MAX_LOAN_PURPOSE_LENGTH = 140;
const MAX_USSD_TEXT_LENGTH = 300;
const MAX_CONTRIBUTION_AMOUNT = 1_000_000;
const MAX_LOAN_AMOUNT = 10_000_000;
const MAX_LOAN_MONTHS = 120;
const MAX_NAME_LENGTH = 60;
const MAX_CON_LENGTH = 182; // handset screen limit for a continuing USSD screen
const SESSION_TIMEOUT_MS = 3 * 60 * 1000;

const PIN_LENGTH = 4;
const MAX_PIN_ATTEMPTS = 3;
const PIN_LOCKOUT_MINUTES = 30;
const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '1212',
]);

const OPEN_OBLIGATION_STATUSES = ['pending', 'partially_paid', 'overdue'];

const kes = (value) => {
  const n = Math.round(Number(value?.toString?.() ?? value ?? 0));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
const shortName = (name, lang) => String(name || t(lang, 'chama_default')).slice(0, MAX_CHAMA_NAME);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

class UssdMenuService {
  /**
   * Entry point. Called from the AT webhook controller.
   * @returns {{ message: string, endSession: boolean }}
   */
  static async handle({ sessionId, phoneNumber: rawPhone, text = '' }) {
    if (String(text || '').length > MAX_USSD_TEXT_LENGTH) {
      return this.end(t(DEFAULT_LANGUAGE, 'too_long'));
    }

    const levels = String(text || '')
      .split('*')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let phoneNumber;
    try {
      phoneNumber = phoneUtil.formatPhone(rawPhone);
    } catch {
      return this.end(t(DEFAULT_LANGUAGE, 'bad_phone'));
    }

    const user = await User.findOne({ phone: phoneNumber })
      .select('+ussd_pin +ussd_failed_pin_attempts +ussd_pin_locked_until')
      .lean();

    const lang = SUPPORTED_LANGUAGES.includes(user?.ussd_language) ? user.ussd_language : DEFAULT_LANGUAGE;
    const ctx = { lang, user: user || null, phoneNumber, sessionId };

    // A suspended/inactive account must not retain access merely because
    // the SIM is recognised.
    if (user && ['suspended', 'inactive'].includes(user.status)) {
      return this.end(t(lang, 'suspended'));
    }

    // Unknown number -> the only thing available is registration.
    if (!user) {
      this.audit(ctx, this.safePath(levels));
      return this.routeGuest(ctx, levels);
    }

    // Account without a PIN yet: force PIN setup before any menu.
    if (!user.ussd_pin) {
      this.audit(ctx, 'pin_setup');
      return this.setupPinFlow(ctx, levels);
    }

    if (levels.length === 0) {
      this.audit(ctx, 'pin_prompt');
      return this.con(t(lang, 'enter_pin'));
    }

    const pinCheck = await this.verifyPin(ctx, levels[0]);
    if (!pinCheck.ok) return pinCheck.response;

    // From here the PIN is dropped: it must never reach logs or routing.
    const menuLevels = levels.slice(1);
    this.audit(ctx, this.safePath(menuLevels));
    return this.routeMember(ctx, menuLevels);
  }

  // ------------------------------------------------------------------
  // ROUTING
  // ------------------------------------------------------------------

  static async routeGuest(ctx, levels) {
    if (levels.length === 0) return this.con(t(ctx.lang, 'reg_menu'));
    if (levels[0] === '1') return this.registerPhone(ctx, levels);
    return this.invalid(ctx);
  }

  /** Post-PIN: pick the chama (skipped when there is only one), then its menu. */
  static async routeMember(ctx, levels) {
    const { lang, user } = ctx;
    const memberships = await this.activeMemberships(user);

    if (memberships.length === 0) {
      if (levels.length === 0) return this.con(t(lang, 'zero_chama'));
      if (levels[0] === '1') return this.language(ctx, levels);
      return this.invalid(ctx);
    }

    let membership;
    let rest;
    if (memberships.length === 1) {
      membership = memberships[0];
      rest = levels;
    } else {
      if (levels.length === 0) return this.chamaListScreen(ctx, memberships, t(lang, 'select_your_chama'));
      membership = memberships[Number(levels[0]) - 1];
      if (!membership) return this.invalid(ctx);
      rest = levels.slice(1);
    }

    return this.chamaMenu(ctx, membership, rest);
  }

  /**
   * The menu lines for one chama, in order. This is the single place that
   * decides what each chama type offers.
   */
  static menuItemsFor(chama) {
    if (chama?.chama_type === 'burial') {
      return ['account', 'pay', 'payments', 'beneficiaries', 'claim', 'support', 'language'];
    }
    return [
      'account',
      'pay',
      ...(isModuleEnabled(chama, 'loans') ? ['loans'] : []),
      'news',
      'goals',
      'support',
      'language',
    ];
  }

  static async chamaMenu(ctx, membership, rest) {
    const { lang } = ctx;
    const items = this.menuItemsFor(membership.chama_id);

    if (rest.length === 0) {
      const lines = items.map((key, i) => `${i + 1}. ${t(lang, `item_${key}`)}`);
      return this.con(`${shortName(membership.chama_id?.name, lang)}\n${lines.join('\n')}`);
    }

    const key = items[Number(rest[0]) - 1];
    if (!key) return this.invalid(ctx);

    switch (key) {
      case 'account': return this.account(ctx, membership);
      case 'pay': return this.payContribution(ctx, membership, rest);
      case 'payments': return this.recentPayments(ctx, membership);
      case 'loans': return this.loans(ctx, membership, rest);
      case 'news': return this.meetingsAndNews(ctx, membership);
      case 'goals': return this.goalsAndPayout(ctx, this.chamaIdOf(membership));
      case 'beneficiaries': return this.beneficiaries(ctx, membership);
      case 'claim': return this.reportClaim(ctx, membership, rest);
      case 'support': return this.support(ctx, membership, rest);
      case 'language': return this.language(ctx, rest);
      default: return this.invalid(ctx);
    }
  }

  // ------------------------------------------------------------------
  // PIN SETUP / VERIFY
  // ------------------------------------------------------------------

  static isWellFormedPin(candidate) {
    return typeof candidate === 'string' && new RegExp(`^\\d{${PIN_LENGTH}}$`).test(candidate);
  }

  static async setupPinFlow(ctx, levels) {
    const { lang, user } = ctx;
    if (levels.length === 0) return this.con(t(lang, 'set_pin', { n: PIN_LENGTH }));

    const chosenPin = levels[0];
    if (!this.isWellFormedPin(chosenPin)) return this.end(t(lang, 'pin_invalid', { n: PIN_LENGTH }));
    if (WEAK_PINS.has(chosenPin)) return this.end(t(lang, 'pin_weak'));
    if (levels.length === 1) return this.con(t(lang, 'confirm_pin'));
    if (levels[1] !== chosenPin) return this.end(t(lang, 'pin_mismatch'));

    const hashed = await bcrypt.hash(chosenPin, 10);
    // Only set if still unset: a replayed final webhook must not overwrite a
    // PIN the member has since changed.
    await User.updateOne(
      { _id: user._id, $or: [{ ussd_pin: null }, { ussd_pin: { $exists: false } }] },
      { $set: { ussd_pin: hashed, ussd_pin_set_at: new Date(), ussd_failed_pin_attempts: 0, ussd_pin_locked_until: null } }
    );
    return this.end(t(lang, 'pin_set'));
  }

  /**
   * Verifies the PIN with a lockout after MAX_PIN_ATTEMPTS consecutive
   * failures. The failure counter is incremented atomically ($inc) so
   * parallel guesses cannot all read "0 attempts" and slip past the limit.
   */
  static async verifyPin(ctx, attempt) {
    const { lang, user } = ctx;

    if (user.ussd_pin_locked_until && new Date(user.ussd_pin_locked_until) > new Date()) {
      return { ok: false, response: this.end(t(lang, 'pin_locked', { m: PIN_LOCKOUT_MINUTES })) };
    }

    const matches = this.isWellFormedPin(attempt) && (await bcrypt.compare(attempt, user.ussd_pin));
    if (matches) {
      if (user.ussd_failed_pin_attempts) {
        await User.updateOne({ _id: user._id }, { $set: { ussd_failed_pin_attempts: 0, ussd_pin_locked_until: null } });
      }
      return { ok: true };
    }

    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { ussd_failed_pin_attempts: 1 } },
      { new: true }
    )
      .select('+ussd_failed_pin_attempts')
      .lean();

    const attempts = Number(updated?.ussd_failed_pin_attempts || 1);
    if (attempts >= MAX_PIN_ATTEMPTS) {
      await User.updateOne(
        { _id: user._id },
        { $set: { ussd_failed_pin_attempts: 0, ussd_pin_locked_until: new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60 * 1000) } }
      );
      return { ok: false, response: this.end(t(lang, 'pin_locked_now', { m: PIN_LOCKOUT_MINUTES })) };
    }

    return { ok: false, response: this.end(t(lang, 'pin_wrong', { n: MAX_PIN_ATTEMPTS - attempts })) };
  }

  // ------------------------------------------------------------------
  // RESPONSE HELPERS
  // ------------------------------------------------------------------

  static con(text) {
    let message = String(text);
    if (message.length > MAX_CON_LENGTH) {
      console.warn(`[ussd] screen exceeded ${MAX_CON_LENGTH} chars (${message.length}); truncating`);
      message = `${message.slice(0, MAX_CON_LENGTH - 1)}…`;
    }
    return { message, endSession: false };
  }

  static end(text) {
    return { message: String(text), endSession: true };
  }

  static invalid(ctx) {
    return this.end(t(ctx.lang, 'invalid'));
  }

  static needsAccount(ctx) {
    return this.end(t(ctx.lang, 'needs_account'));
  }

  static mainMenu(ctx) {
    return this.con(t(ctx.lang, 'menu_main'));
  }

  static roleLabel(role) {
    return String(role || 'member').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  // ------------------------------------------------------------------
  // SHARED LOOKUPS
  // ------------------------------------------------------------------

  /**
   * Active memberships with the chama fields the menu needs. `workspace_config`
   * and `chama_type` MUST be selected, or module gating (Loans on/off) reads
   * an empty config and wrongly falls back to the standard preset.
   */
  static async activeMemberships(user, { filter } = {}) {
    if (!user) return [];
    const rows = await ChamaMembership.find({ user_id: user._id, status: 'active' })
      .sort({ joined_at: 1 })
      .populate('chama_id', 'name monthly_savings chama_type workspace_config')
      .lean();
    const usable = rows.filter((m) => m.chama_id);
    return (filter ? usable.filter(filter) : usable).slice(0, MAX_CHAMAS_SHOWN);
  }

  static chamaListScreen(ctx, memberships, title) {
    const lines = memberships.map((m, i) => `${i + 1}. ${shortName(m.chama_id?.name, ctx.lang)}`);
    return this.con(`${title}\n${lines.join('\n')}`);
  }

  static chamaIdOf(membership) {
    return membership.chama_id?._id || membership.chama_id;
  }

  static async resolveChama(membership) {
    return Chama.findById(this.chamaIdOf(membership)).lean();
  }

  /**
   * Savings balance (savings plan, net of share-outs) plus dues position for
   * ONE membership in ONE chama.
   */
  static async getMemberPosition(membership) {
    const chamaId = this.chamaIdOf(membership);

    const savingsPlan = await ContributionPlan.findOne({ owner_type: 'Chama', owner_id: chamaId, system_key: 'savings' })
      .select('_id')
      .lean();
    const savings = savingsPlan ? toDecimal(await getMemberSavingsBalance(chamaId, savingsPlan._id, membership._id)) : toDecimal(0);

    const open = await ContributionObligation.find({
      owner_type: 'Chama',
      owner_id: chamaId,
      participant_type: 'ChamaMembership',
      participant_id: membership._id,
      status: { $in: OPEN_OBLIGATION_STATUSES },
    })
      .sort({ due_date: 1 })
      .limit(100)
      .lean();

    const now = new Date();
    let overdue = toDecimal(0);
    let nextDue = null;
    for (const o of open) {
      const owed = toDecimal(o.expected_amount).minus(toDecimal(o.paid_amount));
      if (owed.lte(0)) continue;
      if (new Date(o.due_date) < now) overdue = overdue.plus(owed);
      else if (!nextDue) nextDue = { amount: owed, dueDate: o.due_date };
    }

    return { savings: savings.lt(0) ? toDecimal(0) : savings, overdue, nextDue };
  }

  // ------------------------------------------------------------------
  // ACCOUNT  (both chama types)
  // ------------------------------------------------------------------

  /** Burial chamas: when does the member's waiting period end (fixed-days rule only). */
  static async waitingPeriodLine(ctx, membership) {
    const profile = await BurialChamaProfile.findOne({ chama_id: this.chamaIdOf(membership) })
      .select('waiting_period_rules')
      .lean();
    const rules = profile?.waiting_period_rules;
    if (!rules || rules.waiting_period_type !== 'fixed_days' || !(rules.waiting_period_days > 0) || !membership.joined_at) return null;

    const ends = new Date(new Date(membership.joined_at).getTime() + rules.waiting_period_days * 24 * 60 * 60 * 1000);
    return ends > new Date() ? t(ctx.lang, 'waiting_until', { d: fmtDate(ends) }) : t(ctx.lang, 'waiting_over');
  }

  static async account(ctx, membership) {
    const { lang } = ctx;
    const isBurial = membership.chama_id?.chama_type === 'burial';
    const pos = await this.getMemberPosition(membership);

    const lines = [shortName(membership.chama_id?.name, lang), t(lang, 'role', { v: this.roleLabel(membership.role) })];
    if (isBurial) {
      const waiting = await this.waitingPeriodLine(ctx, membership);
      if (waiting) lines.push(waiting);
    } else {
      lines.push(t(lang, 'savings_line', { v: kes(pos.savings) }));
    }
    if (pos.overdue.gt(0)) lines.push(t(lang, 'overdue_line', { v: kes(pos.overdue) }));
    lines.push(pos.nextDue ? t(lang, 'next_due', { a: kes(pos.nextDue.amount), d: fmtDate(pos.nextDue.dueDate) }) : t(lang, 'no_dues'));
    return this.end(lines.join('\n'));
  }

  static async recentPayments(ctx, membership) {
    const { lang } = ctx;
    const payments = await ContributionPayment.find({
      owner_type: 'Chama',
      owner_id: this.chamaIdOf(membership),
      participant_type: 'ChamaMembership',
      participant_id: membership._id,
      status: 'completed',
    })
      .sort({ paid_at: -1 })
      .limit(5)
      .select('amount paid_at')
      .lean();

    if (payments.length === 0) return this.end(t(lang, 'no_payments'));
    const lines = payments.map((p) => `${fmtDate(p.paid_at)}  KES ${kes(p.amount)}`);
    return this.end(`${t(lang, 't_payments')}\n${lines.join('\n')}`);
  }

  // ------------------------------------------------------------------
  // CONTRIBUTE  (any active plan: savings, dues, fees, fines, welfare)
  // ------------------------------------------------------------------

  static async payContribution(ctx, membership, rest) {
    const { lang, user, phoneNumber, sessionId } = ctx;
    // rest: [item, planIdx, amount, confirm]
    const chama = await this.resolveChama(membership);
    const plans = await listPayablePlans({ chama, membership, userId: user._id });
    if (plans.length === 0) return this.end(t(lang, 'no_plans'));

    if (rest.length === 1) {
      const lines = plans.map((p, i) => `${i + 1}. ${String(p.name).slice(0, 20)}${p.owing.gt(0) ? ` (${kes(p.owing)})` : ''}`);
      return this.con(`${t(lang, 'pay_which')}\n${lines.join('\n')}`);
    }

    const plan = plans[Number(rest[1]) - 1];
    if (!plan) return this.invalid(ctx);
    const name = String(plan.name).slice(0, 24);

    if (rest.length === 2) {
      return this.con(plan.owing.gt(0) ? t(lang, 'amount_for_owing', { name, o: kes(plan.owing) }) : t(lang, 'amount_for', { name }));
    }

    const amount = Number(rest[2]);
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_CONTRIBUTION_AMOUNT) return this.end(t(lang, 'bad_amount'));

    if (rest.length === 3) return this.con(t(lang, 'confirm_pay', { a: kes(amount), name }));
    if (rest[3] === '2') return this.end(t(lang, 'cancelled'));
    if (rest[3] !== '1') return this.invalid(ctx);

    try {
      // Same key for a duplicate delivery of this exact screen -> one STK push.
      await initiatePlanPayment({
        chama,
        membership,
        plan,
        amount,
        userId: user._id,
        phoneNumber,
        idempotencyKey: `ussd-${sessionId}-${plan._id}-${amount}`,
      });
    } catch (err) {
      // Plan paused / member not active / bad amount: AppError text is member-facing.
      if (err?.statusCode && err.statusCode < 500 && err.message) return this.end(String(err.message).slice(0, 160));
      console.error('[ussd] contribution payment failed:', err?.message);
      return this.end(t(lang, 'stk_failed'));
    }
    return this.end(t(lang, 'stk_sent'));
  }

  // ------------------------------------------------------------------
  // LOANS  (standard chamas with the Loans module on)
  // ------------------------------------------------------------------

  static async loans(ctx, membership, rest) {
    if (rest.length === 1) return this.con(t(ctx.lang, 'loans_menu'));
    if (rest[1] === '2') return this.loanStatus(ctx, membership);
    if (rest[1] === '1') return this.applyLoan(ctx, membership, rest);
    return this.invalid(ctx);
  }

  static async loanStatus(ctx, membership) {
    const { lang } = ctx;
    const chama = await this.resolveChama(membership);
    const summary = await getMemberLoanSummary({ chama, membership });

    if (!summary.active_loan) {
      return this.end(t(lang, 'no_loan', { l: kes(summary.loan_limit), a: kes(summary.available_borrowing_capacity) }));
    }

    const loan = summary.active_loan;
    const next = loan.next_payment
      ? t(lang, 'loan_next', { a: kes(loan.next_payment.amount), d: fmtDate(loan.next_payment.due_date) })
      : '';
    return this.end(
      t(lang, 'loan_status', { ref: loan.reference, s: this.roleLabel(loan.status), amt: kes(loan.amount), out: kes(loan.outstanding) }) + next
    );
  }

  static async applyLoan(ctx, membership, rest) {
    const { lang, user, phoneNumber, sessionId } = ctx;
    // rest: [item, '1', amount, purpose, months, confirm]
    if (rest.length === 2) return this.con(t(lang, 'loan_enter_amount'));

    const amount = Number(rest[2]);
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_LOAN_AMOUNT) return this.end(t(lang, 'bad_amount'));

    if (rest.length === 3) return this.con(t(lang, 'loan_enter_purpose', { n: MAX_LOAN_PURPOSE_LENGTH }));

    const purpose = rest[3].trim().slice(0, MAX_LOAN_PURPOSE_LENGTH);
    if (purpose.length < 3) return this.end(t(lang, 'loan_bad_purpose'));

    if (rest.length === 4) return this.con(t(lang, 'loan_enter_months'));

    const months = Number(rest[4]);
    if (!Number.isInteger(months) || months <= 0 || months > MAX_LOAN_MONTHS) return this.end(t(lang, 'loan_bad_months'));

    if (rest.length === 5) return this.con(t(lang, 'loan_confirm', { a: kes(amount), m: months }));
    if (rest[5] === '2') return this.end(t(lang, 'cancelled'));
    if (rest[5] !== '1') return this.invalid(ctx);

    // applyForLoan has no idempotency key, so guard against a retried webhook.
    if (!(await this.claimOnce(sessionId, phoneNumber, 'loan_submitted'))) return this.end(t(lang, 'already_done'));

    try {
      const chama = await this.resolveChama(membership);
      const loan = await applyForLoan({
        chama,
        membership,
        userId: user._id,
        applicantPhone: phoneNumber,
        data: { amount, purpose, repayment_period_months: months, repayment_frequency: 'monthly' },
      });
      return this.end(t(lang, 'loan_done', { ref: loan.reference, s: this.roleLabel(loan.status) }));
    } catch (err) {
      await this.releaseClaim(sessionId, 'loan_submitted');
      // AppError messages from the eligibility engine are member-facing
      // explanations (e.g. exceeds your loan limit) and safe to show.
      if (err?.statusCode && err.statusCode < 500 && err.message) return this.end(String(err.message).slice(0, 160));
      console.error('[ussd] loan application failed:', err?.message);
      return this.end(t(lang, 'loan_failed'));
    }
  }

  // ------------------------------------------------------------------
  // MEETINGS & NEWS / GOALS & PAYOUT  (standard chamas)
  // ------------------------------------------------------------------

  static async meetingsAndNews(ctx, membership) {
    const { lang } = ctx;
    const chamaId = this.chamaIdOf(membership);

    const [upcoming, live, announcements] = await Promise.all([
      Meeting.find({ workspace_id: chamaId, workspace_type: 'Chama', cancelled_at: null, starts_at: { $gte: new Date() } })
        .sort({ starts_at: 1 })
        .limit(2)
        .lean(),
      ChamaMeetingRecord.find({ chama_id: chamaId, status: 'live' }).sort({ createdAt: -1 }).limit(1).lean(),
      Announcement.find({ workspace_id: chamaId, workspace_type: 'chama', status: 'approved' })
        .sort({ is_pinned: -1, createdAt: -1 })
        .limit(2)
        .lean(),
    ]);

    if (!upcoming.length && !live.length && !announcements.length) return this.end(t(lang, 'news_none'));

    const blocks = [];
    if (upcoming.length || live.length) {
      const lines = live.map((m) => `* ${t(lang, 'live_now')}: ${String(m.title).slice(0, 28)}`);
      for (const m of upcoming) {
        const when = new Date(m.starts_at);
        const time = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
        lines.push(`${fmtDate(when)} ${time} ${String(m.title).slice(0, 28)}`);
      }
      blocks.push(`${t(lang, 't_upcoming')}\n${lines.join('\n')}`);
    }
    if (announcements.length) {
      blocks.push(`${t(lang, 't_announcements')}\n${announcements.map((a) => `- ${String(a.title || '').slice(0, 36)}`).join('\n')}`);
    }
    return this.end(blocks.join('\n'));
  }

  static async goalsAndPayout(ctx, chamaId) {
    const { lang } = ctx;
    const goals = await ChamaGoal.find({ chama_id: chamaId, status: 'active' }).limit(2).lean();
    const goalLines = goals.map((g) => `${String(g.name).slice(0, 25)}: ${kes(g.saved_amount)}/${kes(g.target_amount)}`);

    const payout = await getCurrentPayout(chamaId);
    const payoutLine = payout
      ? t(lang, 'next_payout', { n: payout.member_id?.user_id?.name || t(lang, 'tbd'), a: kes(payout.amount) })
      : t(lang, 'no_payout');

    return this.end((goalLines.length ? `${t(lang, 't_goals')}\n${goalLines.join('\n')}\n` : `${t(lang, 'no_goals')}\n`) + payoutLine);
  }

  // ------------------------------------------------------------------
  // BURIAL CHAMA: BENEFICIARIES + DEATH / CLAIM NOTICE
  // ------------------------------------------------------------------

  static async beneficiaries(ctx, membership) {
    const { lang } = ctx;
    const rows = await Beneficiary.find({
      membership_id: membership._id,
      chama_id: this.chamaIdOf(membership),
      effective_to: null,
    })
      .limit(5)
      .lean();

    if (rows.length === 0) return this.end(t(lang, 'no_beneficiaries'));
    const lines = rows.map((b, i) => {
      const name = b.full_name || [b.first_name, b.last_name].filter(Boolean).join(' ') || '-';
      return `${i + 1}. ${name.slice(0, 22)} (${this.roleLabel(b.relationship)})`;
    });
    return this.end(`${t(lang, 't_beneficiaries')}\n${lines.join('\n')}`);
  }

  /**
   * Lets a member tell the officials about a death. It raises a high-priority
   * inquiry for them; the BurialCase itself (documents, eligibility,
   * committee review, payout) is still opened by an official in the app.
   */
  static async reportClaim(ctx, membership, rest) {
    const { lang, user, sessionId, phoneNumber } = ctx;
    if (rest.length === 1) return this.con(t(lang, 'claim_prompt', { n: MAX_ISSUE_LENGTH }));

    const message = rest.slice(1).join('*').trim().slice(0, MAX_ISSUE_LENGTH);
    if (message.length < 3) return this.end(t(lang, 'claim_short'));

    if (!(await this.claimOnce(sessionId, phoneNumber, 'claim_submitted'))) return this.end(t(lang, 'claim_done'));

    try {
      await PlatformInquiry.create({
        workspaceId: this.chamaIdOf(membership),
        workspaceType: 'chama',
        workspaceName: membership.chama_id?.name || 'Chama',
        submittedBy: user._id,
        senderName: user.name || 'USSD Member',
        senderRole: membership.role,
        senderPhone: user.phone,
        subject: 'USSD: death notification / burial claim',
        category: 'governance_support',
        priority: 'high',
        message,
      });
    } catch (err) {
      await this.releaseClaim(sessionId, 'claim_submitted');
      console.error('[ussd] claim notice failed:', err?.message);
      return this.end(t(lang, 'claim_failed'));
    }
    return this.end(t(lang, 'claim_done'));
  }

  // ------------------------------------------------------------------
  // SUPPORT
  // ------------------------------------------------------------------

  static async support(ctx, membership, rest) {
    if (rest.length === 1) return this.con(t(ctx.lang, 'support_menu'));
    if (rest[1] === '1') return this.reportIssue(ctx, membership, rest);
    if (rest[1] === '2') return this.inquiryStatus(ctx);
    return this.invalid(ctx);
  }

  static async reportIssue(ctx, membership, rest) {
    const { lang, user, sessionId, phoneNumber } = ctx;
    if (rest.length === 2) return this.con(t(lang, 'describe_issue', { n: MAX_ISSUE_LENGTH }));

    // The free text may itself contain '*', so rejoin everything after the path.
    const message = rest.slice(2).join('*').trim().slice(0, MAX_ISSUE_LENGTH);
    if (message.length < 3) return this.end(t(lang, 'issue_short'));

    if (!(await this.claimOnce(sessionId, phoneNumber, 'issue_submitted'))) return this.end(t(lang, 'issue_done'));

    try {
      await PlatformInquiry.create({
        workspaceId: this.chamaIdOf(membership),
        workspaceType: 'chama',
        workspaceName: membership.chama_id?.name || 'Chama',
        submittedBy: user._id,
        senderName: user.name || 'USSD Member',
        senderRole: membership.role,
        senderPhone: user.phone,
        subject: 'USSD support request',
        category: 'technical_issue',
        priority: 'medium',
        message,
      });
    } catch (err) {
      await this.releaseClaim(sessionId, 'issue_submitted');
      console.error('[ussd] support inquiry failed:', err?.message);
      return this.end(t(lang, 'issue_failed'));
    }
    return this.end(t(lang, 'issue_done'));
  }

  static async inquiryStatus(ctx) {
    const { lang, user } = ctx;
    const inquiries = await PlatformInquiry.find({ submittedBy: user._id }).sort({ createdAt: -1 }).limit(3).lean();
    if (inquiries.length === 0) return this.end(t(lang, 'no_inquiries'));
    const lines = inquiries.map((q) => `${q.inquiryNumber}: ${this.roleLabel(String(q.status || '').toLowerCase())}`);
    return this.end(`${t(lang, 't_inquiries')}\n${lines.join('\n')}`);
  }

  // ------------------------------------------------------------------
  // REGISTER  (unknown numbers only)
  // ------------------------------------------------------------------

  static async registerPhone(ctx, levels) {
    const { lang, user, phoneNumber } = ctx;
    if (user) return this.end(t(lang, 'already_registered'));
    if (levels.length === 1) return this.con(t(lang, 'reg_id'));

    const idNumber = levels[1].trim();
    if (idNumber.length < 4 || idNumber.length > 30) return this.end(t(lang, 'reg_bad_id'));

    // An ID number is not proof of ownership: never let it attach a phone to
    // (or duplicate) an existing account from an unauthenticated session.
    const existing = await User.findOne({ id_number: idNumber }).select('_id').lean();
    if (existing) return this.end(t(lang, 'reg_id_taken'));

    if (levels.length === 2) return this.con(t(lang, 'reg_name'));

    const name = levels.slice(2).join(' ').trim();
    if (name.length < 2 || name.length > MAX_NAME_LENGTH) return this.end(t(lang, 'reg_bad_name'));

    try {
      await User.create({ name, phone: phoneNumber, id_number: idNumber, status: 'active', isPhoneVerified: true });
    } catch (err) {
      if (err.code === 11000) return this.end(t(lang, 'reg_exists'));
      console.error('[ussd] registration failed:', err?.message);
      return this.end(t(lang, 'reg_failed'));
    }
    return this.end(t(lang, 'reg_done'));
  }

  // ------------------------------------------------------------------
  // LANGUAGE / LUGHA
  // ------------------------------------------------------------------

  static async language(ctx, levels) {
    if (!ctx.user) return this.needsAccount(ctx);
    if (levels.length === 1) return this.con(t(ctx.lang, 'lang_menu'));

    const chosen = { 1: 'en', 2: 'sw' }[levels[1]];
    if (!chosen) return this.invalid(ctx);

    await User.updateOne({ _id: ctx.user._id }, { $set: { ussd_language: chosen } });
    return this.end(t(chosen, 'lang_set'));
  }

  // ------------------------------------------------------------------
  // AUDIT LOG + SESSION BOOKKEEPING
  // ------------------------------------------------------------------

  /**
   * Reduces menu levels to a log-safe path: only single-digit menu choices
   * survive; everything else (IDs, names, amounts, free text, PINs) is
   * masked. The PIN itself is stripped before this is called.
   */
  static safePath(levels) {
    if (!levels.length) return 'main';
    return levels.slice(0, 6).map((l) => (/^\d$/.test(l) ? l : '*')).join('*');
  }

  /** Fire-and-forget audit write; never blocks or alters the response. */
  static audit(ctx, screen) {
    this.logInteraction({ sessionId: ctx.sessionId, phoneNumber: ctx.phoneNumber, screen, userId: ctx.user?._id }).catch((err) => {
      console.error('[ussd] failed to log interaction:', err.message);
    });
  }

  static async logInteraction({ sessionId, phoneNumber, screen, userId = null }, retry = true) {
    try {
      await UssdSession.findOneAndUpdate(
        { session_id: sessionId },
        {
          $setOnInsert: { session_id: sessionId, started_at: new Date() },
          $set: { phone_number: phoneNumber, user_id: userId, current_menu: screen, last_activity_at: new Date(), status: 'active' },
          $push: { navigation_history: { $each: [{ menu: screen, user_input: '', timestamp: new Date() }], $slice: -30 } },
        },
        { upsert: true }
      );
    } catch (err) {
      // Two near-simultaneous first deliveries can both try to insert.
      if (err.code === 11000 && retry) return this.logInteraction({ sessionId, phoneNumber, screen, userId }, false);
      throw err;
    }
  }

  /**
   * Atomically claims a one-time action for this session. Returns true for
   * the first caller, false for any replay.
   */
  static async claimOnce(sessionId, phoneNumber, key) {
    try {
      const doc = await UssdSession.findOneAndUpdate(
        { session_id: sessionId, [`metadata.${key}`]: { $ne: true } },
        { $set: { [`metadata.${key}`]: true }, $setOnInsert: { phone_number: phoneNumber, started_at: new Date() } },
        { upsert: true, new: true }
      );
      return Boolean(doc);
    } catch (err) {
      if (err.code === 11000) return false; // existing session already holds the claim
      throw err;
    }
  }

  static async releaseClaim(sessionId, key) {
    await UssdSession.updateOne({ session_id: sessionId }, { $unset: { [`metadata.${key}`]: '' } }).catch(() => {});
  }

  static async cleanupExpiredSessions() {
    const threshold = new Date(Date.now() - SESSION_TIMEOUT_MS);
    const result = await UssdSession.updateMany({ status: 'active', last_activity_at: { $lt: threshold } }, { status: 'timeout' });
    return result.modifiedCount;
  }

  static async completeSession(sessionId) {
    await UssdSession.updateOne(
      { session_id: sessionId, status: 'active' },
      { $set: { status: 'completed', completed_at: new Date(), last_activity_at: new Date() } }
    );
  }
}

export default UssdMenuService;
