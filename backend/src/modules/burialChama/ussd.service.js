import UssdSession from '../../models/UssdSession.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import User from '../../models/User.js';
import BurialChamaProfile from '../../models/BurialChamaProfile.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import MemberStatementService from './memberStatement.service.js';
import MemberCommunicationPreferences from '../../models/MemberCommunicationPreferences.js';
import { Decimal } from 'decimal.js';

// ======================================================
// USSD SERVICE
// ======================================================
// This service handles USSD interactions for rural members
// without smartphones, enabling account registration,
// contribution payments, and account management.
// ======================================================

class UssdService {
  /**
   * Initialize USSD session
   */
  static async initializeSession(phoneNumber, sessionId, networkInfo = {}) {
    try {
      // Check if session already exists
      let session = await UssdSession.findOne({ session_id: sessionId });
      
      if (session) {
        // Update last activity
        session.last_activity_at = new Date();
        await session.save();
        return session;
      }

      // Find user by phone number
      const user = await User.findOne({ phone: phoneNumber });
      
      // Create new session
      session = new UssdSession({
        session_id: sessionId,
        phone_number: phoneNumber,
        user_id: user?._id || null,
        language: 'sw', // Default to Swahili
        status: 'active',
        network_info,
        session_type: user ? 'login' : 'registration'
      });

      await session.save();
      return session;
    } catch (error) {
      throw new Error(`Failed to initialize USSD session: ${error.message}`);
    }
  }

  /**
   * Process USSD request
   */
  static async processRequest(sessionId, user_input) {
    try {
      const session = await UssdSession.findOne({ session_id: sessionId });
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Check for timeout
      if (session.status === 'timeout') {
        return this.getTimeoutResponse(session.language);
      }

      // Add to navigation history
      session.navigation_history.push({
        menu: session.current_menu,
        user_input,
        timestamp: new Date()
      });

      // Process based on current menu
      const response = await this.processMenu(session, user_input);

      // Update session
      session.last_activity_at = new Date();
      await session.save();

      return response;
    } catch (error) {
      throw new Error(`Failed to process USSD request: ${error.message}`);
    }
  }

  /**
   * Process menu based on current state
   */
  static async processMenu(session, user_input) {
    const lang = session.language;

    switch (session.current_menu) {
      case 'main':
        return this.processMainMenu(session, user_input);
      
      case 'login':
        return this.processLogin(session, user_input);
      
      case 'registration':
        return this.processRegistration(session, user_input);
      
      case 'account':
        return this.processAccountMenu(session, user_input);
      
      case 'contributions':
        return this.processContributionsMenu(session, user_input);
      
      case 'payment':
        return this.processPaymentMenu(session, user_input);
      
      case 'benefits':
        return this.processBenefitsMenu(session, user_input);
      
      case 'beneficiaries':
        return this.processBeneficiariesMenu(session, user_input);
      
      case 'statement':
        return this.processStatementMenu(session, user_input);
      
      case 'help':
        return this.processHelpMenu(session, user_input);
      
      default:
        return this.getMainMenu(session);
    }
  }

  /**
   * Process main menu
   */
  static async processMainMenu(session, user_input) {
    const lang = session.language;

    if (!session.user_id) {
      // New user - go to registration
      session.current_menu = 'registration';
      session.session_type = 'registration';
      await session.save();
      return this.getRegistrationMenu(session);
    }

    // Existing user - show main menu
    switch (user_input) {
      case '1':
        session.current_menu = 'account';
        return this.getAccountMenu(session);
      
      case '2':
        session.current_menu = 'contributions';
        return this.getContributionsMenu(session);
      
      case '3':
        session.current_menu = 'payment';
        return this.getPaymentMenu(session);
      
      case '4':
        session.current_menu = 'benefits';
        return this.getBenefitsMenu(session);
      
      case '5':
        session.current_menu = 'beneficiaries';
        return this.getBeneficiariesMenu(session);
      
      case '6':
        session.current_menu = 'statement';
        return this.getStatementMenu(session);
      
      case '7':
        session.current_menu = 'help';
        return this.getHelpMenu(session);
      
      case '0':
        session.status = 'completed';
        await session.save();
        return this.getEndSessionResponse(lang);
      
      default:
        return this.getMainMenu(session);
    }
  }

