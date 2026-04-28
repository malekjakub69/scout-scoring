"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Patrol, ScoreEntry } from "@/lib/api/types";
import { useMemo, useState } from "react";

export function PatrolPicker({
  patrols,
  entries,
  selectedId,
  onSelect,
}: {
  patrols: Patrol[];
  entries: ScoreEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const doneIds = useMemo(() => new Set(entries.map((e) => e.patrol)), [entries]);
  const pointsByPatrol = useMemo(() => {
    const byPatrol = new Map<string, number>();

    for (const entry of entries) {
      const points = (entry.scores ?? []).reduce((sum, score) => sum + (Number(score.points) || 0), 0);
      byPatrol.set(entry.patrol, points);
    }

    return byPatrol;
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const sorted = [...patrols].sort((a, b) => a.start_number - b.start_number);
    if (!needle) return sorted;
    return sorted.filter((p) =>
      String(p.start_number).includes(needle) || p.name.toLowerCase().includes(needle)
    );
  }, [patrols, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Start. číslo nebo název hlídky…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-12 pl-9 text-base"
          inputMode="search"
          autoFocus
        />
      </div>

      <div className="grid max-h-[60vh] gap-1.5 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {filtered
          .sort((a, b) => {
            const aDone = doneIds.has(a.id);
            const bDone = doneIds.has(b.id);
            if (aDone === bDone) return 0;
            return aDone ? 1 : -1; // hotové na konec
          })
          .map((p) => {
   
          const done = doneIds.has(p.id);
          const points = pointsByPatrol.get(p.id) ?? 0;
          const selected = selectedId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={cn(
                "group flex items-center justify-between rounded-md border border-border bg-card p-3 text-left transition-colors",
                "hover:border-primary/60 hover:bg-primary/5",
                selected && "border-primary bg-primary/5 ring-1 ring-primary"
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary font-mono text-sm tabular-nums">
                  {p.start_number}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.category ?? "—"}
                  </div>
                </div>
              </div>
              {done ? (
                <Badge variant="accent" className="ml-2 shrink-0">
                  <Check className="mr-1 h-3 w-3" /> {points} b.
                </Badge>
              ) : null}
            </button>
          );
        })}
        {filtered.length === 0 ? (
          <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
            Žádná hlídka nenalezena.
          </div>
        ) : null}
      </div>
    </div>
  );
}
