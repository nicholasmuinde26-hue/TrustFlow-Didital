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
    }
  });
}