import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import BurialChamaProfile from '../../models/BurialChamaProfile.js';
import Beneficiary from '../../models/Beneficiary.js';
import BurialCase from '../../models/BurialCase.js';
import MemberCommunicationPreferences from '../../models/MemberCommunicationPreferences.js';
import { Decimal } from 'decimal.js';

// ======================================================
// MEMBER STATEMENT SERVICE
// ======================================================
// This service generates member statements in multiple formats
// for App, USSD, SMS, and PDF delivery.
// ======================================================

class MemberStatementService {
  /**
   * Generate comprehensive member statement
   */
  static async generateStatement(membershipId, options = {}) {
    try {
      const membership = await ChamaMembership.findById(membershipId)
        .populate('user_id')
        .populate('chama_id');

      if (!membership) {
        throw new Error('Membership not found');
      }

      const profile = await BurialChamaProfile.findOne({ 
        chama_id: membership.chama_id._id 
      });

      const preferences = await MemberCommunicationPreferences.findOne({
        membership_id: membershipId
      });

      // Get contribution history
      const contributionData = await this.getContributionHistory(membershipId, options);

      // Get burial cases involving this member
      const burialCases = await this.getMemberBurialCases(membershipId);

      // Get beneficiaries
      const beneficiaries = await Beneficiary.find({
        membership_id: membershipId,
        eligibility_status: 'eligible'
      });

      // Calculate summary statistics
      const summary = this.calculateSummary(contributionData, profile);

      // Build statement object
      const statement = {
        statement_info: {
          generated_at: new Date(),
          membership_id: membershipId,
          chama_id: membership.chama_id._id,
          chama_name: membership.chama_id.name,
          member_name: `${membership.user_id.first_name} ${membership.user_id.last_name}`,
          member_id: membership.user_id._id,
          period_start: options.period_start || new Date(new Date().setMonth(new Date().getMonth() - 6)),
          period_end: options.period_end || new Date()
        },
        membership_info: {
          joined_date: membership.joined_at,
          role: membership.role,
          status: membership.status,
          membership_class: this.getMembershipClass(membership, profile)
        },
        contribution_summary: summary,
        contribution_details: contributionData.obligations,
        payment_history: contributionData.payments,
        beneficiaries: beneficiaries.map(b => ({
          name: b.full_name,
          relationship: b.relationship,
          age: b.age,
          eligibility_status: b.eligibility_status
        })),
        burial_cases: burialCases.map(bc => ({
          case_number: bc.case_number,
          case_type: bc.case_type,
          deceased_name: bc.deceased.full_name,
          status: bc.status,
          benefit_amount: bc.benefit?.approved_amount || 'pending'
        })),
        communication_preferences: preferences ? {
          preferred_language: preferences.language,
          preferred_format: preferences.statements.preferred_format,
          channels: Object.keys(preferences.channels).filter(
            key => preferences.channels[key].enabled
          )
        } : null
      };

      return statement;
    } catch (error) {
      throw new Error(`Failed to generate statement: ${error.message}`);
    }
  }

  /**
   * Get contribution history for a member
   */
  static async getContributionHistory(membershipId, options = {}) {
    const periodStart = options.period_start || new Date(new Date().setMonth(new Date().getMonth() - 6));
    const periodEnd = options.period_end || new Date();

    const obligations = await ContributionObligation.find({
      participant_type: 'ChamaMembership',
      participant_id: membershipId,
      due_date: { $gte: periodStart, $lte: periodEnd }
    }).sort({ due_date: 1 });

    const payments = await ContributionPayment.find({
      participant_type: 'ChamaMembership',
      participant_id: membershipId,
      paid_at: { $gte: periodStart, $lte: periodEnd }
    }).sort({ paid_at: -1 });

    return {
      obligations: obligations.map(obligation => ({
        obligation_id: obligation._id,
        due_date: obligation.due_date,
        expected_amount: obligation.expected_amount.toString(),
        paid_amount: obligation.paid_amount.toString(),
        balance: new Decimal(obligation.expected_amount.toString())
          .minus(obligation.paid_amount.toString())
          .toString(),
        status: obligation.status,
        period_start: obligation.period_start,
        period_end: obligation.period_end
      })),
      payments: payments.map(payment => ({
        payment_id: payment._id,
        amount: payment.amount.toString(),
        payment_method: payment.payment_method,
        paid_at: payment.paid_at,
        status: payment.status,
        reference: payment.reference
      }))
    };
  }

