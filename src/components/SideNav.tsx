import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Gauge,
  Wallet,
  Users,
  FileBarChart2,
  Scale,
  PieChart,
  Sparkles,
  Settings,
  LogOut,
  ArrowUpRight,
  CalendarClock,
  Landmark,
  FileCheck,
  FileText,
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
  { to: "/scheduled-expenses", label: "Scheduled Expenses", icon: CalendarClock },
  { to: "/balance-sheet", label: "Assets & Liabilities", icon: Landmark },
  { to: "/payroll", label: "Payroll", icon: Users },
  { to: "/tax", label: "Tax Center", icon: Scale },
  { to: "/reports", label: "Financial Reports", icon: FileBarChart2 },
  { to: "/analytics", label: "Analytics", icon: PieChart },
  { to: "/etims-settings", label: "eTIMS", icon: FileCheck },
];

export const SideNav = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Signed out" });
    navigate("/login", { replace: true });
  };

  const fullName =
    profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined);
  const businessName =
    profile?.company_name ?? (user?.user_metadata?.company_name as string | undefined);
  const initials =
    fullName
      ?.split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? "U");
  const displayName = businessName ?? fullName ?? user?.email ?? "User";

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">

      {/* Logo — full width, tall, readable */}
      <div className="w-full overflow-hidden">
        <img
          src={logo}
          alt="BLAVIA"
          className="w-full object-cover"
          style={{ height: '100px' }}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
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
      <div className="space-y-2 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {fullName ?? user?.email ?? "Member"}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/settings")}
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
  );
};