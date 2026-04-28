"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUpsertScoreEntry } from "@/lib/queries/station";
import type { Patrol, ScoreEntry, StationCriterion } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

interface Props {
  patrol: Patrol;
  criteria: StationCriterion[];
  existing: ScoreEntry | null;
  onSaved: () => void;
  onCancel: () => void;
}

type ScoreFormValues = {
  points: Record<string, string>;
  withTime: boolean;
  arrivedAt: string;
  departedAt: string;
};

const timeFieldSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Zadej čas ve formátu HH:MM.")
  .or(z.literal(""));

function createScoreFormSchema(criteria: StationCriterion[]) {
  return z
    .object({
      points: z.record(z.string()),
      withTime: z.boolean(),
      arrivedAt: timeFieldSchema,
      departedAt: timeFieldSchema,
    })
    .superRefine((values, ctx) => {
      for (const [index, criterion] of criteria.entries()) {
        const fieldKey = criterionFieldKey(criterion, index);
        const raw = values.points[fieldKey] ?? "";
        if (raw === "") {
          continue;
        }

        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["points", fieldKey],
            message: "Zadej číslo.",
          });
          continue;
        }

        if (parsed < 0 || parsed > criterion.max_points) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["points", fieldKey],
            message: `Zadej hodnotu 0 až ${criterion.max_points}.`,
          });
        }
      }
    });
}

