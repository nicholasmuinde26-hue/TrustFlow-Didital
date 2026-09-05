import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import actionSafetyApi from "../api/actionSafety.api";

// Action Risk Assessment Hook
export function useAssessActionRisk() {
  return useMutation({
    mutationFn: ({ action, chamaId, actionData }) =>
      actionSafetyApi.assessActionRisk(action, chamaId, actionData),
  });
}

// Confirmation Dialog Hook
export function useGenerateConfirmationDialog() {
  return useMutation({
    mutationFn: ({ action, chamaId, actionData }) =>
      actionSafetyApi.generateConfirmationDialog(action, chamaId, actionData),
  });
}

// Validate Confirmation Response Hook
export function useValidateConfirmationResponse() {
  return useMutation({
    mutationFn: ({ action, dialog, response }) =>
      actionSafetyApi.validateConfirmationResponse(action, dialog, response),
  });
}

// Re-validate Action Hook
export function useRevalidateAction() {
  return useMutation({
    mutationFn: ({ action, chamaId, actionData, versionToken }) =>
      actionSafetyApi.revalidateAction(action, chamaId, actionData, versionToken),
  });
}

// Warning Explanation Hook
export function useWarningExplanation(warningType, actionData) {
  return useQuery({
    queryKey: ["actionSafety", "warningExplanation", warningType, actionData],
    queryFn: async () => {
      const res = await actionSafetyApi.getWarningExplanation(warningType, actionData);
      return res.data?.data || res.data;
    },
    enabled: !!warningType,
  });
}