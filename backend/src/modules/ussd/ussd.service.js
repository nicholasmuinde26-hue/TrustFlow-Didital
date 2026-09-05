import UssdSession from '../../models/UssdSession.js';
import User from '../../models/User.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import PlatformInquiry from '../../models/PlatformInquiry.js';
import phoneUtil from '../../utils/phone.js';
import { initiateSavingsDeposit } from '../chama/chamaFinance.service.js';
import { sumMoney, toDecimal } from '../../shared/decimal.js';

// ======================================================================
// GENERAL USSD MENU SERVICE
// ======================================================================
//
// Serves the main VeriCircle menu (standard, non-burial chamas):
//   1. My Chamas
//   2. Make a Contribution
//   3. Check Balance
//   4. Admin & Support
//   5. Register / Link Phone
//
// DESIGN NOTE — statelessness:
// Africa's Talking resends the FULL accumulated `text` string on every
// keypress (e.g. "1*2*500"), not just the latest key. Rather than trusting
// a server-side "current_menu" pointer (which is fragile against retried
// or out-of-order webhook deliveries), every screen here is re-derived
// from splitting `text` on '*' each request. This makes the handler
// naturally idempotent: replaying the same webhook twice produces the
// same screen. UssdSession is still written to, but purely as an audit
// trail (navigation_history) — it never drives routing decisions.
//
// MAX_CHAMAS_SHOWN keeps each list within a single USSD screen
// (~182 chars on most handsets); pagination ("0. More") can be added
// later if members regularly belong to more chamas than this.
// ======================================================================

const MAX_CHAMAS_SHOWN = 5;
const MAX_ISSUE_LENGTH = 140;

class UssdMenuService {
  /**
   * Entry point. Call this from the AT webhook controller.
   * @returns {{ message: string, endSession: boolean }}
   */
  static async handle({ sessionId, phoneNumber: rawPhone, text = '' }) {
    const levels = String(text || '')
      .split('*')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let phoneNumber;
    try {
      phoneNumber = phoneUtil.formatPhone(rawPhone);
    } catch {
      return this.end('Sorry, we could not read your phone number. Please try again.');
    }

    // Best-effort audit trail. Never blocks or alters the menu response.
    this.logInteraction({ sessionId, phoneNumber, levels }).catch((err) => {
      console.error('[ussd] failed to log interaction:', err.message);
    });

    const user = await User.findOne({ phone: phoneNumber }).lean();

    if (levels.length === 0) return this.mainMenu();

    switch (levels[0]) {
      case '1':
        return this.myChamas(user, levels);
      case '2':
        return this.makeContribution(user, phoneNumber, sessionId, levels);
      case '3':
        return this.checkBalance(user, levels);
      case '4':
        return this.adminSupport(user, levels);
      case '5':
        return this.registerLinkPhone(user, phoneNumber, levels);
      default:
        return this.invalid();
    }
  }

  // ------------------------------------------------------------------
  // RESPONSE HELPERS
  // ------------------------------------------------------------------

  static con(text) {
    return { message: text, endSession: false };
  }

  static end(text) {
    return { message: text, endSession: true };
  }

  static invalid() {
    return this.end('Invalid selection. Please dial again.');
  }

  static needsAccount() {
    return this.end(
      'This phone number is not linked to a VeriCircle account yet. ' +
        'Choose "5. Register / Link Phone" from the menu to get started.'
    );
  }

  static mainMenu() {
    return this.con(
      'Welcome to VeriCircle\n' +
        '1. My Chamas\n' +
        '2. Make a Contribution\n' +
        '3. Check Balance\n' +
        '4. Admin & Support\n' +
        '5. Register / Link Phone'
    );
  }

  static roleLabel(role) {
    return String(role || 'member')
      .replace(/_/g, ' ')
      .replace(/^./, (c) => c.toUpperCase());
  }

  // ------------------------------------------------------------------
  // SHARED LOOKUPS
  // ------------------------------------------------------------------

  static async activeMemberships(user) {
    if (!user) return [];
    return ChamaMembership.find({ user_id: user._id, status: 'active' })
      .sort({ joined_at: 1 })
      .limit(MAX_CHAMAS_SHOWN)
      .populate('chama_id', 'name monthly_savings')
      .lean();
  }

  static chamaListScreen(memberships, title) {
    const lines = memberships.map((m, i) => `${i + 1}. ${m.chama_id?.name || 'Chama'}`);
    return this.con(`${title}\n${lines.join('\n')}`);
  }

