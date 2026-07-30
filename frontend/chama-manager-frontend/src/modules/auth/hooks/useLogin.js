import { useMutation } from "@tanstack/react-query";

import useAuth from "@/app/hooks/useAuth";

export default function useLogin() {
  const { login } = useAuth();

  return useMutation({
    mutationFn: login,
  });
}