import mongoose from 'mongoose';

import AuditLog from '../models/AuditLog.js';

import AppError from '../utils/AppError.js';


// ========================================
// AUDIT SCOPE TYPES
// ========================================

const AUDIT_SCOPE_TYPES = {

  CHAMA:
    'CHAMA',

  CONTRIBUTION_GROUP:
    'CONTRIBUTION_GROUP'

};


// ========================================
// VALIDATE OBJECT ID
// ========================================

const validateObjectId = (
  value,
  fieldName
) => {

  if (
    !value ||
    !mongoose.Types.ObjectId.isValid(value)
  ) {

    throw new AppError(
      `Invalid ${fieldName}`,
      400
    );

  }

};


// ========================================
// CREATE AUDIT LOG
// ========================================
//
// CENTRALIZED AUDIT SERVICE
//
// Supports:
//
// 1. Chama operations
// 2. Contribution Group operations
//
// Every audit log belongs to exactly one
// audit scope.
//
// CHAMA
//
// OR
//
// CONTRIBUTION_GROUP
//
// This service should be called by business
// services AFTER successful operations.
//
// ========================================

export const createAuditLog = async ({

  actorUserId,

  scopeType,

  chamaId =
    null,

  contributionGroupId =
    null,

  action,

  resourceType,

  resourceId,

  before =
    null,

  after =
    null,

  metadata =
    null,

  session =
    null

}) => {

  // ======================================
  // 1. VALIDATE ACTOR
  // ======================================

  validateObjectId(
    actorUserId,
    'actor user ID'
  );


  // ======================================
  // 2. VALIDATE SCOPE TYPE
  // ======================================

  if (
    !scopeType ||
    typeof scopeType !== 'string'
  ) {

    throw new AppError(
      'Audit scope type is required',
      500
    );

  }


  const normalizedScopeType =
    scopeType.toUpperCase();


  if (
    !Object.values(
      AUDIT_SCOPE_TYPES
    ).includes(
      normalizedScopeType
    )
  ) {

    throw new AppError(
      'Invalid audit scope type',
      500
    );

  }


  // ======================================
  // 3. VALIDATE SCOPE
  // ======================================


  // --------------------------------------
  // CHAMA SCOPE
  // --------------------------------------

  if (
    normalizedScopeType ===
    AUDIT_SCOPE_TYPES.CHAMA
  ) {

    // Chama ID required

    if (
      !chamaId
    ) {

      throw new AppError(
        'Chama ID is required for CHAMA audit logs',
        500
      );

    }


    // Contribution Group ID forbidden

    if (
      contributionGroupId
    ) {

      throw new AppError(
        'Contribution Group ID cannot be used with CHAMA audit logs',
        500
      );

    }


    // Validate Chama ID

    validateObjectId(
      chamaId,
      'Chama ID'
    );

  }


  // --------------------------------------
  // CONTRIBUTION GROUP SCOPE
  // --------------------------------------

  if (
    normalizedScopeType ===
    AUDIT_SCOPE_TYPES.CONTRIBUTION_GROUP
  ) {

    // Contribution Group ID required

    if (
      !contributionGroupId
    ) {

      throw new AppError(
        'Contribution Group ID is required for CONTRIBUTION_GROUP audit logs',
        500
      );

    }


    // Chama ID forbidden

    if (
      chamaId
    ) {

      throw new AppError(
        'Chama ID cannot be used with CONTRIBUTION_GROUP audit logs',
        500
      );

    }


    // Validate Contribution Group ID

    validateObjectId(
      contributionGroupId,
      'Contribution Group ID'
    );

  }


  // ======================================
  // 4. VALIDATE RESOURCE ID
  // ======================================

  validateObjectId(
    resourceId,
    'resource ID'
  );


  // ======================================
  // 5. VALIDATE ACTION
  // ======================================

  if (
    !action ||
    typeof action !== 'string'
  ) {

    throw new AppError(
      'Audit action is required',
      500
    );

  }


  // ======================================
  // 6. VALIDATE RESOURCE TYPE
  // ======================================

  if (
    !resourceType ||
    typeof resourceType !== 'string'
  ) {

    throw new AppError(
      'Audit resource type is required',
      500
    );

  }


  // ======================================
  // 7. BUILD AUDIT DATA
  // ======================================

  const auditData = {

    actorUserId,

    scopeType:
      normalizedScopeType,

    chamaId,

    contributionGroupId,

    action:
      action.toUpperCase(),

    resourceType,

    resourceId,

    before,

    after,

    metadata

  };


  // ======================================
  // 8. CREATE USING TRANSACTION SESSION
  // ======================================

  if (
    session
  ) {

    const [
      auditLog
    ] =
      await AuditLog.create(

        [
          auditData
        ],

        {
          session
        }

      );


    return auditLog;

  }


  // ======================================
  // 9. NORMAL CREATION
  // ======================================

  return AuditLog.create(
    auditData
  );

};


