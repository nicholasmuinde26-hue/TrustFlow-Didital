import notificationService from './notification.service.js';
import domainEventEmitter from './domainEvent.emitter.js';

// ========================================
// NOTIFICATION EVENT HANDLER
// ========================================
//
// Handles domain events and triggers notifications.
// This is a separate service to avoid circular dependencies.
//
// ========================================

class NotificationEventHandler {
  /**
   * Initialize event listeners for domain events
   */
  initializeEventListeners() {
    // Financial events
    domainEventEmitter.onDomainEvent('CONTRIBUTION_RECEIVED', this.handleContributionReceived.bind(this));
    domainEventEmitter.onDomainEvent('CONTRIBUTION_MISSED', this.handleContributionMissed.bind(this));
    domainEventEmitter.onDomainEvent('CONTRIBUTION_OVERDUE', this.handleContributionOverdue.bind(this));
    domainEventEmitter.onDomainEvent('LOAN_SUBMITTED', this.handleLoanSubmitted.bind(this));
    domainEventEmitter.onDomainEvent('LOAN_APPROVED', this.handleLoanApproved.bind(this));
    domainEventEmitter.onDomainEvent('LOAN_REJECTED', this.handleLoanRejected.bind(this));
    domainEventEmitter.onDomainEvent('LOAN_DISBURSED', this.handleLoanDisbursed.bind(this));
    domainEventEmitter.onDomainEvent('LOAN_REPAYMENT_RECEIVED', this.handleLoanRepaymentReceived.bind(this));
    domainEventEmitter.onDomainEvent('LOAN_REPAYMENT_OVERDUE', this.handleLoanRepaymentOverdue.bind(this));
    domainEventEmitter.onDomainEvent('WITHDRAWAL_REQUESTED', this.handleWithdrawalRequested.bind(this));
    domainEventEmitter.onDomainEvent('WITHDRAWAL_APPROVED', this.handleWithdrawalApproved.bind(this));
    domainEventEmitter.onDomainEvent('WITHDRAWAL_REJECTED', this.handleWithdrawalRejected.bind(this));
    domainEventEmitter.onDomainEvent('PAYMENT_FAILED', this.handlePaymentFailed.bind(this));
    domainEventEmitter.onDomainEvent('PAYMENT_REVERSED', this.handlePaymentReversed.bind(this));
    domainEventEmitter.onDomainEvent('PAYMENT_RECONCILED', this.handlePaymentReconciled.bind(this));

    // Membership events
    domainEventEmitter.onDomainEvent('MEMBER_JOINED', this.handleMemberJoined.bind(this));
    domainEventEmitter.onDomainEvent('MEMBER_INVITED', this.handleMemberInvited.bind(this));
    domainEventEmitter.onDomainEvent('INVITATION_ACCEPTED', this.handleInvitationAccepted.bind(this));
    domainEventEmitter.onDomainEvent('MEMBER_SUSPENDED', this.handleMemberSuspended.bind(this));
    domainEventEmitter.onDomainEvent('MEMBER_REINSTATED', this.handleMemberReinstated.bind(this));
    domainEventEmitter.onDomainEvent('MEMBER_REMOVED', this.handleMemberRemoved.bind(this));
    domainEventEmitter.onDomainEvent('ROLE_CHANGED', this.handleRoleChanged.bind(this));
    domainEventEmitter.onDomainEvent('MEMBER_PROFILE_UPDATED', this.handleMemberProfileUpdated.bind(this));

    // Governance events
    domainEventEmitter.onDomainEvent('MEETING_SCHEDULED', this.handleMeetingScheduled.bind(this));
    domainEventEmitter.onDomainEvent('MEETING_REMINDER', this.handleMeetingReminder.bind(this));
    domainEventEmitter.onDomainEvent('MEETING_STARTED', this.handleMeetingStarted.bind(this));
    domainEventEmitter.onDomainEvent('MINUTES_PUBLISHED', this.handleMinutesPublished.bind(this));
    domainEventEmitter.onDomainEvent('RESOLUTION_CREATED', this.handleResolutionCreated.bind(this));
    domainEventEmitter.onDomainEvent('RESOLUTION_APPROVED', this.handleResolutionApproved.bind(this));
    domainEventEmitter.onDomainEvent('RESOLUTION_REJECTED', this.handleResolutionRejected.bind(this));
    domainEventEmitter.onDomainEvent('ELECTION_OPENED', this.handleElectionOpened.bind(this));
    domainEventEmitter.onDomainEvent('ELECTION_COMPLETED', this.handleElectionCompleted.bind(this));
    domainEventEmitter.onDomainEvent('COMMITTEE_APPOINTED', this.handleCommitteeAppointed.bind(this));

    // Burial chama events
    domainEventEmitter.onDomainEvent('MEMBER_DECEASED_REPORTED', this.handleMemberDeceasedReported.bind(this));
    domainEventEmitter.onDomainEvent('BURIAL_CASE_OPENED', this.handleBurialCaseOpened.bind(this));
    domainEventEmitter.onDomainEvent('BENEFICIARY_CLAIM_SUBMITTED', this.handleBeneficiaryClaimSubmitted.bind(this));
    domainEventEmitter.onDomainEvent('CLAIM_REQUIRES_VERIFICATION', this.handleClaimRequiresVerification.bind(this));
    domainEventEmitter.onDomainEvent('CLAIM_APPROVED', this.handleClaimApproved.bind(this));
    domainEventEmitter.onDomainEvent('CLAIM_REJECTED', this.handleClaimRejected.bind(this));
    domainEventEmitter.onDomainEvent('BENEFIT_PAYMENT_APPROVED', this.handleBenefitPaymentApproved.bind(this));
    domainEventEmitter.onDomainEvent('BENEFIT_PAYMENT_DISBURSED', this.handleBenefitPaymentDisbursed.bind(this));
    domainEventEmitter.onDomainEvent('BURIAL_CONTRIBUTION_REQUIRED', this.handleBurialContributionRequired.bind(this));
    domainEventEmitter.onDomainEvent('EMERGENCY_CONTRIBUTION_OPENED', this.handleEmergencyContributionOpened.bind(this));

    // System events
    domainEventEmitter.onDomainEvent('MPESA_PAYMENT_SUCCESSFUL', this.handleMpesaPaymentSuccessful.bind(this));
    domainEventEmitter.onDomainEvent('MPESA_PAYMENT_FAILED', this.handleMpesaPaymentFailed.bind(this));
    domainEventEmitter.onDomainEvent('BANK_TRANSACTION_RECEIVED', this.handleBankTransactionReceived.bind(this));
    domainEventEmitter.onDomainEvent('RECONCILIATION_COMPLETED', this.handleReconciliationCompleted.bind(this));
    domainEventEmitter.onDomainEvent('SECURITY_ALERT', this.handleSecurityAlert.bind(this));
    domainEventEmitter.onDomainEvent('NEW_DEVICE_LOGIN', this.handleNewDeviceLogin.bind(this));
    domainEventEmitter.onDomainEvent('PASSWORD_CHANGED', this.handlePasswordChanged.bind(this));
    domainEventEmitter.onDomainEvent('ROLE_PERMISSION_CHANGED', this.handleRolePermissionChanged.bind(this));

    console.log('✅ Notification event listeners initialized');
  }

