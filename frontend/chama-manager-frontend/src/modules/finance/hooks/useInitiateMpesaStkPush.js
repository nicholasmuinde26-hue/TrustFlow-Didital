import { useMutation } from "@tanstack/react-query";
import financeApi from "../api/finance.api";

export function useInitiateMpesaStkPush() {
  const mutation = useMutation({
    mutationFn: async (payload) => {
      const response = await financeApi.initiateMpesaStkPush(payload);
      return response.data;
    },
  });

  return {
    ...mutation,
    initiateStkPush: mutation.mutateAsync,
  };
}

export default useInitiateMpesaStkPush;