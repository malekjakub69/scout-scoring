/**
 * Judge-facing endpoints scoped to a single station (OTSA).
 * All calls use the station token (short-lived, race-scoped).
 */
import { apiFetch } from "./client";
import type { PublicStationOption, PublicStationRace, ScoreEntry, StationMePayload } from "./types";

interface ListResponse<T> { data: T[] }

export interface StationLoginResponse {
  token: string;
  station: {
    id: string;
    name: string;
    race: string;
  };
}

export async function loginStation(stationId: string, pin: string): Promise<StationLoginResponse> {
  return apiFetch<StationLoginResponse>("/api/station/login", {
    method: "POST",
    body: { station_id: stationId, pin },
  });
}

export async function listActiveRaces(): Promise<PublicStationRace[]> {
  const res = await apiFetch<ListResponse<PublicStationRace>>("/api/station/races");
  return res.data ?? [];
}

export async function listActiveStations(raceId: string): Promise<PublicStationOption[]> {
  const res = await apiFetch<ListResponse<PublicStationOption>>(
    `/api/station/races/${encodeURIComponent(raceId)}/stations`
  );
  return res.data ?? [];
}

export async function getStationMe(tokenOverride?: string): Promise<StationMePayload> {
  return apiFetch<StationMePayload>("/api/station/me", {
    scope: "station",
    tokenOverride,
  });
}

export async function listStationEntries(): Promise<ScoreEntry[]> {
  const res = await apiFetch<ListResponse<ScoreEntry>>("/api/station/scores", { scope: "station" });
  return res.data ?? [];
}

export interface UpsertScorePayload {
  patrol_id: string;
  scores: { criterion: string; points: number }[];
  arrived_at?: string | null;
  departed_at?: string | null;
}

export async function upsertScoreEntry(payload: UpsertScorePayload): Promise<ScoreEntry> {
  return apiFetch<ScoreEntry>("/api/station/scores", {
    method: "POST",
    scope: "station",
    body: payload,
  });
}
