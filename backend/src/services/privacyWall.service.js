import ChamaMembership from '../models/ChamaMembership.js';

// ========================================
// PRIVACY WALL SERVICE
// ========================================
//
// Implements field-level access control for sensitive
// member data following the privacy wall architecture.
//
// Privacy Levels:
// - FULL: Complete access to all fields
// - PUBLIC: Basic profile information only
// - BASIC_CONTACT: Limited contact information
// - FINANCIAL_FULL: Complete financial access
// - FINANCIAL_SUMMARY: Limited financial information
// - ADMINISTRATIVE_FULL: Complete administrative access
// - IDENTITY_LIMITED: Limited identity information
// - CREDENTIALS_HIDDEN: Credentials are hidden
//
// ========================================

// ========================================
// PRIVACY CONFIGURATIONS PER ROLE
// ========================================

const PRIVACY_CONFIGURATIONS = {
  chairperson: {
    own: {
      level: 'FULL',
      allowedFields: ['*']
    },
    others: {
      level: 'FULL_EXCEPT_CREDENTIALS',
      allowedFields: ['*'],
      excludedFields: ['mpesa_credentials', 'bank_credentials', 'api_credentials']
    }
  },

  treasurer: {
    own: {
      level: 'FULL',
      allowedFields: ['*']
    },
    others: {
      level: 'FINANCIAL_FULL',
      allowedFields: [
        'profile.*',
        'contact.*',
        'financial.*',
        'identity.basic',
        'membership.*'
      ],
      excludedFields: [
        'mpesa_credentials',
        'bank_credentials',
        'api_credentials',
        'disciplinary.full'
      ]
    }
  },

  secretary: {
    own: {
      level: 'FULL',
      allowedFields: ['*']
    },
    others: {
      level: 'ADMINISTRATIVE_FULL',
      allowedFields: [
        'profile.*',
        'contact.basic',
        'financial.summary',
        'identity.basic',
        'membership.*',
        'administrative.*'
      ],
      excludedFields: [
        'financial.detailed',
        'contact.sensitive',
        'mpesa_credentials',
        'bank_credentials',
        'api_credentials',
        'disciplinary.full'
      ]
    }
  },

  auditor: {
    own: {
      level: 'FULL',
      allowedFields: ['*']
    },
    others: {
      level: 'FINANCIAL_HISTORICAL',
      allowedFields: [
        'profile.basic',
        'financial.historical',
        'financial.audit',
        'identity.limited',
        'membership.*',
        'audit.*'
      ],
      excludedFields: [
        'contact.sensitive',
        'mpesa_credentials',
        'bank_credentials',
        'api_credentials',
        'disciplinary.investigation'
      ]
    }
  },

  committee_member: {
    own: {
      level: 'FULL',
      allowedFields: ['*']
    },
    others: {
      level: 'LIMITED',
      allowedFields: [
        'profile.public',
        'contact.basic',
        'membership.basic'
      ],
      excludedFields: [
        'financial.*',
        'contact.sensitive',
        'identity.*',
        'disciplinary.*',
        'mpesa_credentials',
        'bank_credentials',
        'api_credentials'
      ]
    }
  },

  member: {
    own: {
      level: 'FULL',
      allowedFields: ['*']
    },
    others: {
      level: 'PUBLIC',
      allowedFields: [
        'profile.public',
        'membership.public'
      ],
      excludedFields: [
        'contact.*',
        'financial.*',
        'identity.*',
        'disciplinary.*',
        'mpesa_credentials',
        'bank_credentials',
        'api_credentials',
        'profile.private'
      ]
    }
  },

  patron: {
    own: {
      level: 'FULL',
      allowedFields: ['*']
    },
    others: {
      level: 'BASIC',
      allowedFields: [
        'profile.public',
        'membership.basic'
      ],
      excludedFields: [
        'contact.*',
        'financial.*',
        'identity.*',
        'disciplinary.*',
        'mpesa_credentials',
        'bank_credentials',
        'api_credentials'
      ]
    }
  }
};

// ========================================
// FIELD CATEGORIES FOR DATA CLASSIFICATION
// ========================================

