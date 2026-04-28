import { apiFetch, tokens } from "./client";
import type { LoginResponse, Organizer } from "./types";

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

export function logout() {
  tokens.clear("organizer");
}
