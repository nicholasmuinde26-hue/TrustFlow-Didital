import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import financeService from "@/modules/finance/services/finance.service";
import loanService from "@/modules/loans/services/loan.service";
import mgrApi from "../api/mgr.api";
import contributionPlanApi from "@/modules/contribution-group/api/contributionPlan.api";

const ROOT = "chama-overview";

// One place for every Overview read that isn't already behind its own hook.
// Officials-only reads are gated on `isFullView` so a plain member never
// fires a request the backend would 403 anyway. Each read reports its own
// loading / error state so one failing card never blanks the page.
export default function useChamaOverviewData(workspaceId, isFullView, modules = null) {
  const qc = useQueryClient();
  const opts = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true };
  const official = Boolean(workspaceId && isFullView);
  // `modules` = workspace.modules. A chama that switched Loans or MGR off must
  // not fire reads the backend now refuses; null means "no module info".
  const on = (key) => !Array.isArray(modules) || modules.includes(key);

  const trend = useQuery({ queryKey: [ROOT, workspaceId, "trend"], queryFn: () => financeService.getTrend(workspaceId), enabled: official, ...opts });
  const gl = useQuery({ queryKey: [ROOT, workspaceId, "gl"], queryFn: () => financeService.getGlBalance(workspaceId), enabled: official, ...opts });
  const loans = useQuery({ queryKey: [ROOT, workspaceId, "loans"], queryFn: () => loanService.getDashboard(workspaceId), enabled: official && on("loans"), ...opts });
  const contrib = useQuery({ queryKey: [ROOT, workspaceId, "contrib"], queryFn: async () => (await contributionPlanApi.getMemberContributions(workspaceId))?.data?.data ?? null, enabled: official && on("contributions"), ...opts });
  const mgr = useQuery({ queryKey: [ROOT, workspaceId, "mgr"], queryFn: async () => (await mgrApi.getOverview(workspaceId))?.data?.data ?? null, enabled: Boolean(workspaceId) && on("mgr"), ...opts });

  // A payment completing anywhere in the app refreshes every read here.
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: [ROOT, workspaceId] });
    window.addEventListener("finance:updated", refresh);
    return () => window.removeEventListener("finance:updated", refresh);
  }, [qc, workspaceId]);

  const shape = (q, enabled) => ({ data: q.data, loading: enabled && q.data === undefined && !q.isError, error: q.isError, refetch: q.refetch });
  return {
    trend: shape(trend, official),
    gl: shape(gl, official),
    loans: shape(loans, official),
    contrib: shape(contrib, official),
    mgr: shape(mgr, Boolean(workspaceId)),
  };
}

// Collapsed / expanded state of each section, remembered per chama and per
// role so a treasurer who keeps "Loan book" open finds it that way. `variant`
// keeps an official's layout and a member's layout from overwriting each other.
export function useSectionState(workspaceId, defaults, variant = "default") {
  const key = `chama-overview:v2:${variant}:${workspaceId}`;
  const read = useCallback(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return defaults; }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState(read);
  useEffect(() => setState(read()), [read]);
  const persist = useCallback((next) => {
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  }, [key]);
  const toggle = useCallback((id) => setState((prev) => persist({ ...prev, [id]: !prev[id] })), [persist]);
  // Expand or collapse a whole set of sections in one go ("Expand all").
  const setMany = useCallback((ids, open) => setState((prev) => {
    const next = { ...prev };
    ids.forEach((id) => { next[id] = open; });
    return persist(next);
  }), [persist]);
  return [state, toggle, setMany];
}