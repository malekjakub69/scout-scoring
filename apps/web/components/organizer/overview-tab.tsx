"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useRace, useActivateRace, useCloseRace } from "@/lib/queries/races";
import { useDashboard, useLeaderboardGroups } from "@/lib/queries/dashboard";
import type { DashboardPatrolRow, DashboardStationRow } from "@/lib/api/types";
import { fromNowFormat } from "@/lib/utils";
import { toast } from "sonner";

export function OverviewTab({ raceId }: { raceId: string }) {
  const { data: race } = useRace(raceId);
  const { data: dashboardData } = useDashboard(raceId, { refetchInterval: 10_000 });
  const { isLoading: leaderboardLoading } = useLeaderboardGroups(raceId, {
    refetchInterval: 10_000,
  });
  const activate = useActivateRace(raceId);
  const close = useCloseRace(raceId);

  const payload = dashboardData ?? null;
  const loading = leaderboardLoading;

  async function onActivate() {
    try {
      await activate.mutateAsync();
      toast.success("Závod spuštěn. Login Cards najdeš v tabu Stanoviště.");
    } catch {
      toast.error("Aktivace selhala.");
    }
  }

  async function onClose() {
    if (!confirm("Opravdu uzavřít závod? Rozhodčí už nebudou moci editovat.")) return;
    try {
      await close.mutateAsync();
      toast.success("Závod uzavřen.");
    } catch {
      toast.error("Uzavření selhalo.");
    }
  }

  if (!race) return null;

  const patrols = payload?.patrols ?? [];
  const stations = payload?.stations ?? [];
  const totalPatrols = patrols.length;
  const totalStations = stations.length;
  const allEntries = patrols.reduce((acc, p) => acc + p.stations_done, 0);
  const maxEntries = totalPatrols * totalStations;
  const progress = maxEntries > 0 ? Math.round((allEntries / maxEntries) * 100) : 0;

  const hasAction = race.state === "draft" || race.state === "active";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5">
      {hasAction ? (
        <div className="flex shrink-0 justify-end gap-2">
          {race.state === "draft" ? (
            <Button onClick={onActivate} disabled={activate.isPending}>Spustit závod</Button>
          ) : null}
          {race.state === "active" ? (
            <Button variant="outline" onClick={onClose} disabled={close.isPending}>Uzavřít závod</Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4.5 xl:grid-cols-[360px,minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-3.5 overflow-hidden">
          <ProgressRingCard progress={progress} done={allEntries} total={maxEntries} patrols={totalPatrols} stations={totalStations} />
          <ActivityFeedCard patrols={patrols} loading={loading} />
        </div>

        <div className="flex min-h-0 flex-col gap-3.5 overflow-hidden">
          <PatrolTableCard patrols={patrols} totalStations={totalStations} />
          <StationsOverviewCard stations={stations} totalPatrols={totalPatrols} />
        </div>
      </div>
    </div>
  );
}

function ProgressRingCard({
  progress,
  done,
  total,
  patrols,
  stations,
}: {
  progress: number;
  done: number;
  total: number;
  patrols: number;
  stations: number;
}) {
  const size = 164;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dash = (progress / 100) * circumference;

  return (
    <section className="flex shrink-0 items-center gap-5 rounded-12 border border-scout-border bg-white p-5">
      <div className="relative h-41 w-41 shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E4E1D8" strokeWidth={14} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#294885"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
            strokeWidth={14}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-32 font-bold leading-none text-scout-blue">{progress}%</div>
          <div className="mt-0.5 text-11 text-scout-text-muted">průběh</div>
        </div>
      </div>
      <div className="flex flex-col gap-3.5">
        <Stat label="Zápisů" value={`${done} / ${total}`} />
        <Stat label="Hlídky" value={String(patrols)} />
        <Stat label="Stanoviště" value={String(stations)} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.25 text-2xs font-medium uppercase tracking-0.6 text-scout-text-muted">{label}</div>
      <div className="text-20 font-bold text-scout-text">{value}</div>
    </div>
  );
}

function ActivityFeedCard({ patrols, loading }: { patrols: DashboardPatrolRow[]; loading: boolean }) {
  const latest = [...patrols]
    .filter((p) => p.last_activity)
    .sort((a, b) => new Date(b.last_activity ?? 0).getTime() - new Date(a.last_activity ?? 0).getTime())
    .slice(0, 8);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-12 border border-scout-border bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-scout-border px-4 py-3">
        <span className="text-13 font-semibold text-scout-text">Live aktivita</span>
        <span className="text-2xs text-scout-text-muted">{loading ? "načítám" : "↻ 10 s"}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {latest.length === 0 ? (
          <EmptyState className="m-3 border-none bg-transparent py-8" title="Zatím bez aktivity" description="První zapsané body se objeví tady." />
        ) : (
          latest.map((p, index) => (
            <div key={p.id} className={`flex items-center gap-2.5 border-b border-scout-border px-4 py-2.25 ${index % 2 === 0 ? "bg-scout-bg-subtle" : "bg-white"}`}>
              <span className={`h-1.75 w-1.75 shrink-0 rounded-full ${index < 2 ? "bg-scout-green" : "bg-scout-blue-light"}`} />
              <div className="min-w-0 flex-1">
                <span className="text-12 font-semibold text-scout-text">{p.name}</span>
                <span className="text-12 text-scout-text-muted"> · {p.stations_done} stanovišť</span>
              </div>
              <span className="shrink-0 text-13 font-bold tabular-nums text-scout-blue">{p.total_points} b.</span>
              <span className="w-12.5 shrink-0 text-right text-11 text-scout-text-muted">{fromNowFormat(p.last_activity)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PatrolTableCard({ patrols, totalStations }: { patrols: DashboardPatrolRow[]; totalStations: number }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-12 border border-scout-border bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-scout-border px-4.5 py-3">
        <span className="text-13 font-semibold text-scout-text">Hlídky</span>
        <span className="text-11 text-scout-text-muted">{patrols.length} celkem</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {patrols.length === 0 ? (
          <EmptyState className="m-4 border-none bg-transparent py-10" title="Žádné hlídky" description="V tabu Hlídky je importuj z CSV nebo přidej ručně." />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-scout-bg-table">
                {["#", "Hlídka", "Stanovišť", "Body", "Aktivita"].map((header, index) => (
                  <th key={header} className={`border-b border-scout-border px-3 py-2 text-2xs font-semibold uppercase tracking-0.5 text-scout-text-muted ${index <= 1 ? "text-left" : "text-right"}`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...patrols].sort((a, b) => b.total_points - a.total_points).map((p, index) => (
                <tr key={p.id} className={`border-b border-scout-border ${index % 2 === 0 ? "bg-white" : "bg-scout-bg-subtle"}`}>
                  <td className="w-12 px-3 py-2.25">
                    <span className="grid h-8 w-8 place-items-center rounded-8 bg-scout-blue text-13 font-bold text-white">{p.start_number}</span>
                  </td>
                  <td className="px-3 py-2.25 text-13 font-semibold text-scout-text">{p.name}</td>
                  <td className="px-3 py-2.25 text-right"><MiniProgress done={p.stations_done} total={totalStations} /></td>
                  <td className="px-3 py-2.25 text-right text-14 font-bold tabular-nums text-scout-text">{p.total_points}</td>
                  <td className="px-3 py-2.25 text-right text-11 text-scout-text-muted">{fromNowFormat(p.last_activity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function MiniProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  const color = pct >= 1 ? "bg-scout-green" : pct >= 0.67 ? "bg-scout-blue" : pct >= 0.34 ? "bg-scout-amber" : "bg-scout-text-muted";

  return (
    <div className="flex items-center justify-end gap-1.5">
      <div className="h-1.25 w-11 overflow-hidden rounded-full bg-scout-bg-track">
        <div className={`h-full ${color}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className={`min-w-8.5 text-right text-12 tabular-nums ${pct >= 1 ? "text-scout-green" : "text-scout-text-secondary"}`}>
        {done}/{total}
      </span>
    </div>
  );
}

function StationsOverviewCard({ stations, totalPatrols }: { stations: DashboardStationRow[]; totalPatrols: number }) {
  return (
    <section className="shrink-0 rounded-12 border border-scout-border bg-white px-4.5 py-3.5">
      <div className="mb-3 text-13 font-semibold text-scout-text">Stanoviště — průběh</div>
      {stations.length === 0 ? (
        <EmptyState className="border-none bg-transparent py-6" title="Žádná stanoviště" description="V tabu Stanoviště je definuj a pak spusť závod." />
      ) : (
        <div className="flex flex-wrap gap-2">
          {stations.map((s) => {
            const pct = totalPatrols > 0 ? s.patrols_processed / totalPatrols : 0;
            const tone =
              pct >= 1
                ? "border-scout-green-border bg-scout-green-soft text-scout-green"
                : pct >= 0.67
                  ? "border-scout-station-blue-border bg-scout-station-blue text-scout-blue"
                  : "border-scout-yellow-border bg-scout-yellow-soft text-scout-amber";
            return (
              <div key={s.id} className={`min-w-[110px] rounded-10 border-1.5 px-3 py-2 ${tone}`}>
                <div className="mb-1.5 text-12 font-semibold text-scout-text">
                  <span className="text-2xs text-scout-text-muted">#{s.position} </span>{s.name}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-scout-border-track">
                    <div className="h-full bg-current" style={{ width: `${pct * 100}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-11 font-bold tabular-nums">{s.patrols_processed}/{totalPatrols}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
