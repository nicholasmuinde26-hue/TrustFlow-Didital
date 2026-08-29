import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import pollsService from "../services/polls.service";

function pollsKey(workspaceId, status) {
  return ["polls", workspaceId, status || "all"];
}

function pollKey(workspaceId, pollId) {
  return ["poll", workspaceId, pollId];
}

// Polls that are open can change every time someone votes — a short
// refetch interval keeps turnout/results feeling "live" without wiring a
// dedicated socket listener on the frontend for a first version.
const LIVE_REFETCH_MS = 15_000;

export function usePolls(workspaceId, status) {
  return useQuery({
    queryKey: pollsKey(workspaceId, status),
    queryFn: () => pollsService.list(workspaceId, status),
    enabled: Boolean(workspaceId),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function usePoll(workspaceId, pollId) {
  return useQuery({
    queryKey: pollKey(workspaceId, pollId),
    queryFn: () => pollsService.get(workspaceId, pollId),
    enabled: Boolean(workspaceId) && Boolean(pollId),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

function useInvalidatePolls(workspaceId) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["polls", workspaceId] });
}

export function useCreatePoll(workspaceId) {
  const invalidate = useInvalidatePolls(workspaceId);

  return useMutation({
    mutationFn: (payload) => pollsService.create(workspaceId, payload),
    onSuccess: invalidate,
  });
}

export function usePublishPoll(workspaceId) {
  const invalidate = useInvalidatePolls(workspaceId);

  return useMutation({
    mutationFn: (pollId) => pollsService.publish(workspaceId, pollId),
    onSuccess: invalidate,
  });
}

export function useCastVote(workspaceId) {
  const invalidate = useInvalidatePolls(workspaceId);

  return useMutation({
    mutationFn: ({ pollId, optionIds }) => pollsService.vote(workspaceId, pollId, optionIds),
    onSuccess: invalidate,
  });
}

export function useClosePoll(workspaceId) {
  const invalidate = useInvalidatePolls(workspaceId);

  return useMutation({
    mutationFn: (pollId) => pollsService.close(workspaceId, pollId),
    onSuccess: invalidate,
  });
}

export function useCancelPoll(workspaceId) {
  const invalidate = useInvalidatePolls(workspaceId);

  return useMutation({
    mutationFn: (pollId) => pollsService.cancel(workspaceId, pollId),
    onSuccess: invalidate,
  });
}
