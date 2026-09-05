import mongoose from 'mongoose';

// ========================================
// COMMITTEE SCHEMA
// ========================================
//
// Specialized committees for delegated permissions
// and separation of duties in chama governance.
//
// Committee Types:
// - finance: Financial decisions and oversight
// - welfare: Member welfare and benevolence
// - investment: Investment decisions and management
// - discipline: Disciplinary actions and member conduct
// - general: General administrative functions
//
// ========================================

const COMMITTEE_TYPES = ['finance', 'welfare', 'investment', 'discipline', 'general'];

const COMMITTEE_ROLES = ['chair', 'member', 'secretary'];

const committeeSchema = new mongoose.Schema({
  chama_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chama',
    required: true,
    index: true
  },

  committee_type: {
    type: String,
    enum: COMMITTEE_TYPES,
    required: true,
    index: true
  },

  name: {
    type: String,
    required: true
  },

  description: {
    type: String,
    default: ''
  },

  // Committee members
  members: [{
    membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true
    },
    role: {
      type: String,
      enum: COMMITTEE_ROLES,
      default: 'member'
    },
    joined_at: {
      type: Date,
      default: Date.now
    }
  }],

  // Committee permissions (inherited from role + committee-specific)
  permissions: [{
    type: String
  }],

  // Committee leader
  chairperson_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChamaMembership'
  },

  // Committee settings
  settings: {
    minimum_members: {
      type: Number,
      default: 3
    },
    quorum_required: {
      type: Number,
      default: 2
    },
    decision_threshold: {
      type: Number,
      default: 0.51 // 51% majority
    },
    meeting_frequency_days: {
      type: Number,
      default: 30
    }
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'dissolved'],
    default: 'active',
    index: true
  },

  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChamaMembership'
  },

  created_at: {
    type: Date,
    default: Date.now
  },

  dissolved_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// ========================================
// INDEXES
// ========================================

// Composite index for chama committee lookups
committeeSchema.index({ chama_id: 1, committee_type: 1, status: 1 });

// Index for active committees by type
committeeSchema.index({ committee_type: 1, status: 1 });

// Index for committee membership lookups
committeeSchema.index({ 'members.membership_id': 1, status: 1 });

// Index for chairperson lookups
committeeSchema.index({ chairperson_id: 1, status: 1 });

// ========================================
// VALIDATION
// ========================================

committeeSchema.pre('save', function(next) {
  // Ensure committee has at least a chairperson
  if (this.status === 'active' && (!this.chairperson_id || this.members.length === 0)) {
    return next(new Error('Active committee must have a chairperson and at least one member'));
  }

  // Ensure chairperson is in members list
  if (this.chairperson_id) {
    const chairpersonInMembers = this.members.some(
      member => String(member.membership_id) === String(this.chairperson_id)
    );
    if (!chairpersonInMembers) {
      return next(new Error('Chairperson must be a committee member'));
    }
  }

  // Validate minimum members requirement
  if (this.status === 'active' && this.members.length < this.settings.minimum_members) {
    return next(new Error(`Committee must have at least ${this.settings.minimum_members} members`));
  }

  // Set dissolved_at if status is dissolved
  if (this.status === 'dissolved' && !this.dissolved_at) {
    this.dissolved_at = new Date();
  }

  next();
});

// ========================================
// METHODS
// ========================================

// Check if membership is a committee member
committeeSchema.methods.isMember = function(membershipId) {
  return this.members.some(member => String(member.membership_id) === String(membershipId));
};

// Check if membership is the chairperson
committeeSchema.methods.isChairperson = function(membershipId) {
  return String(this.chairperson_id) === String(membershipId);
};

// Get member role in committee
committeeSchema.methods.getMemberRole = function(membershipId) {
  const member = this.members.find(m => String(m.membership_id) === String(membershipId));
  return member ? member.role : null;
};

// Check if committee has quorum
committeeSchema.methods.hasQuorum = function() {
  return this.members.length >= this.settings.quorum_required;
};

// Add member to committee
committeeSchema.methods.addMember = function(membershipId, role = 'member') {
  if (this.isMember(membershipId)) {
    throw new Error('Membership is already a committee member');
  }

  this.members.push({
    membership_id: membershipId,
    role,
    joined_at: new Date()
  });

  return this.save();
};

// Remove member from committee
committeeSchema.methods.removeMember = function(membershipId) {
  const memberIndex = this.members.findIndex(
    m => String(m.membership_id) === String(membershipId)
  );

  if (memberIndex === -1) {
    throw new Error('Membership is not a committee member');
  }

  // Prevent removing chairperson without replacement
  if (String(this.chairperson_id) === String(membershipId)) {
    throw new Error('Cannot remove chairperson without appointing replacement');
  }

  this.members.splice(memberIndex, 1);
  return this.save();
};

// Update member role
committeeSchema.methods.updateMemberRole = function(membershipId, newRole) {
  const member = this.members.find(m => String(m.membership_id) === String(membershipId));

  if (!member) {
    throw new Error('Membership is not a committee member');
  }

  member.role = newRole;

  // Update chairperson if role is chair
  if (newRole === 'chair') {
    this.chairperson_id = membershipId;
  }

  return this.save();
};

// Set chairperson
committeeSchema.methods.setChairperson = function(membershipId) {
  if (!this.isMember(membershipId)) {
    throw new Error('Cannot set non-member as chairperson');
  }

  this.chairperson_id = membershipId;

  // Update member role to chair
  const member = this.members.find(m => String(m.membership_id) === String(membershipId));
  if (member) {
    member.role = 'chair';
  }

  return this.save();
};

// ========================================
// STATIC METHODS
// ========================================

// Get active committees for a chama
committeeSchema.statics.getActiveChamaCommittees = function(chamaId) {
  return this.find({
    chama_id: chamaId,
    status: 'active'
  }).sort({ committee_type: 1 });
};

// Get committee by type for a chama
committeeSchema.statics.getCommitteeByType = function(chamaId, committeeType) {
  return this.findOne({
    chama_id: chamaId,
    committee_type: committeeType,
    status: 'active'
  });
};

// Get committees where membership is a member
committeeSchema.statics.getMembershipCommittees = function(membershipId) {
  return this.find({
    'members.membership_id': membershipId,
    status: 'active'
  }).populate('chama_id');
};

// Get committees where membership is chairperson
committeeSchema.statics.getChairedCommittees = function(membershipId) {
  return this.find({
    chairperson_id: membershipId,
    status: 'active'
  }).populate('chama_id');
};

// ========================================
// MODEL
// ========================================

const Committee = mongoose.models.Committee ||
  mongoose.model('Committee', committeeSchema);

export default Committee;