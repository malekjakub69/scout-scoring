import { useQuery } from "@tanstack/react-query";
import * as DashboardApi from "@/lib/api/dashboard";
import { qk } from "./keys";

export function useDashboard(raceId: string | null | undefined, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: qk.dashboard(raceId ?? "__nil__"),
    queryFn: () => DashboardApi.getDashboard(raceId as string),
    enabled: !!raceId,
    refetchInterval: options?.refetchInterval,
  });
}

export function useLeaderboardGroups(raceId: string | null | undefined, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: qk.leaderboard(raceId ?? "__nil__"),
    queryFn: () => DashboardApi.getLeaderboardGroups(raceId as string),
    enabled: !!raceId,
    refetchInterval: options?.refetchInterval,
  });
}