  // ========================================
  // FINANCIAL EVENT HANDLERS
  // ========================================

  async handleContributionReceived(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'CONTRIBUTION_RECEIVED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleContributionMissed(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'CONTRIBUTION_MISSED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleContributionOverdue(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'CONTRIBUTION_OVERDUE',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleLoanSubmitted(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'LOAN_SUBMITTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleLoanApproved(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'LOAN_APPROVED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleLoanRejected(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'LOAN_REJECTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleLoanDisbursed(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'LOAN_DISBURSED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleLoanRepaymentReceived(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'LOAN_REPAYMENT_RECEIVED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleLoanRepaymentOverdue(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'LOAN_REPAYMENT_OVERDUE',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleWithdrawalRequested(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'WITHDRAWAL_REQUESTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleWithdrawalApproved(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'WITHDRAWAL_APPROVED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleWithdrawalRejected(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'WITHDRAWAL_REJECTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handlePaymentFailed(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'PAYMENT_FAILED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handlePaymentReversed(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'PAYMENT_REVERSED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handlePaymentReconciled(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'PAYMENT_RECONCILED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  // ========================================
  // MEMBERSHIP EVENT HANDLERS
  // ========================================

  async handleMemberJoined(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEMBER_JOINED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleMemberInvited(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEMBER_INVITED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleInvitationAccepted(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'INVITATION_ACCEPTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleMemberSuspended(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEMBER_SUSPENDED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleMemberReinstated(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEMBER_REINSTATED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleMemberRemoved(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEMBER_REMOVED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleRoleChanged(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'ROLE_CHANGED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleMemberProfileUpdated(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEMBER_PROFILE_UPDATED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  // ========================================
  // GOVERNANCE EVENT HANDLERS
  // ========================================

  async handleMeetingScheduled(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEETING_SCHEDULED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleMeetingReminder(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEETING_REMINDER',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleMeetingStarted(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEETING_STARTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleMinutesPublished(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MINUTES_PUBLISHED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleResolutionCreated(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'RESOLUTION_CREATED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleResolutionApproved(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'RESOLUTION_APPROVED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleResolutionRejected(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'RESOLUTION_REJECTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleElectionOpened(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'ELECTION_OPENED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleElectionCompleted(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'ELECTION_COMPLETED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleCommitteeAppointed(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'COMMITTEE_APPOINTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  // ========================================
  // BURIAL CHAMA EVENT HANDLERS
  // ========================================

  async handleMemberDeceasedReported(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MEMBER_DECEASED_REPORTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleBurialCaseOpened(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'BURIAL_CASE_OPENED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleBeneficiaryClaimSubmitted(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'BENEFICIARY_CLAIM_SUBMITTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleClaimRequiresVerification(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'CLAIM_REQUIRES_VERIFICATION',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleClaimApproved(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'CLAIM_APPROVED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleClaimRejected(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'CLAIM_REJECTED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleBenefitPaymentApproved(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'BENEFIT_PAYMENT_APPROVED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleBenefitPaymentDisbursed(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'BENEFIT_PAYMENT_DISBURSED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleBurialContributionRequired(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'BURIAL_CONTRIBUTION_REQUIRED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleEmergencyContributionOpened(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'EMERGENCY_CONTRIBUTION_OPENED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  // ========================================
  // SYSTEM EVENT HANDLERS
  // ========================================

  async handleMpesaPaymentSuccessful(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MPESA_PAYMENT_SUCCESSFUL',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleMpesaPaymentFailed(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'MPESA_PAYMENT_FAILED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleBankTransactionReceived(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'BANK_TRANSACTION_RECEIVED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleReconciliationCompleted(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'RECONCILIATION_COMPLETED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleSecurityAlert(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'SECURITY_ALERT',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleNewDeviceLogin(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'NEW_DEVICE_LOGIN',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handlePasswordChanged(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'PASSWORD_CHANGED',
      chamaId: eventData.chamaId,
      eventData
    });
  }

  async handleRolePermissionChanged(eventData) {
    await notificationService.sendDomainEventNotification({
      domainEvent: 'ROLE_PERMISSION_CHANGED',
      chamaId: eventData.chamaId,
      eventData
    });
  }
}

// Create singleton instance
const notificationEventHandler = new NotificationEventHandler();

export default notificationEventHandler;