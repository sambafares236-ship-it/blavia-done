import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, Sparkles } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const s = (status ?? "").toLowerCase();
  let style = "bg-muted text-muted-foreground border border-border";
  let Icon = Clock;

  if (s.includes("auto")) {
    style = "bg-success/12 text-success border border-success/25";
    Icon = Sparkles;
  } else if (s.includes("approve")) {
    style = "bg-success/12 text-success border border-success/25";
    Icon = CheckCircle2;
  } else if (s.includes("pending")) {
    style = "bg-warning/15 text-[hsl(38_92%_38%)] border border-warning/30";
    Icon = Clock;
  } else if (s.includes("reject")) {
    style = "bg-destructive/12 text-destructive border border-destructive/25";
    Icon = XCircle;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        style,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {status || "—"}
    </span>
  );
};