  static async getMemberBalanceSummary(membership) {
    const obligations = await ContributionObligation.find({
      participant_type: 'ChamaMembership',
      participant_id: membership._id,
    }).lean();

    const totalPaid = sumMoney(obligations.map((o) => o.paid_amount));
    return { totalPaid: totalPaid.toFixed(0) };
  }

  static async getNextDue(membership) {
    const obligation = await ContributionObligation.findOne({
      participant_type: 'ChamaMembership',
      participant_id: membership._id,
      status: { $in: ['pending', 'partially_paid', 'overdue'] },
    })
      .sort({ due_date: 1 })
      .lean();

    if (!obligation) return null;

    const outstanding = toDecimal(obligation.expected_amount).minus(toDecimal(obligation.paid_amount));
    return {
      amount: outstanding.toFixed(0),
      dueDate: new Date(obligation.due_date).toLocaleDateString('en-GB'),
    };
  }

  // ------------------------------------------------------------------
  // 1. MY CHAMAS
  // ------------------------------------------------------------------

  static async myChamas(user, levels) {
    if (!user) return this.needsAccount();

    const memberships = await this.activeMemberships(user);
    if (memberships.length === 0) return this.end('You are not yet a member of any chama.');

    if (levels.length === 1) return this.chamaListScreen(memberships, 'MY CHAMAS');

    const membership = memberships[Number(levels[1]) - 1];
    if (!membership) return this.invalid();

    const balance = await this.getMemberBalanceSummary(membership);
    const nextDue = await this.getNextDue(membership);

    return this.end(
      `${membership.chama_id?.name || 'Chama'}\n` +
        `Role: ${this.roleLabel(membership.role)}\n` +
        `Balance: KES ${balance.totalPaid}\n` +
        (nextDue ? `Next due: KES ${nextDue.amount} by ${nextDue.dueDate}` : 'No pending dues')
    );
  }

  // ------------------------------------------------------------------
  // 2. MAKE A CONTRIBUTION
  // ------------------------------------------------------------------

  static async makeContribution(user, phoneNumber, sessionId, levels) {
    if (!user) return this.needsAccount();

    const memberships = await this.activeMemberships(user);
    if (memberships.length === 0) return this.end('You are not yet a member of any chama.');

    if (levels.length === 1) {
      return this.chamaListScreen(memberships, 'MAKE A CONTRIBUTION\nSelect chama');
    }

    const membership = memberships[Number(levels[1]) - 1];
    if (!membership) return this.invalid();

    if (levels.length === 2) {
      return this.con(`Enter amount to contribute to ${membership.chama_id?.name || 'this chama'} (KES):`);
    }

    const amount = Number(levels[2]);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return this.end('Invalid amount. Please dial again and enter a whole number of KES.');
    }

    if (levels.length === 3) {
      return this.con(`Pay KES ${amount} to ${membership.chama_id?.name || 'this chama'}?\n1. Confirm\n2. Cancel`);
    }

    if (levels[3] === '2') return this.end('Contribution cancelled.');
    if (levels[3] !== '1') return this.invalid();

    try {
      const chama = await Chama.findById(membership.chama_id?._id || membership.chama_id).lean();
      // Stable idempotency key so a duplicate AT webhook delivery for this
      // exact screen doesn't trigger a second STK push.
      const idempotencyKey = `ussd-${sessionId}-${levels.join('-')}`;

      await initiateSavingsDeposit({
        chama,
        membership,
        userId: user._id,
        amount,
        phoneNumber,
        idempotencyKey,
      });
    } catch (err) {
      return this.end(`Sorry, we could not start the M-Pesa payment: ${err.message}`);
    }

