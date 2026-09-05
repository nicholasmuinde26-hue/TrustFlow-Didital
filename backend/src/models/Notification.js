import mongoose from 'mongoose';

// ========================================
// NOTIFICATION SCHEMA
// ========================================
//
// Comprehensive notification system for ChamaManager
// supporting three notification layers:
// 1. Toast notifications (instant, ephemeral)
// 2. In-app notifications (persistent notification center)
// 3. Action-required alerts (must be acted upon)
//
// ========================================

const notificationSchema = new mongoose.Schema({
  // ========================================
  // BASIC NOTIFICATION INFO
  // ========================================
  
  chama_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chama',
    required: true,
    index: true
  },
  
  recipient_membership_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChamaMembership',
    required: true,
    index: true
  },
  
  recipient_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  recipient_role: {
    type: String,
    enum: ['member', 'treasurer', 'secretary', 'auditor', 'chairperson', 'committee_member', 'patron'],
    required: true,
    index: true
  },
  
  // ========================================
  // NOTIFICATION TYPE & CATEGORY
  // ========================================
  
  notification_type: {
    type: String,
    required: true,
    index: true
  },
  
  category: {
    type: String,
    enum: ['financial', 'membership', 'governance', 'burial', 'system', 'approval', 'alert'],
    required: true,
    index: true
  },
  
  icon: {
    type: String,
    default: '🔔'
  },
  
  // ========================================
  // NOTIFICATION CONTENT
  // ========================================
  
  title: {
    type: String,
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  
  description: {
    type: String,
    default: ''
  },
  
  // ========================================
  // NOTIFICATION METADATA
  // ========================================
  
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Reference to related entity (loan, contribution, meeting, etc.)
  related_entity_type: {
    type: String,
    default: null
  },
  
  related_entity_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  
  // Action-related fields
  action_url: {
    type: String,
    default: null
  },
  
  action_text: {
    type: String,
    default: null
  },
  
  action_method: {
    type: String,
    enum: ['GET', 'POST', 'PATCH', 'DELETE'],
    default: null
  },
  
  // ========================================
  // NOTIFICATION STATE & STATUS
  // ========================================
  
  state: {
    type: String,
    enum: ['unread', 'read', 'archived', 'pending', 'acted'],
    default: 'unread',
    index: true
  },
  
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  
  requires_action: {
    type: Boolean,
    default: false,
    index: true
  },
  
  action_deadline: {
    type: Date,
    default: null
  },
  
  action_completed_at: {
    type: Date,
    default: null
  },
  
  // ========================================
  // DELIVERY CHANNELS
  // ========================================
  
  delivery_channels: [{
    channel: {
      type: String,
      enum: ['in-app', 'toast', 'push', 'sms', 'email']
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending'
    },
    sent_at: {
      type: Date,
      default: null
    },
    delivered_at: {
      type: Date,
      default: null
    },
    failed_reason: {
      type: String,
      default: null
    },
    external_id: {
      type: String,
      default: null
    }
  }],
  
  // ========================================
  // DOMAIN EVENT TRACKING
  // ========================================
  
  domain_event: {
    type: String,
    default: null
  },
  
  event_source: {
    type: String,
    default: null
  },
  
  event_timestamp: {
    type: Date,
    default: null
  },
  
  // ========================================
  // READ/ACKNOWLEDGE TRACKING
  // ========================================
  
  read_at: {
    type: Date,
    default: null
  },
  
  acknowledged_at: {
    type: Date,
    default: null
  },
  
  read_count: {
    type: Number,
    default: 0
  },
  
  // ========================================
  // NOTIFICATION LIFECYCLE
  // ========================================
  
  expires_at: {
    type: Date,
    default: null
  },
  
  archived_at: {
    type: Date,
    default: null
  },
  
  deleted_at: {
    type: Date,
    default: null
  },
  
  // ========================================
  // SENDING CONTEXT
  // ========================================
  
  sent_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChamaMembership',
    default: null
  },
  
  sent_by_role: {
    type: String,
    default: null
  },
  
  ip_address: {
    type: String,
    default: null
  },
  
  user_agent: {
    type: String,
    default: null
  },
  
  // ========================================
  // RESPONSE TRACKING (for action notifications)
  // ========================================
  
  response: {
    action_taken: {
      type: String,
      enum: ['approved', 'rejected', 'completed', 'dismissed', null],
      default: null
    },
    response_metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    responded_at: {
      type: Date,
      default: null
    },
    responded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      default: null
    }
  },
  
  // ========================================
  // TIMESTAMP
  // ========================================
  
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // We manage timestamps manually
});

// ========================================
// INDEXES
// ========================================

// Composite index for recipient's unread notifications
notificationSchema.index({ 
  recipient_membership_id: 1, 
  state: 1, 
  created_at: -1 
});