const FIELD_CATEGORIES = {
  profile: {
    public: ['name', 'avatar_url', 'membership_number'],
    private: ['id_number', 'date_of_birth', 'gender', 'marital_status'],
    sensitive: ['national_id', 'passport_number', 'tax_id']
  },

  contact: {
    basic: ['phone', 'email'],
    sensitive: ['address', 'physical_address', 'postal_code', 'emergency_contact'],
    restricted: ['alternative_phone', 'work_phone', 'social_media']
  },

  financial: {
    summary: ['total_contributions', 'current_balance', 'loan_status'],
    detailed: ['contribution_history', 'loan_details', 'repayment_history', 'arrears'],
    sensitive: ['bank_account', 'mpesa_number', 'transaction_details', 'credit_score'],
    credentials: ['mpesa_credentials', 'bank_credentials', 'api_credentials']
  },

  identity: {
    basic: ['name', 'membership_number'],
    limited: ['id_number', 'phone'],
    full: ['id_number', 'date_of_birth', 'address', 'national_id']
  },

  membership: {
    public: ['role', 'status', 'joined_date'],
    basic: ['role', 'status', 'joined_date', 'payout_position'],
    full: ['*', 'disciplinary_info', 'committee_assignments']
  },

  disciplinary: {
    basic: ['is_under_discipline'],
    full: ['*', 'disciplinary_records', 'restrictions', 'case_details'],
    investigation: ['investigation_notes', 'evidence', 'case_status']
  },

  administrative: {
    basic: ['notes', 'tags'],
    full: ['*', 'internal_notes', 'admin_comments', 'flags']
  },

  audit: {
    basic: ['action', 'timestamp'],
    full: ['*', 'ip_address', 'user_agent', 'details']
  }
};

class PrivacyWallService {
  /**
   * Get privacy configuration for a role
   */
  getPrivacyConfig(role, isOwnData = false) {
    const config = PRIVACY_CONFIGURATIONS[role];
    if (!config) {
      // Default to most restrictive if role not found
      return {
        level: 'PUBLIC',
        allowedFields: ['profile.public', 'membership.public'],
        excludedFields: ['*']
      };
    }

    return isOwnData ? config.own : config.others;
  }