  /**
   * Get burial cases for a member
   */
  static async getMemberBurialCases(membershipId) {
    return await BurialCase.find({
      'member.membership_id': membershipId
    }).sort({ createdAt: -1 }).limit(10);
  }

  /**
   * Calculate summary statistics
   */
  static calculateSummary(contributionData, profile) {
    let totalRequired = new Decimal(0);
    let totalPaid = new Decimal(0);
    let totalBalance = new Decimal(0);
    let overdueCount = 0;
    let paidCount = 0;
    let partialCount = 0;

    contributionData.obligations.forEach(obligation => {
      const expected = new Decimal(obligation.expected_amount);
      const paid = new Decimal(obligation.paid_amount);
      const balance = expected.minus(paid);

      totalRequired = totalRequired.plus(expected);
      totalPaid = totalPaid.plus(paid);
      totalBalance = totalBalance.plus(balance);

      if (obligation.status === 'paid') {
        paidCount++;
      } else if (obligation.status === 'partially_paid') {
        partialCount++;
      } else if (obligation.status === 'overdue') {
        overdueCount++;
      }
    });

    return {
      total_required: totalRequired.toString(),
      total_paid: totalPaid.toString(),
      outstanding_balance: totalBalance.toString(),
      payment_rate: totalRequired.gt(0) 
        ? totalPaid.div(totalRequired).times(100).toFixed(2) 
        : '0.00',
      total_obligations: contributionData.obligations.length,
      paid_count: paidCount,
      partial_count: partialCount,
      overdue_count: overdueCount,
      currency: 'KES'
    };
  }

  /**
   * Get membership class for a member
   */
  static getMembershipClass(membership, profile) {
    if (!profile || !profile.membership_classes) {
      return 'ordinary';
    }

    // Simple logic - could be enhanced with actual member class assignment
    return profile.membership_classes[0]?.name || 'ordinary';
  }

  /**
   * Format statement for App (JSON)
   */
  static formatForApp(statement) {
    return {
      format: 'app',
      data: statement,
      display_options: {
        show_charts: true,
        show_detailed_breakdown: true,
        show_projections: false
      }
    };
  }

  /**
   * Format statement for USSD (concise text)
   */
  static formatForUSSD(statement, language = 'sw') {
    const summary = statement.contribution_summary;
    const info = statement.statement_info;

    if (language === 'sw') {
      return {
        format: 'ussd',
        language: 'sw',
        text: `TAARIFA ZAKO\n` +
              `Jina: ${statement.membership_info.member_name}\n` +
              `Kundi: ${statement.statement_info.chama_name}\n` +
              `Kati: ${info.period_start.toLocaleDateString('sw-KE')} - ${info.period_end.toLocaleDateString('sw-KE')}\n\n` +
              `Jumla Inayohitajika: KES ${summary.total_required}\n` +
              `Imelipwa: KES ${summary.total_paid}\n` +
              `Baki: KES ${summary.outstanding_balance}\n` +
              `Kiwango: ${summary.payment_rate}%\n\n` +
              `Malipo: ${summary.paid_count}\n` +
              `Zilizosaa: ${summary.overdue_count}`,
        menu_options: [
          '1. Maelezo zaidi',
          '2. Historia ya malipo',
          '3. Wasiliana na ofisi'
        ]
      };
    } else {
      return {
        format: 'ussd',
        language: 'en',
        text: `YOUR STATEMENT\n` +
              `Name: ${statement.membership_info.member_name}\n` +
              `Chama: ${statement.statement_info.chama_name}\n` +
              `Period: ${info.period_start.toLocaleDateString()} - ${info.period_end.toLocaleDateString()}\n\n` +
              `Total Required: KES ${summary.total_required}\n` +
              `Paid: KES ${summary.total_paid}\n` +
              `Balance: KES ${summary.outstanding_balance}\n` +
              `Rate: ${summary.payment_rate}%\n\n` +
              `Paid: ${summary.paid_count}\n` +
              `Overdue: ${summary.overdue_count}`,
        menu_options: [
          '1. More details',
          '2. Payment history',
          '3. Contact office'
        ]
      };
    }
  }