// ========================================
// BUILD PAGINATION
// ========================================

const getPagination = ({

  page =
    1,

  limit =
    20

}) => {

  const currentPage =
    Math.max(

      Number(page) || 1,

      1

    );


  const pageLimit =
    Math.min(

      Math.max(

        Number(limit) || 20,

        1

      ),

      100

    );


  const skip =
    (
      currentPage -
      1
    ) *
    pageLimit;


  return {

    currentPage,

    pageLimit,

    skip

  };

};


// ========================================
// APPLY COMMON AUDIT FILTERS
// ========================================

const applyAuditFilters = ({

  query,

  action,

  actorUserId,

  resourceType,

  resourceId,

  startDate,

  endDate

}) => {


  // ======================================
  // ACTION
  // ======================================

  if (
    action
  ) {

    query.action =
      action.toUpperCase();

  }


  // ======================================
  // ACTOR
  // ======================================

  if (
    actorUserId
  ) {

    validateObjectId(
      actorUserId,
      'actor user ID'
    );


    query.actorUserId =
      actorUserId;

  }


  // ======================================
  // RESOURCE TYPE
  // ======================================

  if (
    resourceType
  ) {

    query.resourceType =
      resourceType;

  }


  // ======================================
  // RESOURCE ID
  // ======================================

  if (
    resourceId
  ) {

    validateObjectId(
      resourceId,
      'resource ID'
    );


    query.resourceId =
      resourceId;

  }


  // ======================================
  // DATE FILTERING
  // ======================================

  if (
    startDate ||
    endDate
  ) {

    query.createdAt = {};

  }


  // --------------------------------------
  // START DATE
  // --------------------------------------

  if (
    startDate
  ) {

    const start =
      new Date(
        startDate
      );


    if (
      Number.isNaN(
        start.getTime()
      )
    ) {

      throw new AppError(
        'Invalid start date',
        400
      );

    }


    query.createdAt.$gte =
      start;

  }


  // --------------------------------------
  // END DATE
  // --------------------------------------

  if (
    endDate
  ) {

    const end =
      new Date(
        endDate
      );


    if (
      Number.isNaN(
        end.getTime()
      )
    ) {

      throw new AppError(
        'Invalid end date',
        400
      );

    }


    // Include complete end day.

    end.setHours(

      23,

      59,

      59,

      999

    );


    query.createdAt.$lte =
      end;

  }


  return query;

};


// ========================================
// EXECUTE AUDIT LOG QUERY
// ========================================

const executeAuditLogQuery = async ({

  query,

  page,

  limit

}) => {

  // --------------------------------------
  // Pagination
  // --------------------------------------

  const {

    currentPage,

    pageLimit,

    skip

  } =
    getPagination({

      page,

      limit

    });


  // --------------------------------------
  // Execute queries
  // --------------------------------------

  const [

    logs,

    total

  ] = await Promise.all([

    AuditLog

      .find(
        query
      )

      .populate(

        'actorUserId',

        'name phone email'

      )

      .populate(

        'chamaId',

        'name status'

      )

      .populate(

        'contributionGroupId',

        'name status'

      )

      .sort({

        createdAt:
          -1

      })

      .skip(
        skip
      )

      .limit(
        pageLimit
      )

      .lean(),


    AuditLog

      .countDocuments(
        query
      )

  ]);


  // --------------------------------------
  // Pagination
  // --------------------------------------

  const totalPages =
    Math.ceil(

      total /
      pageLimit

    );


  return {

    logs,

    pagination: {

      page:
        currentPage,

      limit:
        pageLimit,

      total,

      totalPages,

      hasNextPage:
        currentPage <
        totalPages,

      hasPreviousPage:
        currentPage >
        1

    }

  };

};


// ========================================
// GET AUDIT LOGS FOR CHAMA
// ========================================
//
// Used by:
//
// Treasurer
// Auditor
//
// ========================================

