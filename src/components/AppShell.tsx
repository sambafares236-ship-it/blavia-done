import { ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AlertTriangle, Bell, CalendarClock, CheckCheck,
  ClipboardList, CreditCard, LogOut, Menu, Search, TrendingDown, Users,
} from "lucide-react";
import { SideNav } from "./SideNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface AppShellProps { children: ReactNode; }

// ── Notification types ────────────────────────────────────────
type AlertLevel = "warning" | "info" | "success";
interface Notif {
  id: string;
  level: AlertLevel;
  icon: React.ElementType;
  title: string;
  body: string;
  link: string;
}

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n);

// ── Build notifications from live data ────────────────────────
async function buildNotifications(businessId: string): Promise<Notif[]> {
  const alerts: Notif[] = [];
  const now = new Date();

  const [txRes, schedRes, empRes, assetRes, liabRes] = await Promise.all([
    supabase.from("transactions").select("id,status,txn_type,amount,txn_date")
      .eq("business_id", businessId).limit(500),
    supabase.from("scheduled_expenses").select("id,vendor,amount,next_due,status")
      .eq("business_id", businessId).eq("status", "active"),
    supabase.from("employees").select("id,status,basic_salary")
      .eq("business_id", businessId),
    supabase.from("assets").select("value").eq("business_id", businessId),
    supabase.from("liabilities").select("value,due_on").eq("business_id", businessId),
  ]);

  const txns = txRes.data ?? [];
  const scheduled = schedRes.data ?? [];
  const employees = empRes.data ?? [];
  const assets = assetRes.data ?? [];
  const liabilities = liabRes.data ?? [];

  // 1. Pending transactions
  const pending = txns.filter((t) => t.status === "Pending Review");
  if (pending.length > 0) {
    alerts.push({
      id: "pending-txns",
      level: "warning",
      icon: ClipboardList,
      title: `${pending.length} transaction${pending.length > 1 ? "s" : ""} pending review`,
      body: "Review and approve to keep your records accurate.",
      link: "/dashboard#transactions",
    });
  }

  // 2. Overdue scheduled expenses
  const overdue = scheduled.filter((s) => {
    const due = new Date(s.next_due);
    return !isNaN(due.getTime()) && due < now;
  });
  if (overdue.length > 0) {
    const names = overdue.slice(0, 2).map((s) => s.vendor).join(", ");
    alerts.push({
      id: "overdue-expenses",
      level: "warning",
      icon: AlertTriangle,
      title: `${overdue.length} overdue scheduled expense${overdue.length > 1 ? "s" : ""}`,
      body: `${names}${overdue.length > 2 ? ` +${overdue.length - 2} more` : ""} past due date.`,
      link: "/scheduled-expenses",
    });
  }

  // 3. Expenses due in next 7 days
  const soon = scheduled.filter((s) => {
    const due = new Date(s.next_due);
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });
  if (soon.length > 0) {
    const total = soon.reduce((s, e) => s + Number(e.amount), 0);
    alerts.push({
      id: "upcoming-expenses",
      level: "info",
      icon: CalendarClock,
      title: `${soon.length} bill${soon.length > 1 ? "s" : ""} due in the next 7 days`,
      body: `Total: ${fmtKES(total)} — ${soon.slice(0, 2).map((s) => s.vendor).join(", ")}`,
      link: "/scheduled-expenses",
    });
  }

  // 4. VAT filing reminder (due 20th of each month)
  const dueDay = 20;
  const daysUntilVatDue = dueDay - now.getDate();
  if (daysUntilVatDue >= 0 && daysUntilVatDue <= 5) {
    const month = now.toLocaleString("en-KE", { month: "long", year: "numeric" });
    alerts.push({
      id: "vat-reminder",
      level: daysUntilVatDue <= 2 ? "warning" : "info",
      icon: CalendarClock,
      title: `VAT return due in ${daysUntilVatDue} day${daysUntilVatDue !== 1 ? "s" : ""}`,
      body: `File your ${month} VAT3 return by the 20th to avoid KRA penalties.`,
      link: "/tax?tab=vat",
    });
  }

  // 5. Monthly cashflow check
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthTxns = txns.filter(
    (t) => t.txn_date?.startsWith(thisMonthKey) && t.status === "Approved"
  );
  const monthIncome = thisMonthTxns
    .filter((t) => t.txn_type === "Income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = thisMonthTxns
    .filter((t) => t.txn_type === "Expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  if (monthExpense > monthIncome && monthIncome > 0) {
    alerts.push({
      id: "cashflow-warning",
      level: "warning",
      icon: TrendingDown,
      title: "Expenses exceed income this month",
      body: `Income: ${fmtKES(monthIncome)} · Expenses: ${fmtKES(monthExpense)} · Deficit: ${fmtKES(monthExpense - monthIncome)}`,
      link: "/analytics",
    });
  }

  // 6. Payroll reminder (1st–5th of month)
  if (now.getDate() <= 5) {
    const activeEmp = employees.filter((e) => e.status === "active");
    const payrollTotal = activeEmp.reduce((s, e) => s + Number(e.basic_salary), 0);
    if (payrollTotal > 0) {
      alerts.push({
        id: "payroll-reminder",
        level: "info",
        icon: Users,
        title: "Monthly payroll reminder",
        body: `${activeEmp.length} active employees — total payroll: ${fmtKES(payrollTotal)}`,
        link: "/payroll",
      });
    }
  }

  // 7. Liabilities due soon
  const liabsDueSoon = liabilities.filter((l) => {
    if (!l.due_on) return false;
    const due = new Date(l.due_on);
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 14;
  });
  if (liabsDueSoon.length > 0) {
    const total = liabsDueSoon.reduce((s, l) => s + Number(l.value), 0);
    alerts.push({
      id: "liabilities-due",
      level: "warning",
      icon: CreditCard,
      title: `${liabsDueSoon.length} liability payment${liabsDueSoon.length > 1 ? "s" : ""} due soon`,
      body: `Total due: ${fmtKES(total)} within the next 14 days.`,
      link: "/balance-sheet",
    });
  }

  // 8. Net worth positive — celebrate!
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiabs = liabilities.reduce((s, l) => s + Number(l.value), 0);
  if (totalAssets > totalLiabs && totalAssets > 0 && alerts.length === 0) {
    alerts.push({
      id: "net-worth-positive",
      level: "success",
      icon: CheckCheck,
      title: "Your business is financially healthy",
      body: `Net worth: ${fmtKES(totalAssets - totalLiabs)} — assets exceed liabilities.`,
      link: "/balance-sheet",
    });
  }

  return alerts;
}

// ── Main component ─────────────────────────────────────────────
export const AppShell = ({ children }: AppShellProps) => {
  const { user, profile, business, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const dropRef = useRef<HTMLDivElement>(null);

  const fullName =
    profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined);
  const displayName = fullName ?? user?.email ?? "User";
  const initials =
    fullName?.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
    || (user?.email?.[0]?.toUpperCase() ?? "U");

  // Load notifications
  useEffect(() => {
    if (!business?.id) return;
    buildNotifications(business.id).then(setNotifs);
  }, [business?.id, location.pathname]);

  // Close mobile sidebar drawer on every route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifs.filter((n) => !read.has(n.id)).length;

  const handleOpen = () => {
    setOpen((o) => !o);
  };

  const markAllRead = () => {
    setRead(new Set(notifs.map((n) => n.id)));
  };

  const handleNotifClick = (n: Notif) => {
    setRead((r) => new Set([...r, n.id]));
    setOpen(false);
    navigate(n.link);
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Signed out" });
    navigate("/login", { replace: true });
  };

  const levelStyles: Record<AlertLevel, string> = {
    warning: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
    info: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
    success: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
  };

  const iconStyles: Record<AlertLevel, string> = {
    warning: "text-amber-600",
    info: "text-blue-600",
    success: "text-emerald-600",
  };

  return (
    <div className="flex min-h-screen bg-background">
      <SideNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden flex-1 max-w-md md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              className="h-10 rounded-full border-transparent bg-muted/60 pl-10 text-sm focus-visible:bg-card"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notification bell */}
            <div ref={dropRef} className="relative">
              <button
                onClick={handleOpen}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {open && (
                <div className="absolute right-0 top-11 z-50 w-[360px] rounded-xl border border-border bg-background shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Notifications
                      {unread > 0 && (
                        <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {unread} new
                        </span>
                      )}
                    </h3>
                    {unread > 0 && (
                      <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notification list */}
                  <div className="max-h-[420px] overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No alerts right now</p>
                        <p className="text-xs text-muted-foreground/60">
                          We'll notify you when something needs attention.
                        </p>
                      </div>
                    ) : (
                      notifs.map((n) => {
                        const Icon = n.icon;
                        const isRead = read.has(n.id);
                        return (
                          <button
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            className={cn(
                              "w-full border-b border-border/50 border-l-4 px-4 py-3 text-left transition-colors last:border-b-0 hover:brightness-95",
                              levelStyles[n.level],
                              isRead && "opacity-60"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconStyles[n.level])} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={cn("text-xs font-semibold text-foreground truncate",
                                    !isRead && "font-bold")}>
                                    {n.title}
                                  </p>
                                  {!isRead && (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                                  )}
                                </div>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                                  {n.body}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-border px-4 py-2.5">
                    <p className="text-[10px] text-muted-foreground text-center">
                      Alerts refresh on every page load · Powered by BLAVIA
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* User badge */}
            <div className="flex items-center gap-2.5 rounded-full border border-border bg-card pl-1 pr-3.5 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {initials}
              </div>
              <span className="hidden text-sm font-medium text-foreground sm:inline">
                {displayName}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2 rounded-full"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
};