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

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: qk.users,
    queryFn: Auth.listUsers,
    enabled,
  });
}

export function useUser(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.user(id ?? "__nil__"),
    queryFn: () => Auth.getUser(id as string),
    enabled: !!id && enabled,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: Auth.createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users });
    },
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { is_admin: boolean }) => Auth.updateUser(id, data),
    onSuccess: (user) => {
      qc.setQueryData(qk.user(id), user);
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useResetUserPassword(id: string) {
  return useMutation({
    mutationFn: () => Auth.resetUserPassword(id),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: Auth.deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users });
    },
  });
}

export function useUserRaces(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.userRaces(id ?? "__nil__"),
    queryFn: () => Auth.listUserRaces(id as string),
    enabled: !!id && enabled,
  });
}
