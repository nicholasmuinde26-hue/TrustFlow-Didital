// ========================================
// NOTIFICATION CONSTANTS
// ========================================
//
// Centralized notification types, categories,
// and routing rules for ChamaManager.
//
// This system implements three notification layers:
// 1. Toast notifications (instant, ephemeral)
// 2. In-app notifications (persistent notification center)
// 3. Action-required alerts (must be acted upon)
//
// ========================================

// ========================================
// NOTIFICATION CATEGORIES
// ========================================

export const NOTIFICATION_CATEGORIES = {
  FINANCIAL: 'financial',
  MEMBERSHIP: 'membership', 
  GOVERNANCE: 'governance',
  BURIAL: 'burial',
  SYSTEM: 'system',
  APPROVAL: 'approval',
  ALERT: 'alert'
};

// ========================================
// NOTIFICATION TYPES
// ========================================

export const NOTIFICATION_TYPES = {
  // ========================================
  // FINANCIAL NOTIFICATIONS
  // ========================================
  
  CONTRIBUTION_RECEIVED: {
    type: 'CONTRIBUTION_RECEIVED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '💰',
    title: 'Contribution received',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app', 'toast']
  },
  
  CONTRIBUTION_MISSED: {
    type: 'CONTRIBUTION_MISSED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '⚠️',
    title: 'Contribution missed',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  CONTRIBUTION_OVERDUE: {
    type: 'CONTRIBUTION_OVERDUE',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '🚨',
    title: 'Contribution overdue',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  FINE_APPLIED: {
    type: 'FINE_APPLIED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '📝',
    title: 'Fine applied',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  FINE_WAIVED: {
    type: 'FINE_WAIVED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '✅',
    title: 'Fine waived',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  LOAN_SUBMITTED: {
    type: 'LOAN_SUBMITTED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '📋',
    title: 'Loan application submitted',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app', 'toast']
  },
  
  LOAN_APPROVED: {
    type: 'LOAN_APPROVED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '✅',
    title: 'Loan approved',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  LOAN_REJECTED: {
    type: 'LOAN_REJECTED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '❌',
    title: 'Loan rejected',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  LOAN_DISBURSED: {
    type: 'LOAN_DISBURSED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '💰',
    title: 'Loan disbursed',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  LOAN_REPAYMENT_RECEIVED: {
    type: 'LOAN_REPAYMENT_RECEIVED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '💰',
    title: 'Loan repayment received',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  LOAN_REPAYMENT_OVERDUE: {
    type: 'LOAN_REPAYMENT_OVERDUE',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '🚨',
    title: 'Loan repayment overdue',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  WITHDRAWAL_REQUESTED: {
    type: 'WITHDRAWAL_REQUESTED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '📋',
    title: 'Withdrawal requested',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app']
  },
  
  WITHDRAWAL_APPROVED: {
    type: 'WITHDRAWAL_APPROVED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '✅',
    title: 'Withdrawal approved',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  WITHDRAWAL_REJECTED: {
    type: 'WITHDRAWAL_REJECTED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '❌',
    title: 'Withdrawal rejected',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  PAYMENT_FAILED: {
    type: 'PAYMENT_FAILED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '❌',
    title: 'Payment failed',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  PAYMENT_REVERSED: {
    type: 'PAYMENT_REVERSED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '⚠️',
    title: 'Payment reversed',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app', 'push']
  },
  
  PAYMENT_RECONCILED: {
    type: 'PAYMENT_RECONCILED',
    category: NOTIFICATION_CATEGORIES.FINANCIAL,
    icon: '✅',
    title: 'Payment reconciled',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  // ========================================
  // MEMBERSHIP NOTIFICATIONS
  // ========================================
  
  MEMBER_JOINED: {
    type: 'MEMBER_JOINED',
    category: NOTIFICATION_CATEGORIES.MEMBERSHIP,
    icon: '👤',
    title: 'New member joined',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  MEMBER_INVITED: {
    type: 'MEMBER_INVITED',
    category: NOTIFICATION_CATEGORIES.MEMBERSHIP,
    icon: '📧',
    title: 'Member invited',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app', 'email']
  },
  
  INVITATION_ACCEPTED: {
    type: 'INVITATION_ACCEPTED',
    category: NOTIFICATION_CATEGORIES.MEMBERSHIP,
    icon: '✅',
    title: 'Invitation accepted',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  MEMBER_SUSPENDED: {
    type: 'MEMBER_SUSPENDED',
    category: NOTIFICATION_CATEGORIES.MEMBERSHIP,
    icon: '⚠️',
    title: 'Member suspended',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  MEMBER_REINSTATED: {
    type: 'MEMBER_REINSTATED',
    category: NOTIFICATION_CATEGORIES.MEMBERSHIP,
    icon: '✅',
    title: 'Member reinstated',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  MEMBER_REMOVED: {
    type: 'MEMBER_REMOVED',
    category: NOTIFICATION_CATEGORIES.MEMBERSHIP,
    icon: '🚫',
    title: 'Member removed',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  ROLE_CHANGED: {
    type: 'ROLE_CHANGED',
    category: NOTIFICATION_CATEGORIES.MEMBERSHIP,
    icon: '🔄',
    title: 'Role changed',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  MEMBER_PROFILE_UPDATED: {
    type: 'MEMBER_PROFILE_UPDATED',
    category: NOTIFICATION_CATEGORIES.MEMBERSHIP,
    icon: '👤',
    title: 'Profile updated',
    priority: 'low',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  // ========================================
  // GOVERNANCE NOTIFICATIONS
  // ========================================
  
  MEETING_SCHEDULED: {
    type: 'MEETING_SCHEDULED',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '📅',
    title: 'Meeting scheduled',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  MEETING_REMINDER: {
    type: 'MEETING_REMINDER',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '⏰',
    title: 'Meeting reminder',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  MEETING_STARTED: {
    type: 'MEETING_STARTED',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '🎯',
    title: 'Meeting started',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  MINUTES_PUBLISHED: {
    type: 'MINUTES_PUBLISHED',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '📄',
    title: 'Meeting minutes published',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  RESOLUTION_CREATED: {
    type: 'RESOLUTION_CREATED',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '📋',
    title: 'Resolution created',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  RESOLUTION_APPROVED: {
    type: 'RESOLUTION_APPROVED',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '✅',
    title: 'Resolution approved',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  RESOLUTION_REJECTED: {
    type: 'RESOLUTION_REJECTED',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '❌',
    title: 'Resolution rejected',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  ELECTION_OPENED: {
    type: 'ELECTION_OPENED',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '🗳️',
    title: 'Election opened',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app', 'push']
  },
  
  ELECTION_COMPLETED: {
    type: 'ELECTION_COMPLETED',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '✅',
    title: 'Election completed',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  COMMITTEE_APPOINTED: {
    type: 'COMMITTEE_APPOINTED',
    category: NOTIFICATION_CATEGORIES.GOVERNANCE,
    icon: '👥',
    title: 'Committee appointed',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  // ========================================
  // BURIAL CHAMA NOTIFICATIONS
  // ========================================
  
  MEMBER_DECEASED_REPORTED: {
    type: 'MEMBER_DECEASED_REPORTED',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '🪦',
    title: 'Member reported deceased',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  BURIAL_CASE_OPENED: {
    type: 'BURIAL_CASE_OPENED',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '🪦',
    title: 'Burial case opened',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  BENEFICIARY_CLAIM_SUBMITTED: {
    type: 'BENEFICIARY_CLAIM_SUBMITTED',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '📋',
    title: 'Beneficiary claim submitted',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app']
  },
  
  CLAIM_REQUIRES_VERIFICATION: {
    type: 'CLAIM_REQUIRES_VERIFICATION',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '🔍',
    title: 'Claim requires verification',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app']
  },
  
  CLAIM_APPROVED: {
    type: 'CLAIM_APPROVED',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '✅',
    title: 'Claim approved',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  CLAIM_REJECTED: {
    type: 'CLAIM_REJECTED',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '❌',
    title: 'Claim rejected',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  BENEFIT_PAYMENT_APPROVED: {
    type: 'BENEFIT_PAYMENT_APPROVED',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '✅',
    title: 'Benefit payment approved',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  BENEFIT_PAYMENT_DISBURSED: {
    type: 'BENEFIT_PAYMENT_DISBURSED',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '💰',
    title: 'Benefit payment disbursed',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  BURIAL_CONTRIBUTION_REQUIRED: {
    type: 'BURIAL_CONTRIBUTION_REQUIRED',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '💰',
    title: 'Burial contribution required',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  EMERGENCY_CONTRIBUTION_OPENED: {
    type: 'EMERGENCY_CONTRIBUTION_OPENED',
    category: NOTIFICATION_CATEGORIES.BURIAL,
    icon: '🚨',
    title: 'Emergency contribution opened',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  // ========================================
  // SYSTEM NOTIFICATIONS
  // ========================================
  
  MPESA_PAYMENT_SUCCESSFUL: {
    type: 'MPESA_PAYMENT_SUCCESSFUL',
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    icon: '✅',
    title: 'M-Pesa payment successful',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app', 'toast']
  },
  
  MPESA_PAYMENT_FAILED: {
    type: 'MPESA_PAYMENT_FAILED',
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    icon: '❌',
    title: 'M-Pesa payment failed',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push', 'sms']
  },
  
  BANK_TRANSACTION_RECEIVED: {
    type: 'BANK_TRANSACTION_RECEIVED',
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    icon: '🏦',
    title: 'Bank transaction received',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  RECONCILIATION_COMPLETED: {
    type: 'RECONCILIATION_COMPLETED',
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    icon: '✅',
    title: 'Reconciliation completed',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app']
  },
  
  SECURITY_ALERT: {
    type: 'SECURITY_ALERT',
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    icon: '🚨',
    title: 'Security alert',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push', 'sms', 'email']
  },
  
  NEW_DEVICE_LOGIN: {
    type: 'NEW_DEVICE_LOGIN',
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    icon: '🔐',
    title: 'New device login',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push', 'email']
  },
  
  PASSWORD_CHANGED: {
    type: 'PASSWORD_CHANGED',
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    icon: '🔑',
    title: 'Password changed',
    priority: 'normal',
    requiresAction: false,
    defaultChannels: ['in-app', 'email']
  },
  
  ROLE_PERMISSION_CHANGED: {
    type: 'ROLE_PERMISSION_CHANGED',
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    icon: '🔄',
    title: 'Role/permission changed',
    priority: 'high',
    requiresAction: false,
    defaultChannels: ['in-app', 'push']
  },
  
  // ========================================
  // APPROVAL NOTIFICATIONS
  // ========================================
  
  LOAN_REQUIRES_APPROVAL: {
    type: 'LOAN_REQUIRES_APPROVAL',
    category: NOTIFICATION_CATEGORIES.APPROVAL,
    icon: '⚠️',
    title: 'Loan requires approval',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app', 'push']
  },
  
  LOAN_REQUIRES_DISBURSEMENT: {
    type: 'LOAN_REQUIRES_DISBURSEMENT',
    category: NOTIFICATION_CATEGORIES.APPROVAL,
    icon: '💰',
    title: 'Loan requires disbursement',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app', 'push']
  },
  
  EXPENSE_REQUIRES_APPROVAL: {
    type: 'EXPENSE_REQUIRES_APPROVAL',
    category: NOTIFICATION_CATEGORIES.APPROVAL,
    icon: '📋',
    title: 'Expense requires approval',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app', 'push']
  },
  
  WITHDRAWAL_REQUIRES_APPROVAL: {
    type: 'WITHDRAWAL_REQUIRES_APPROVAL',
    category: NOTIFICATION_CATEGORIES.APPROVAL,
    icon: '📋',
    title: 'Withdrawal requires approval',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app', 'push']
  },
  
  ROLE_CHANGE_REQUIRES_APPROVAL: {
    type: 'ROLE_CHANGE_REQUIRES_APPROVAL',
    category: NOTIFICATION_CATEGORIES.APPROVAL,
    icon: '🔄',
    title: 'Role change requires approval',
    priority: 'high',
    requiresAction: true,
    defaultChannels: ['in-app', 'push']
  },
  
  MEMBER_REMOVAL_REQUIRES_APPROVAL: {
    type: 'MEMBER_REMOVAL_REQUIRES_APPROVAL',
    category: NOTIFICATION_CATEGORIES.APPROVAL,
    icon: '🚫',
    title: 'Member removal requires approval',
    priority: 'urgent',
    requiresAction: true,
    defaultChannels: ['in-app', 'push']
  }
};

// ========================================
// NOTIFICATION PRIORITIES
// ========================================

export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
};

// ========================================
// NOTIFICATION CHANNELS
// ========================================

export const NOTIFICATION_CHANNELS = {
  IN_APP: 'in-app',
  TOAST: 'toast',
  PUSH: 'push',
  SMS: 'sms',
  EMAIL: 'email'
};

// ========================================
// NOTIFICATION STATES
// ========================================

export const NOTIFICATION_STATES = {
  UNREAD: 'unread',
  READ: 'read',
  ARCHIVED: 'archived',
  PENDING: 'pending',
  ACTIONED: 'acted'
};

// ========================================
// ROLE-BASED NOTIFICATION ROUTING
// ========================================

export const ROLE_NOTIFICATION_RULES = {
  // Normal Members - receive personal notifications only
  member: {
    canReceive: [
      'CONTRIBUTION_RECEIVED',
      'CONTRIBUTION_MISSED',
      'CONTRIBUTION_OVERDUE',
      'FINE_APPLIED',
      'FINE_WAIVED',
      'LOAN_SUBMITTED',
      'LOAN_APPROVED',
      'LOAN_REJECTED',
      'LOAN_DISBURSED',
      'LOAN_REPAYMENT_RECEIVED',
      'LOAN_REPAYMENT_OVERDUE',
      'WITHDRAWAL_APPROVED',
      'WITHDRAWAL_REJECTED',
      'PAYMENT_FAILED',
      'MEMBER_SUSPENDED',
      'MEMBER_REINSTATED',
      'MEMBER_REMOVED',
      'ROLE_CHANGED',
      'MEETING_SCHEDULED',
      'MEETING_REMINDER',
      'MINUTES_PUBLISHED',
      'RESOLUTION_APPROVED',
      'ELECTION_OPENED',
      'ELECTION_COMPLETED',
      'COMMITTEE_APPOINTED',
      'MEMBER_DECEASED_REPORTED',
      'BURIAL_CASE_OPENED',
      'CLAIM_APPROVED',
      'CLAIM_REJECTED',
      'BENEFIT_PAYMENT_DISBURSED',
      'BURIAL_CONTRIBUTION_REQUIRED',
      'EMERGENCY_CONTRIBUTION_OPENED',
      'MPESA_PAYMENT_SUCCESSFUL',
      'MPESA_PAYMENT_FAILED',
      'NEW_DEVICE_LOGIN',
      'PASSWORD_CHANGED'
    ],
    cannotReceive: [
      'PAYMENT_REVERSED',
      'PAYMENT_RECONCILED',
      'ROLE_PERMISSION_CHANGED',
      'SECURITY_ALERT',
      'RECONCILIATION_COMPLETED',
      'BANK_TRANSACTION_RECEIVED'
    ]
  },
  
  // Treasurer - financial notifications and approvals
  treasurer: {
    canReceive: [
      'CONTRIBUTION_RECEIVED',
      'CONTRIBUTION_MISSED',
      'CONTRIBUTION_OVERDUE',
      'FINE_APPLIED',
      'FINE_WAIVED',
      'LOAN_SUBMITTED',
      'LOAN_APPROVED',
      'LOAN_REJECTED',
      'LOAN_DISBURSED',
      'LOAN_REPAYMENT_RECEIVED',
      'LOAN_REPAYMENT_OVERDUE',
      'WITHDRAWAL_REQUESTED',
      'WITHDRAWAL_APPROVED',
      'WITHDRAWAL_REJECTED',
      'PAYMENT_FAILED',
      'PAYMENT_REVERSED',
      'PAYMENT_RECONCILED',
      'LOAN_REQUIRES_DISBURSEMENT',
      'EXPENSE_REQUIRES_APPROVAL',
      'WITHDRAWAL_REQUIRES_APPROVAL',
      'RECONCILIATION_COMPLETED',
      'BANK_TRANSACTION_RECEIVED',
      'SECURITY_ALERT',
      'ROLE_PERMISSION_CHANGED',
      'MEMBER_JOINED',
      'MEMBER_INVITED',
      'INVITATION_ACCEPTED',
      'MEETING_SCHEDULED',
      'MEETING_REMINDER',
      'MINUTES_PUBLISHED',
      'RESOLUTION_APPROVED',
      'COMMITTEE_APPOINTED',
      'BURIAL_CASE_OPENED',
      'CLAIM_REQUIRES_VERIFICATION',
      'CLAIM_APPROVED',
      'BENEFIT_PAYMENT_APPROVED',
      'BURIAL_CONTRIBUTION_REQUIRED',
      'EMERGENCY_CONTRIBUTION_OPENED',
      'MPESA_PAYMENT_SUCCESSFUL',
      'MPESA_PAYMENT_FAILED',
      'NEW_DEVICE_LOGIN'
    ],
    cannotReceive: []
  },
  
  // Secretary - membership and governance notifications
  secretary: {
    canReceive: [
      'MEMBER_JOINED',
      'MEMBER_INVITED',
      'INVITATION_ACCEPTED',
      'MEMBER_SUSPENDED',
      'MEMBER_REINSTATED',
      'MEMBER_REMOVED',
      'ROLE_CHANGED',
      'MEMBER_PROFILE_UPDATED',
      'MEETING_SCHEDULED',
      'MEETING_REMINDER',
      'MEETING_STARTED',
      'MINUTES_PUBLISHED',
      'RESOLUTION_CREATED',
      'RESOLUTION_APPROVED',
      'RESOLUTION_REJECTED',
      'ELECTION_OPENED',
      'ELECTION_COMPLETED',
      'COMMITTEE_APPOINTED',
      'LOAN_SUBMITTED',
      'LOAN_APPROVED',
      'LOAN_REJECTED',
      'CONTRIBUTION_RECEIVED',
      'FINE_APPLIED',
      'FINE_WAIVED',
      'BURIAL_CASE_OPENED',
      'CLAIM_APPROVED',
      'CLAIM_REJECTED',
      'EMERGENCY_CONTRIBUTION_OPENED',
      'SECURITY_ALERT',
      'NEW_DEVICE_LOGIN'
    ],
    cannotReceive: [
      'PAYMENT_REVERSED',
      'PAYMENT_RECONCILED',
      'RECONCILIATION_COMPLETED',
      'BANK_TRANSACTION_RECEIVED',
      'ROLE_PERMISSION_CHANGED'
    ]
  },
  
  // Chairperson - approvals and governance
  chairperson: {
    canReceive: [
      'LOAN_REQUIRES_APPROVAL',
      'EXPENSE_REQUIRES_APPROVAL',
      'WITHDRAWAL_REQUIRES_APPROVAL',
      'ROLE_CHANGE_REQUIRES_APPROVAL',
      'MEMBER_REMOVAL_REQUIRES_APPROVAL',
      'MEMBER_JOINED',
      'MEMBER_INVITED',
      'INVITATION_ACCEPTED',
      'MEMBER_SUSPENDED',
      'MEMBER_REINSTATED',
      'MEMBER_REMOVED',
      'ROLE_CHANGED',
      'MEETING_SCHEDULED',
      'MEETING_REMINDER',
      'MEETING_STARTED',
      'MINUTES_PUBLISHED',
      'RESOLUTION_CREATED',
      'RESOLUTION_APPROVED',
      'RESOLUTION_REJECTED',
      'ELECTION_OPENED',
      'ELECTION_COMPLETED',
      'COMMITTEE_APPOINTED',
      'CONTRIBUTION_OVERDUE',
      'LOAN_REPAYMENT_OVERDUE',
      'PAYMENT_FAILED',
      'PAYMENT_REVERSED',
      'WITHDRAWAL_REQUESTED',
      'SECURITY_ALERT',
      'ROLE_PERMISSION_CHANGED',
      'BURIAL_CASE_OPENED',
      'CLAIM_REQUIRES_VERIFICATION',
      'CLAIM_APPROVED',
      'BENEFIT_PAYMENT_APPROVED',
      'BURIAL_CONTRIBUTION_REQUIRED',
      'EMERGENCY_CONTRIBUTION_OPENED',
      'MPESA_PAYMENT_FAILED',
      'NEW_DEVICE_LOGIN'
    ],
    cannotReceive: [
      'PAYMENT_RECONCILED',
      'RECONCILIATION_COMPLETED',
      'BANK_TRANSACTION_RECEIVED'
    ]
  },
  
  // Auditor - audit and security notifications
  auditor: {
    canReceive: [
      'PAYMENT_REVERSED',
      'PAYMENT_RECONCILED',
      'LOAN_APPROVED',
      'LOAN_REJECTED',
      'LOAN_DISBURSED',
      'ROLE_CHANGED',
      'MEMBER_SUSPENDED',
      'MEMBER_REMOVED',
      'ROLE_PERMISSION_CHANGED',
      'SECURITY_ALERT',
      'RECONCILIATION_COMPLETED',
      'WITHDRAWAL_APPROVED',
      'WITHDRAWAL_REJECTED',
      'EXPENSE_REQUIRES_APPROVAL',
      'FINE_APPLIED',
      'FINE_WAIVED',
      'CONTRIBUTION_RECEIVED',
      'MEETING_SCHEDULED',
      'MINUTES_PUBLISHED',
      'RESOLUTION_APPROVED',
      'BURIAL_CASE_OPENED',
      'CLAIM_APPROVED',
      'CLAIM_REJECTED',
      'BENEFIT_PAYMENT_APPROVED',
      'BENEFIT_PAYMENT_DISBURSED',
      'NEW_DEVICE_LOGIN'
    ],
    cannotReceive: [
      'CONTRIBUTION_MISSED',
      'CONTRIBUTION_OVERDUE',
      'LOAN_SUBMITTED',
      'LOAN_REPAYMENT_RECEIVED',
      'LOAN_REPAYMENT_OVERDUE',
      'WITHDRAWAL_REQUESTED',
      'PAYMENT_FAILED',
      'MEMBER_JOINED',
      'MEMBER_INVITED',
      'INVITATION_ACCEPTED',
      'MEMBER_REINSTATED',
      'MEMBER_PROFILE_UPDATED',
      'MEETING_REMINDER',
      'MEETING_STARTED',
      'RESOLUTION_CREATED',
      'RESOLUTION_REJECTED',
      'ELECTION_OPENED',
      'ELECTION_COMPLETED',
      'COMMITTEE_APPOINTED',
      'MEMBER_DECEASED_REPORTED',
      'BENEFICIARY_CLAIM_SUBMITTED',
      'CLAIM_REQUIRES_VERIFICATION',
      'BURIAL_CONTRIBUTION_REQUIRED',
      'EMERGENCY_CONTRIBUTION_OPENED',
      'MPESA_PAYMENT_SUCCESSFUL',
      'MPESA_PAYMENT_FAILED',
      'PASSWORD_CHANGED'
    ]
  },
  
  // Committee Member - committee-specific notifications
  committee_member: {
    canReceive: [
      'MEETING_SCHEDULED',
      'MEETING_REMINDER',
      'MEETING_STARTED',
      'MINUTES_PUBLISHED',
      'RESOLUTION_CREATED',
      'RESOLUTION_APPROVED',
      'RESOLUTION_REJECTED',
      'COMMITTEE_APPOINTED',
      'LOAN_REQUIRES_APPROVAL',
      'EXPENSE_REQUIRES_APPROVAL',
      'CLAIM_REQUIRES_VERIFICATION',
      'MEMBER_JOINED',
      'MEMBER_SUSPENDED',
      'MEMBER_REMOVED',
      'ROLE_CHANGED',
      'CONTRIBUTION_RECEIVED',
      'SECURITY_ALERT',
      'BURIAL_CASE_OPENED',
      'CLAIM_APPROVED',
      'CLAIM_REJECTED',
      'EMERGENCY_CONTRIBUTION_OPENED'
    ],
    cannotReceive: [
      'PAYMENT_REVERSED',
      'PAYMENT_RECONCILED',
      'RECONCILIATION_COMPLETED',
      'BANK_TRANSACTION_RECEIVED',
      'ROLE_PERMISSION_CHANGED',
      'CONTRIBUTION_MISSED',
      'CONTRIBUTION_OVERDUE',
      'LOAN_SUBMITTED',
      'LOAN_APPROVED',
      'LOAN_REJECTED',
      'LOAN_DISBURSED',
      'LOAN_REPAYMENT_RECEIVED',
      'LOAN_REPAYMENT_OVERDUE',
      'WITHDRAWAL_REQUESTED',
      'WITHDRAWAL_APPROVED',
      'WITHDRAWAL_REJECTED',
      'PAYMENT_FAILED',
      'FINE_APPLIED',
      'FINE_WAIVED',
      'MEMBER_INVITED',
      'INVITATION_ACCEPTED',
      'MEMBER_REINSTATED',
      'MEMBER_PROFILE_UPDATED',
      'ELECTION_OPENED',
      'ELECTION_COMPLETED',
      'MEMBER_DECEASED_REPORTED',
      'BENEFICIARY_CLAIM_SUBMITTED',
      'BENEFIT_PAYMENT_APPROVED',
      'BENEFIT_PAYMENT_DISBURSED',
      'BURIAL_CONTRIBUTION_REQUIRED',
      'MPESA_PAYMENT_SUCCESSFUL',
      'MPESA_PAYMENT_FAILED',
      'NEW_DEVICE_LOGIN',
      'PASSWORD_CHANGED'
    ]
  },
  
  // Patron - limited notifications
  patron: {
    canReceive: [
      'MEETING_SCHEDULED',
      'MEETING_REMINDER',
      'MINUTES_PUBLISHED',
      'RESOLUTION_APPROVED',
      'MEMBER_JOINED',
      'MEMBER_REMOVED',
      'CONTRIBUTION_RECEIVED',
      'LOAN_APPROVED',
      'LOAN_REJECTED',
      'BURIAL_CASE_OPENED',
      'CLAIM_APPROVED',
      'EMERGENCY_CONTRIBUTION_OPENED',
      'SECURITY_ALERT'
    ],
    cannotReceive: [
      'CONTRIBUTION_MISSED',
      'CONTRIBUTION_OVERDUE',
      'FINE_APPLIED',
      'FINE_WAIVED',
      'LOAN_SUBMITTED',
      'LOAN_DISBURSED',
      'LOAN_REPAYMENT_RECEIVED',
      'LOAN_REPAYMENT_OVERDUE',
      'WITHDRAWAL_REQUESTED',
      'WITHDRAWAL_APPROVED',
      'WITHDRAWAL_REJECTED',
      'PAYMENT_FAILED',
      'PAYMENT_REVERSED',
      'PAYMENT_RECONCILED',
      'MEMBER_INVITED',
      'INVITATION_ACCEPTED',
      'MEMBER_SUSPENDED',
      'MEMBER_REINSTATED',
      'ROLE_CHANGED',
      'MEMBER_PROFILE_UPDATED',
      'MEETING_STARTED',
      'RESOLUTION_CREATED',
      'RESOLUTION_REJECTED',
      'ELECTION_OPENED',
      'ELECTION_COMPLETED',
      'COMMITTEE_APPOINTED',
      'ROLE_CHANGE_REQUIRES_APPROVAL',
      'MEMBER_REMOVAL_REQUIRES_APPROVAL',
      'EXPENSE_REQUIRES_APPROVAL',
      'ROLE_PERMISSION_CHANGED',
      'RECONCILIATION_COMPLETED',
      'BANK_TRANSACTION_RECEIVED',
      'MEMBER_DECEASED_REPORTED',
      'BENEFICIARY_CLAIM_SUBMITTED',
      'CLAIM_REQUIRES_VERIFICATION',
      'CLAIM_REJECTED',
      'BENEFIT_PAYMENT_APPROVED',
      'BENEFIT_PAYMENT_DISBURSED',
      'BURIAL_CONTRIBUTION_REQUIRED',
      'MPESA_PAYMENT_SUCCESSFUL',
      'MPESA_PAYMENT_FAILED',
      'NEW_DEVICE_LOGIN',
      'PASSWORD_CHANGED'
    ]
  }
};

// ========================================
// DOMAIN EVENTS
// ========================================

export const DOMAIN_EVENTS = {
  // Financial Events
  CONTRIBUTION_RECEIVED: 'CONTRIBUTION_RECEIVED',
  CONTRIBUTION_MISSED: 'CONTRIBUTION_MISSED',
  CONTRIBUTION_OVERDUE: 'CONTRIBUTION_OVERDUE',
  FINE_APPLIED: 'FINE_APPLIED',
  FINE_WAIVED: 'FINE_WAIVED',
  LOAN_SUBMITTED: 'LOAN_SUBMITTED',
  LOAN_APPROVED: 'LOAN_APPROVED',
  LOAN_REJECTED: 'LOAN_REJECTED',
  LOAN_DISBURSED: 'LOAN_DISBURSED',
  LOAN_REPAYMENT_RECEIVED: 'LOAN_REPAYMENT_RECEIVED',
  LOAN_REPAYMENT_OVERDUE: 'LOAN_REPAYMENT_OVERDUE',
  WITHDRAWAL_REQUESTED: 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_APPROVED: 'WITHDRAWAL_APPROVED',
  WITHDRAWAL_REJECTED: 'WITHDRAWAL_REJECTED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REVERSED: 'PAYMENT_REVERSED',
  PAYMENT_RECONCILED: 'PAYMENT_RECONCILED',
  
  // Membership Events
  MEMBER_JOINED: 'MEMBER_JOINED',
  MEMBER_INVITED: 'MEMBER_INVITED',
  INVITATION_ACCEPTED: 'INVITATION_ACCEPTED',
  MEMBER_SUSPENDED: 'MEMBER_SUSPENDED',
  MEMBER_REINSTATED: 'MEMBER_REINSTATED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  MEMBER_PROFILE_UPDATED: 'MEMBER_PROFILE_UPDATED',
  
  // Governance Events
  MEETING_SCHEDULED: 'MEETING_SCHEDULED',
  MEETING_REMINDER: 'MEETING_REMINDER',
  MEETING_STARTED: 'MEETING_STARTED',
  MINUTES_PUBLISHED: 'MINUTES_PUBLISHED',
  RESOLUTION_CREATED: 'RESOLUTION_CREATED',
  RESOLUTION_APPROVED: 'RESOLUTION_APPROVED',
  RESOLUTION_REJECTED: 'RESOLUTION_REJECTED',
  ELECTION_OPENED: 'ELECTION_OPENED',
  ELECTION_COMPLETED: 'ELECTION_COMPLETED',
  COMMITTEE_APPOINTED: 'COMMITTEE_APPOINTED',
  
  // Burial Chama Events
  MEMBER_DECEASED_REPORTED: 'MEMBER_DECEASED_REPORTED',
  BURIAL_CASE_OPENED: 'BURIAL_CASE_OPENED',
  BENEFICIARY_CLAIM_SUBMITTED: 'BENEFICIARY_CLAIM_SUBMITTED',
  CLAIM_REQUIRES_VERIFICATION: 'CLAIM_REQUIRES_VERIFICATION',
  CLAIM_APPROVED: 'CLAIM_APPROVED',
  CLAIM_REJECTED: 'CLAIM_REJECTED',
  BENEFIT_PAYMENT_APPROVED: 'BENEFIT_PAYMENT_APPROVED',
  BENEFIT_PAYMENT_DISBURSED: 'BENEFIT_PAYMENT_DISBURSED',
  BURIAL_CONTRIBUTION_REQUIRED: 'BURIAL_CONTRIBUTION_REQUIRED',
  EMERGENCY_CONTRIBUTION_OPENED: 'EMERGENCY_CONTRIBUTION_OPENED',
  
  // System Events
  MPESA_PAYMENT_SUCCESSFUL: 'MPESA_PAYMENT_SUCCESSFUL',
  MPESA_PAYMENT_FAILED: 'MPESA_PAYMENT_FAILED',
  BANK_TRANSACTION_RECEIVED: 'BANK_TRANSACTION_RECEIVED',
  RECONCILIATION_COMPLETED: 'RECONCILIATION_COMPLETED',
  SECURITY_ALERT: 'SECURITY_ALERT',
  NEW_DEVICE_LOGIN: 'NEW_DEVICE_LOGIN',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ROLE_PERMISSION_CHANGED: 'ROLE_PERMISSION_CHANGED'
};

// ========================================
// TOAST NOTIFICATION TEMPLATES
// ========================================

export const TOAST_TEMPLATES = {
  MEMBER_ADDED: {
    icon: '✅',
    message: 'Member added successfully',
    duration: 3000
  },
  CONTRIBUTION_PAID: {
    icon: '✅',
    message: 'Contribution recorded',
    duration: 3000
  },
  LOAN_APPLICATION: {
    icon: '✅',
    message: 'Loan application submitted',
    duration: 3000
  },
  LOAN_APPROVED: {
    icon: '✅',
    message: 'Loan approved successfully',
    duration: 4000
  },
  LOAN_DISBURSED: {
    icon: '💰',
    message: (amount) => `Loan of KSh ${amount} disbursed`,
    duration: 4000
  },
  CONTRIBUTION_PLAN_CREATED: {
    icon: '✅',
    message: 'Contribution plan created',
    duration: 3000
  },
  FINE_APPLIED: {
    icon: '✅',
    message: 'Fine recorded',
    duration: 3000
  },
  MEETING_CREATED: {
    icon: '📅',
    message: 'Meeting scheduled successfully',
    duration: 3000
  },
  MINUTES_PUBLISHED: {
    icon: '📄',
    message: 'Meeting minutes published',
    duration: 3000
  },
  BENEFICIARY_ADDED: {
    icon: '✅',
    message: 'Beneficiary added successfully',
    duration: 3000
  },
  WITHDRAWAL_APPROVED: {
    icon: '✅',
    message: 'Withdrawal approved',
    duration: 3000
  },
  PAYMENT_RECEIVED: {
    icon: '💰',
    message: 'Payment received successfully',
    duration: 3000
  },
  // Generic toast types
  SUCCESS: {
    icon: '✅',
    message: (data) => data.message || 'Operation successful',
    duration: 3000
  },
  ERROR: {
    icon: '❌',
    message: (data) => data.message || 'Operation failed',
    duration: 5000
  },
  WARNING: {
    icon: '⚠️',
    message: (data) => data.message || 'Warning',
    duration: 4000
  },
  INFO: {
    icon: 'ℹ️',
    message: (data) => data.message || 'Information',
    duration: 3000
  }
};

// ========================================
// CONFIRMATION DIALOG TEMPLATES
// ========================================

export const CONFIRMATION_TEMPLATES = {
  LOAN_APPROVAL: {
    title: 'Approve Loan?',
    message: (loanDetails) => `
Member: ${loanDetails.memberName}
Amount: KSh ${loanDetails.amount}
Duration: ${loanDetails.duration}

This action will move the loan to the disbursement stage.
    `,
    confirmText: 'Approve Loan',
    cancelText: 'Cancel',
    severity: 'warning'
  },
  
  LOAN_REJECTION: {
    title: 'Reject Loan?',
    message: (loanDetails) => `
Member: ${loanDetails.memberName}
Amount: KSh ${loanDetails.amount}

This action cannot be undone.
    `,
    confirmText: 'Reject Loan',
    cancelText: 'Cancel',
    severity: 'danger'
  },
  
  MEMBER_REMOVAL: {
    title: 'Remove Member?',
    message: (memberDetails) => `
Member: ${memberDetails.memberName}
Role: ${memberDetails.role}

This action will remove the member from the chama.
This cannot be undone.
    `,
    confirmText: 'Remove Member',
    cancelText: 'Cancel',
    severity: 'danger'
  },
  
  ROLE_CHANGE: {
    title: 'Change Role?',
    message: (roleDetails) => `
Member: ${roleDetails.memberName}
Current Role: ${roleDetails.currentRole}
New Role: ${roleDetails.newRole}

This will change the member's permissions and access.
    `,
    confirmText: 'Change Role',
    cancelText: 'Cancel',
    severity: 'warning'
  },
  
  WITHDRAWAL_APPROVAL: {
    title: 'Approve Withdrawal?',
    message: (withdrawalDetails) => `
Member: ${withdrawalDetails.memberName}
Amount: KSh ${withdrawalDetails.amount}
Reason: ${withdrawalDetails.reason}

This will initiate the withdrawal process.
    `,
    confirmText: 'Approve Withdrawal',
    cancelText: 'Cancel',
    severity: 'warning'
  },
  
  EXPENSE_APPROVAL: {
    title: 'Approve Expense?',
    message: (expenseDetails) => `
Amount: KSh ${expenseDetails.amount}
Category: ${expenseDetails.category}
Description: ${expenseDetails.description}

This will authorize the expense payment.
    `,
    confirmText: 'Approve Expense',
    cancelText: 'Cancel',
    severity: 'warning'
  }
};

export default {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATES,
  ROLE_NOTIFICATION_RULES,
  DOMAIN_EVENTS,
  TOAST_TEMPLATES,
  CONFIRMATION_TEMPLATES
};