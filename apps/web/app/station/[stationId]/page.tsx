"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, QrCode, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ThemeToggle } from "@/components/theme-toggle";
import { PatrolPicker } from "@/components/station/patrol-picker";
import { ScoreForm } from "@/components/station/score-form";
import { useStationLogin, useStationMe, useStationEntries } from "@/lib/queries/station";
import { qk } from "@/lib/queries/keys";
import { ApiError, tokens } from "@/lib/api/client";
import type { Patrol } from "@/lib/api/types";
import { useEffect, useState } from "react";

type Mode = "pick" | "score";

export default function StationPage() {
  const params = useParams<{ stationId: string }>();
  const search = useSearchParams();
  const qc = useQueryClient();

  const stationId = decodeURIComponent(params.stationId);
  const pinFromUrl = search.get("pin");
  const { mutateAsync: loginStation, isPending: stationLoginPending } = useStationLogin();
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<unknown>(null);
  const loginAttemptedForPin = React.useRef<string | null>(null);

  // QR URLs carry only station id + PIN. Exchange them once for a station
  // token, then use the stored token for regular station API calls.
  useEffect(() => {
    const loginAttemptKey = pinFromUrl ? `${stationId}:${pinFromUrl}` : null;
    if (!pinFromUrl || !loginAttemptKey || loginToken || loginAttemptedForPin.current === loginAttemptKey) return;

    loginAttemptedForPin.current = loginAttemptKey;
    setLoginError(null);

    loginStation({ stationId, pin: pinFromUrl })
      .then((res) => {
        if (loginAttemptedForPin.current !== loginAttemptKey) return;
        tokens.set("station", res.token);
        qc.invalidateQueries({ queryKey: qk.stationMe });
        qc.invalidateQueries({ queryKey: qk.stationEntries });
        setLoginToken(res.token);
      })
      .catch((err) => {
        if (loginAttemptedForPin.current !== loginAttemptKey) return;
        setLoginError(err);
      });
  }, [pinFromUrl, loginToken, stationId, loginStation, qc]);

  const hasStoredStationToken = !pinFromUrl && Boolean(tokens.get("station"));
  const hasStationToken = Boolean(loginToken || hasStoredStationToken);
  const exchangingPin = Boolean(pinFromUrl && !loginToken && !loginError);

  const {
    data: stationMeData,
    error: stationMeError,
    isLoading: stationMeLoading,
    isSuccess: stationMeSuccess,
  } = useStationMe(loginToken ?? undefined, hasStationToken && !loginError);
  const { data: stationEntriesData } = useStationEntries(stationMeSuccess);

  const [selected, setSelected] = useState<Patrol | null>(null);
  const [mode, setMode] = useState<Mode>("pick");

  const booting = exchangingPin || stationLoginPending || (hasStationToken && stationMeLoading);
  const err = loginError ?? stationMeError;
  const errorMsg = err
    ? err instanceof ApiError && err.status === 401
      ? "PIN je neplatný, přístup vypršel nebo je závod uzavřený. Naskenuj QR kód znovu."
      : "Nelze načíst stanoviště. Zkontroluj připojení."
    : !pinFromUrl && !hasStationToken
    ? "Chybí PIN ze QR kódu. Naskenuj kartu stanoviště znovu."
    : null;

  const payload = stationMeData;
  const entries = stationEntriesData ?? [];

  function refresh() {
    qc.invalidateQueries({ queryKey: qk.stationMe });
    qc.invalidateQueries({ queryKey: qk.stationEntries });
  }

  function onSelect(id: string) {
    const p = payload?.patrols.find((x) => x.id === id) ?? null;
    setSelected(p);
    if (p) setMode("score");
  }

  function onSaved() {
    setSelected(null);
    setMode("pick");
  }

  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (errorMsg || !payload) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <EmptyState
          className="max-w-md"
          icon={<QrCode className="h-6 w-6" />}
          title="Přístup se nezdařil"
          description={errorMsg ?? "Neznámá chyba."}
        />
      </div>
    );
  }

  const station = payload.station;
  const existingForSelected = selected ? entries.find((e) => e.patrol === selected.id) ?? null : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {mode === "score" ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSelected(null); setMode("pick"); }}
                aria-label="Zpět"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-scout-yellow" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Stanoviště
              </div>
              <div className="truncate text-base font-semibold leading-tight">{station.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {entries.length}/{payload.patrols.length} hlídek
            </Badge>
            <Button variant="ghost" size="icon" onClick={refresh} aria-label="Obnovit">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-6 sm:py-10">
        {mode === "pick" ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold sm:text-2xl">Vyber hlídku</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Seřazeno podle startovního čísla. U bodovaných hlídek vidíš součet bodů — kliknutím zápis přepíšeš.
              </p>
            </div>
            <PatrolPicker
              patrols={payload.patrols}
              entries={entries}
              selectedId={selected?.id ?? null}
              onSelect={onSelect}
            />
          </div>
        ) : selected ? (
          <ScoreForm
            patrol={selected}
            criteria={station.criteria.map((c, index) => ({ ...c, id: index }))}
            existing={existingForSelected}
            onSaved={onSaved}
            onCancel={() => { setSelected(null); setMode("pick"); }}
          />
        ) : null}
      </main>
    </div>
  );
}
