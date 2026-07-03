import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, FileText, Smartphone, Users, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  key: string;
  label: string;
  href: string;
  icon: typeof FileText;
  done: boolean;
}

const dismissKey = (businessId: string) => `blavia_onboarding_dismissed_${businessId}`;

export const OnboardingChecklist = () => {
  const { business } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasEmployee, setHasEmployee] = useState(false);
  const [hasInvoice, setHasInvoice] = useState(false);
  const [hasMpesa, setHasMpesa] = useState(false);
  const [dismissed, setDismissed] = useState(true); // starts true to avoid a flash before localStorage is checked

  useEffect(() => {
    if (!business?.id) return;
    setDismissed(localStorage.getItem(dismissKey(business.id)) === "true");

    const load = async () => {
      setLoading(true);
      const [empRes, invRes, mpesaRes] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "active"),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("mpesa_configs").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("is_active", true),
      ]);
      setHasEmployee((empRes.count ?? 0) > 0);
      setHasInvoice((invRes.count ?? 0) > 0);
      setHasMpesa((mpesaRes.count ?? 0) > 0);
      setLoading(false);
    };
    load();
  }, [business?.id]);

  const dismiss = () => {
    if (!business?.id) return;
    localStorage.setItem(dismissKey(business.id), "true");
    setDismissed(true);
  };

  if (loading || dismissed || !business) return null;

  const items: ChecklistItem[] = [
    { key: "invoice", label: "Send your first invoice", href: "/invoices/new", icon: FileText, done: hasInvoice },
    { key: "employee", label: "Add your first employee", href: "/payroll?tab=employees", icon: Users, done: hasEmployee },
    { key: "mpesa", label: "Connect M-Pesa for payments", href: "/mpesa-settings", icon: Smartphone, done: hasMpesa },
  ];

  const remaining = items.filter((i) => !i.done).length;
  if (remaining === 0) return null;

  return (
    <Card className="border border-primary/20 bg-primary/5 p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Get started with BLAVIA</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{remaining} step{remaining !== 1 ? "s" : ""} left</p>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.done ? CheckCircle2 : Circle;
          const body = (
            <div className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              item.done
                ? "border-border/60 bg-background/40 text-muted-foreground line-through"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
            )}>
              <Icon className={cn("h-4 w-4 shrink-0", item.done ? "text-success" : "text-muted-foreground")} />
              {item.label}
            </div>
          );
          return (
            <li key={item.key}>
              {item.done ? body : <Link to={item.href}>{body}</Link>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
