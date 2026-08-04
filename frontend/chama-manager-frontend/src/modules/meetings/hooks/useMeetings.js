import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import meetingsService from "../services/meetings.service";

function meetingsKey(workspaceId) {
  return ["meetings", workspaceId];
}

export function useMeetings(workspaceId) {
  return useQuery({
    queryKey: meetingsKey(workspaceId),
    queryFn: () => meetingsService.list(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateMeeting(workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => meetingsService.create(workspaceId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingsKey(workspaceId) });
    },
  });
}

export function useDeleteMeeting(workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meetingId) => meetingsService.remove(workspaceId, meetingId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingsKey(workspaceId) });
    },
  });
}