export function ScoreForm({ patrol, criteria, existing, onSaved, onCancel }: Props) {
  const upsert = useUpsertScoreEntry();
  const schema = useMemo(() => createScoreFormSchema(criteria), [criteria]);
  const {
    formState,
    handleSubmit,
    control,
    register,
    reset,
    setValue,
    watch,
  } = useForm<ScoreFormValues>({
    resolver: zodResolver(schema),
    defaultValues: createDefaultValues(criteria, existing),
  });

  useEffect(() => {
    reset(createDefaultValues(criteria, existing));
  }, [criteria, existing, reset]);

  const withTime = watch("withTime");
  const watchedPoints = useWatch({ control, name: "points" });
  const submitting = upsert.isPending;

  const total = useMemo(
    () => criteria.reduce((sum, c, index) => sum + (Number(watchedPoints?.[criterionFieldKey(c, index)]) || 0), 0),
    [criteria, watchedPoints]
  );
  const maxTotal = useMemo(
    () => criteria.reduce((sum, c) => sum + (c.max_points || 0), 0),
    [criteria]
  );

  async function onSubmit(values: ScoreFormValues) {
    try {
      const scoresPayload = criteria.map((c, index) => ({
        criterion: c.name,
        points: clamp(Number(values.points[criterionFieldKey(c, index)]) || 0, 0, c.max_points),
      }));

      const today = new Date().toISOString().slice(0, 10);
      await upsert.mutateAsync({
        patrol_id: patrol.id,
        scores: scoresPayload,
        arrived_at: values.withTime && values.arrivedAt ? `${today}T${values.arrivedAt}:00` : null,
        departed_at: values.withTime && values.departedAt ? `${today}T${values.departedAt}:00` : null,
      });
      toast.success(`Uloženo - ${patrol.name} (${total} b.)`);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) {
        toast.error("Závod je uzavřen. Nelze upravovat.");
      } else {
        toast.error("Uložení selhalo. Zkontroluj signál a zkus znovu.");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hlídka #{patrol.start_number}
          </div>
          <div className="text-xl font-semibold">{patrol.name}</div>
        </div>
        {existing ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground" />
            <span>Přepisuješ existující zápis</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {criteria.map((criterion, index) => {
          const fieldKey = criterionFieldKey(criterion, index);
          return (
          <CriterionRow
            key={fieldKey}
            inputId={`crit-${fieldKey}`}
            criterion={criterion}
            value={watchedPoints?.[fieldKey] ?? "0"}
            onChange={(value) =>
              setValue(`points.${fieldKey}`, String(value), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            error={formState.errors.points?.[fieldKey]?.message}
          />
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-secondary/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">Celkem</span>
        <span className="text-2xl font-semibold tabular-nums">
          {total} <span className="text-base text-muted-foreground">/ {maxTotal}</span>
        </span>
      </div>

      <div className="rounded-md border border-border p-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-foreground">
            <Clock className="h-4 w-4" /> Zaznamenat čas
          </Label>
          <Switch checked={withTime} onCheckedChange={(checked) => setValue("withTime", checked)} />
        </div>
        {withTime ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="arrived">Příchod</Label>
              <Input id="arrived" type="time" {...register("arrivedAt")} />
              <FieldError message={formState.errors.arrivedAt?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="departed">Odchod</Label>
              <Input id="departed" type="time" {...register("departedAt")} />
              <FieldError message={formState.errors.departedAt?.message} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:m-0 sm:border-0 sm:p-0">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Zrušit
        </Button>
        <Button type="submit" size="lg" disabled={submitting} className="min-w-[140px]">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Uložit {total > 0 ? `- ${total} b.` : ""}
        </Button>
      </div>
    </form>
  );
}

function CriterionRow({
  inputId,
  criterion,
  value,
  onChange,
  error,
}: {
  inputId: string;
  criterion: StationCriterion;
  value: string;
  onChange: (value: number) => void;
  error?: string;
}) {
  const max = Math.max(0, Math.round(criterion.max_points || 0));
  const current = clamp(Number(value) || 0, 0, max);
  const percent = max > 0 ? (current / max) * 100 : 0;
  const tickValues = createTickValues(max);

  return (
    <div className={`rounded-lg border bg-card p-4 ${error ? "border-destructive" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <Label htmlFor={inputId} className="text-base font-semibold">
          {criterion.name}
        </Label>
        <span className="shrink-0 text-xs text-muted-foreground">max {max}</span>
      </div>

      <div className="relative mt-6 px-2 pb-7 pt-10">
        <div className="absolute inset-x-2 top-10 h-14 rounded-full border border-border bg-white shadow-sm" />
        <div
          className="pointer-events-none absolute top-6 z-10 grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-[left] duration-100"
          style={{ left: `clamp(2.5rem, ${percent}%, calc(100% - 2.5rem))`, transform: "translateX(-50%)" }}
        >
          <span className="text-2xl font-bold tabular-nums">{current}</span>
        </div>
        <input
          id={inputId}
          type="range"
          min={0}
          max={max}
          step={1}
          value={current}
          onChange={(event) => onChange(Number(event.target.value))}
          className="score-slider relative z-20 h-20 w-full cursor-pointer appearance-none bg-transparent"
          aria-label={criterion.name}
          aria-valuetext={`${current} z ${max} bodů`}
        />
        <div className="pointer-events-none absolute inset-x-12 bottom-20 flex justify-between text-xs font-medium text-muted-foreground">
          {tickValues.map((tick) => (
            <span key={tick} className="tabular-nums">
              {tick}
            </span>
          ))}
        </div>
      </div>
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function createDefaultValues(criteria: StationCriterion[], existing: ScoreEntry | null): ScoreFormValues {
  return {
    points: seedPoints(criteria, existing),
    arrivedAt: existing?.arrived_at?.slice(11, 16) ?? "",
    departedAt: existing?.departed_at?.slice(11, 16) ?? "",
    withTime: Boolean(existing?.arrived_at || existing?.departed_at),
  };
}

function seedPoints(criteria: StationCriterion[], existing: ScoreEntry | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [index, c] of criteria.entries()) {
    const found = existing?.scores?.find((s) => s.criterion === c.name);
    result[criterionFieldKey(c, index)] = found ? String(found.points) : "0";
  }
  return result;
}

function criterionFieldKey(criterion: StationCriterion, index: number) {
  return criterion.id != null ? String(criterion.id) : `idx-${index}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function createTickValues(max: number) {
  if (max <= 0) return [0];

  const raw = [0, Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max * 0.75), max];
  return Array.from(new Set(raw));
}
