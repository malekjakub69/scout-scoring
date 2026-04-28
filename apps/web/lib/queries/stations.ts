import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as StationsApi from "@/lib/api/stations";
import type { AiImportStationDraft, Station } from "@/lib/api/types";
import { qk } from "./keys";

export function useStations(raceId: string | null | undefined) {
  return useQuery({
    queryKey: qk.stations(raceId ?? "__nil__"),
    queryFn: () => StationsApi.listStations(raceId as string),
    enabled: !!raceId,
    select: (data) => [...data].sort((a, b) => a.position - b.position),
  });
}

function invalidateStationScope(qc: ReturnType<typeof useQueryClient>, raceId: string) {
  qc.invalidateQueries({ queryKey: qk.stations(raceId) });
  qc.invalidateQueries({ queryKey: qk.dashboard(raceId) });
}

export function useCreateStation(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Station>) => StationsApi.createStation(raceId, data),
    onSuccess: () => invalidateStationScope(qc, raceId),
  });
}

export function useUpdateStation(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Station> }) => StationsApi.updateStation(id, data),
    onSuccess: () => invalidateStationScope(qc, raceId),
  });
}

export function useDeactivateStation(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => StationsApi.deactivateStation(id),
    onSuccess: () => invalidateStationScope(qc, raceId),
  });
}

export function useResetStationPin(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => StationsApi.resetStationPin(id),
    onSuccess: () => invalidateStationScope(qc, raceId),
  });
}

export function useBulkCreateStations(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stations: AiImportStationDraft[]) => StationsApi.bulkCreateStations(raceId, stations),
    onSuccess: () => invalidateStationScope(qc, raceId),
  });
}
