import { useMutation, useQueryClient } from "@tanstack/react-query";
import financeService from "../services/finance.service";

export default function useRecordContribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeService.recordContribution,
    onSuccess: (_, variables) => {
      // auto refresh finance data after manual record
      queryClient.invalidateQueries({ queryKey: ["financeSummary", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["ledger", variables.workspaceId] });

      // The dashboard balance card (useFinanceSummary) doesn't use
      // react-query, so the invalidateQueries calls above don't reach
      // it. It listens for this event instead, so the balance updates
      // immediately instead of waiting for its 15s poll.
      window.dispatchEvent(new Event("finance:updated"));
    }
  });
}