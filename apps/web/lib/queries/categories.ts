import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as CategoriesApi from "@/lib/api/categories";
import type { Category } from "@/lib/api/types";
import { qk } from "./keys";

export function useCategories(raceId: string | null | undefined) {
  return useQuery({
    queryKey: qk.categories(raceId ?? "__nil__"),
    queryFn: () => CategoriesApi.listCategories(raceId as string),
    enabled: !!raceId,
  });
}

export function useCreateCategory(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Category>) => CategoriesApi.createCategory(raceId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories(raceId) });
    },
  });
}

export function useDeleteCategory(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => CategoriesApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories(raceId) });
      qc.invalidateQueries({ queryKey: qk.patrols(raceId) });
    },
  });
}
