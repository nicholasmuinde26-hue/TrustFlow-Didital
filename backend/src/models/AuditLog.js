import mongoose from 'mongoose';


// ========================================
// AUDIT LOG SCHEMA
// ========================================
//
// Centralized immutable history of important
// business, financial, membership, security,
// and communication actions.
//
// Supports:
//
// 1. Chama
// 2. Contribution Group
//
// ========================================


const auditLogSchema = new mongoose.Schema(
  {

    // ======================================
    // ACTOR
    // ======================================

    actorUserId: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'User',

      required:
        true,

      index:
        true

    },


    // ======================================
    // AUDIT SCOPE TYPE
    // ======================================

    scopeType: {

      type:
        String,

      enum: [

        'CHAMA',

        'CONTRIBUTION_GROUP'

      ],

      required:
        true,

      uppercase:
        true,

      trim:
        true,

      index:
        true

    },


    // ======================================
    // CHAMA
    // ======================================

    chamaId: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'Chama',

      default:
        null,

      index:
        true

    },


    // ======================================
    // CONTRIBUTION GROUP
    // ======================================

    contributionGroupId: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'ContributionGroup',

      default:
        null,

      index:
        true

    },


    // ======================================
    // ACTION
    // ======================================

    action: {

      type:
        String,

      required:
        true,

      trim:
        true,

      uppercase:
        true,

      index:
        true

    },


    // ======================================
    // RESOURCE TYPE
    // ======================================

    resourceType: {

      type:
        String,

      required:
        true,

      trim:
        true,

      index:
        true

    },


    // ======================================
    // RESOURCE ID
    // ======================================

    resourceId: {

      type:
        mongoose.Schema.Types.ObjectId,

      required:
        true,

      index:
        true

    },


    // ======================================
    // BEFORE STATE
    // ======================================

    before: {

      type:
        mongoose.Schema.Types.Mixed,

      default:
        null

    },


    // ======================================
    // AFTER STATE
    // ======================================

    after: {

      type:
        mongoose.Schema.Types.Mixed,

      default:
        null

    },


    // ======================================
    // REQUEST / EVENT METADATA
    // ======================================

    metadata: {

      type:
        mongoose.Schema.Types.Mixed,

      default:
        null

    }

  },

  {

    timestamps:
      true

  }

);


// ========================================
// VALIDATE AUDIT SCOPE
// ========================================
//
// Ensures exactly ONE audit scope is used.
//
// CHAMA
// -> chamaId required
// -> contributionGroupId must be null
//
// CONTRIBUTION_GROUP
// -> contributionGroupId required
// -> chamaId must be null
//
// ========================================
//
// IMPORTANT:
//
// This hook intentionally does NOT use:
//
// function (next)
//
// Instead, it uses:
//
// function ()
//
// Validation errors are thrown directly.
//
// ========================================

auditLogSchema.pre(
  'validate',
  function () {

    // ======================================
    // CHAMA SCOPE
    // ======================================

    if (
      this.scopeType === 'CHAMA'
    ) {

      // ------------------------------------
      // Chama ID required
      // ------------------------------------

      if (
        !this.chamaId
      ) {

        throw new Error(
          'chamaId is required for CHAMA audit logs'
        );

      }


      // ------------------------------------
      // Contribution Group ID forbidden
      // ------------------------------------

      if (
        this.contributionGroupId
      ) {

        throw new Error(
          'ContributionGroup ID cannot be set for CHAMA audit logs'
        );

      }

    }


    // ======================================
    // CONTRIBUTION GROUP SCOPE
    // ======================================

    if (
      this.scopeType === 'CONTRIBUTION_GROUP'
    ) {

      // ------------------------------------
      // Contribution Group ID required
      // ------------------------------------

      if (
        !this.contributionGroupId
      ) {

        throw new Error(
          'contributionGroupId is required for CONTRIBUTION_GROUP audit logs'
        );

      }


      // ------------------------------------
      // Chama ID forbidden
      // ------------------------------------

      if (
        this.chamaId
      ) {

        throw new Error(
          'Chama ID cannot be set for CONTRIBUTION_GROUP audit logs'
        );

      }

    }

  }
);


// ========================================
// INDEXES
// ========================================


// ========================================
// CHAMA AUDIT LOGS
// ========================================

auditLogSchema.index({

  scopeType:
    1,

  chamaId:
    1,

  createdAt:
    -1

});


// ========================================
// CONTRIBUTION GROUP AUDIT LOGS
// ========================================

auditLogSchema.index({

  scopeType:
    1,

  contributionGroupId:
    1,

  createdAt:
    -1

});


// ========================================
// SCOPE + ACTION
// ========================================

auditLogSchema.index({

  scopeType:
    1,

  action:
    1,

  createdAt:
    -1

});


// ========================================
// ACTOR
// ========================================

auditLogSchema.index({

  actorUserId:
    1,

  createdAt:
    -1

});


// ========================================
// RESOURCE
// ========================================

auditLogSchema.index({

  resourceType:
    1,

  resourceId:
    1,

  createdAt:
    -1

});


// ========================================
// CHAMA RESOURCE
// ========================================

auditLogSchema.index({

  chamaId:
    1,

  resourceType:
    1,

  resourceId:
    1,

  createdAt:
    -1

});


// ========================================
// CONTRIBUTION GROUP RESOURCE
// ========================================

auditLogSchema.index({

  contributionGroupId:
    1,

  resourceType:
    1,

  resourceId:
    1,

  createdAt:
    -1

});


// ========================================
// IMMUTABILITY PROTECTION
// ========================================
//
// Audit records represent historical truth.
//
// They should NEVER be:
//
// UPDATE
// DELETE
//
// All audit records must be created using:
//
// AuditLog.create()
//
// ========================================


// ----------------------------------------
// BLOCK findOneAndUpdate
// ----------------------------------------

auditLogSchema.pre(
  'findOneAndUpdate',
  function () {

    throw new Error(
      'Audit logs are immutable and cannot be updated'
    );

  }
);


// ----------------------------------------
// BLOCK updateOne
// ----------------------------------------

auditLogSchema.pre(
  'updateOne',
  function () {

    throw new Error(
      'Audit logs are immutable and cannot be updated'
    );

  }
);


// ----------------------------------------
// BLOCK updateMany
// ----------------------------------------

auditLogSchema.pre(
  'updateMany',
  function () {

    throw new Error(
      'Audit logs are immutable and cannot be updated'
    );

  }
);


// ----------------------------------------
// BLOCK findOneAndDelete
// ----------------------------------------

auditLogSchema.pre(
  'findOneAndDelete',
  function () {

    throw new Error(
      'Audit logs are immutable and cannot be deleted'
    );

  }
);


// ----------------------------------------
// BLOCK deleteOne
// ----------------------------------------

auditLogSchema.pre(
  'deleteOne',
  function () {

    throw new Error(
      'Audit logs are immutable and cannot be deleted'
    );

  }
);


// ----------------------------------------
// BLOCK deleteMany
// ----------------------------------------

auditLogSchema.pre(
  'deleteMany',
  function () {

    throw new Error(
      'Audit logs are immutable and cannot be deleted'
    );

  }
);


// ========================================
// MODEL
// ========================================

const AuditLog =
  mongoose.model(
    'AuditLog',
    auditLogSchema
  );


export default AuditLog;