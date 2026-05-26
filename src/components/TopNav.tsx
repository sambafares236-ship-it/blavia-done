import { ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import logo from "@/assets/blavia-logo.png";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/analytics", label: "Analytics" },
  { to: "/employees", label: "Employees" },
  { to: "/payslips", label: "Payslips" },
];

export const TopNav = () => {
  return (
    <header className="bg-gradient-navy text-navy-foreground shadow-elevated">
      <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/10 p-1.5 backdrop-blur-sm">
            <img src={logo} alt="BLAVIA" className="h-9 w-9 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight md:text-xl">BLAVIA</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-75">
              Redefining Financial Statements
            </p>
          </div>
        </div>

        <nav className="order-3 flex w-full items-center gap-1 md:order-2 md:w-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="order-2 hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm md:order-3 md:flex">
          <ShieldCheck className="h-4 w-4" />
          Live · Supabase
        </div>
      </div>
    </header>
  );
};
