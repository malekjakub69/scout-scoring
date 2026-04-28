import { apiFetch } from "./client";
import type { Category } from "./types";

interface ListResponse<T> { data: T[] }

export async function listCategories(raceId: string): Promise<Category[]> {
  const res = await apiFetch<ListResponse<Category>>(`/api/races/${raceId}/categories`, {
    scope: "organizer",
  });
  return res.data ?? [];
}

export async function createCategory(raceId: string, data: Partial<Category>): Promise<Category> {
  return apiFetch<Category>(`/api/races/${raceId}/categories`, {
    method: "POST",
    scope: "organizer",
    body: data,
  });
}

export async function deleteCategory(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/categories/${id}`, {
    method: "DELETE",
    scope: "organizer",
  });
}
