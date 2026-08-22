import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import notificationsApi from "../api/notifications.api";

export function useNotifications(params = {}) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: async () => {
      const res = await notificationsApi.getNotifications(params);
      return res.data?.data || res.data;
    },
    refetchInterval: 15000, // Poll every 15s for live notifications
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
