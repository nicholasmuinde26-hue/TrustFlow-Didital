import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import contributionGroupService from "../services/contributionGroup.service";

export function useContributionGroupMembers(groupId) {
  return useQuery({
    queryKey: ["contribution-group-members", groupId],
    queryFn: () => contributionGroupService.getMembers(groupId),
    enabled: !!groupId,
  });
}

export function useContributionGroupPlans(groupId) {
  return useQuery({
    queryKey: ["contribution-group-plans", groupId],
    queryFn: () => contributionGroupService.getPlans(groupId),
    enabled: !!groupId,
  });
}

export function useContributionGroupAuditLogs(groupId) {
  return useQuery({
    queryKey: ["contribution-group-audit-logs", groupId],
    queryFn: () => contributionGroupService.getAuditLogs(groupId),
    enabled: !!groupId,
  });
}

export function useContributionGroupFinanceSummary(groupId) {
  return useQuery({
    queryKey: ["contribution-group-finance-summary", groupId],
    queryFn: () => contributionGroupService.getFinanceSummary(groupId),
    enabled: !!groupId,
  });
}

export function useContributionGroupTransactions(groupId) {
  return useQuery({
    queryKey: ["contribution-group-transactions", groupId],
    queryFn: () => contributionGroupService.getTransactions(groupId),
    enabled: !!groupId,
  });
}

export function useContributionGroupExpenses(groupId) {
  return useQuery({
    queryKey: ["contribution-group-expenses", groupId],
    queryFn: () => contributionGroupService.getExpenses(groupId),
    enabled: !!groupId,
  });
}

export function useCreateContributionGroupExpense(groupId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => contributionGroupService.createExpense(groupId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contribution-group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["contribution-group-finance-summary", groupId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", groupId] });
    },
  });
}
