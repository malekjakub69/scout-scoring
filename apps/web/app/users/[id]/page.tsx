"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, KeyRound, Loader2, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import * as Auth from "@/lib/api/auth";
import * as RacesApi from "@/lib/api/races";
import { ApiError, tokens } from "@/lib/api/client";
import { useMe, useDeleteUser, useResetUserPassword, useUpdateUser, useUser, useUserRaces } from "@/lib/queries/auth";
import { useRaces } from "@/lib/queries/races";
import { qk } from "@/lib/queries/keys";
import type { Race, UserRaceAssignment } from "@/lib/api/types";

type AssignableRole = "none" | "read" | "edit";

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const userId = decodeURIComponent(params.id);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);

  useEffect(() => {
    const present = !!tokens.get("organizer");
    setHasToken(present);
    if (!present) router.replace("/login");
  }, [router]);

  const { data: meData, error: meError, isLoading: meLoading } = useMe(hasToken === true);
  const isAdmin = meData?.is_admin === true;
  const { data: user, error: userError, isLoading: userLoading } = useUser(userId, isAdmin);
  const { data: racesData, isLoading: racesLoading } = useRaces();
  const { data: assignmentsData, isLoading: assignmentsLoading } = useUserRaces(userId, isAdmin);
  const updateUser = useUpdateUser(userId);
  const resetUserPassword = useResetUserPassword(userId);
  const deleteUser = useDeleteUser();

  const assignmentMutation = useMutation({
    mutationFn: async ({ race, assignment, role }: { race: Race; assignment?: UserRaceAssignment; role: AssignableRole }) => {
      if (assignment?.role === "owner") return;
      if (role === "none") {
        if (assignment?.membership_id) await RacesApi.deleteRaceMember(assignment.membership_id);
        return;
      }
      if (assignment?.membership_id) {
        await RacesApi.updateRaceMember(assignment.membership_id, role);
        return;
      }
      await RacesApi.shareRace(race.id, { organizer_id: userId, role });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.userRaces(userId) });
      toast.success("Přiřazení závodu uloženo.");
    },
    onError: () => toast.error("Přiřazení se nepodařilo uložit."),
  });

  useEffect(() => {
    const err = meError ?? userError;
    if (!err) return;
    if (err instanceof ApiError && err.status === 401) {
      Auth.logout();
      router.replace("/login");
      return;
    }
    if (err instanceof ApiError && err.status === 404) {
      toast.error("Uživatel neexistuje.");
      router.replace("/users");
      return;
    }
    toast.error("Nepodařilo se načíst data.");
  }, [meError, userError, router]);

  useEffect(() => {
    if (meData && !meData.is_admin) {
      router.replace("/dashboard");
    }
  }, [meData, router]);

  const assignments = assignmentsData ?? [];
  const assignmentsByRace = useMemo(() => {
    return new Map(assignments.map((assignment) => [assignment.race_id, assignment]));
  }, [assignments]);

  const booting =
    hasToken === null ||
    (hasToken && (meLoading || !meData)) ||
    (isAdmin && (userLoading || !user));

  if (booting || !meData?.is_admin || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-scout-bg-app text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  async function onToggleAdmin(checked: boolean) {
    try {
      await updateUser.mutateAsync({ is_admin: checked });
      toast.success("Role admina upravena.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Nelze odebrat posledního admina.");
        return;
      }
      toast.error("Role se nepodařilo uložit.");
    }
  }

  async function onResetPassword() {
    try {
      const res = await resetUserPassword.mutateAsync();
      setResetPassword(res.password);
      toast.success("Nové heslo vygenerováno.");
    } catch {
      toast.error("Heslo se nepodařilo vygenerovat.");
    }
  }

  async function onCopyPassword() {
    if (!resetPassword) return;
    await navigator.clipboard.writeText(resetPassword);
    toast.success("Heslo zkopírováno.");
  }

  async function onDelete() {
    if (!user || !meData) return;
    if (user.id === meData.id) return;
    if (!confirm(`Opravdu smazat uživatele ${user.email}?`)) return;

    try {
      await deleteUser.mutateAsync(user.id);
      toast.success("Uživatel smazán.");
      router.replace("/users");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const body = error.body as { error?: string } | null;
        if (body?.error === "organizer_owns_races") {
          toast.error("Uživatel vlastní závod. Nejdřív je potřeba převést vlastnictví nebo závod vyřešit.");
          return;
        }
        if (body?.error === "last_admin") {
          toast.error("Nelze smazat posledního admina.");
          return;
        }
      }
      toast.error("Uživatele se nepodařilo smazat.");
    }
  }

  function onRoleChange(race: Race, assignment: UserRaceAssignment | undefined, role: AssignableRole) {
    assignmentMutation.mutate({ race, assignment, role });
  }

  return (
    <div className="min-h-screen bg-scout-bg-app text-scout-text">
      <header className="flex h-13 shrink-0 items-center gap-3 bg-scout-blue px-7 text-white">
        <button
          type="button"
          onClick={() => router.push("/users")}
          className="inline-flex items-center gap-2 rounded-8 border border-white/20 bg-white/10 px-3 py-1.75 text-12 font-medium text-white/80 transition hover:bg-white/15"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Uživatelé
        </button>
        <div className="h-5 w-px bg-white/20" />
        <div className="flex shrink-0 items-center gap-2">
          <span className="h-2.25 w-2.25 rounded-full bg-scout-yellow" />
          <span className="text-15 font-bold tracking-tightest">Scout Scoring</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            Auth.logout();
            router.replace("/login");
          }}
          className="hidden items-center gap-2 rounded-8 border border-white/20 bg-white/10 px-3 py-1.75 text-12 font-medium text-white/80 transition hover:bg-white/15 sm:inline-flex"
        >
          <LogOut className="h-3.5 w-3.5" />
          Odhlásit
        </button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-7 py-6 lg:grid-cols-[360px,minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-12 border border-scout-border bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-22 font-bold leading-none text-scout-text">{user.name || "Bez jména"}</h1>
                <p className="mt-1.5 truncate text-13 text-scout-text-muted">{user.email}</p>
              </div>
              {user.is_admin ? <Badge variant="default">Admin</Badge> : <Badge variant="secondary">Organizátor</Badge>}
            </div>

            <label className="flex items-center justify-between rounded-8 border border-scout-border px-3 py-2.5">
              <span className="text-13 font-medium text-scout-text">Systémový admin</span>
              <Switch checked={user.is_admin === true} onCheckedChange={onToggleAdmin} disabled={updateUser.isPending} />
            </label>
          </div>

          <div className="rounded-12 border border-scout-border bg-white p-5">
            <div className="mb-4">
              <h2 className="text-16 font-bold text-scout-text">Heslo</h2>
              <p className="text-12 text-scout-text-muted">Nové heslo se zobrazí jen tady po vygenerování.</p>
            </div>
            <Button type="button" variant="outline" onClick={onResetPassword} disabled={resetUserPassword.isPending}>
              <KeyRound className="h-4 w-4" /> Vygenerovat nové heslo
            </Button>
            {resetPassword ? (
              <div className="mt-4 rounded-8 border border-scout-border bg-scout-bg-subtle p-3">
                <Label>Nové heslo</Label>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 rounded bg-white px-2 py-1 font-mono text-13 text-scout-text">{resetPassword}</code>
                  <Button type="button" variant="outline" size="icon" onClick={onCopyPassword} aria-label="Kopírovat heslo">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-12 border border-destructive/30 bg-white p-5">
            <div className="mb-4">
              <h2 className="text-16 font-bold text-destructive">Smazat uživatele</h2>
              <p className="text-12 text-scout-text-muted">Uživatel nejde smazat, pokud vlastní závod nebo je poslední admin.</p>
            </div>
            <Button type="button" variant="destructive" onClick={onDelete} disabled={user.id === meData.id || deleteUser.isPending}>
              <Trash2 className="h-4 w-4" /> Smazat
            </Button>
          </div>
        </section>

        <section className="rounded-12 border border-scout-border bg-white p-5">
          <div className="mb-4">
            <h2 className="text-16 font-bold text-scout-text">Přiřazené závody</h2>
            <p className="text-12 text-scout-text-muted">Vlastník závodu je pevná role; ostatní závody lze přidat pro čtení nebo editaci.</p>
          </div>

          {racesLoading || assignmentsLoading ? (
            <div className="py-8 text-center text-13 text-scout-text-muted">Načítám...</div>
          ) : (
            <div className="divide-y divide-scout-border rounded-8 border border-scout-border">
              {(racesData ?? []).map((race) => {
                const assignment = assignmentsByRace.get(race.id);
                const value = assignment?.role === "owner" ? "owner" : assignment?.role ?? "none";
                return (
                  <div key={race.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-13 font-semibold text-scout-text">{race.name}</div>
                      <div className="truncate text-12 text-scout-text-muted">
                        {[race.location, formatRaceDate(race.date)].filter(Boolean).join(" · ") || "Bez místa a data"}
                      </div>
                    </div>
                    {value === "owner" ? (
                      <Badge variant="default" className="justify-self-start sm:justify-self-end">Vlastník</Badge>
                    ) : (
                      <Select
                        value={value}
                        onValueChange={(next) => onRoleChange(race, assignment, next as AssignableRole)}
                        disabled={assignmentMutation.isPending}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Bez přístupu</SelectItem>
                          <SelectItem value="read">Čtení</SelectItem>
                          <SelectItem value="edit">Editace</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function formatRaceDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" }).format(date);
}
