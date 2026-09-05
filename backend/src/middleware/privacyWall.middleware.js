import privacyWallService from '../services/privacyWall.service.js';

// ========================================
// PRIVACY WALL MIDDLEWARE
// ========================================
//
// Middleware for applying field-level access control
// to API responses based on user roles and privacy settings.
//
// ========================================

/**
 * Apply privacy wall to response data
 *
 * Usage: router.get('/members', applyPrivacyWall(), controller)
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.maskSensitive - Mask sensitive fields (default: true)
 * @param {boolean} options.includeMetadata - Include privacy metadata in response (default: false)
 * @param {string} options.dataPath - Path to data in response object (default: 'data')
 * @param {function} options.getActorMembershipId - Function to extract actor membership ID from request
 * @param {function} options.getChamaId - Function to extract chama ID from request
 */
export const applyPrivacyWall = (options = {}) => {
  const {
    maskSensitive = true,
    includeMetadata = false,
    dataPath = 'data',
    getActorMembershipId = null,
    getChamaId = null
  } = options;

  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to apply privacy filtering
    res.json = function(data) {
      // Extract membership ID and chama ID
      const actorMembershipId = getActorMembershipId 
        ? getActorMembershipId(req) 
        : (req.membership?._id || null);
      
      const chamaId = getChamaId 
        ? getChamaId(req) 
        : (req.chama?._id || req.params.chamaId || req.params.id || null);

      // If no membership context, skip privacy filtering
      if (!actorMembershipId || !chamaId) {
        return originalJson(data);
      }

      // Extract data to filter
      let dataToFilter = data;
      if (dataPath && data[dataPath]) {
        dataToFilter = data[dataPath];
      }

      // Apply privacy transformation
      privacyWallService.transformResponse(
        dataToFilter,
        actorMembershipId,
        chamaId,
        { maskSensitive, includeMetadata }
      )
      .then(filteredData => {
        // Reconstruct response with filtered data
        if (dataPath && data[dataPath]) {
          data[dataPath] = filteredData;
        } else {
          data = filteredData;
        }

        return originalJson(data);
      })
      .catch(error => {
        console.error('Privacy wall middleware error:', error);
        // On error, return original data (fail-safe)
        return originalJson(data);
      });
    };

    next();
  };
};

/**
 * Apply privacy wall to specific field in response
 *
 * Usage: router.get('/members/:id', applyPrivacyToField('member'), controller)
 *
 * @param {string} fieldName - The field name to apply privacy to
 * @param {object} options - Configuration options (same as applyPrivacyWall)
 */
export const applyPrivacyToField = (fieldName, options = {}) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      const actorMembershipId = req.membership?._id || null;
      const chamaId = req.chama?._id || req.params.chamaId || req.params.id || null;

      if (!actorMembershipId || !chamaId || !data[fieldName]) {
        return originalJson(data);
      }

      privacyWallService.transformResponse(
        data[fieldName],
        actorMembershipId,
        chamaId,
        options
      )
      .then(filteredData => {
        data[fieldName] = filteredData;
        return originalJson(data);
      })
      .catch(error => {
        console.error('Privacy field middleware error:', error);
        return originalJson(data);
      });
    };

    next();
  };
};

/**
 * Apply privacy wall to array of items in response
 *
 * Usage: router.get('/members', applyPrivacyToArray('members'), controller)
 *
 * @param {string} arrayName - The array field name to apply privacy to
 * @param {object} options - Configuration options (same as applyPrivacyWall)
 */
export const applyPrivacyToArray = (arrayName, options = {}) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      const actorMembershipId = req.membership?._id || null;
      const chamaId = req.chama?._id || req.params.chamaId || req.params.id || null;

      if (!actorMembershipId || !chamaId || !data[arrayName] || !Array.isArray(data[arrayName])) {
        return originalJson(data);
      }

      // Filter each item in the array
      const filterPromises = data[arrayName].map(item =>
        privacyWallService.transformResponse(item, actorMembershipId, chamaId, options)
      );

      Promise.all(filterPromises)
        .then(filteredItems => {
          data[arrayName] = filteredItems;
          return originalJson(data);
        })
        .catch(error => {
          console.error('Privacy array middleware error:', error);
          return originalJson(data);
        });
    };

    next();
  };
};

/**
 * Check if actor can access specific data category
 *
 * Usage: In controllers to conditionally show/hide features
 *
 * @param {string} dataCategory - The data category to check
 */
