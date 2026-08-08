import { useMutation } from "@tanstack/react-query";

import financeService from "../services/finance.service";

export default function useRecordContribution() {
  return useMutation({
    mutationFn: financeService.recordContribution,
  });
}