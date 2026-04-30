import { apiFetch, tokens } from "./client";
import type { CreateOrganizerResponse, LoginResponse, Organizer, UserRaceAssignment } from "./types";

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  tokens.set("organizer", res.token);
  return res;
}

export async function me(): Promise<Organizer> {
  return apiFetch<Organizer>("/api/auth/me", { scope: "organizer" });
}

export async function listUsers(): Promise<Organizer[]> {
  const res = await apiFetch<{ data: Organizer[] }>("/api/auth/users", { scope: "organizer" });
  return res.data ?? [];
}

export async function getUser(id: string): Promise<Organizer> {
  return apiFetch<Organizer>(`/api/auth/users/${id}`, { scope: "organizer" });
}

export async function createUser(data: {
  email: string;
  name: string;
  password?: string;
  is_admin?: boolean;
}): Promise<CreateOrganizerResponse> {
  return apiFetch<CreateOrganizerResponse>("/api/auth/users", {
    method: "POST",
    scope: "organizer",
    body: data,
  });
}

export async function updateUser(id: string, data: { is_admin: boolean }): Promise<Organizer> {
  return apiFetch<Organizer>(`/api/auth/users/${id}`, {
    method: "PUT",
    scope: "organizer",
    body: data,
  });
}

export async function resetUserPassword(id: string): Promise<CreateOrganizerResponse> {
  return apiFetch<CreateOrganizerResponse>(`/api/auth/users/${id}/reset_password`, {
    method: "POST",
    scope: "organizer",
  });
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch<void>(`/api/auth/users/${id}`, { method: "DELETE", scope: "organizer" });
}

export async function listUserRaces(id: string): Promise<UserRaceAssignment[]> {
  const res = await apiFetch<{ data: UserRaceAssignment[] }>(`/api/auth/users/${id}/races`, {
    scope: "organizer",
  });
  return res.data ?? [];
}

export function logout() {
  tokens.clear("organizer");
}