    return this.end('Check your phone to enter your M-Pesa PIN and complete the payment.');
  }

  // ------------------------------------------------------------------
  // 3. CHECK BALANCE
  // ------------------------------------------------------------------

  static async checkBalance(user, levels) {
    if (!user) return this.needsAccount();

    const memberships = await this.activeMemberships(user);
    if (memberships.length === 0) return this.end('You are not yet a member of any chama.');

    if (levels.length === 1) return this.chamaListScreen(memberships, 'CHECK BALANCE\nSelect chama');

    const membership = memberships[Number(levels[1]) - 1];
    if (!membership) return this.invalid();

    const balance = await this.getMemberBalanceSummary(membership);
    const nextDue = await this.getNextDue(membership);

    return this.end(
      `${membership.chama_id?.name || 'Chama'}\n` +
        `Total contributed: KES ${balance.totalPaid}\n` +
        (nextDue ? `Outstanding: KES ${nextDue.amount} (due ${nextDue.dueDate})` : 'No outstanding balance')
    );
  }

  // ------------------------------------------------------------------
  // 4. ADMIN & SUPPORT
  // ------------------------------------------------------------------

  static async adminSupport(user, levels) {
    if (levels.length === 1) {
      return this.con('ADMIN & SUPPORT\n1. Report an issue\n2. Check inquiry status');
    }

    if (levels[1] === '1') return this.reportIssue(user, levels);
    if (levels[1] === '2') return this.inquiryStatus(user);
    return this.invalid();
  }

  static async reportIssue(user, levels) {
    if (levels.length === 2) return this.con(`Describe your issue (max ${MAX_ISSUE_LENGTH} characters):`);

    if (!user) return this.needsAccount();

    const membership = (await this.activeMemberships(user))[0];
    if (!membership) return this.end('You must be a member of a chama to report an issue.');

    // The free-text description may itself contain '*', so rejoin
    // everything after the menu path instead of trusting levels[2] alone.
    const message = levels.slice(2).join('*').slice(0, MAX_ISSUE_LENGTH);

    try {
      await PlatformInquiry.create({
        workspaceId: membership.chama_id?._id || membership.chama_id,
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
    } catch {
      return this.end('Sorry, we could not submit your issue right now. Please try again later.');
    }

    return this.end('Thank you. Your issue has been logged and our support team will follow up.');
  }

  static async inquiryStatus(user) {
    if (!user) return this.needsAccount();

    const inquiries = await PlatformInquiry.find({ submittedBy: user._id })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    if (inquiries.length === 0) return this.end('You have no recent support inquiries.');

    const lines = inquiries.map((q) => `${q.inquiryNumber}: ${q.status}`);
    return this.end(`YOUR RECENT INQUIRIES\n${lines.join('\n')}`);
  }

  // ------------------------------------------------------------------
  // 5. REGISTER / LINK PHONE
  // ------------------------------------------------------------------

  static async registerLinkPhone(user, phoneNumber, levels) {
    if (user) return this.end('This phone number is already linked to a VeriCircle account.');

    if (levels.length === 1) return this.con('Enter your National ID number or member code:');

    const idNumber = levels[1].trim();
    const existing = await User.findOne({ id_number: idNumber }).lean();

    if (levels.length === 2) {
      if (existing) return this.con('Account found for this ID.\n1. Link this phone\n2. Cancel');
      return this.con('Enter your full name:');
    }

    // levels.length === 3
    if (existing) {
      if (levels[2] === '1') {
        await User.updateOne({ _id: existing._id }, { phone: phoneNumber, isPhoneVerified: true });
        return this.end('Your phone number has been linked to your VeriCircle account.');
      }
      if (levels[2] === '2') return this.end('Registration cancelled.');
      return this.invalid();
    }

    const name = levels[2].trim();
    if (name.length < 2) return this.end('Invalid name. Please dial again.');

    try {
      await User.create({
        name,
        phone: phoneNumber,
        id_number: idNumber,
        status: 'active',
        isPhoneVerified: true,
      });
    } catch (err) {
      if (err.code === 11000) return this.end('An account with this phone number already exists.');
      return this.end('Sorry, registration could not be completed. Please try again later.');
    }

    return this.end('Your VeriCircle account has been created. Ask your Chama treasurer to add you as a member.');
  }

  // ------------------------------------------------------------------
  // AUDIT LOG (never drives routing — see design note above)
  // ------------------------------------------------------------------

  static async logInteraction({ sessionId, phoneNumber, levels }) {
    const screen = levels.join('*') || 'main';
    await UssdSession.findOneAndUpdate(
      { session_id: sessionId },
      {
        $setOnInsert: { session_id: sessionId, phone_number: phoneNumber, started_at: new Date() },
        $set: { phone_number: phoneNumber, current_menu: screen, last_activity_at: new Date() },
        $push: {
          navigation_history: {
            menu: screen,
            user_input: levels[levels.length - 1] || '',
            timestamp: new Date(),
          },
        },
      },
      { upsert: true }
    );
  }

  /**
   * Marks sessions inactive for longer than their timeout as 'timeout'.
   * Intended to be run periodically (see jobs/ussdSessionCleanup.job.js).
   */
  static async cleanupExpiredSessions() {
    const timeoutThreshold = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes
    const result = await UssdSession.updateMany(
      { status: 'active', last_activity_at: { $lt: timeoutThreshold } },
      { status: 'timeout' }
    );
    return result.modifiedCount;
  }
}

export default UssdMenuService;