  /**
   * Format statement for SMS (ultra-concise)
   */
  static formatForSMS(statement, language = 'sw') {
    const summary = statement.contribution_summary;
    const info = statement.statement_info;

    if (language === 'sw') {
      return {
        format: 'sms',
        language: 'sw',
        text: `${statement.statement_info.chama_name}: ${statement.membership_info.member_name}, ` +
              `KES ${summary.total_paid} imelipwa, ` +
              `Baki KES ${summary.outstanding_balance}, ` +
              `Kiwango ${summary.payment_rate}%. ` +
              `Malipo ${summary.paid_count}, Zilizosaa ${summary.overdue_count}.`,
        character_count: 0 // Will be calculated
      };
    } else {
      return {
        format: 'sms',
        language: 'en',
        text: `${statement.statement_info.chama_name}: ${statement.membership_info.member_name}, ` +
              `KES ${summary.total_paid} paid, ` +
              `Balance KES ${summary.outstanding_balance}, ` +
              `Rate ${summary.payment_rate}%. ` +
              `Paid ${summary.paid_count}, Overdue ${summary.overdue_count}.`,
        character_count: 0 // Will be calculated
      };
    }
  }

  /**
   * Format statement for PDF (structured data for PDF generation)
   */
  static formatForPDF(statement) {
    const summary = statement.contribution_summary;
    const info = statement.statement_info;

    return {
      format: 'pdf',
      template: 'member_statement',
      data: {
        header: {
          chama_name: statement.statement_info.chama_name,
          statement_title: 'MEMBER CONTRIBUTION STATEMENT',
          statement_date: info.generated_at.toLocaleDateString(),
          period: `${info.period_start.toLocaleDateString()} to ${info.period_end.toLocaleDateString()}`,
          statement_number: `STMT-${Date.now()}`
        },
        member_info: {
          name: statement.membership_info.member_name,
          membership_id: statement.statement_info.membership_id,
          role: statement.membership_info.role,
          joined_date: statement.membership_info.joined_date.toLocaleDateString(),
          status: statement.membership_info.status,
          membership_class: statement.membership_info.membership_class
        },
        summary: {
          total_required: `KES ${summary.total_required}`,
          total_paid: `KES ${summary.total_paid}`,
          outstanding_balance: `KES ${summary.outstanding_balance}`,
          payment_rate: `${summary.payment_rate}%`,
          total_obligations: summary.total_obligations,
          paid_count: summary.paid_count,
          partial_count: summary.partial_count,
          overdue_count: summary.overdue_count
        },
        contribution_table: {
          headers: ['Period', 'Due Date', 'Required', 'Paid', 'Balance', 'Status'],
          rows: statement.contribution_details.map(detail => [
            detail.period_start ? detail.period_start.toLocaleDateString() : 'N/A',
            detail.due_date.toLocaleDateString(),
            `KES ${detail.expected_amount}`,
            `KES ${detail.paid_amount}`,
            `KES ${detail.balance}`,
            detail.status.toUpperCase()
          ])
        },
        payment_history_table: {
          headers: ['Date', 'Amount', 'Method', 'Reference', 'Status'],
          rows: statement.payment_history.map(payment => [
            payment.paid_at.toLocaleDateString(),
            `KES ${payment.amount}`,
            payment.payment_method.toUpperCase(),
            payment.reference,
            payment.status.toUpperCase()
          ])
        },
        beneficiaries: statement.beneficiaries,
        burial_cases: statement.burial_cases,
        footer: {
          generated_by: 'Vericircle ChamaManager',
          page: '1 of 1'
        }
      }
    };
  }

  /**
   * Generate statement in requested format
   */
  static async generateFormattedStatement(membershipId, format, options = {}) {
    const statement = await this.generateStatement(membershipId, options);

    switch (format) {
      case 'app':
        return this.formatForApp(statement);
      case 'ussd':
        return this.formatForUSSD(statement, options.language || 'sw');
      case 'sms':
        return this.formatForSMS(statement, options.language || 'sw');
      case 'pdf':
        return this.formatForPDF(statement);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Get quick balance for USSD
   */
  static async getQuickBalance(membershipId, language = 'sw') {
    const contributionData = await this.getContributionHistory(membershipId, {
      period_start: new Date(new Date().setMonth(new Date().getMonth() - 3)),
      period_end: new Date()
    });

    const summary = this.calculateSummary(contributionData, null);

    if (language === 'sw') {
      return {
        balance: summary.outstanding_balance,
        paid: summary.total_paid,
        rate: summary.payment_rate,
        message: `Salio: KES ${summary.outstanding_balance}, Imelipwa: KES ${summary.total_paid}, Kiwango: ${summary.payment_rate}%`
      };
    } else {
      return {
        balance: summary.outstanding_balance,
        paid: summary.total_paid,
        rate: summary.payment_rate,
        message: `Balance: KES ${summary.outstanding_balance}, Paid: KES ${summary.total_paid}, Rate: ${summary.payment_rate}%`
      };
    }
  }
}

export default MemberStatementService;