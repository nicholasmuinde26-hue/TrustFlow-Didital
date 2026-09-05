import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import notificationsApi from "../api/notifications.api";

// Notification Center Hooks
export function useUnreadNotifications(params = {}) {
  return useQuery({
    queryKey: ["notifications", "unread", params],
    queryFn: async () => {
      const res = await notificationsApi.getUnreadNotifications(params);
      return res.data?.data || res.data;
    },
    refetchInterval: 10000, // Poll every 10s for live notifications
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}

export function useActionRequiredNotifications(params = {}) {
  return useQuery({
    queryKey: ["notifications", "action-required", params],
    queryFn: async () => {
      const res = await notificationsApi.getActionRequiredNotifications(params);
      return res.data?.data || res.data;
    },
    refetchInterval: 10000,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}

export function useHighPriorityNotifications(params = {}) {
  return useQuery({
    queryKey: ["notifications", "high-priority", params],
    queryFn: async () => {
      const res = await notificationsApi.getHighPriorityNotifications(params);
      return res.data?.data || res.data;
    },
    refetchInterval: 10000,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationsByCategory(category, params = {}) {
  return useQuery({
    queryKey: ["notifications", "category", category, params],
    queryFn: async () => {
      const res = await notificationsApi.getNotificationsByCategory(category, params);
      return res.data?.data || res.data;
    },
    refetchInterval: 10000,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationCounts() {
  return useQuery({
    queryKey: ["notifications", "counts"],
    queryFn: async () => {
      const res = await notificationsApi.getNotificationCounts();
      return res.data?.data || res.data;
    },
    refetchInterval: 10000,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}

// Notification Management Hooks
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId) => notificationsApi.markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "counts"] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "counts"] });
    },
  });
}

export function useMarkNotificationAsArchived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId) => notificationsApi.markNotificationAsArchived(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "counts"] });
    },
  });
}

export function useMarkActionCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ notificationId, actionTaken, metadata }) => 
      notificationsApi.markActionCompleted(notificationId, { actionTaken, metadata }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "counts"] });
    },
  });
}

// Preferences Hooks
export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: async () => {
      const res = await notificationsApi.getNotificationPreferences();
      return res.data?.data || res.data;
    },
    staleTime: 300000, // 5 minutes
  });
}

export function useUpdateDefaultChannelPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelPreferences) => 
      notificationsApi.updateDefaultChannelPreferences(channelPreferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

export function useUpdateCategoryPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ category, categoryPreferences }) => 
      notificationsApi.updateCategoryPreferences(category, categoryPreferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

export function useUpdateQuietHours() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quietHoursSettings) => 
      notificationsApi.updateQuietHours(quietHoursSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

export function useUpdateDoNotDisturb() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ enabled, until }) => 
      notificationsApi.updateDoNotDisturb(enabled, until),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

export function useUpdateMobileSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mobileSettings) => 
      notificationsApi.updateMobileSettings(mobileSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

export function useUpdateEmailSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailSettings) => 
      notificationsApi.updateEmailSettings(emailSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

export function useUpdateSMSSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (smsSettings) => 
      notificationsApi.updateSMSSettings(smsSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

export function useResetPreferencesToDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.resetPreferencesToDefaults(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

// Template Hooks
export function useConfirmationTemplate(templateType, data = {}) {
  return useQuery({
    queryKey: ["notifications", "confirmation-template", templateType, data],
    queryFn: async () => {
      const res = await notificationsApi.getConfirmationTemplate(templateType, data);
      return res.data?.data || res.data;
    },
    enabled: !!templateType,
  });
}

export function useToastTemplate(toastType) {
  return useQuery({
    queryKey: ["notifications", "toast-template", toastType],
    queryFn: async () => {
      const res = await notificationsApi.getToastTemplate(toastType);
      return res.data?.data || res.data;
    },
    enabled: !!toastType,
  });
}

// Toast Notification Hook
export function useSendToastNotification() {
  return useMutation({
    mutationFn: ({ toastType, messageData, duration }) => 
      notificationsApi.sendToastNotification(toastType, messageData, duration),
  });
}

// Legacy compatibility
export function useNotifications(params = {}) {
  return useUnreadNotifications(params);
}

export function useMarkNotificationRead() {
  return useMarkNotificationAsRead();
}

export function useMarkAllNotificationsRead() {
  return useMarkAllNotificationsAsRead();
}