  /**
   * Process login
   */
  static async processLogin(session, user_input) {
    const lang = session.language;
    
    // For simplicity, we'll use phone-based authentication
    // In production, this would use PIN or OTP
    const user = await User.findOne({ phone: session.phone_number });
    
    if (user) {
      session.user_id = user._id;
      session.current_menu = 'main';
      await session.save();
      return this.getMainMenu(session);
    } else {
      session.current_menu = 'registration';
      session.session_type = 'registration';
      await session.save();
      return this.getRegistrationMenu(session);
    }
  }

  /**
   * Process registration
   */
  static async processRegistration(session, user_input) {
    const lang = session.language;
    
    // Simplified registration flow
    // In production, this would be multi-step with validation
    
    if (!session.session_data.name) {
      session.session_data.name = user_input;
      session.session_data.step = 'id';
      await session.save();
      return {
        text: lang === 'sw' 
          ? 'Weka Namba yako ya Kitaifa (ID):' 
          : 'Enter your National ID Number:',
        requires_input: true
      };
    }
    
    if (!session.session_data.national_id) {
      session.session_data.national_id = user_input;
      session.session_data.step = 'complete';
      await session.save();
      
      // Create user (simplified)
      const user = new User({
        phone: session.phone_number,
        first_name: session.session_data.name.split(' ')[0],
        last_name: session.session_data.name.split(' ').slice(1).join(' ') || 'User',
        national_id: session.session_data.national_id
      });
      
      await user.save();
      
      session.user_id = user._id;
      session.current_menu = 'main';
      session.session_type = 'login';
      await session.save();
      
      return {
        text: lang === 'sw'
          ? 'Akaunti yako imewekwa vizuri. Karibu kwenye Vericircle!'
          : 'Your account has been created successfully. Welcome to Vericircle!',
        requires_input: false
      };
    }
    
    return this.getMainMenu(session);
  }

  /**
   * Process account menu
   */
  static async processAccountMenu(session, user_input) {
    const lang = session.language;
    
    switch (user_input) {
      case '1':
        return this.getAccountDetails(session);
      
      case '2':
        return this.getCommunicationPreferences(session);
      
      case '0':
        session.current_menu = 'main';
        await session.save();
        return this.getMainMenu(session);
      
      default:
        return this.getAccountMenu(session);
    }
  }

  /**
   * Process contributions menu
   */
  static async processContributionsMenu(session, user_input) {
    const lang = session.language;
    
    switch (user_input) {
      case '1':
        return this.getContributionHistory(session);
      
      case '2':
        return this.getArrearsInfo(session);
      
      case '0':
        session.current_menu = 'main';
        await session.save();
        return this.getMainMenu(session);
      
      default:
        return this.getContributionsMenu(session);
    }
  }

  /**
   * Process payment menu
   */
  static async processPaymentMenu(session, user_input) {
    const lang = session.language;
    
    switch (user_input) {
      case '1':
        session.current_menu = 'payment_amount';
        return {
          text: lang === 'sw'
            ? 'Weka kiasi unachotaka kulipa:'
            : 'Enter amount you want to pay:',
          requires_input: true
        };
      
      case '2':
        return this.getOutstandingBalance(session);
      
      case '0':
        session.current_menu = 'main';
        await session.save();
        return this.getMainMenu(session);
      
      default:
        return this.getPaymentMenu(session);
    }
  }

  /**
   * Process benefits menu
   */
  static async processBenefitsMenu(session, user_input) {
    const lang = session.language;
    
    switch (user_input) {
      case '1':
        return this.getBenefitEligibility(session);
      
      case '2':
        return this.getFileClaimInstructions(session);
      
      case '0':
        session.current_menu = 'main';
        await session.save();
        return this.getMainMenu(session);
      
      default:
        return this.getBenefitsMenu(session);
    }
  }

  /**
   * Process beneficiaries menu
   */
  static async processBeneficiariesMenu(session, user_input) {
    const lang = session.language;
    
    switch (user_input) {
      case '1':
        return this.getBeneficiaryList(session);
      
      case '2':
        session.current_menu = 'add_beneficiary';
        return {
          text: lang === 'sw'
            ? 'Weka jina la mpokeaji mzazi:'
            : 'Enter beneficiary name:',
          requires_input: true
        };
      
      case '0':
        session.current_menu = 'main';
        await session.save();
        return this.getMainMenu(session);
      
      default:
        return this.getBeneficiariesMenu(session);
    }
  }

