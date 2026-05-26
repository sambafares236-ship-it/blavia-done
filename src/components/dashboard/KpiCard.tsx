import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Visual tone of the small icon chip in the corner */
  tone?: "success" | "danger" | "warning" | "navy";
  /** Legacy alias for `tone`, kept for backwards compatibility. */
  variant?: "navy" | "shield" | "success" | "warning";
  loading?: boolean;
  /** Numeric percentage delta vs prior period, e.g. 12.5 or -2.4 */
  delta?: number;
  deltaLabel?: string;
  hint?: string;
}

const variantToTone: Record<NonNullable<KpiCardProps["variant"]>, NonNullable<KpiCardProps["tone"]>> = {
  navy: "navy",
  shield: "navy",
  success: "success",
  warning: "warning",
};

const toneClasses: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  success: "bg-success/12 text-success",
  danger: "bg-destructive/12 text-destructive",
  warning: "bg-warning/15 text-warning",
  navy: "bg-navy/10 text-navy",
};

export const KpiCard = ({
  label,
  value,
  icon: Icon,
  tone,
  variant,
  loading,
  delta,
  deltaLabel = "from last month",
  hint,
}: KpiCardProps) => {
  const resolvedTone: NonNullable<KpiCardProps["tone"]> =
    tone ?? (variant ? variantToTone[variant] : "success");
  const showDelta = typeof delta === "number" && !loading;
  const positive = (delta ?? 0) >= 0;

  return (
    <Card className="relative border border-border/60 bg-card p-5 shadow-card transition-shadow hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneClasses[resolvedTone])}>
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-[26px]">
        {loading ? "—" : value}
      </p>

      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {showDelta ? (
          <>
            <span
              className={cn(
                "font-semibold",
                positive ? "text-success" : "text-destructive",
              )}
            >
              {positive ? "+" : ""}
              {delta!.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">{deltaLabel}</span>
          </>
        ) : (
          hint && <span className="text-muted-foreground">{hint}</span>
        )}
      </div>
    </Card>
  );
};