export const canAccessCategory = (dataCategory) => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(401).json({
          success: false,
          code: 'MEMBERSHIP_CONTEXT_REQUIRED',
          message: 'Membership context required'
        });
      }

      const actorRole = req.membership.role;
      const isOwnData = req.isOwnData || false;

      const canAccess = privacyWallService.canAccessCategory(
        actorRole,
        dataCategory,
        isOwnData
      );

      req.categoryAccess = {
        category: dataCategory,
        canAccess,
        role: actorRole,
        isOwnData
      };

      next();
    } catch (error) {
      console.error('Category access check error:', error);
      return res.status(500).json({
        success: false,
        code: 'CATEGORY_ACCESS_CHECK_ERROR',
        message: 'Error checking category access'
      });
    }
  };
};

/**
 * Require access to specific data category
 *
 * Usage: router.get('/financials', requireCategoryAccess('financial'), controller)
 *
 * @param {string} dataCategory - The data category required
 */
export const requireCategoryAccess = (dataCategory) => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(401).json({
          success: false,
          code: 'MEMBERSHIP_CONTEXT_REQUIRED',
          message: 'Membership context required'
        });
      }

      const actorRole = req.membership.role;
      const isOwnData = req.isOwnData || false;

      const canAccess = privacyWallService.canAccessCategory(
        actorRole,
        dataCategory,
        isOwnData
      );

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          code: 'CATEGORY_ACCESS_DENIED',
          message: `You do not have access to ${dataCategory} data`,
          requiredCategory: dataCategory,
          role: actorRole
        });
      }

      next();
    } catch (error) {
      console.error('Category access requirement error:', error);
      return res.status(500).json({
        success: false,
        code: 'CATEGORY_ACCESS_CHECK_ERROR',
        message: 'Error checking category access'
      });
    }
  };
};

/**
 * Set own data context for privacy checks
 *
 * Usage: In controllers when you know the data belongs to the actor
 *
 * @param {boolean} isOwnData - Whether the data belongs to the actor
 */
export const setOwnDataContext = (isOwnData) => {
  return (req, res, next) => {
    req.isOwnData = isOwnData;
    next();
  };
};

/**
 * Privacy wall helper for controller use
 *
 * Usage: In controllers to manually apply privacy filtering
 */
export const filterResponseData = async (data, req, options = {}) => {
  try {
    const actorMembershipId = req.membership?._id || null;
    const chamaId = req.chama?._id || req.params.chamaId || req.params.id || null;

    if (!actorMembershipId || !chamaId) {
      return data; // Return original data if no context
    }

    return await privacyWallService.transformResponse(
      data,
      actorMembershipId,
      chamaId,
      options
    );
  } catch (error) {
    console.error('Filter response data error:', error);
    return data; // Return original data on error
  }
};

/**
 * Get visible fields for current user
 *
 * Usage: In controllers to determine which fields to show in UI
 */
export const getVisibleFields = (req, dataCategory = null) => {
  try {
    if (!req.membership) {
      return [];
    }

    const actorRole = req.membership.role;
    const isOwnData = req.isOwnData || false;

    return privacyWallService.getVisibleFields(actorRole, isOwnData, dataCategory);
  } catch (error) {
    console.error('Get visible fields error:', error);
    return [];
  }
};

/**
 * Privacy information endpoint middleware
 *
 * Usage: router.get('/privacy-info', getPrivacyInfo, controller)
 */
export const getPrivacyInfo = async (req, res, next) => {
  try {
    if (!req.membership) {
      return res.status(401).json({
        success: false,
        code: 'MEMBERSHIP_CONTEXT_REQUIRED',
        message: 'Membership context required'
      });
    }

    const actorRole = req.membership.role;
    const ownConfig = privacyWallService.getPrivacyConfig(actorRole, true);
    const othersConfig = privacyWallService.getPrivacyConfig(actorRole, false);

    req.privacyInfo = {
      role: actorRole,
      ownData: {
        level: ownConfig.level,
        description: privacyWallService.getPrivacyLevelDescription(ownConfig.level),
        allowedFields: ownConfig.allowedFields,
        excludedFields: ownConfig.excludedFields
      },
      othersData: {
        level: othersConfig.level,
        description: privacyWallService.getPrivacyLevelDescription(othersConfig.level),
        allowedFields: othersConfig.allowedFields,
        excludedFields: othersConfig.excludedFields
      }
    };

    next();
  } catch (error) {
    console.error('Get privacy info error:', error);
    return res.status(500).json({
      success: false,
      code: 'PRIVACY_INFO_ERROR',
      message: 'Error retrieving privacy information'
    });
  }
};

export default {
  applyPrivacyWall,
  applyPrivacyToField,
  applyPrivacyToArray,
  canAccessCategory,
  requireCategoryAccess,
  setOwnDataContext,
  filterResponseData,
  getVisibleFields,
  getPrivacyInfo
};