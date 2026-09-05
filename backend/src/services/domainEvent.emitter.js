// ========================================
// DOMAIN EVENT EMITTER
// ========================================
//
// Event emitter for domain events in ChamaManager.
// This enables a decoupled architecture where business
// operations emit events that are handled by various
// services (notifications, audit logging, etc.)
//
// Architecture:
// Business Logic → Domain Event → Event Handlers
//
// ========================================

import { EventEmitter } from 'events';
import {
  DOMAIN_EVENTS
} from '../constants/notification.constants.js';

class DomainEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Allow many event listeners
  }

  /**
   * Emit a domain event
   */
  emitDomainEvent(eventName, eventData = {}) {
    console.log(`[Domain Event] ${eventName}:`, JSON.stringify(eventData));
    this.emit(eventName, eventData);
  }

  /**
   * Emit financial events
   */
  emitContributionReceived(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.CONTRIBUTION_RECEIVED, data);
  }

  emitContributionMissed(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.CONTRIBUTION_MISSED, data);
  }

  emitContributionOverdue(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.CONTRIBUTION_OVERDUE, data);
  }

  emitFineApplied(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.FINE_APPLIED, data);
  }

  emitFineWaived(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.FINE_WAIVED, data);
  }

  emitLoanSubmitted(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.LOAN_SUBMITTED, data);
  }

  emitLoanApproved(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.LOAN_APPROVED, data);
  }

  emitLoanRejected(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.LOAN_REJECTED, data);
  }

  emitLoanDisbursed(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.LOAN_DISBURSED, data);
  }

  emitLoanRepaymentReceived(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.LOAN_REPAYMENT_RECEIVED, data);
  }

  emitLoanRepaymentOverdue(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.LOAN_REPAYMENT_OVERDUE, data);
  }

  emitWithdrawalRequested(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.WITHDRAWAL_REQUESTED, data);
  }

  emitWithdrawalApproved(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.WITHDRAWAL_APPROVED, data);
  }

  emitWithdrawalRejected(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.WITHDRAWAL_REJECTED, data);
  }

  emitPaymentFailed(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.PAYMENT_FAILED, data);
  }

  emitPaymentReversed(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.PAYMENT_REVERSED, data);
  }

  emitPaymentReconciled(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.PAYMENT_RECONCILED, data);
  }

  /**
   * Emit membership events
   */
  emitMemberJoined(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEMBER_JOINED, data);
  }

  emitMemberInvited(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEMBER_INVITED, data);
  }

  emitInvitationAccepted(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.INVITATION_ACCEPTED, data);
  }

  emitMemberSuspended(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEMBER_SUSPENDED, data);
  }

  emitMemberReinstated(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEMBER_REINSTATED, data);
  }

  emitMemberRemoved(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEMBER_REMOVED, data);
  }

  emitRoleChanged(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.ROLE_CHANGED, data);
  }

  emitMemberProfileUpdated(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEMBER_PROFILE_UPDATED, data);
  }

  /**
   * Emit governance events
   */
  emitMeetingScheduled(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEETING_SCHEDULED, data);
  }

  emitMeetingReminder(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEETING_REMINDER, data);
  }

  emitMeetingStarted(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEETING_STARTED, data);
  }

  emitMinutesPublished(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MINUTES_PUBLISHED, data);
  }

  emitResolutionCreated(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.RESOLUTION_CREATED, data);
  }

  emitResolutionApproved(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.RESOLUTION_APPROVED, data);
  }

  emitResolutionRejected(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.RESOLUTION_REJECTED, data);
  }

  emitElectionOpened(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.ELECTION_OPENED, data);
  }

  emitElectionCompleted(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.ELECTION_COMPLETED, data);
  }

  emitCommitteeAppointed(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.COMMITTEE_APPOINTED, data);
  }

  /**
   * Emit burial chama events
   */
  emitMemberDeceasedReported(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MEMBER_DECEASED_REPORTED, data);
  }

  emitBurialCaseOpened(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.BURIAL_CASE_OPENED, data);
  }

  emitBeneficiaryClaimSubmitted(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.BENEFICIARY_CLAIM_SUBMITTED, data);
  }

  emitClaimRequiresVerification(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.CLAIM_REQUIRES_VERIFICATION, data);
  }

  emitClaimApproved(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.CLAIM_APPROVED, data);
  }

  emitClaimRejected(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.CLAIM_REJECTED, data);
  }

  emitBenefitPaymentApproved(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.BENEFIT_PAYMENT_APPROVED, data);
  }

  emitBenefitPaymentDisbursed(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.BENEFIT_PAYMENT_DISBURSED, data);
  }

  emitBurialContributionRequired(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.BURIAL_CONTRIBUTION_REQUIRED, data);
  }

  emitEmergencyContributionOpened(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.EMERGENCY_CONTRIBUTION_OPENED, data);
  }

  /**
   * Emit system events
   */
  emitMpesaPaymentSuccessful(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MPESA_PAYMENT_SUCCESSFUL, data);
  }

  emitMpesaPaymentFailed(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.MPESA_PAYMENT_FAILED, data);
  }

  emitBankTransactionReceived(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.BANK_TRANSACTION_RECEIVED, data);
  }

  emitReconciliationCompleted(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.RECONCILIATION_COMPLETED, data);
  }

  emitSecurityAlert(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.SECURITY_ALERT, data);
  }

  emitNewDeviceLogin(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.NEW_DEVICE_LOGIN, data);
  }

  emitPasswordChanged(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.PASSWORD_CHANGED, data);
  }

  emitRolePermissionChanged(data) {
    this.emitDomainEvent(DOMAIN_EVENTS.ROLE_PERMISSION_CHANGED, data);
  }

  /**
   * Generic event emitter for custom events
   */
  emitCustomEvent(eventName, eventData = {}) {
    this.emitDomainEvent(eventName, eventData);
  }

  /**
   * Subscribe to domain events
   */
  onDomainEvent(eventName, handler) {
    this.on(eventName, handler);
  }

  /**
   * Unsubscribe from domain events
   */
  offDomainEvent(eventName, handler) {
    this.off(eventName, handler);
  }

  /**
   * Subscribe to all events
   */
  onAllEvents(handler) {
    this.on('*', handler);
  }

  /**
   * Unsubscribe from all events
   */
  offAllEvents(handler) {
    this.off('*', handler);
  }

  /**
   * Get event statistics
   */
  getEventStatistics() {
    return {
      listenerCount: this.listenerCount('*'),
      eventNames: this.eventNames(),
      maxListeners: this.getMaxListeners()
    };
  }
}

// Create singleton instance
const domainEventEmitter = new DomainEventEmitter();

export default domainEventEmitter;