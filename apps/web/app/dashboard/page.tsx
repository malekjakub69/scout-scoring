"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/app-shell";
import { RaceSelector } from "@/components/organizer/race-selector";
import { OverviewTab } from "@/components/organizer/overview-tab";
import { PatrolsTab } from "@/components/organizer/patrols-tab";
import { StationsTab } from "@/components/organizer/stations-tab";
import { SettingsTab } from "@/components/organizer/settings-tab";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import * as Auth from "@/lib/api/auth";
import { ApiError, tokens } from "@/lib/api/client";
import { useMe } from "@/lib/queries/auth";
import { useRaces } from "@/lib/queries/races";
import { useEffect, useState } from "react";

const CURRENT_RACE_KEY = "ss.current_race";

export default function DashboardPage() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const present = !!tokens.get("organizer");
    setHasToken(present);
    if (!present) router.replace("/login");
  }, [router]);

  const {
    data: meData,
    error: meError,
    isLoading: meLoading,
  } = useMe(hasToken === true);
  const {
    data: racesData,
    error: racesError,
    isLoading: racesLoading,
  } = useRaces();

  useEffect(() => {
    const err = meError ?? racesError;
    if (!err) return;
    if (err instanceof ApiError && err.status === 401) {
      Auth.logout();
      router.replace("/login");
      return;
    }
    toast.error("Nepodařilo se načíst data.");
  }, [meError, racesError, router]);

  useEffect(() => {
    const list = racesData;
    if (!list || currentId !== null) return;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(CURRENT_RACE_KEY) : null;
    const pick = list.find((r) => r.id === saved)?.id ?? list[0]?.id ?? null;
    if (pick) setCurrentId(pick);
  }, [racesData, currentId]);

  useEffect(() => {
    if (currentId && typeof window !== "undefined") {
      window.localStorage.setItem(CURRENT_RACE_KEY, currentId);
    }
  }, [currentId]);

  const races = racesData ?? [];
  const current = races.find((r) => r.id === currentId) ?? null;
  const booting = hasToken === null || (hasToken && (meLoading || racesLoading));

  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <AppShell
      organizer={meData ?? null}
      rightSlot={
        <RaceSelector races={races} current={current} onPick={setCurrentId} onCreated={(r) => setCurrentId(r.id)} />
      }
    >
      {current ? (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Přehled</TabsTrigger>
            <TabsTrigger value="patrols">Hlídky</TabsTrigger>
            <TabsTrigger value="stations">Stanoviště</TabsTrigger>
            <TabsTrigger value="settings">Nastavení</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab raceId={current.id} />
          </TabsContent>
          <TabsContent value="patrols">
            <PatrolsTab raceId={current.id} />
          </TabsContent>
          <TabsContent value="stations">
            <StationsTab raceId={current.id} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab raceId={current.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <EmptyState
          title="Žádný závod"
          description="Začni založením prvního závodu"
        />
      )}
    </AppShell>
  );
}
