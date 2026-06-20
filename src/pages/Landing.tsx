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

const BRAND = "#0d1f2d";
const GOLD = "#E7B008";

const Landing = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg p-1.5"
            style={{ background: BRAND }}
          >
            <img src={logo} alt="BLAVIA" className="h-full w-full object-contain" />
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: BRAND }}>
            BLAVIA
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login" style={{ color: BRAND }}>Sign in</Link>
          </Button>
          <Button
            asChild
            style={{ background: GOLD, color: BRAND, border: "none" }}
            className="hover:opacity-90"
          >
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <section className="text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-6 text-white"
            style={{ background: BRAND }}>
            🇰🇪 Built for Kenyan Businesses
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl" style={{ color: BRAND }}>
            Finance, payroll, and tax —{" "}
            <span className="relative inline-block">
              done right.
              <span
                className="absolute -bottom-1 left-0 h-1 w-full rounded-full"
                style={{ background: GOLD }}
              />
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            BLAVIA gives Kenyan businesses one place to manage payments, run payroll, file taxes,
            and produce audit-ready financial reports.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              style={{ background: GOLD, color: BRAND, border: "none" }}
              className="hover:opacity-90 shadow-lg"
            >
              <Link to="/signup">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              style={{ borderColor: BRAND, color: BRAND }}
              className="hover:opacity-80"
            >
              <Link to="/login">Sign in</Link>
            </Button>
          </div>

          {/* Stats row */}
          <div className="mt-12 flex items-center justify-center gap-8 flex-wrap">
            {[
              { label: "Businesses", value: "500+" },
              { label: "Transactions Tracked", value: "KES 2B+" },
              { label: "Payroll Processed", value: "KES 500M+" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold" style={{ color: GOLD }}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border p-5 transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{ borderColor: `${BRAND}30`, background: `${BRAND}08` }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: `${BRAND}15` }}
              >
                <Icon className="h-5 w-5" style={{ color: BRAND }} />
              </div>
              <h3 className="mt-4 text-base font-semibold" style={{ color: BRAND }}>{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>

        {/* CTA Banner */}
        <section
          className="mt-16 rounded-2xl p-8 text-center text-white"
          style={{ background: BRAND }}
        >
          <h2 className="text-2xl font-bold">Ready to take control of your finances?</h2>
          <p className="mt-2 text-sm opacity-80">
            Join hundreds of Kenyan businesses already using BLAVIA.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 hover:opacity-90"
            style={{ background: GOLD, color: BRAND, border: "none" }}
          >
            <Link to="/signup">
              Start for free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </section>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-muted-foreground">
          <p>© 2026 BLAVIA — Track. Automate. Grow.</p>
          <p className="mt-1">Built for Kenyan businesses 🇰🇪</p>
        </footer>
      </main>
    </div>
  );
};

export default Landing;