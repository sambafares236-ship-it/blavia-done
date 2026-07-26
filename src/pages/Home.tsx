import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileBarChart2,
  FileText,
  Gauge,
  Hourglass,
  Landmark,
  Mail,
  MapPin,
  PieChart,
  Receipt,
  Scale,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const APPROVED_STATUSES = ["approved", "auto-approved"];

const money = (n: number, currency = "KES") =>
  `${currency} ` + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const formatDate = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
};

/** A single labelled value inside an information card. */
const Field = ({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  loading?: boolean;
}) => (
  <div className="min-w-0">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    {loading ? (
      <Skeleton className="mt-1.5 h-4 w-28" />
    ) : (
      <div className="mt-1 flex items-start gap-1.5 text-sm text-foreground">
        {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 break-words">{value}</span>
      </div>
    )}
  </div>
);

const InfoCard = ({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: { label: string; to: string };
  children: React.ReactNode;
}) => (
  <Card className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <Link
          to={action.to}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          {action.label} →
        </Link>
      )}
    </div>
    <div className="mt-4">{children}</div>
  </Card>
);

type StatusTone = "ok" | "warn" | "missing";

const StatusRow = ({
  label,
  value,
  tone,
  fix,
  loading,
}: {
  label: string;
  value: string;
  tone: StatusTone;
  fix?: { label: string; to: string };
  loading?: boolean;
}) => {
  const toneStyles: Record<StatusTone, string> = {
    ok: "bg-emerald-500/10 text-emerald-600",
    warn: "bg-amber-500/10 text-amber-600",
    missing: "bg-muted text-muted-foreground",
  };
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0">
      <span className="text-sm text-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              toneStyles[tone],
            )}
          >
            {tone !== "missing" && <Icon className="h-3 w-3" />}
            {value}
          </span>
          {tone !== "ok" && fix && (
            <Link to={fix.to} className="text-[11px] font-medium text-primary hover:underline">
              {fix.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

const SHORTCUTS = [
  { to: "/executive", label: "Executive BI", desc: "KPIs, margins and trends", icon: Gauge },
  { to: "/payments", label: "Transactions", desc: "Review and approve activity", icon: Wallet },
  { to: "/invoices", label: "Invoices", desc: "Raise and send invoices", icon: FileText },
  { to: "/receivables", label: "Receivables", desc: "Chase what you're owed", icon: Hourglass },
  { to: "/payables", label: "Payables", desc: "Track what you owe", icon: Receipt },
  { to: "/scheduled-expenses", label: "Scheduled Expenses", desc: "Recurring bills and dues", icon: CalendarClock },
  { to: "/balance-sheet", label: "Assets & Liabilities", desc: "Net position register", icon: Landmark },
  { to: "/payroll", label: "Payroll", desc: "Employees and payslips", icon: Users },
  { to: "/tax", label: "Tax Center", desc: "VAT, PAYE and filings", icon: Scale },
  { to: "/reports", label: "Financial Reports", desc: "P&L, cash flow, balance sheet", icon: FileBarChart2 },
  { to: "/analytics", label: "Analytics", desc: "Forecasts and insights", icon: PieChart },
  { to: "/settings", label: "Settings", desc: "Business and integrations", icon: SettingsIcon },
];

const Home = () => {
  const { user, profile, business } = useAuth();

  const [loading, setLoading] = useState(true);
  const [kraPin, setKraPin] = useState<string | null>(null);
  const [etimsStatus, setEtimsStatus] = useState<string | null>(null);
  const [mpesaActive, setMpesaActive] = useState(false);
  const [staff, setStaff] = useState({ count: 0, payroll: 0 });
  const [revenueYtd, setRevenueYtd] = useState(0);

  useEffect(() => {
    if (!business?.id) return;

    const load = async () => {
      setLoading(true);
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

      const [etimsRes, mpesaRes, empRes, txRes] = await Promise.all([
        supabase
          .from("etims_configs")
          .select("kra_pin, status")
          .eq("business_id", business.id)
          .maybeSingle(),
        supabase
          .from("mpesa_configs")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("is_active", true),
        supabase
          .from("employees")
          .select("id, status, basic_salary")
          .eq("business_id", business.id),
        supabase
          .from("transactions")
          .select("amount, txn_type, status, txn_date")
          .eq("business_id", business.id)
          .gte("txn_date", yearStart)
          .limit(5000),
      ]);

      setKraPin(etimsRes.data?.kra_pin ?? null);
      setEtimsStatus(etimsRes.data?.status ?? null);
      setMpesaActive((mpesaRes.count ?? 0) > 0);

      const active = (empRes.data ?? []).filter((e) => e.status === "active");
      setStaff({
        count: active.length,
        payroll: active.reduce((s, e) => s + (Number(e.basic_salary) || 0), 0),
      });

      const income = (txRes.data ?? []).filter(
        (t) =>
          APPROVED_STATUSES.includes(String(t.status ?? "").toLowerCase()) &&
          String(t.txn_type ?? "").toLowerCase() === "income",
      );
      setRevenueYtd(income.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0));

      setLoading(false);
    };

    load();
  }, [business?.id]);

  const currency = business?.currency ?? "KES";

  const fullName =
    profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? null;
  const greetingName = fullName?.split(" ")[0] ?? "there";

  const address = useMemo(() => {
    const parts = [
      business?.street_address,
      business?.city,
      business?.county,
      business?.postal_code,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not set";
  }, [business]);

  const initials =
    business?.business_name
      ?.split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "B";

  const turnover = Number(business?.annual_turnover) || 0;
  const turnoverProgress = turnover > 0 ? Math.min(100, (revenueYtd / turnover) * 100) : null;

  const etimsTone: StatusTone =
    etimsStatus === "active" ? "ok" : etimsStatus ? "warn" : "missing";
  const etimsLabel =
    etimsStatus === "active"
      ? "Connected"
      : etimsStatus === "error"
        ? "Error"
        : etimsStatus === "pending"
          ? "Pending"
          : "Not set up";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <section>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Welcome back, {greetingName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your business profile and everything it connects to.
          </p>
        </section>

        <OnboardingChecklist />

        {/* Business identity */}
        <Card className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              {business?.logo_url ? (
                <img
                  src={business.logo_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-foreground">
                  {business?.business_name ?? "Your business"}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {business?.business_category ?? "Category not set"} · {currency}
                </p>
              </div>
            </div>
            <Link
              to="/settings"
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Edit business details →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border/50 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Owner email" value={business?.owner_email ?? profile?.email ?? "—"} icon={Mail} />
            <Field label="WhatsApp" value={business?.whatsapp_number ?? "Not set"} icon={Smartphone} />
            <Field label="Address" value={address} icon={MapPin} />
            <Field label="Reporting currency" value={currency} icon={Building2} />
          </div>
        </Card>

        {/* Compliance + Financial profile */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <InfoCard
            title="Compliance & integrations"
            description="What's connected, and what still needs attention"
            action={{ label: "Manage", to: "/settings" }}
          >
            <div>
              <StatusRow
                label="KRA PIN"
                value={kraPin ?? "Not set"}
                tone={kraPin ? "ok" : "missing"}
                fix={{ label: "Add", to: "/settings" }}
                loading={loading}
              />
              <StatusRow
                label="eTIMS"
                value={etimsLabel}
                tone={etimsTone}
                fix={{ label: "Set up", to: "/settings" }}
                loading={loading}
              />
              {/* Not being VAT registered is lawful, not a compliance gap — it
                  is reported without the warning tone. eTIMS above applies either way. */}
              <StatusRow
                label="VAT registration"
                value={business?.vat_registered ? "Registered" : "Not registered"}
                tone="ok"
                loading={loading}
              />
              <StatusRow
                label="M-Pesa"
                value={mpesaActive ? "Connected" : "Not set up"}
                tone={mpesaActive ? "ok" : "missing"}
                fix={{ label: "Connect", to: "/mpesa-settings" }}
                loading={loading}
              />
            </div>
          </InfoCard>

          <InfoCard
            title="Financial profile"
            description="Declared figures and how the year is tracking against them"
            action={{ label: "Edit", to: "/settings" }}
          >
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Declared annual turnover"
                value={turnover > 0 ? money(turnover, currency) : "Not set"}
              />
              <Field
                label="Revenue this year"
                value={money(revenueYtd, currency)}
                loading={loading}
              />
              <Field
                label="Tax status"
                value={business?.vat_registered ? "VAT registered" : "Not VAT registered"}
              />
              <Field
                label="Low-cash alert at"
                value={
                  business?.alert_threshold != null
                    ? money(Number(business.alert_threshold), currency)
                    : "Not set"
                }
              />
            </div>

            {turnoverProgress !== null && !loading && (
              <div className="mt-4 border-t border-border/50 pt-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Against declared turnover</span>
                  <span className="font-semibold text-foreground">
                    {turnoverProgress.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${turnoverProgress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Approved income booked since 1 January, against the turnover on file.
                </p>
              </div>
            )}
          </InfoCard>
        </div>

        {/* Team & account */}
        <InfoCard
          title="Team & account"
          description="Who runs this business on Blavia"
          action={{ label: "Manage payroll", to: "/payroll?tab=employees" }}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="Account owner" value={fullName ?? user?.email ?? "—"} />
            <Field label="Your role" value={profile?.role ? profile.role[0].toUpperCase() + profile.role.slice(1) : "—"} />
            <Field
              label="Active employees"
              value={String(staff.count)}
              loading={loading}
            />
            <Field
              label="Monthly payroll"
              value={money(staff.payroll, currency)}
              loading={loading}
            />
            <Field label="Signed in as" value={user?.email ?? "—"} icon={Mail} />
            <Field label="Member since" value={formatDate(user?.created_at)} />
            <Field label="Contact phone" value={profile?.phone ?? "Not set"} icon={Smartphone} />
            <Field
              label="Compliance"
              value={
                kraPin && etimsStatus === "active" ? "Fully configured" : "Needs attention"
              }
              icon={ShieldCheck}
              loading={loading}
            />
          </div>
        </InfoCard>

        {/* Shortcuts */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Go to</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SHORTCUTS.map(({ to, label, desc, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                    {label}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default Home;
