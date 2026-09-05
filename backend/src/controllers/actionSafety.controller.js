import actionSafetyEngine from '../services/actionSafety.service.js';
import confirmationDialogService from '../services/confirmationDialog.service.js';
import ChamaMembership from '../models/ChamaMembership.js';

/**
 * Assess action risk before confirmation
 */
export const assessActionRisk = async (req, res) => {
  try {
    const { user } = req;
    const { action } = req.params;
    const { chamaId, actionData } = req.body;

    // Get user's active membership
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      chama_id: chamaId,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found for this chama'
      });
    }

    // Assess action risk
    const riskAssessment = await actionSafetyEngine.assessActionRisk({
      action,
      membershipId: membership._id,
      chamaId,
      actionData
    });

    res.status(200).json({
      success: true,
      data: riskAssessment
    });

  } catch (error) {
    console.error('Assess action risk error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Generate confirmation dialog
 */
export const generateConfirmationDialog = async (req, res) => {
  try {
    const { user } = req;
    const { action } = req.params;
    const { chamaId, actionData } = req.body;

    // Get user's active membership
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      chama_id: chamaId,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found for this chama'
      });
    }

    // Generate confirmation dialog
    const result = await confirmationDialogService.generateConfirmationDialog({
      action,
      membershipId: membership._id,
      chamaId,
      actionData
    });

    if (!result.allowed) {
      return res.status(403).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      data: result.dialog,
      riskAssessment: result.riskAssessment
    });

  } catch (error) {
    console.error('Generate confirmation dialog error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Validate confirmation response
 */
export const validateConfirmationResponse = async (req, res) => {
  try {
    const { action } = req.params;
    const { dialog, response } = req.body;

    // Validate confirmation response
    const validation = confirmationDialogService.validateConfirmationResponse(
      action,
      dialog,
      response
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        message: validation.message
      });
    }

    res.status(200).json({
      success: true,
      data: { valid: true }
    });

  } catch (error) {
    console.error('Validate confirmation response error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Re-validate action before execution
 */
export const revalidateAction = async (req, res) => {
  try {
    const { user } = req;
    const { action } = req.params;
    const { chamaId, actionData, versionToken } = req.body;

    // Get user's active membership
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      chama_id: chamaId,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found for this chama'
      });
    }

    // Re-validate action
    const revalidation = await confirmationDialogService.revalidateAction({
      action,
      membershipId: membership._id,
      chamaId,
      actionData,
      versionToken
    });

    if (!revalidation.valid) {
      return res.status(400).json({
        success: false,
        error: revalidation.reason,
        message: revalidation.message,
        currentData: revalidation.currentData
      });
    }

    res.status(200).json({
      success: true,
      data: { valid: true }
    });

  } catch (error) {
    console.error('Re-validate action error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get warning explanation
 */
export const getWarningExplanation = async (req, res) => {
  try {
    const { warningType } = req.params;
    const { actionData } = req.body;

    // Get warning explanation
    const explanation = confirmationDialogService.getWarningExplanation(
      warningType,
      actionData
    );

    res.status(200).json({
      success: true,
      data: explanation
    });

  } catch (error) {
    console.error('Get warning explanation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};