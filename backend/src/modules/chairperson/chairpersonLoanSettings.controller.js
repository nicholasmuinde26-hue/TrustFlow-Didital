import chairpersonLoanSettingsService from '../../services/chairpersonLoanSettings.service.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { preventSelfAction } from '../../middleware/permission.middleware.js';

// ========================================
// GET CHAIRPERSON LOAN SETTINGS
// ========================================
//
// GET /api/v1/chamas/:chamaId/chairperson-loan-settings
//
// Requirements:
// - Authentication
// - Active Chama membership
// - settings.view permission
//
// ========================================

export const getChairpersonLoanSettingsController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const actorMembershipId = req.membership._id;

    const settings = await chairpersonLoanSettingsService.getSettings(chamaId, actorMembershipId);

    res.status(200).json({
      success: true,
      data: {
        settings
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE CHAIRPERSON LOAN SETTINGS
// ========================================
//
// PATCH /api/v1/chamas/:chamaId/chairperson-loan-settings
//
// Requirements:
// - Authentication
// - Active Chama membership
// - settings.manage permission
// - Chairperson role (typically)
//
// Body can include any of the settings sections:
// - interest_rate_settings
// - max_loan_settings
// - repayment_settings
// - eligibility_settings
// - guarantor_settings
// - penalty_settings
// - loan_types
// - approval_workflow
// - disbursement_config
// - security_settings
//
// ========================================

export const updateChairpersonLoanSettingsController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const actorMembershipId = req.membership._id;
    const updates = req.body;
    const { changeReason } = req.body;

    // Remove changeReason from updates as it's not a setting
    const settingsUpdates = { ...updates };
    delete settingsUpdates.changeReason;

    const result = await chairpersonLoanSettingsService.updateSettings(
      chamaId,
      actorMembershipId,
      settingsUpdates,
      changeReason || 'Settings updated via API'
    );

    // Check if result requires approval
    if (result.requiresApproval) {
      return res.status(202).json({
        success: true,
        message: result.message,
        data: {
          requiresApproval: true,
          reason: result.reason,
          currentSettings: result.currentSettings,
          requestedChanges: result.requestedChanges
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Loan settings updated successfully',
      data: {
        settings: result
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// RESET CHAIRPERSON LOAN SETTINGS TO DEFAULTS
// ========================================
//
// POST /api/v1/chamas/:chamaId/chairperson-loan-settings/reset
//
// Requirements:
// - Authentication
// - Active Chama membership
// - settings.manage permission
//
// ========================================

export const resetChairpersonLoanSettingsController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const actorMembershipId = req.membership._id;
    const { reason } = req.body;

    const settings = await chairpersonLoanSettingsService.resetToDefaults(
      chamaId,
      actorMembershipId,
      reason || 'Settings reset to defaults'
    );

    res.status(200).json({
      success: true,
      message: 'Loan settings reset to defaults successfully',
      data: {
        settings
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET SETTINGS CHANGE HISTORY
// ========================================
//
// GET /api/v1/chamas/:chamaId/chairperson-loan-settings/history
//
// Requirements:
// - Authentication
// - Active Chama membership
// - audit.view permission
//
// ========================================

export const getSettingsHistoryController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const actorMembershipId = req.membership._id;

    const history = await chairpersonLoanSettingsService.getSettingsHistory(chamaId, actorMembershipId);

    res.status(200).json({
      success: true,
      data: {
        history
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// CHECK IF CHAIRPERSON CAN APPROVE LOAN
// ========================================
//
// GET /api/v1/chamas/:chamaId/chairperson-loan-settings/can-approve/:loanId
//
// Requirements:
// - Authentication
// - Active Chama membership
// - Chairperson role
//
// ========================================

export const canApproveLoanController = async (req, res, next) => {
  try {
    const { chamaId, loanId } = req.params;
    const chairpersonMembershipId = req.membership._id;

    const result = await chairpersonLoanSettingsService.canApproveLoan(
      chamaId,
      chairpersonMembershipId,
      loanId
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// CHECK IF SETTINGS CAN BE CHANGED
// ========================================
//
// POST /api/v1/chamas/:chamaId/chairperson-loan-settings/can-change
//
// Requirements:
// - Authentication
// - Active Chama membership
// - settings.view permission
//
// Body:
// {
//   "settingType": "interest_rate",
//   "newValue": 15
// }
//
// ========================================

export const canChangeSettingsController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const actorMembershipId = req.membership._id;
    const { settingType, newValue } = req.body;

    const result = await chairpersonLoanSettingsService.canChangeSettings(
      chamaId,
      settingType,
      newValue
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET LOAN TYPE CONFIGURATION
// ========================================
//
// GET /api/v1/chamas/:chamaId/chairperson-loan-settings/loan-types
//
// Requirements:
// - Authentication
// - Active Chama membership
// - settings.view permission
//
// ========================================

export const getLoanTypesController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const actorMembershipId = req.membership._id;

    const settings = await chairpersonLoanSettingsService.getSettings(chamaId, actorMembershipId);

    res.status(200).json({
      success: true,
      data: {
        loanTypes: settings.loan_types
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// ADD LOAN TYPE
// ========================================
//
// POST /api/v1/chamas/:chamaId/chairperson-loan-settings/loan-types
//
// Requirements:
// - Authentication
// - Active Chama membership
// - settings.manage permission
//
// ========================================

export const addLoanTypeController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const actorMembershipId = req.membership._id;
    const loanTypeData = req.body;

    const settings = await chairpersonLoanSettingsService.getSettings(chamaId, actorMembershipId);

    // Add new loan type
    settings.loan_types.push(loanTypeData);

    const updatedSettings = await chairpersonLoanSettingsService.updateSettings(
      chamaId,
      actorMembershipId,
      { loan_types: settings.loan_types },
      `Added loan type: ${loanTypeData.type_name}`
    );

    res.status(201).json({
      success: true,
      message: 'Loan type added successfully',
      data: {
        loanType: loanTypeData,
        settings: updatedSettings
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE LOAN TYPE
// ========================================
//
// PATCH /api/v1/chamas/:chamaId/chairperson-loan-settings/loan-types/:typeName
//
// Requirements:
// - Authentication
// - Active Chama membership
// - settings.manage permission
//
// ========================================

export const updateLoanTypeController = async (req, res, next) => {
  try {
    const { chamaId, typeName } = req.params;
    const actorMembershipId = req.membership._id;
    const updates = req.body;

    const settings = await chairpersonLoanSettingsService.getSettings(chamaId, actorMembershipId);

    // Find and update the loan type
    const loanTypeIndex = settings.loan_types.findIndex(lt => lt.type_name === typeName);
    if (loanTypeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Loan type not found'
      });
    }

    settings.loan_types[loanTypeIndex] = { ...settings.loan_types[loanTypeIndex], ...updates };

    const updatedSettings = await chairpersonLoanSettingsService.updateSettings(
      chamaId,
      actorMembershipId,
      { loan_types: settings.loan_types },
      `Updated loan type: ${typeName}`
    );

    res.status(200).json({
      success: true,
      message: 'Loan type updated successfully',
      data: {
        loanType: settings.loan_types[loanTypeIndex],
        settings: updatedSettings
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// ENABLE/DISABLE LOAN TYPE
// ========================================
//
// PATCH /api/v1/chamas/:chamaId/chairperson-loan-settings/loan-types/:typeName/toggle
//
// Requirements:
// - Authentication
// - Active Chama membership
// - settings.manage permission
//
// ========================================

export const toggleLoanTypeController = async (req, res, next) => {
  try {
    const { chamaId, typeName } = req.params;
    const actorMembershipId = req.membership._id;

    const settings = await chairpersonLoanSettingsService.getSettings(chamaId, actorMembershipId);

    const loanTypeIndex = settings.loan_types.findIndex(lt => lt.type_name === typeName);
    if (loanTypeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Loan type not found'
      });
    }

    settings.loan_types[loanTypeIndex].enabled = !settings.loan_types[loanTypeIndex].enabled;

    const updatedSettings = await chairpersonLoanSettingsService.updateSettings(
      chamaId,
      actorMembershipId,
      { loan_types: settings.loan_types },
      `${settings.loan_types[loanTypeIndex].enabled ? 'Enabled' : 'Disabled'} loan type: ${typeName}`
    );

    res.status(200).json({
      success: true,
      message: `Loan type ${settings.loan_types[loanTypeIndex].enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        loanType: settings.loan_types[loanTypeIndex],
        settings: updatedSettings
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// DELETE LOAN TYPE
// ========================================
//
// DELETE /api/v1/chamas/:chamaId/chairperson-loan-settings/loan-types/:typeName
//
// Requirements:
// - Authentication
// - Active Chama membership
// - settings.manage permission
//
// ========================================

export const deleteLoanTypeController = async (req, res, next) => {
  try {
    const { chamaId, typeName } = req.params;
    const actorMembershipId = req.membership._id;

    const settings = await chairpersonLoanSettingsService.getSettings(chamaId, actorMembershipId);

    const loanTypeIndex = settings.loan_types.findIndex(lt => lt.type_name === typeName);
    if (loanTypeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Loan type not found'
      });
    }

    // Prevent deletion of standard loan type
    if (typeName === 'standard') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete standard loan type'
      });
    }

    settings.loan_types.splice(loanTypeIndex, 1);

    const updatedSettings = await chairpersonLoanSettingsService.updateSettings(
      chamaId,
      actorMembershipId,
      { loan_types: settings.loan_types },
      `Deleted loan type: ${typeName}`
    );

    res.status(200).json({
      success: true,
      message: 'Loan type deleted successfully',
      data: {
        settings: updatedSettings
      }
    });
  } catch (error) {
    next(error);
  }
};