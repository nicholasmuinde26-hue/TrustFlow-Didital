import { useQuery } from "@tanstack/react-query";

import financeService from "@/modules/finance/services/finance.service";
import membersService from "@/modules/members/services/members.service";
import auditLogService from "@/modules/audit/services/auditLog.service";
import pollsService from "@/modules/polls/services/polls.service";
import trustScoreService from "@/modules/trustScore/services/trustScore.service";

const ROOT = "chama-overview-pro";

// Extra reads for the Chairperson / Treasurer command overview. Same contract
// as useChamaOverviewData: each read reports its own loading / error state so
// one failing card never blanks the page, and everything is officials-only
// (`enabled` is false for plain members, so no request a 403 would reject).
//
// `modules` is workspace.modules; a chama that switched polls off does not
// fire the polls read.
// `canViewAudit` is narrower than `enabled`: the backend's requireAuditAccess
// admits only treasurer/auditor, so a chairperson would get a 403 here.
export default function useOverviewPro(workspaceId, enabled, modules = null, canViewAudit = false) {
  const official = Boolean(workspaceId && enabled);
  const on = (key) => !Array.isArray(modules) || modules.includes(key);
  const opts = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true };

  const members = useQuery({
    queryKey: [ROOT, workspaceId, "members"],
    queryFn: () => membersService.list("chama", workspaceId),
    enabled: official,
    ...opts,
  });

  const accounts = useQuery({
    queryKey: [ROOT, workspaceId, "accounts"],
    queryFn: () => financeService.getAccounts(workspaceId),
    enabled: official,
    ...opts,
  });

  const audit = useQuery({
    queryKey: [ROOT, workspaceId, "audit"],
    queryFn: () => auditLogService.list(workspaceId, { page: 1, limit: 5 }),
    enabled: official && canViewAudit,
    ...opts,
  });

  const polls = useQuery({
    queryKey: [ROOT, workspaceId, "polls-open"],
    queryFn: () => pollsService.list(workspaceId, "open"),
    enabled: official && on("polls"),
    ...opts,
  });

  const trustHistory = useQuery({
    queryKey: [ROOT, workspaceId, "trust-history"],
    queryFn: () => trustScoreService.getHistory(workspaceId, { page: 1, limit: 6 }),
    enabled: official,
    ...opts,
  });

  const shape = (q, gate) => ({
    data: q.data,
    loading: gate && q.data === undefined && !q.isError,
    error: q.isError,
    refetch: q.refetch,
  });

  return {
    members: shape(members, official),
    accounts: shape(accounts, official),
    audit: shape(audit, official && canViewAudit),
    polls: shape(polls, official && on("polls")),
    trustHistory: shape(trustHistory, official),
  };
}