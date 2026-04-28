import { apiFetch } from "./client";
import type { DashboardPayload, LeaderboardGroup, LeaderboardRow } from "./types";

interface ListResponse<T> { data: T[] }

export async function getDashboard(raceId: string): Promise<DashboardPayload> {
  return apiFetch<DashboardPayload>(`/api/races/${raceId}/dashboard`, {
    scope: "organizer",
  });
}

export async function getLeaderboard(raceId: string): Promise<LeaderboardRow[]> {
  const res = await apiFetch<ListResponse<LeaderboardGroup>>(`/api/races/${raceId}/leaderboard`, {
    scope: "organizer",
  });
  return (res.data ?? []).flatMap((group) =>
    group.rows.map((row) => ({
      ...row,
      category_name: group.category_name,
      scored: group.scored,
    })),
  );
}

export async function getLeaderboardGroups(raceId: string): Promise<LeaderboardGroup[]> {
  const res = await apiFetch<ListResponse<LeaderboardGroup>>(`/api/races/${raceId}/leaderboard`, {
    scope: "organizer",
  });
  return res.data ?? [];
}
