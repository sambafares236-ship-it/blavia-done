import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2, CalendarClock, Landmark, PiggyBank,
  Receipt, AlertCircle, CheckCircle, Info
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatbotWidget } from "@/components/dashboard/ChatbotWidget";
import { supabase, Transaction } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { VatTab } from "@/components/tax/VatTab";
import { CorporateTaxTab } from "@/components/tax/CorporateTaxTab";
import { WithholdingTaxTab } from "@/components/tax/WithholdingTaxTab";
import { TurnoverTaxTab } from "@/components/tax/TurnoverTaxTab";
import { TaxCalendarTab } from "@/components/tax/TaxCalendarTab";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// ── Thresholds ────────────────────────────────────────────────────────────────
const TOT_MIN = 1_000_000;   // KES 1M
const TOT_MAX = 25_000_000;  // KES 25M
const VAT_THRESHOLD = 5_000_000; // KES 5M

// ── Tax regime logic ──────────────────────────────────────────────────────────
type TaxRegime =
  | "exempt"        // < 1M — no income tax
  | "tot"           // 1M–25M — Turnover Tax 3%
  | "corporate"     // > 25M — Corporate Tax 30%
  | "vat";          // VAT registered — VAT + Corporate Tax

const getRegime = (vatRegistered: boolean, annualTurnover: number): TaxRegime => {
  if (vatRegistered) return "vat";
  if (annualTurnover >= TOT_MAX) return "corporate";
  if (annualTurnover >= TOT_MIN) return "tot";
  return "exempt";
};

const regimeInfo: Record<TaxRegime, { label: string; color: string; description: string }> = {
  exempt: {
    label: "Tax Exempt",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    description: "Annual turnover below KES 1M. No income tax obligations. PAYE still applies if you have employees.",
  },
  tot: {
    label: "Turnover Tax (TOT)",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    description: "Annual turnover KES 1M–25M. File TOT at 3% of gross monthly revenue by the 20th each month.",
  },
  corporate: {
    label: "Corporate Tax",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    description: "Annual turnover above KES 25M. Pay 30% corporate tax on net profit with quarterly instalments.",
  },
  vat: {
    label: "VAT Registered",
    color: "bg-green-100 text-green-700 border-green-200",
    description: "Charge 16% VAT on taxable supplies. File VAT3 return monthly by the 20th and submit invoices via eTIMS.",
  },
};

const Tax = () => {
  const { profile, business } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [hasEmployees, setHasEmployees] = useState(false);

  const vatRegistered = business?.vat_registered ?? false;
  const annualTurnover = business?.annual_turnover ?? 0;
  const regime = getRegime(vatRegistered, annualTurnover);
  const info = regimeInfo[regime];

  // Determine which tabs to show
  const tabs = useMemo(() => {
    const t: { value: string; label: string; icon: any }[] = [];

    if (regime === "vat") {
      t.push({ value: "vat", label: "VAT", icon: Receipt });
      t.push({ value: "corp", label: "Corporate Tax", icon: Building2 });
    } else if (regime === "corporate") {
      t.push({ value: "corp", label: "Corporate Tax", icon: Building2 });
      t.push({ value: "tot", label: "Turnover Tax", icon: PiggyBank });
    } else if (regime === "tot") {
      t.push({ value: "tot", label: "Turnover Tax", icon: PiggyBank });
    }
    // All regimes get WHT and Calendar
    t.push({ value: "wht", label: "Withholding Tax", icon: Landmark });
    t.push({ value: "cal", label: "Tax Calendar", icon: CalendarClock });

    return t;
  }, [regime]);

  // Default tab to first available
  const defaultTab = tabs[0]?.value ?? "cal";
  const [tab, setTab] = useState(params.get("tab") || defaultTab);

  useEffect(() => {
    if (!profile?.business_id) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("txn_date", { ascending: false })
        .limit(2000);
      if (error) {
        toast({ title: "Couldn't load transactions", description: error.message, variant: "destructive" });
      } else {
        setTxns((data ?? []) as Transaction[]);
      }
    };
    const checkEmployees = async () => {
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("business_id", profile.business_id!)
        .eq("status", "active");
      setHasEmployees((count ?? 0) > 0);
    };
    load();
    checkEmployees();
  }, [profile?.business_id]);

  const onTab = (v: string) => {
    setTab(v);
    const next = new URLSearchParams(params);
    next.set("tab", v);
    setParams(next, { replace: true });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Tax Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            KRA compliance, tax calculations, and filing reminders for your business.
          </p>
        </header>

        {/* ── Tax Regime Banner ─────────────────────────────────────────────── */}
        <div className={`rounded-xl border p-4 ${info.color}`}>
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">Your tax regime: {info.label}</p>
                {!business?.annual_turnover && regime === "exempt" && (
                  <button
                    onClick={() => navigate("/settings")}
                    className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                  >
                    Set annual turnover in Settings →
                  </button>
                )}
              </div>
              <p className="text-xs mt-1 opacity-80">{info.description}</p>
            </div>
          </div>
        </div>

        {/* ── PAYE Notice (if employees exist) ─────────────────────────────── */}
        {hasEmployees && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-amber-800">PAYE Obligation</p>
                <p className="text-xs text-amber-700 mt-1">
                  You have active employees — deduct and remit PAYE, NSSF, SHIF, and Housing Levy to KRA by the <strong>9th of every month</strong>. Manage this in the <button onClick={() => navigate("/payroll")} className="underline font-medium">Payroll</button> section.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Exempt notice ────────────────────────────────────────────────── */}
        {regime === "exempt" && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
            <CheckCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-700">No income tax obligations</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Your annual turnover is below KES 1M. You are exempt from income tax.
              {hasEmployees
                ? " However, PAYE applies since you have employees."
                : " If your turnover grows past KES 1M, you'll need to register for Turnover Tax."}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate("/settings")}
                className="text-sm text-primary underline underline-offset-2"
              >
                Update annual turnover in Settings →
              </button>
            </div>
            {/* Still show WHT and Calendar even for exempt */}
            <div className="mt-6 border-t pt-6">
              <p className="text-xs text-gray-500 mb-4">You can still use Withholding Tax and the Tax Calendar:</p>
              <Tabs defaultValue="wht" className="space-y-4">
                <TabsList className="bg-muted/60 p-1">
                  <TabsTrigger value="wht" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <Landmark className="h-4 w-4" /> Withholding Tax
                  </TabsTrigger>
                  <TabsTrigger value="cal" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <CalendarClock className="h-4 w-4" /> Tax Calendar
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="wht"><WithholdingTaxTab /></TabsContent>
                <TabsContent value="cal"><TaxCalendarTab /></TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {/* ── Main tabs for non-exempt regimes ─────────────────────────────── */}
        {regime !== "exempt" && (
          <Tabs value={tab} onValueChange={onTab} className="space-y-6">
            <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
              {tabs.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <Icon className="h-4 w-4" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="vat" className="mt-0"><VatTab txns={txns} /></TabsContent>
            <TabsContent value="corp" className="mt-0"><CorporateTaxTab txns={txns} /></TabsContent>
            <TabsContent value="wht" className="mt-0"><WithholdingTaxTab /></TabsContent>
            <TabsContent value="tot" className="mt-0"><TurnoverTaxTab txns={txns} /></TabsContent>
            <TabsContent value="cal" className="mt-0"><TaxCalendarTab /></TabsContent>
          </Tabs>
        )}
      </div>
      <ChatbotWidget />
    </AppShell>
  );
};

export default Tax;