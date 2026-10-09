import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import presenceService from "../services/presence.service";

const PING_INTERVAL = 30_000; // tell the backend "I'm here" every 30s
const POLL_INTERVAL = 15_000; // check everyone else every 15s

// GET/POST /workspaces/:id/presence[/ping] aren't mounted on the backend
// yet, so every call 404s. Flip this to true (or wire it to an env var,
// e.g. import.meta.env.VITE_PRESENCE_ENABLED === "true") the day those
// routes exist — until then this keeps the feature fully off so it
// never fires a single request, rather than discovering the 404 at
// runtime on every page load.
const PRESENCE_ENABLED = false;

const isNotFound = (error) => error?.response?.status === 404;

// Returns { data: [{ id, name, status: "online"|"away"|"offline" }], ... }
// and pings the backend on an interval while mounted, so this workspace's
// presence list stays roughly current for everyone else looking at it.
//
// Every caller already defaults `data` to `[]`, so with PRESENCE_ENABLED
// off this is a silent no-op: no ping, no poll, no request at all. Once
// PRESENCE_ENABLED is true, it still guards against the routes 404ing
// (e.g. mid-rollout) — either call coming back 404 stops pinging and
// polling for that workspace instead of hammering a dead endpoint every
// few seconds, and tries again on a fresh mount.
export function usePresence(workspaceId) {
  const [unavailable, setUnavailable] = useState(!PRESENCE_ENABLED);

  useEffect(() => {
    setUnavailable(!PRESENCE_ENABLED);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || unavailable) return undefined;

    const sendPing = () => {
      presenceService.ping(workspaceId).catch((err) => {
        if (isNotFound(err)) setUnavailable(true);
      });
    };

    sendPing();
    const interval = setInterval(sendPing, PING_INTERVAL);
    return () => clearInterval(interval);
  }, [workspaceId, unavailable]);

  const query = useQuery({
    queryKey: ["presence", workspaceId],
    queryFn: () => presenceService.list(workspaceId),
    enabled: Boolean(workspaceId) && !unavailable,
    refetchInterval: unavailable ? false : POLL_INTERVAL,
    // Retrying a 404 just repeats the same failure — only retry the
    // kind of transient error (timeouts, 5xx) a retry might fix.
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  useEffect(() => {
    if (isNotFound(query.error)) setUnavailable(true);
  }, [query.error]);

  return query;
}