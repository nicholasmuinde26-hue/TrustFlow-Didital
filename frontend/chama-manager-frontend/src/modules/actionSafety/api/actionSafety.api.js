import api from "@/app/services/api";

const actionSafetyApi = {
  // Assess action risk before confirmation
  assessActionRisk(action, chamaId, actionData) {
    return api.post(`/actions/${action}/assess-risk`, { chamaId, actionData });
  },

  // Generate confirmation dialog
  generateConfirmationDialog(action, chamaId, actionData) {
    return api.post(`/actions/${action}/confirmation-dialog`, { chamaId, actionData });
  },

  // Validate confirmation response
  validateConfirmationResponse(action, dialog, response) {
    return api.post(`/actions/${action}/validate-confirmation`, { dialog, response });
  },

  // Re-validate action before execution
  revalidateAction(action, chamaId, actionData, versionToken) {
    return api.post(`/actions/${action}/revalidate`, { chamaId, actionData, versionToken });
  },

  // Get warning explanation
  getWarningExplanation(warningType, actionData) {
    return api.get(`/actions/warnings/${warningType}/explanation`, { data: actionData });
  },
};

export default actionSafetyApi;