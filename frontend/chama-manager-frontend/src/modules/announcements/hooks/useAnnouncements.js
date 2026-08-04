import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import announcementsService from "../services/announcements.service";

function announcementsKey(workspaceId) {
  return ["announcements", workspaceId];
}

export function useAnnouncements(workspaceId) {
  return useQuery({
    queryKey: announcementsKey(workspaceId),
    queryFn: () => announcementsService.list(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateAnnouncement(workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      announcementsService.create(workspaceId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: announcementsKey(workspaceId),
      });
    },
  });
}

export function useSetAnnouncementPinned(workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ announcementId, pinned }) =>
      announcementsService.setPinned(workspaceId, announcementId, pinned),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: announcementsKey(workspaceId),
      });
    },
  });
}

export function useDeleteAnnouncement(workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (announcementId) =>
      announcementsService.remove(workspaceId, announcementId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: announcementsKey(workspaceId),
      });
    },
  });
}