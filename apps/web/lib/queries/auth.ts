import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Auth from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { qk } from "./keys";

export function useMe(enabled = true) {
  return useQuery({
    queryKey: qk.me,
    queryFn: Auth.me,
    enabled,
    retry: (n, err) => !(err instanceof ApiError && err.status === 401) && n < 1,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      Auth.login(email, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}
