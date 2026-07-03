import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Gauge, Wallet, Users, FileBarChart2,
  Scale, PieChart, Sparkles, Settings, LogOut, ArrowUpRight,
  CalendarClock, Landmark, FileText, X, Smartphone, Hourglass, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/blavia-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/executive", label: "Executive BI", icon: Gauge },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/receivables", label: "Receivables", icon: Hourglass },
  { to: "/payables", label: "Payables", icon: Receipt },
  { to: "/scheduled-expenses", label: "Scheduled Expenses", icon: CalendarClock },
  { to: "/balance-sheet", label: "Assets & Liabilities", icon: Landmark },
  { to: "/payroll", label: "Payroll", icon: Users },
  { to: "/tax", label: "Tax Center", icon: Scale },
  { to: "/reports", label: "Financial Reports", icon: FileBarChart2 },
  { to: "/analytics", label: "Analytics", icon: PieChart },
  { to: "/mpesa-settings", label: "M-Pesa Setup", icon: Smartphone },
];

interface SideNavProps {
  open?: boolean;
  onClose?: () => void;
}

export const SideNav = ({ open = false, onClose }: SideNavProps) => {
  const { user, profile, business, signOut } = useAuth();
  const navigate = useNavigate();

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
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn(
                  "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
          ))}

          <div className="pt-2">
            <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70">
              <Sparkles className="h-4 w-4" strokeWidth={2.25} />
              AI Assistant
            </div>
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