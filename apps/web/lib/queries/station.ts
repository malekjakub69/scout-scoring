import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as StationApi from "@/lib/api/station";
import { qk } from "./keys";

export function useStationMe(tokenOverride?: string, enabled = true) {
  return useQuery({
    queryKey: [...qk.stationMe, tokenOverride ?? "__stored__"] as const,
    queryFn: () => StationApi.getStationMe(tokenOverride),
    enabled,
  });
}

export function useStationLogin() {
  return useMutation({
    mutationFn: ({ stationId, pin }: { stationId: string; pin: string }) =>
      StationApi.loginStation(stationId, pin),
  });
}

export function useActiveStationRaces() {
  return useQuery({
    queryKey: qk.stationRaces,
    queryFn: StationApi.listActiveRaces,
  });
}

export function useActiveStations(raceId: string | null | undefined) {
  return useQuery({
    queryKey: qk.stationOptions(raceId ?? "__nil__"),
    queryFn: () => StationApi.listActiveStations(raceId as string),
    enabled: !!raceId,
  });
}

export function useStationEntries(enabled = true) {
  return useQuery({
    queryKey: qk.stationEntries,
    queryFn: StationApi.listStationEntries,
    enabled,
  });
}

export function useUpsertScoreEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: StationApi.upsertScoreEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.stationEntries });
    },
  });
}