// Index for chama-wide notifications
notificationSchema.index({ 
  chama_id: 1, 
  category: 1, 
  created_at: -1 
});

// Index for notification type queries
notificationSchema.index({ 
  notification_type: 1, 
  created_at: -1 
});

// Index for action-required notifications
notificationSchema.index({ 
  requires_action: 1, 
  state: 1, 
  action_deadline: 1 
});

// Index for priority notifications
notificationSchema.index({ 
  priority: 1, 
  state: 1, 
  created_at: -1 
});

// Index for expiry cleanup
notificationSchema.index({ 
  expires_at: 1, 
  state: 1 
});

// Index for domain event tracking
notificationSchema.index({ 
  domain_event: 1, 
  created_at: -1 
});

// ========================================
// VALIDATION HOOKS
// ========================================

notificationSchema.pre('save', function(next) {
  // Auto-expire notifications
  if (this.expires_at && this.expires_at < new Date() && this.state === 'unread') {
    this.state = 'archived';
    this.archived_at = new Date();
  }
  
  // Auto-archive actioned notifications after 30 days
  if (this.state === 'acted' && !this.archived_at) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (this.action_completed_at && this.action_completed_at < thirtyDaysAgo) {
      this.state = 'archived';
      this.archived_at = new Date();
    }
  }
  
  // Validate action deadline for action-required notifications
  if (this.requires_action && !this.action_deadline) {
    // Set default deadline based on priority
    const deadlines = {
      'urgent': 24 * 60 * 60 * 1000, // 24 hours
      'high': 3 * 24 * 60 * 60 * 1000, // 3 days
      'normal': 7 * 24 * 60 * 60 * 1000 // 7 days
    };
    this.action_deadline = new Date(Date.now() + (deadlines[this.priority] || deadlines.normal));
  }
  
  next();
});

// ========================================
// INSTANCE METHODS
// ========================================

// Mark notification as read
notificationSchema.methods.markAsRead = function() {
  this.state = 'read';
  this.read_at = new Date();
  this.read_count = (this.read_count || 0) + 1;
  this.updated_at = new Date();
  return this.save();
};

// Mark notification as archived
notificationSchema.methods.markAsArchived = function() {
  this.state = 'archived';
  this.archived_at = new Date();
  this.updated_at = new Date();
  return this.save();
};

// Mark action as completed
notificationSchema.methods.markActionCompleted = function(actionTaken, respondedBy, metadata = {}) {
  this.state = 'acted';
  this.action_completed_at = new Date();
  this.response.action_taken = actionTaken;
  this.response.responded_at = new Date();
  this.response.responded_by = respondedBy;
  this.response.response_metadata = metadata;
  this.updated_at = new Date();
  return this.save();
};

// Check if notification is expired
notificationSchema.methods.isExpired = function() {
  if (!this.expires_at) return false;
  return this.expires_at < new Date();
};

// Check if notification requires immediate action
notificationSchema.methods.requiresImmediateAction = function() {
  if (!this.requires_action) return false;
  if (!this.action_deadline) return false;
  
  const hoursUntilDeadline = (this.action_deadline - new Date()) / (1000 * 60 * 60);
  return hoursUntilDeadline <= 24; // Within 24 hours
};

// Get delivery status for a specific channel
notificationSchema.methods.getDeliveryStatus = function(channel) {
  const delivery = this.delivery_channels.find(d => d.channel === channel);
  return delivery || null;
};

// Update delivery status
notificationSchema.methods.updateDeliveryStatus = function(channel, status, details = {}) {
  let delivery = this.delivery_channels.find(d => d.channel === channel);
  
  if (!delivery) {
    delivery = {
      channel,
      status: 'pending',
      sent_at: null,
      delivered_at: null,
      failed_reason: null,
      external_id: null
    };
    this.delivery_channels.push(delivery);
  }
  
  delivery.status = status;
  
  if (status === 'sent' && !delivery.sent_at) {
    delivery.sent_at = new Date();
  }
  
  if (status === 'delivered' && !delivery.delivered_at) {
    delivery.delivered_at = new Date();
  }
  
  if (status === 'failed' && details.reason) {
    delivery.failed_reason = details.reason;
  }
  
  if (details.externalId) {
    delivery.external_id = details.externalId;
  }
  
  this.updated_at = new Date();
  return this.save();
};

// Check if notification should be shown as toast
notificationSchema.methods.shouldShowToast = function() {
  const delivery = this.getDeliveryStatus('toast');
  return delivery !== null && delivery.status !== 'failed';
};

// Get notification urgency level
notificationSchema.methods.getUrgencyLevel = function() {
  if (this.priority === 'urgent') return 'critical';
  if (this.priority === 'high') return 'important';
  if (this.requires_action && this.requiresImmediateAction()) return 'urgent';
  return 'normal';
};

