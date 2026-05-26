import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BarChart3, Scale, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/blavia-logo.png";

const features = [
  { icon: Wallet, title: "Payments", desc: "Track inflows and outflows in real time." },
  { icon: Users, title: "Payroll", desc: "Run payroll with PAYE, NHIF, NSSF, and Housing Levy." },
  { icon: Scale, title: "Tax Center", desc: "VAT, Corporate, WHT, and Turnover Tax in one place." },
  { icon: BarChart3, title: "Reports", desc: "P&L, Cash Flow, Balance Sheet with approvals." },
];

const Landing = () => {
  const { user, loading } = useAuth();

  // While auth is initializing (e.g. processing access_token from email link), wait.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Already signed in (including right after email-confirmation redirect) → go to dashboard.
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary p-1.5">
            <img src={logo} alt="BLAVIA" className="h-full w-full object-contain" />
          </div>
          <span className="text-base font-bold tracking-tight">BLAVIA</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Finance, payroll, and tax — done right.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            BLAVIA gives Kenyan businesses one place to manage payments, run payroll, file taxes,
            and produce audit-ready financial reports.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

export default Landing;
