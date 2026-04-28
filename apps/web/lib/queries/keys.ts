/**
 * Central registry of TanStack Query keys.
 * Pattern: arrays prefixed by resource, nested by scope (raceId, etc.).
 * Invalidate a subtree by passing the prefix — see mutations/*.ts.
 */
export const qk = {
  me: ["me"] as const,
  races: {
    all: ["races"] as const,
    detail: (id: string) => ["races", id] as const,
  },
  categories: (raceId: string) => ["categories", raceId] as const,
  patrols: (raceId: string) => ["patrols", raceId] as const,
  stations: (raceId: string) => ["stations", raceId] as const,
  dashboard: (raceId: string) => ["dashboard", raceId] as const,
  leaderboard: (raceId: string) => ["leaderboard", raceId] as const,
  stationMe: ["station", "me"] as const,
  stationEntries: ["station", "entries"] as const,
};
