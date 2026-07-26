import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  House, Gauge, Wallet, Users, FileBarChart2,
  Scale, PieChart, Sparkles, Settings, LogOut, ArrowUpRight,
  CalendarClock, Landmark, FileText, X, Smartphone, Hourglass, Receipt,
  Calculator, ChevronDown, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/blavia-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };
type NavGroup = { group: string; label: string; icon: LucideIcon; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => "group" in entry;

const links: NavEntry[] = [
  { to: "/home", label: "Home", icon: House, end: true },
  { to: "/executive", label: "Executive BI", icon: Gauge },
  {
    group: "actuarial",
    label: "Actuarial Accounting",
    icon: Calculator,
    children: [
      { to: "/payments", label: "Transactions", icon: Wallet },
      { to: "/invoices", label: "Invoices", icon: FileText },
      { to: "/receivables", label: "Account Receivables", icon: Hourglass },
      { to: "/payables", label: "Account Payable", icon: Receipt },
      { to: "/scheduled-expenses", label: "Scheduled Expenses", icon: CalendarClock },
    ],
  },
  { to: "/balance-sheet", label: "Assets & Liabilities", icon: Landmark },
  { to: "/payroll", label: "Payroll", icon: Users },
  { to: "/tax", label: "Tax Center", icon: Scale },
  { to: "/reports", label: "Financial Reports", icon: FileBarChart2 },
  { to: "/analytics", label: "Analytics", icon: PieChart },
  { to: "/mpesa-settings", label: "M-Pesa Setup", icon: Smartphone },
];

const storageKey = (group: string) => `blavia.sidenav.${group}`;

const readStoredOpen = (group: string) => {
  try {
    return localStorage.getItem(storageKey(group)) === "true";
  } catch {
    return false;
  }
};

const writeStoredOpen = (group: string, value: boolean) => {
  try {
    localStorage.setItem(storageKey(group), String(value));
  } catch {
    /* storage unavailable — state simply won't persist */
  }
};

interface SideNavProps {
  open?: boolean;
  onClose?: () => void;
  onOpenChat?: () => void;
}

export const SideNav = ({ open = false, onClose, onOpenChat }: SideNavProps) => {
  const { user, profile, business, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      links.filter(isGroup).map((g) => [g.group, readStoredOpen(g.group)])
    )
  );

  // Auto-expand a group whenever the active route lives inside it
  useEffect(() => {
    const active = links
      .filter(isGroup)
      .filter((g) => g.children.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`)));
    if (active.length === 0) return;
    setOpenGroups((prev) => {
      const next = { ...prev };
      active.forEach((g) => { next[g.group] = true; });
      return next;
    });
  }, [pathname]);

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => {
      const value = !prev[group];
      writeStoredOpen(group, value);
      return { ...prev, [group]: value };
    });
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Signed out" });
    navigate("/login", { replace: true });
  };

  const handleNavClick = () => { onClose?.(); };

  const fullName = profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined);
  const businessName = business?.business_name ?? profile?.company_name ?? (user?.user_metadata?.company_name as string | undefined);
  const initials =
    fullName?.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
    || (user?.email?.[0]?.toUpperCase() ?? "U");
  const displayName = businessName ?? fullName ?? user?.email ?? "User";

  const renderLink = ({ to, label, icon: Icon, end }: NavItem, nested = false) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={handleNavClick}
      className={({ isActive }) =>
        cn(
          "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
          nested && "text-[13px]",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center gap-3">
            <Icon className="h-4 w-4" strokeWidth={2.25} />
            {label}
          </span>
          {isActive && <ArrowUpRight className="h-3.5 w-3.5 opacity-80" />}
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full",
        "md:static md:z-auto md:flex md:w-60 md:max-w-none md:translate-x-0 md:shrink-0"
      )}>
        {/* Logo */}
        <div className="relative w-full overflow-hidden shrink-0">
          <img src={logo} alt="BLAVIA" className="w-full object-cover" style={{ height: "100px" }} />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto">
          {links.map((entry) => {
            if (!isGroup(entry)) return renderLink(entry);

            const { group, label, icon: Icon, children } = entry;
            const expanded = openGroups[group] ?? false;
            const hasActiveChild = children.some(
              (c) => pathname === c.to || pathname.startsWith(`${c.to}/`)
            );

            return (
              <div key={group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={expanded}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    hasActiveChild && !expanded
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                    {label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 opacity-70 transition-transform duration-200",
                      expanded && "rotate-180"
                    )}
                  />
                </button>

                {expanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-2">
                    {children.map((child) => renderLink(child, true))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => { onOpenChat?.(); onClose?.(); }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2.25} />
              AI Assistant
            </button>
          </div>
        </nav>

        {/* Profile + footer */}
        <div className="space-y-2 border-t border-sidebar-border p-3 shrink-0">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{fullName ?? user?.email ?? "Member"}</p>
            </div>
          </div>
          <button
            onClick={() => { handleNavClick(); navigate("/settings"); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};