// ========================================
// STATIC METHODS
// ========================================

// Get unread notifications for a user
notificationSchema.statics.getUnreadNotifications = function(recipientMembershipId, options = {}) {
  const {
    limit = 20,
    skip = 0,
    category = null
  } = options;
  
  const query = {
    recipient_membership_id: recipientMembershipId,
    state: 'unread'
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query)
    .populate('chama_id')
    .populate('recipient_membership_id')
    .sort({ priority: -1, created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Get action-required notifications
notificationSchema.statics.getActionRequiredNotifications = function(recipientMembershipId, options = {}) {
  const {
    limit = 10,
    skip = 0
  } = options;
  
  return this.find({
    recipient_membership_id: recipientMembershipId,
    requires_action: true,
    state: { $in: ['unread', 'pending'] }
  })
  .populate('chama_id')
  .populate('recipient_membership_id')
  .sort({ action_deadline: 1, priority: -1 })
  .limit(limit)
  .skip(skip);
};

// Get notifications by category
notificationSchema.statics.getNotificationsByCategory = function(recipientMembershipId, category, options = {}) {
  const {
    limit = 20,
    skip = 0,
    state = null
  } = options;
  
  const query = {
    recipient_membership_id: recipientMembershipId,
    category
  };
  
  if (state) {
    query.state = state;
  }
  
  return this.find(query)
    .populate('chama_id')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Get notifications by type
notificationSchema.statics.getNotificationsByType = function(recipientMembershipId, notificationType, options = {}) {
  const {
    limit = 20,
    skip = 0
  } = options;
  
  return this.find({
    recipient_membership_id: recipientMembershipId,
    notification_type: notificationType
  })
  .populate('chama_id')
  .sort({ created_at: -1 })
  .limit(limit)
  .skip(skip);
};

// Get high-priority notifications
notificationSchema.statics.getHighPriorityNotifications = function(recipientMembershipId, options = {}) {
  const {
    limit = 10,
    skip = 0
  } = options;
  
  return this.find({
    recipient_membership_id: recipientMembershipId,
    priority: { $in: ['high', 'urgent'] },
    state: { $in: ['unread', 'pending'] }
  })
  .populate('chama_id')
  .sort({ priority: -1, created_at: -1 })
  .limit(limit)
  .skip(skip);
};

// Get notifications count by state
notificationSchema.statics.getNotificationCounts = function(recipientMembershipId) {
  return this.aggregate([
    { $match: { recipient_membership_id: recipientMembershipId } },
    { $group: { _id: '$state', count: { $sum: 1 } } }
  ]);
};

// Mark all notifications as read for a user
notificationSchema.statics.markAllAsRead = function(recipientMembershipId) {
  return this.updateMany(
    {
      recipient_membership_id: recipientMembershipId,
      state: 'unread'
    },
    {
      state: 'read',
      read_at: new Date(),
      updated_at: new Date()
    }
  );
};

// Cleanup expired notifications
notificationSchema.statics.cleanupExpiredNotifications = function() {
  return this.deleteMany({
    expires_at: { $lt: new Date() },
    state: { $in: ['unread', 'read'] }
  });
};

// Archive old notifications
notificationSchema.statics.archiveOldNotifications = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.updateMany(
    {
      state: { $in: ['read', 'acted'] },
      created_at: { $lt: cutoffDate },
      archived_at: null
    },
    {
      state: 'archived',
      archived_at: new Date(),
      updated_at: new Date()
    }
  );
};

// Get notifications for a chama (admin view)
notificationSchema.statics.getChamaNotifications = function(chamaId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    category = null,
    state = null
  } = options;
  
  const query = { chama_id: chamaId };
  
  if (category) query.category = category;
  if (state) query.state = state;
  
  return this.find(query)
    .populate('recipient_membership_id')
    .populate('recipient_user_id')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Get notification statistics
notificationSchema.statics.getNotificationStatistics = function(chamaId, timeRange = '7d') {
  const cutoffDate = new Date();
  
  switch (timeRange) {
    case '1d':
      cutoffDate.setDate(cutoffDate.getDate() - 1);
      break;
    case '7d':
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      break;
    case '30d':
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      break;
    default:
      cutoffDate.setDate(cutoffDate.getDate() - 7);
  }
  
  return this.aggregate([
    { $match: { chama_id: chamaId, created_at: { $gte: cutoffDate } } },
    {
      $group: {
        _id: {
          category: '$category',
          priority: '$priority',
          state: '$state'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// ========================================
// MODEL
// ========================================

const Notification = mongoose.models.Notification ||
  mongoose.model('Notification', notificationSchema);

export default Notification;