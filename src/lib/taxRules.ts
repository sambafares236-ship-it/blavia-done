import { supabase } from "@/lib/supabase";

export const BUSINESS_CATEGORIES = [
  "Retail & Trading",
  "Professional Services",
  "Manufacturing & Production",
  "Agriculture & Farming",
  "Transport & Logistics",
  "Hospitality & Tourism",
  "Real Estate & Property",
  "Construction & Contracting",
  "Technology & Software",
  "Healthcare & Medical",
  "Education & Training",
  "Other",
] as const;

export type TaxRule = {
  id: string;
  category: string;
  tax_name: string;
  tax_rate: number;
  description: string | null;
  min_turnover: number | null;
  max_turnover: number | null;
  applies_when: string | null;
};

export async function fetchTaxRules(): Promise<TaxRule[]> {
  const { data, error } = await supabase
    .from("tax_rules")
    .select("*")
    .order("category", { ascending: true });
  if (error) {
    console.error("tax_rules error:", error);
    return [];
  }
  return (data ?? []) as TaxRule[];
}

export function applicableRules(
  rules: TaxRule[],
  category: string | null,
  turnover: number | null,
  vatRegistered: boolean,
): TaxRule[] {
  const t = Number(turnover ?? 0);
  return rules.filter((r) => {
    if (r.category !== "All" && r.category !== category) return false;
    switch (r.applies_when) {
      case "turnover_below":
        return r.max_turnover == null || t < Number(r.max_turnover);
      case "turnover_above_or_vat":
        return vatRegistered || (r.min_turnover != null && t >= Number(r.min_turnover));
      case "vat_registered":
        return vatRegistered;
      case "always":
      default:
        return true;
    }
  });
}

export function smartAlerts(
  category: string | null,
  turnover: number | null,
  vatRegistered: boolean,
): { tone: "info" | "warning"; message: string }[] {
  const alerts: { tone: "info" | "warning"; message: string }[] = [];
  const t = Number(turnover ?? 0);
  if (category === "Professional Services") {
    alerts.push({ tone: "info", message: "Remember to track withholding tax deductions on your invoices." });
  }
  if (category === "Retail & Trading" && !vatRegistered && t >= 4_000_000 && t < 5_000_000) {
    alerts.push({ tone: "warning", message: "Approaching the KES 5M VAT registration threshold." });
  }
  if (vatRegistered) {
    alerts.push({ tone: "info", message: "File monthly VAT returns by the 20th of each month." });
  }
  return alerts;
}
