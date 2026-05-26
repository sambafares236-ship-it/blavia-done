import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Search } from "lucide-react";
import { SideNav } from "./SideNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const fullName =
    profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined);
  const displayName = fullName ?? user?.email ?? "User";
  const initials =
    fullName
      ?.split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? "U");

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Signed out" });
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <SideNav />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:px-8">
          <div className="relative hidden flex-1 max-w-md md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              className="h-10 rounded-full border-transparent bg-muted/60 pl-10 text-sm focus-visible:bg-card"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>

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
