import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import presenceService from "../services/presence.service";

const PING_INTERVAL = 30_000; // tell the backend "I'm here" every 30s
const POLL_INTERVAL = 15_000; // check everyone else every 15s

// Returns { data: [{ id, name, status: "online"|"away"|"offline" }], ... }
// and pings the backend on an interval while mounted, so this workspace's
// presence list stays roughly current for everyone else looking at it.
export function usePresence(workspaceId) {
  useEffect(() => {
    if (!workspaceId) return undefined;

    presenceService.ping(workspaceId).catch(() => {});

    const interval = setInterval(() => {
      presenceService.ping(workspaceId).catch(() => {});
    }, PING_INTERVAL);

    return () => clearInterval(interval);
  }, [workspaceId]);

  return useQuery({
    queryKey: ["presence", workspaceId],
    queryFn: () => presenceService.list(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: POLL_INTERVAL,
  });
}