export const getChamaAuditLogs = async ({

  chamaId,

  page =
    1,

  limit =
    20,

  action,

  actorUserId,

  resourceType,

  resourceId,

  startDate,

  endDate

}) => {

  // --------------------------------------
  // Validate Chama ID
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );


  // --------------------------------------
  // Build query
  // --------------------------------------

  const query = {

    scopeType:
      AUDIT_SCOPE_TYPES.CHAMA,

    chamaId

  };


  // --------------------------------------
  // Apply filters
  // --------------------------------------

  applyAuditFilters({

    query,

    action,

    actorUserId,

    resourceType,

    resourceId,

    startDate,

    endDate

  });


  // --------------------------------------
  // Execute
  // --------------------------------------

  return executeAuditLogQuery({

    query,

    page,

    limit

  });

};


// ========================================
// GET AUDIT LOGS FOR CONTRIBUTION GROUP
// ========================================
//
// Used by:
//
// Organizer
// Co-organizer
//
// ========================================

export const getContributionGroupAuditLogs = async ({

  contributionGroupId,

  page =
    1,

  limit =
    20,

  action,

  actorUserId,

  resourceType,

  resourceId,

  startDate,

  endDate

}) => {

  // --------------------------------------
  // Validate Contribution Group ID
  // --------------------------------------

  validateObjectId(

    contributionGroupId,

    'Contribution Group ID'

  );


  // --------------------------------------
  // Build query
  // --------------------------------------

  const query = {

    scopeType:
      AUDIT_SCOPE_TYPES.CONTRIBUTION_GROUP,

    contributionGroupId

  };


  // --------------------------------------
  // Apply filters
  // --------------------------------------

  applyAuditFilters({

    query,

    action,

    actorUserId,

    resourceType,

    resourceId,

    startDate,

    endDate

  });


  // --------------------------------------
  // Execute
  // --------------------------------------

  return executeAuditLogQuery({

    query,

    page,

    limit

  });

};


// ========================================
// GET AUDIT LOG BY ID
// ========================================
//
// Works for:
//
// Chama
//
// OR
//
// Contribution Group
//
// ========================================

export const getAuditLogById = async ({

  chamaId =
    null,

  contributionGroupId =
    null,

  auditLogId

}) => {

  // --------------------------------------
  // Validate Audit Log ID
  // --------------------------------------

  validateObjectId(

    auditLogId,

    'audit log ID'

  );


  // --------------------------------------
  // Validate Scope
  // --------------------------------------

  if (
    !chamaId &&
    !contributionGroupId
  ) {

    throw new AppError(

      'Chama ID or Contribution Group ID is required',

      400

    );

  }


  // --------------------------------------
  // Prevent Multiple Scopes
  // --------------------------------------

  if (
    chamaId &&
    contributionGroupId
  ) {

    throw new AppError(

      'Provide only one audit scope',

      400

    );

  }


  // --------------------------------------
  // Build Base Query
  // --------------------------------------

  const query = {

    _id:
      auditLogId

  };


  // ======================================
  // CHAMA SCOPE
  // ======================================

  if (
    chamaId
  ) {

    validateObjectId(

      chamaId,

      'Chama ID'

    );


    query.scopeType =
      AUDIT_SCOPE_TYPES.CHAMA;


    query.chamaId =
      chamaId;

  }


  // ======================================
  // CONTRIBUTION GROUP SCOPE
  // ======================================

  if (
    contributionGroupId
  ) {

    validateObjectId(

      contributionGroupId,

      'Contribution Group ID'

    );


    query.scopeType =
      AUDIT_SCOPE_TYPES.CONTRIBUTION_GROUP;


    query.contributionGroupId =
      contributionGroupId;

  }


  // ======================================
  // FIND AUDIT LOG
  // ======================================

  const auditLog =
    await AuditLog

      .findOne(
        query
      )

      .populate(

        'actorUserId',

        'name phone email'

      )

      .populate(

        'chamaId',

        'name status'

      )

      .populate(

        'contributionGroupId',

        'name status'

      )

      .lean();


  // ======================================
  // CHECK EXISTENCE
  // ======================================

  if (
    !auditLog
  ) {

    throw new AppError(

      'Audit log not found',

      404

    );

  }


  // ======================================
  // RETURN
  // ======================================

  return auditLog;

};


// ========================================
// EXPORT AUDIT SCOPE TYPES
// ========================================

export {
  AUDIT_SCOPE_TYPES
};