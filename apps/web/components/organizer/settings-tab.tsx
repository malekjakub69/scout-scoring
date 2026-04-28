"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleHelp, Plus, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useRace, useUpdateRace } from "@/lib/queries/races";
import { usePatrols } from "@/lib/queries/patrols";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/lib/queries/categories";
import { ApiError } from "@/lib/api/client";

const SCORING_OPTIONS = [
  { value: "sum_points", label: "Součet bodů" },
  { value: "sum_ranks", label: "Součet pořadí (v2)" },
  { value: "points_plus_time", label: "Body + čas tiebreaker (v2)" },
] as const;

const TIME_OPTIONS = [
  { value: "none", label: "Neměří se" },
  { value: "per_station", label: "Na každém stanovišti" },
  { value: "start_finish", label: "Jen start / cíl" },
] as const;

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Název je povinný."),
  date: z.string(),
  location: z.string(),
  scoring: z.enum(["sum_points", "sum_ranks", "points_plus_time"]),
  timeMode: z.enum(["none", "per_station", "start_finish"]),
});

const categorySchema = z.object({
  newCategory: z.string().trim().min(1, "Zadej název kategorie."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;
type CategoryFormValues = z.infer<typeof categorySchema>;
type ScoringValue = SettingsFormValues["scoring"];
type TimeModeValue = SettingsFormValues["timeMode"];

function toDateInputValue(v: string | null | undefined): string {
  if (!v) return "";
  const match = /^\d{4}-\d{2}-\d{2}/.exec(v);
  return match ? match[0] : "";
}

export function SettingsTab({ raceId }: { raceId: string }) {
  const { data: race } = useRace(raceId);
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories(raceId);
  const { data: patrolsData } = usePatrols(raceId);
  const updateRace = useUpdateRace(raceId);
  const createCategory = useCreateCategory(raceId);
  const deleteCategory = useDeleteCategory(raceId);

  const {
    control,
    formState: settingsFormState,
    handleSubmit: handleSettingsSubmit,
    register: registerSettings,
    reset: resetSettings,
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      date: "",
      location: "",
      scoring: "sum_points",
      timeMode: "none",
    },
  });
  const {
    formState: categoryFormState,
    handleSubmit: handleCategorySubmit,
    register: registerCategory,
    reset: resetCategory,
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      newCategory: "",
    },
  });

  useEffect(() => {
    if (!race) return;
    resetSettings({
      name: race.name,
      date: toDateInputValue(race.date),
      location: race.location ?? "",
      scoring: toScoringValue(race.scoring_model),
      timeMode: toTimeModeValue(race.time_tracking),
    });
  }, [race, resetSettings]);

  async function onSave(values: SettingsFormValues) {
    try {
      await updateRace.mutateAsync({
        name: values.name.trim(),
        date: values.date || null,
        location: values.location.trim() || null,
        scoring_model: values.scoring,
        time_tracking: values.timeMode,
      });
      toast.success("Uloženo.");
    } catch {
      toast.error("Uložení selhalo.");
    }
  }

  async function onAddCategory(values: CategoryFormValues) {
    try {
      await createCategory.mutateAsync({ name: values.newCategory.trim() });
      resetCategory();
      toast.success("Kategorie přidána.");
    } catch {
      toast.error("Nepodařilo se přidat.");
    }
  }

  if (!race) return null;

  const readOnly = race.state !== "draft";
  const categories = categoriesData ?? [];
  const patrols = patrolsData ?? [];
  const categoryPatrolCounts = patrols.reduce<Record<string, number>>((acc, patrol) => {
    if (patrol.category) {
      acc[patrol.category] = (acc[patrol.category] ?? 0) + 1;
    }
    return acc;
  }, {});

  async function onDeleteCategory(categoryId: string) {
    try {
      await deleteCategory.mutateAsync(categoryId);
      toast.success("Kategorie smazána.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Kategorii nelze smazat, protože obsahuje hlídku.");
        return;
      }

      toast.error("Nepodařilo se smazat kategorii.");
    }
  }

  return (
    <div className="space-y-10">
      {readOnly ? (
        <div className="rounded-md border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Závod je ve stavu <Badge variant="default" className="mx-1">{race.state}</Badge>. Některá pole jsou uzamčena.
        </div>
      ) : null}

      <form onSubmit={handleSettingsSubmit(onSave)} className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Základní</h2>
          <p className="text-sm text-muted-foreground">Název, datum, místo konání.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sname">Název</Label>
            <Input id="sname" {...registerSettings("name")} disabled={readOnly} />
            <FieldError message={settingsFormState.errors.name?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sdate">Datum</Label>
            <Input id="sdate" type="date" {...registerSettings("date")} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sloc">Místo</Label>
            <Input id="sloc" {...registerSettings("location")} disabled={readOnly} />
          </div>
        </div>

        <Separator />

        <div>
          <h2 className="text-lg font-semibold">Bodování</h2>
          <p className="text-sm text-muted-foreground">
            V MVP jen součet bodů. Ostatní modely budou v další verzi.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Model</Label>
            <Controller
              control={control}
              name="scoring"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCORING_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>Měření času</Label>
            <Controller
              control={control}
              name="timeMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div>
          <Button type="submit" disabled={readOnly || updateRace.isPending}>Uložit nastavení</Button>
        </div>
      </form>

      <Separator />

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Kategorie</h2>
          <p className="text-sm text-muted-foreground">Každá má vlastní výsledkovku (dívčí / chlapecké / nesoutěžní).</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {categoriesLoading ? (
            <span className="text-sm text-muted-foreground">Načítám...</span>
          ) : categories.length === 0 ? (
            <span className="text-sm text-muted-foreground">Zatím žádné kategorie.</span>
          ) : (
            categories.map((c) => (
              <div
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-sm font-normal text-secondary-foreground"
              >
                <span>{c.name}</span>
                {categoryPatrolCounts[c.id] ? (
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground"
                    title="Kategorii nelze smazat, protože obsahuje alespoň jednu hlídku."
                    aria-label={`Kategorii ${c.name} nelze smazat, protože obsahuje hlídku`}
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(c.id)}
                    disabled={readOnly || deleteCategory.isPending}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    title="Smazat kategorii"
                    aria-label={`Smazat kategorii ${c.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleCategorySubmit(onAddCategory)} className="flex max-w-md items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="newcat">Nová kategorie</Label>
            <Input
              id="newcat"
              {...registerCategory("newCategory")}
              placeholder="Dívčí"
              disabled={readOnly}
            />
            <FieldError message={categoryFormState.errors.newCategory?.message} />
          </div>
          <Button type="submit" variant="outline" disabled={readOnly || createCategory.isPending}>
            <Plus className="h-4 w-4" /> Přidat
          </Button>
        </form>
      </section>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function toScoringValue(value: string | null | undefined): ScoringValue {
  if (value === "sum_ranks" || value === "points_plus_time") {
    return value;
  }

  return "sum_points";
}

function toTimeModeValue(value: string | null | undefined): TimeModeValue {
  if (value === "per_station" || value === "start_finish") {
    return value;
  }

  return "none";
}
