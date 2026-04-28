import { apiFetch } from "./client";
import type { AiImportStationDraft, BulkCreateStationsResponse, Station } from "./types";

interface ListResponse<T> { data: T[] }

export async function listStations(raceId: string): Promise<Station[]> {
  const res = await apiFetch<ListResponse<Station>>(`/api/races/${raceId}/stations`, {
    scope: "organizer",
  });
  return res.data ?? [];
}

export async function createStation(raceId: string, data: Partial<Station>): Promise<Station> {
  return apiFetch<Station>(`/api/races/${raceId}/stations`, {
    method: "POST",
    scope: "organizer",
    body: data,
  });
}

export async function bulkCreateStations(
  raceId: string,
  stations: AiImportStationDraft[],
): Promise<BulkCreateStationsResponse> {
  return apiFetch<BulkCreateStationsResponse>(`/api/races/${raceId}/stations/bulk`, {
    method: "POST",
    scope: "organizer",
    body: { stations },
  });
}

export async function updateStation(id: string, data: Partial<Station>): Promise<Station> {
  return apiFetch<Station>(`/api/stations/${id}`, {
    method: "PUT",
    scope: "organizer",
    body: data,
  });
}

export async function deactivateStation(id: string): Promise<void> {
  await apiFetch<void>(`/api/stations/${id}/deactivate`, {
    method: "POST",
    scope: "organizer",
  });
}

export async function resetStationPin(id: string): Promise<Station> {
  return apiFetch<Station>(`/api/stations/${id}/reset_pin`, {
    method: "POST",
    scope: "organizer",
  });
}
