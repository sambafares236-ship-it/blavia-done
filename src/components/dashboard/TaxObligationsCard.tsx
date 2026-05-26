import { useEffect, useState } from "react";
import { AlertTriangle, Info, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { applicableRules, fetchTaxRules, smartAlerts, type TaxRule } from "@/lib/taxRules";

export const TaxObligationsCard = () => {
  const { business } = useAuth();
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchTaxRules().then((r) => {
      if (mounted) {
        setRules(r);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const category = business?.business_category ?? null;
  const turnover = business?.annual_turnover ?? null;
  const vat = business?.vat_registered ?? false;
  const applicable = applicableRules(rules, category, turnover, vat);
  const alerts = smartAlerts(category, turnover, vat);

  return (
    <Card className="border border-border/60 p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Tax Obligations</h3>
        </div>
        {category && (
          <span className="text-xs text-muted-foreground">{category}</span>
        )}
      </div>

      {!category && !loading && (
        <p className="mt-4 text-xs text-muted-foreground">
          Set your business category in{" "}
          <a href="/settings" className="font-medium text-primary hover:underline">
            Settings
          </a>{" "}
          to see applicable taxes.
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-xs text-muted-foreground">Loading tax rules…</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {applicable.length === 0 && category && (
            <span className="text-xs text-muted-foreground">No specific rules found.</span>
          )}
          {applicable.map((r) => (
            <Badge
              key={r.id}
              variant="secondary"
              className="rounded-md border border-border/60 bg-muted/40 text-xs font-medium"
              title={r.description ?? ""}
            >
              {r.tax_name} ({Number(r.tax_rate).toString()}%)
            </Badge>
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                a.tone === "warning"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-border/60 bg-muted/30 text-muted-foreground"
              }`}
            >
              {a.tone === "warning" ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
