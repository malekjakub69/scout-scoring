import { cn } from "@/lib/utils";

interface ProgressStatCardProps {
  label: string;
  value: number;
  done: number;
  total: number;
  className?: string;
}

export function ProgressStatCard({ label, value, done, total, className }: ProgressStatCardProps) {
  const progress = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border bg-card p-5", className)}>
      <div
        className="absolute inset-y-0 left-0 bg-scout-blue/15 transition-[width] duration-500 ease-out dark:bg-primary/20"
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-3xl font-semibold tabular-nums text-scout-blue dark:text-primary">{progress}%</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {done} z {total} stanovišť
        </div>
      </div>
    </div>
  );
}
