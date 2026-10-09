import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
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

// ========================================
// NOTIFICATION BADGES (nav + section tabs + bell)
// ========================================
//
// Single shared source of truth for "does this route/category have a
// pending update" so the section tab bar, the sidebar nav, and the
// notification bell's category tabs all agree with each other. Reads off
// the same two queries the bell already fetches (useUnreadNotifications +
// useNotificationCounts), so this adds no extra network calls beyond
// raising the unread fetch's limit enough to sample every pending route.
//
// Route matching relies on each notification's `action_url` (backend now
// fills this in for every domain-event notification - see
// notification.constants.js's per-type `route`). A notification whose
// action_url is `/workspace/123/loans` marks the "Loans" section tab and
// sidebar item as having an update; `hasUpdateForRoute` prefix-matches so
// a nested page like `/workspace/123/loans/42` still lights up "Loans".
export function useNotificationBadges() {
  const { data: notifications } = useUnreadNotifications({ limit: 100 });
  const { data: counts } = useNotificationCounts();

  return useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : [];
    const routes = [];

    list.forEach((item) => {
      if (!item.action_url) return;
      routes.push(normalizePath(item.action_url));
    });

    // How many unread items live on this page or anywhere beneath it. The
    // sidebar icon for "Finance" counts everything under /finance/..., while
    // the "Contributions" tab counts only its own page.
    function countForRoute(to) {
      if (!to) return 0;
      const base = normalizePath(to);
      return routes.reduce(
        (total, path) =>
          path === base || path.startsWith(`${base}/`) ? total + 1 : total,
        0
      );
    }

    return {
      unreadTotal: counts?.unread || 0,
      byCategory: counts?.byCategory || {},
      actionRequiredTotal: counts?.actionRequired || 0,
      countForRoute,
      hasUpdateForRoute: (to) => countForRoute(to) > 0,
    };
  }, [notifications, counts]);
}

// Strip query string / hash / trailing slash so "/workspace/1/loans/?a=1"
// and "/workspace/1/loans" compare equal.
export function normalizePath(value) {
  const path = String(value || "").split("?")[0].split("#")[0];
  return path.length > 1 ? path.replace(/\/+$/, "") : path || "/";
}

// ========================================
// CLEAR THE BADGE WHEN THE PAGE IS VIEWED
// ========================================
//
// Mount once inside the workspace layout. Whenever the page the person is
// looking at has unread notifications pointing at it (including ones that
// arrive while they are already on it), mark them read. The badge on the
// nav icon / section tab goes away immediately (optimistic), then the server
// confirms. Exact-page match only: opening "Finance" does not clear the
// "Contributions" badge.
export function useClearNotificationsOnVisit() {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { data: unread } = useUnreadNotifications({ limit: 100 });
  const sent = useRef(new Set());

  useEffect(() => {
    const list = Array.isArray(unread) ? unread : [];
    const here = normalizePath(pathname);

    const matching = list.filter(
      (item) =>
        item.action_url &&
        normalizePath(item.action_url) === here &&
        !sent.current.has(String(item._id))
    );
    if (matching.length === 0) return;

    const ids = new Set(matching.map((item) => String(item._id)));
    ids.forEach((id) => sent.current.add(id));

    // Optimistic: drop them from every cached unread list and the counter.
    queryClient.setQueriesData({ queryKey: ["notifications", "unread"] }, (old) =>
      Array.isArray(old) ? old.filter((item) => !ids.has(String(item._id))) : old
    );
    queryClient.setQueryData(["notifications", "counts"], (old) =>
      old ? { ...old, unread: Math.max((old.unread || 0) - ids.size, 0) } : old
    );

    notificationsApi
      .markReadByRoute(here)
      .catch(() => ids.forEach((id) => sent.current.delete(id)))
      .finally(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
  }, [pathname, unread, queryClient]);
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