  /**
   * Check if actor can access specific field
   */
  canAccessField(actorRole, targetRole, fieldName, isOwnData = false) {
    const config = this.getPrivacyConfig(actorRole, isOwnData);

    // If all fields are allowed
    if (config.allowedFields.includes('*')) {
      // Check if field is in excluded list
      if (config.excludedFields && config.excludedFields.length > 0) {
        for (const excluded of config.excludedFields) {
          if (this.fieldMatchesPattern(fieldName, excluded)) {
            return false;
          }
        }
      }
      return true;
    }

    // Check if field matches any allowed pattern
    for (const allowed of config.allowedFields) {
      if (this.fieldMatchesPattern(fieldName, allowed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Filter data object based on privacy settings
   */
  filterData(data, actorMembershipId, chamaId) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Get actor membership
    return ChamaMembership.findById(actorMembershipId)
      .then(actorMembership => {
        if (!actorMembership) {
          // Return empty object if membership not found
          return {};
        }

        const actorRole = actorMembership.role;
        const isOwnData = this.isOwnData(actorMembershipId, data, chamaId);
        const config = this.getPrivacyConfig(actorRole, isOwnData);

        return this.filterObject(data, config);
      })
      .catch(error => {
        console.error('Privacy filter error:', error);
        return {}; // Return empty object on error
      });
  }

  /**
   * Filter object based on privacy configuration
   */
  filterObject(obj, config) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.filterObject(item, config));
    }

    const filtered = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (this.shouldIncludeField(key, config)) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            filtered[key] = this.filterObject(obj[key], config);
          } else {
            filtered[key] = obj[key];
          }
        }
      }
    }

    return filtered;
  }

  /**
   * Check if field should be included based on config
   */
  shouldIncludeField(fieldName, config) {
    // If all fields are allowed
    if (config.allowedFields.includes('*')) {
      // Check exclusions
      if (config.excludedFields && config.excludedFields.length > 0) {
        for (const excluded of config.excludedFields) {
          if (this.fieldMatchesPattern(fieldName, excluded)) {
            return false;
          }
        }
      }
      return true;
    }

    // Check if field matches any allowed pattern
    for (const allowed of config.allowedFields) {
      if (this.fieldMatchesPattern(fieldName, allowed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if field name matches a pattern (supports wildcards)
   */
  fieldMatchesPattern(fieldName, pattern) {
    if (pattern === '*') {
      return true;
    }

    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(fieldName);
    }

    return fieldName === pattern;
  }

  /**
   * Check if data belongs to the actor
   */
  isOwnData(actorMembershipId, data, chamaId) {
    // Check if data has user_id or membership_id field
    if (data.user_id && typeof data.user_id === 'object') {
      return String(data.user_id._id) === String(actorMembershipId);
    }
    if (data.membership_id && typeof data.membership_id === 'object') {
      return String(data.membership_id._id) === String(actorMembershipId);
    }
    if (data.user_id) {
      return String(data.user_id) === String(actorMembershipId);
    }
    if (data.membership_id) {
      return String(data.membership_id) === String(actorMembershipId);
    }
    if (data._id) {
      return String(data._id) === String(actorMembershipId);
    }

    return false;
  }

  /**
   * Get visible fields for a role
   */
  getVisibleFields(role, isOwnData = false, dataCategory = null) {
    const config = this.getPrivacyConfig(role, isOwnData);

    if (config.allowedFields.includes('*')) {
      if (dataCategory && FIELD_CATEGORIES[dataCategory]) {
        return FIELD_CATEGORIES[dataCategory].public || 
               FIELD_CATEGORIES[dataCategory].basic || 
               Object.keys(FIELD_CATEGORIES[dataCategory]).flat();
      }
      return ['*'];
    }

    // Expand patterns to actual field names
    const visibleFields = [];
    for (const pattern of config.allowedFields) {
      if (pattern.includes('.')) {
        const [category, subPattern] = pattern.split('.');
        if (FIELD_CATEGORIES[category]) {
          if (subPattern === '*') {
            visibleFields.push(...Object.values(FIELD_CATEGORIES[category]).flat());
          } else if (FIELD_CATEGORIES[category][subPattern]) {
            visibleFields.push(...FIELD_CATEGORIES[category][subPattern]);
          }
        }
      } else {
        visibleFields.push(pattern);
      }
    }

    return [...new Set(visibleFields)]; // Remove duplicates
  }

  /**
   * Mask sensitive fields (partial data exposure)
   */
  maskSensitiveField(fieldName, value) {
    if (!value) return value;

    const sensitiveFields = [
      'phone',
      'national_id',
      'id_number',
      'bank_account',
      'mpesa_number',
      'credit_card'
    ];

    if (!sensitiveFields.some(field => fieldName.toLowerCase().includes(field))) {
      return value;
    }

    const valueStr = String(value);

    // Mask phone numbers (show last 4 digits)
    if (fieldName.toLowerCase().includes('phone') && valueStr.length >= 10) {
      return valueStr.substring(0, valueStr.length - 4).replace(/\d/g, '*') + 
             valueStr.substring(valueStr.length - 4);
    }

    // Mask ID numbers (show last 4 digits)
    if (fieldName.toLowerCase().includes('id') && valueStr.length >= 8) {
      return valueStr.substring(0, valueStr.length - 4).replace(/\w/g, '*') + 
             valueStr.substring(valueStr.length - 4);
    }

    // Mask bank accounts (show last 4 digits)
    if (fieldName.toLowerCase().includes('account') && valueStr.length >= 8) {
      return '****' + valueStr.substring(valueStr.length - 4);
    }

    // Default masking
    return valueStr.substring(0, 2) + '****' + valueStr.substring(valueStr.length - 2);
  }

  /**
   * Apply privacy transformation to API response
   */
  transformResponse(data, actorMembershipId, chamaId, options = {}) {
    const {
      maskSensitive = true,
      includeMetadata = false
    } = options;

    return this.filterData(data, actorMembershipId, chamaId)
      .then(filteredData => {
        if (maskSensitive) {
          return this.maskSensitiveFields(filteredData);
        }
        return filteredData;
      })
      .then(filteredData => {
        if (includeMetadata) {
          return ChamaMembership.findById(actorMembershipId)
            .then(membership => {
              const actorRole = membership?.role || 'member';
              const isOwnData = this.isOwnData(actorMembershipId, data, chamaId);
              const config = this.getPrivacyConfig(actorRole, isOwnData);

              return {
                data: filteredData,
                privacy: {
                  role: actorRole,
                  privacyLevel: config.level,
                  isOwnData,
                  fieldsExposed: Object.keys(filteredData),
                  timestamp: new Date().toISOString()
                }
              };
            });
        }
        return filteredData;
      });
  }

  /**
   * Mask sensitive fields in data object
   */
  maskSensitiveFields(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSensitiveFields(item));
    }

    const masked = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          masked[key] = this.maskSensitiveFields(obj[key]);
        } else {
          masked[key] = this.maskSensitiveField(key, obj[key]);
        }
      }
    }

    return masked;
  }

  /**
   * Check if role can access category of data
   */
  canAccessCategory(actorRole, dataCategory, isOwnData = false) {
    const config = this.getPrivacyConfig(actorRole, isOwnData);
    const visibleFields = this.getVisibleFields(actorRole, isOwnData, dataCategory);

    return visibleFields.length > 0;
  }

  /**
   * Get privacy level description
   */
  getPrivacyLevelDescription(level) {
    const descriptions = {
      'FULL': 'Complete access to all data fields',
      'FULL_EXCEPT_CREDENTIALS': 'Complete access except sensitive credentials',
      'FINANCIAL_FULL': 'Complete financial access with some restrictions',
      'FINANCIAL_HISTORICAL': 'Historical financial data access for audit',
      'FINANCIAL_SUMMARY': 'Limited financial summary information',
      'ADMINISTRATIVE_FULL': 'Complete administrative access',
      'IDENTITY_LIMITED': 'Limited identity information access',
      'CREDENTIALS_HIDDEN': 'All credentials are hidden',
      'PUBLIC': 'Public profile information only',
      'BASIC': 'Basic profile information',
      'LIMITED': 'Very limited access to essential information'
    };

    return descriptions[level] || 'Unknown privacy level';
  }
}

export default new PrivacyWallService();