  /**
   * Process statement menu
   */
  static async processStatementMenu(session, user_input) {
    const lang = session.language;
    
    switch (user_input) {
      case '1':
        return this.getQuickStatement(session);
      
      case '2':
        return this.getDetailedStatement(session);
      
      case '0':
        session.current_menu = 'main';
        await session.save();
        return this.getMainMenu(session);
      
      default:
        return this.getStatementMenu(session);
    }
  }

  /**
   * Process help menu
   */
  static async processHelpMenu(session, user_input) {
    const lang = session.language;
    
    switch (user_input) {
      case '1':
        return this.getContactInfo(session);
      
      case '2':
        session.current_menu = 'main';
        await session.save();
        return this.getMainMenu(session);
      
      default:
        return this.getHelpMenu(session);
    }
  }

  // ======================================================
  // MENU RESPONSES
  // ======================================================

  static getMainMenu(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'VERICIRCLE BURIAL CHAMA\n\n' +
              '1. Akaunti Yangu\n' +
              '2. Mchango\n' +
              '3. Lipa\n' +
              '4. Faedha\n' +
              '5. Wapokeaji\n' +
              '6. Taarifa\n' +
              '7. Msaada\n\n' +
              '0. Ondoka',
        requires_input: true
      };
    } else {
      return {
        text: 'VERICIRCLE BURIAL CHAMA\n\n' +
              '1. My Account\n' +
              '2. Contributions\n' +
              '3. Pay\n' +
              '4. Benefits\n' +
              '5. Beneficiaries\n' +
              '6. Statement\n' +
              '7. Help\n\n' +
              '0. Exit',
        requires_input: true
      };
    }
  }

  static getRegistrationMenu(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'KUJIUNGA NA VERICIRCLE\n\n' +
              'Weka jina lako kamili:',
        requires_input: true
      };
    } else {
      return {
        text: 'JOIN VERICIRCLE\n\n' +
              'Enter your full name:',
        requires_input: true
      };
    }
  }

  static getAccountMenu(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'AKAUNTI YANGU\n\n' +
              '1. Maelezo ya Akaunti\n' +
              '2. Mapendelezo ya Mawasiliano\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'MY ACCOUNT\n\n' +
              '1. Account Details\n' +
              '2. Communication Preferences\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static getContributionsMenu(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'MCHANGO\n\n' +
              '1. Historia ya Mchango\n' +
              '2. Taarifa ya Malipo\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'CONTRIBUTIONS\n\n' +
              '1. Contribution History\n' +
              '2. Payment Information\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static getPaymentMenu(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'LIPA\n\n' +
              '1. Lipa Sasa\n' +
              '2. Angalia Salio\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'PAY\n\n' +
              '1. Pay Now\n' +
              '2. Check Balance\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static getBenefitsMenu(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'FAEDHA\n\n' +
              '1. Kuangalia Ustahiki\n' +
              '2. Jinsi ya Kuomba\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'BENEFITS\n\n' +
              '1. Check Eligibility\n' +
              '2. How to Claim\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static getBeneficiariesMenu(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'WAPOKEAJI\n\n' +
              '1. Orodha ya Wapokeaji\n' +
              '2. Ongeza Mpokeaji\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'BENEFICIARIES\n\n' +
              '1. Beneficiary List\n' +
              '2. Add Beneficiary\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static getStatementMenu(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'TAARIFA\n\n' +
              '1. Taarifa ya Haraka\n' +
              '2. Taarifa Kamili\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'STATEMENT\n\n' +
              '1. Quick Statement\n' +
              '2. Full Statement\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static getHelpMenu(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'MSAADA\n\n' +
              '1. Wasiliana Nasi\n' +
              '2. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'HELP\n\n' +
              '1. Contact Us\n' +
              '2. Back',
        requires_input: true
      };
    }
  }

  // ======================================================
  // DATA RETRIEVAL METHODS
  // ======================================================

  static async getAccountDetails(session) {
    const lang = session.language;
    const user = await User.findById(session.user_id);
    
    if (lang === 'sw') {
      return {
        text: `MAELEZO YA AKAUNTI\n\n` +
              `Jina: ${user.first_name} ${user.last_name}\n` +
              `Simu: ${user.phone}\n` +
              `Akaunti ID: ${user._id.toString().slice(-8)}\n\n` +
              `0. Nyuma`,
        requires_input: true
      };
    } else {
      return {
        text: `ACCOUNT DETAILS\n\n` +
              `Name: ${user.first_name} ${user.last_name}\n` +
              `Phone: ${user.phone}\n` +
              `Account ID: ${user._id.toString().slice(-8)}\n\n` +
              `0. Back`,
        requires_input: true
      };
    }
  }

  static async getCommunicationPreferences(session) {
    const lang = session.language;
    const user = await User.findById(session.user_id);
    const preferences = await MemberCommunicationPreferences.findOne({
      user_id: user._id
    });
    
    if (lang === 'sw') {
      return {
        text: `MAPENDELEZO YA MAWASILIANO\n\n` +
              `Lugha: ${preferences?.language || 'sw'}\n` +
              `Njia kuu: ${preferences?.channels?.sms?.preferred ? 'SMS' : 'App'}\n\n` +
              `0. Nyuma`,
        requires_input: true
      };
    } else {
      return {
        text: `COMMUNICATION PREFERENCES\n\n` +
              `Language: ${preferences?.language || 'en'}\n` +
              `Primary Channel: ${preferences?.channels?.sms?.preferred ? 'SMS' : 'App'}\n\n` +
              `0. Back`,
        requires_input: true
      };
    }
  }

  static async getContributionHistory(session) {
    const lang = session.language;
    const user = await User.findById(session.user_id);
    const membership = await ChamaMembership.findOne({ user_id: user._id });
    
    if (!membership) {
      return {
        text: lang === 'sw' ? 'Huna uanachama wa kikundi.' : 'You are not a member of any group.',
        requires_input: true
      };
    }

    const payments = await ContributionPayment.find({
      participant_type: 'ChamaMembership',
      participant_id: membership._id
    }).sort({ paid_at: -1 }).limit(5);

    let text = lang === 'sw' ? 'HISTORIA YA MCHANGO\n\n' : 'CONTRIBUTION HISTORY\n\n';
    
    payments.forEach((payment, index) => {
      text += `${index + 1}. ${payment.paid_at.toLocaleDateString()} - KES ${payment.amount}\n`;
    });

    text += '\n0. Nyuma';
    
    return {
      text,
      requires_input: true
    };
  }

  static async getArrearsInfo(session) {
    const lang = session.language;
    const user = await User.findById(session.user_id);
    const membership = await ChamaMembership.findOne({ user_id: user._id });
    
    if (!membership) {
      return {
        text: lang === 'sw' ? 'Huna uanachama wa kikundi.' : 'You are not a member of any group.',
        requires_input: true
      };
    }

    const obligations = await ContributionObligation.find({
      participant_type: 'ChamaMembership',
      participant_id: membership._id,
      status: { $in: ['pending', 'overdue'] }
    });

    let totalArrears = new Decimal(0);
    obligations.forEach(obligation => {
      const expected = new Decimal(obligation.expected_amount.toString());
      const paid = new Decimal(obligation.paid_amount.toString());
      totalArrears = totalArrears.plus(expected.minus(paid));
    });

    if (lang === 'sw') {
      return {
        text: `TAARIFA YA MALIPO\n\n` +
              `Baki ya Malipo: KES ${totalArrears.toString()}\n` +
              `Mihanga Yasilipwa: ${obligations.length}\n\n` +
              `0. Nyuma`,
        requires_input: true
      };
    } else {
      return {
        text: `PAYMENT INFORMATION\n\n` +
              `Outstanding Balance: KES ${totalArrears.toString()}\n` +
              `Missed Payments: ${obligations.length}\n\n` +
              `0. Back`,
        requires_input: true
      };
    }
  }

  static async getOutstandingBalance(session) {
    const lang = session.language;
    const user = await User.findById(session.user_id);
    const membership = await ChamaMembership.findOne({ user_id: user._id });
    
    if (!membership) {
      return {
        text: lang === 'sw' ? 'Huna uanachama wa kikundi.' : 'You are not a member of any group.',
        requires_input: true
      };
    }

    const balance = await MemberStatementService.getQuickBalance(membership._id, lang);
    
    return {
      text: balance.message + '\n\n0. Nyuma',
      requires_input: true
    };
  }

  static async getBenefitEligibility(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'USTAHILI WA FAEDHA\n\n' +
              'Kwa maelezo kuhusu ustahili wako wa faida, tafadhali wasiliana na ofisi au tembelea app ya Vericircle.\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'BENEFIT ELIGIBILITY\n\n' +
              'For information about your benefit eligibility, please contact the office or visit the Vericircle app.\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static getFileClaimInstructions(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'JINSI YA KUOMBA\n\n' +
              '1. Piga simu kwa ofisi mara moja\n' +
              '2. Wasilisha hatua ya kufariki\n' +
              '3. Wasilisha kitambulisho cha MPokeaji\n' +
              '4. Tengeneza kikao kamili\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'HOW TO CLAIM\n\n' +
              '1. Call the office immediately\n' +
              '2. Submit death certificate\n' +
              '3. Submit beneficiary ID\n' +
              '4. Schedule committee meeting\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static async getBeneficiaryList(session) {
    const lang = session.language;
    const user = await User.findById(session.user_id);
    const membership = await ChamaMembership.findOne({ user_id: user._id });
    
    // This would integrate with the Beneficiary model
    // For now, return placeholder
    
    if (lang === 'sw') {
      return {
        text: 'ORODHA YA WAPOKEAJI\n\n' +
              'Hamna wapokeaji waliosajiliwa.\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'BENEFICIARY LIST\n\n' +
              'No beneficiaries registered.\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static async getQuickStatement(session) {
    const lang = session.language;
    const user = await User.findById(session.user_id);
    const membership = await ChamaMembership.findOne({ user_id: user._id });
    
    if (!membership) {
      return {
        text: lang === 'sw' ? 'Huna uanachama wa kikundi.' : 'You are not a member of any group.',
        requires_input: true
      };
    }

    const balance = await MemberStatementService.getQuickBalance(membership._id, lang);
    
    return {
      text: balance.message + '\n\n0. Nyuma',
      requires_input: true
    };
  }

  static async getDetailedStatement(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'TAARIFA KAMILI\n\n' +
              'Kwa taarifa kamili, tafadhali tumia app ya Vericircle au wasiliana na ofisi.\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'FULL STATEMENT\n\n' +
              'For a full statement, please use the Vericircle app or contact the office.\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static getContactInfo(session) {
    const lang = session.language;
    
    if (lang === 'sw') {
      return {
        text: 'WASILIANA NASI\n\n' +
              'Simu: 0700-000-000\n' +
              'Barua pepe: support@vericircle.co.ke\n\n' +
              '0. Nyuma',
        requires_input: true
      };
    } else {
      return {
        text: 'CONTACT US\n\n' +
              'Phone: 0700-000-000\n' +
              'Email: support@vericircle.co.ke\n\n' +
              '0. Back',
        requires_input: true
      };
    }
  }

  static getTimeoutResponse(language) {
    if (language === 'sw') {
      return {
        text: 'Kipindi cha muda kimeisha. Tafadhali piga tena.',
        requires_input: false,
        end_session: true
      };
    } else {
      return {
        text: 'Session has timed out. Please dial again.',
        requires_input: false,
        end_session: true
      };
    }
  }

  static getEndSessionResponse(language) {
    if (language === 'sw') {
      return {
        text: 'Asante kwa kutumia Vericircle. Kwaheri!',
        requires_input: false,
        end_session: true
      };
    } else {
      return {
        text: 'Thank you for using Vericircle. Goodbye!',
        requires_input: false,
        end_session: true
      };
    }
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpiredSessions() {
    const timeoutThreshold = new Date(Date.now() - (3 * 60 * 1000)); // 3 minutes
    
    const result = await UssdSession.updateMany(
      {
        status: 'active',
        last_activity_at: { $lt: timeoutThreshold }
      },
      {
        status: 'timeout'
      }
    );

    return result.modifiedCount;
  }
}

export default UssdService;