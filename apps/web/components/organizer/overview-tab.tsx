"use client";

import * as React from "react";
import { Activity, AlertCircle, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProgressStatCard } from "./progress-stat-card";
import { useRace, useActivateRace, useCloseRace } from "@/lib/queries/races";
import { useDashboard, useLeaderboardGroups } from "@/lib/queries/dashboard";
import type { Race } from "@/lib/api/types";
import { formatTime, fromNowFormat } from "@/lib/utils";
import { toast } from "sonner";

export function OverviewTab({ raceId }: { raceId: string }) {
  const { data: race } = useRace(raceId);
  const { data: dashboardData } = useDashboard(raceId, { refetchInterval: 10_000 });
  const { data: leaderboardData, isLoading: leaderboardLoading } = useLeaderboardGroups(raceId, {
    refetchInterval: 10_000,
  });
  const activate = useActivateRace(raceId);
  const close = useCloseRace(raceId);

  const payload = dashboardData ?? null;
  const leaderboard = leaderboardData ?? [];
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{race.name}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <RaceStateBadge state={race.state} />
            {race.location ? <span>{race.location}</span> : null}
          </div>
        </div>
        <div className="flex gap-2">
          {race.state === "draft" ? (
            <Button onClick={onActivate} disabled={activate.isPending}>
              Spustit závod
            </Button>
          ) : null}
          {race.state === "active" ? (
            <Button variant="outline" onClick={onClose} disabled={close.isPending}>
              Uzavřít závod
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4">
        <ProgressStatCard label="Průběh" value={progress} done={allEntries} total={maxEntries} />
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card max-h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              Aktivita hlídek
            </div>
            <span className="text-xs text-muted-foreground">{patrols.length}</span>
          </div>
          {patrols.length === 0 ? (
            <EmptyState
              className="m-4 border-none bg-transparent py-10"
              title="Žádné hlídky"
              description="V tabu Hlídky je importuj z CSV nebo přidej ručně."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Hlídka</TableHead>
                  <TableHead>Stanovišť</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead>Před</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patrols.sort((a, b) => a.total_points - b.total_points).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium tabular-nums">{p.start_number}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="tabular-nums">
                      {p.stations_done}
                      <span className="text-muted-foreground"> / {totalStations}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{p.total_points}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fromNowFormat(p.last_activity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card max-h-[600px] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            Stanoviště — průběh
          </div>
          <span className="text-xs text-muted-foreground">{stations.length}</span>
        </div>
        {stations.length === 0 ? (
          <EmptyState
            className="m-4 border-none bg-transparent py-10"
            title="Žádná stanoviště"
            description="V tabu Stanoviště je definuj a pak spusť závod."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Stanoviště</TableHead>
                <TableHead>Odbaveno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium tabular-nums">{s.position}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="tabular-nums">
                    {s.patrols_processed}
                    <span className="text-muted-foreground"> / {totalPatrols}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        </div>
      </section>
    </div>
  );
}

function RaceStateBadge({ state }: { state: Race["state"] }) {
  if (state === "active") return <Badge variant="default">Běží</Badge>;
  if (state === "closed") return <Badge variant="secondary">Uzavřeno</Badge>;
  return <Badge variant="muted">Rozpracováno</Badge>;
}
