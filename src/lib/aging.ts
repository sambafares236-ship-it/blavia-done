/** Shared "money owed" aging-bucket logic used by Receivables and Payables. */

export type Bucket = "due_soon" | "not_due" | "overdue_1_30" | "overdue_31_60" | "overdue_60_plus" | "no_due_date";

export const bucketOf = (dueDate: string | null, today: string): Bucket => {
  if (!dueDate) return "no_due_date";
  const days = Math.round((new Date(today).getTime() - new Date(dueDate).getTime()) / 86_400_000);
  if (days < 0) return days >= -7 ? "due_soon" : "not_due";
  if (days <= 30) return "overdue_1_30";
  if (days <= 60) return "overdue_31_60";
  return "overdue_60_plus";
};

export const BUCKET_META: Record<Bucket, { label: string; color: string }> = {
  not_due: { label: "Not yet due", color: "border-border bg-card text-muted-foreground" },
  due_soon: { label: "Due this week", color: "border-amber-200 bg-amber-50 text-amber-700" },
  overdue_1_30: { label: "Overdue 1–30d", color: "border-red-200 bg-red-50 text-red-700" },
  overdue_31_60: { label: "Overdue 31–60d", color: "border-red-300 bg-red-100 text-red-800" },
  overdue_60_plus: { label: "Overdue 60d+", color: "border-red-400 bg-red-200 text-red-900" },
  no_due_date: { label: "No due date", color: "border-border bg-card text-muted-foreground" },
};

export const BUCKET_ORDER: Bucket[] = ["overdue_60_plus", "overdue_31_60", "overdue_1_30", "due_soon", "not_due", "no_due_date"];

/** Hex fills for chart bars/cells (Tailwind classes in BUCKET_META don't work as SVG fill props). */
export const BUCKET_CHART_COLOR: Record<Bucket, string> = {
  not_due: "hsl(213 52% 25%)",
  due_soon: "hsl(38 92% 50%)",
  overdue_1_30: "hsl(0 72% 65%)",
  overdue_31_60: "hsl(0 72% 51%)",
  overdue_60_plus: "hsl(0 72% 35%)",
  no_due_date: "hsl(214 15% 65%)",
};