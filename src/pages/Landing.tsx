import { Navigate } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  ArrowRight, BarChart3, Check, MessageCircle, Instagram, Mail,
  ShieldCheck, Scale, Users, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/landing/Navbar";
import logo from "@/assets/blavia-logo.png";
import homeShot from "@/assets/landing-screenshots/home-dashboard.png";
import payrollShot from "@/assets/landing-screenshots/payroll.png";
import taxShot from "@/assets/landing-screenshots/tax-center.png";

const BRAND = "#0d1f2d";
const GOLD = "#E7B008";
const WHATSAPP_URL =
  "https://wa.me/254791708828?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20Blavia";

const painPoints = [
  { title: "M-Pesa statements, reconciled by hand", desc: "Matching Till/Paybill payments to invoices in a notebook or spreadsheet, every single month." },
  { title: "Payroll on a calculator", desc: "Working out PAYE, NSSF, SHIF, and Housing Levy deductions manually for every employee, every payday." },
  { title: "KRA deadlines that sneak up on you", desc: "Not knowing which tax regime you're even in, until a filing deadline is already missed." },
];

const jobs = [
  {
    icon: Wallet,
    title: "Get paid faster",
    points: ["Send invoices by email in seconds", "Collect via M-Pesa STK push", "Track what's owed to you, with aging by due date"],
    shot: null as string | null,
  },
  {
    icon: Users,
    title: "Run payroll without the headache",
    points: ["PAYE, NSSF, SHIF, and Housing Levy calculated for you", "Pay staff in bulk directly via M-Pesa", "Payslips generated automatically"],
    shot: payrollShot,
  },
  {
    icon: Scale,
    title: "Stay KRA-compliant",
    points: ["Automatically detects your tax regime — VAT, Turnover Tax, or Corporate", "eTIMS-ready invoicing, so filings match what KRA expects", "A calendar of your actual filing deadlines"],
    shot: taxShot,
  },
  {
    icon: BarChart3,
    title: "See your whole financial picture",
    points: ["One dashboard for income, expenses, and cash position", "Receivables and payables in one view", "Balance sheet and financial reports"],
    shot: null as string | null,
  },
];

const steps = [
  { n: "1", title: "Sign up", desc: "Name, business, email — takes about a minute." },
  { n: "2", title: "Set up your business", desc: "Category, turnover, VAT status. Under a minute, and it's how we get your tax picture right from day one." },
  { n: "3", title: "Start using it", desc: "Send your first invoice, add your first employee, or connect M-Pesa." },
];

const aboutBullets = [
  "A retail shop owner flagged by KRA after an eTIMS submission failed silently — she thought it had gone through",
  "A business owner spending the first week of every month reconciling M-Pesa payments by hand against a notebook",
  "A payslip PAYE calculation done by hand that took weeks to sort out with KRA",
];

const faqs = [
  {
    q: "Does BLAVIA work with M-Pesa Till and Paybill?",
    a: "Yes. You can collect payments via STK push, and pay staff or suppliers directly via M-Pesa from within BLAVIA.",
  },
  {
    q: "What if I'm not VAT-registered, or I'm not sure what tax regime I'm in?",
    a: "Tell us your annual turnover during setup and BLAVIA works out whether you're VAT-registered, on Turnover Tax, on Corporate Tax, or exempt — and only shows you the taxes that actually apply.",
  },
  {
    q: "Do you submit invoices to eTIMS for me?",
    a: "BLAVIA supports eTIMS-ready invoicing so your invoices are structured for KRA's electronic tax invoice system.",
  },
  {
    q: "Is my financial and payroll data secure?",
    a: "Every business's data is isolated at the database level — your transactions, payroll, and customer details are never visible to other businesses on BLAVIA.",
  },
  {
    q: "Can I use BLAVIA if I don't have any employees yet?",
    a: "Yes. Invoicing, payments, and the Tax Center all work on their own. Payroll is there when you need it.",
  },
];

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
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-16 md:py-20">

        {/* Hero */}
        <section id="home" className="scroll-mt-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-6 text-white"
            style={{ background: BRAND }}>
            🇰🇪 Built for Kenyan Businesses
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl" style={{ color: BRAND }}>
            Invoicing, payroll, and KRA tax —{" "}
            <span className="relative inline-block">
              built for how you actually get paid.
              <span
                className="absolute -bottom-1 left-0 h-1 w-full rounded-full"
                style={{ background: GOLD }}
              />
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            M-Pesa native. PAYE, NSSF, SHIF, and Housing Levy calculated automatically.
            Your tax regime worked out for you — VAT, Turnover Tax, or Corporate. One place, not five.
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
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          {/* Product shot */}
          <div className="mx-auto mt-14 max-w-4xl">
            <div
              className="overflow-hidden rounded-2xl border shadow-2xl"
              style={{ borderColor: `${BRAND}20` }}
            >
              <img
                src={homeShot}
                alt="The BLAVIA dashboard, showing a business's onboarding checklist and profile"
                className="w-full"
              />
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="mt-24">
          <h2 className="text-center text-2xl font-bold md:text-3xl" style={{ color: BRAND }}>
            Sound familiar?
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {painPoints.map((p) => (
              <div key={p.title} className="rounded-xl border p-5" style={{ borderColor: `${BRAND}20` }}>
                <h3 className="text-sm font-semibold" style={{ color: BRAND }}>{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What it does */}
        <section id="features" className="mt-24 scroll-mt-24">
          <h2 className="text-center text-2xl font-bold md:text-3xl" style={{ color: BRAND }}>
            What BLAVIA does
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {jobs.map(({ icon: Icon, title, points, shot }) => (
              <div
                key={title}
                className="overflow-hidden rounded-xl border transition-all hover:shadow-lg"
                style={{ borderColor: `${BRAND}20`, background: `${BRAND}05` }}
              >
                <div className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${BRAND}15` }}>
                    <Icon className="h-5 w-5" style={{ color: BRAND }} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold" style={{ color: BRAND }}>{title}</h3>
                  <ul className="mt-3 space-y-2">
                    {points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
                {shot && (
                  <div className="border-t" style={{ borderColor: `${BRAND}15` }}>
                    <img src={shot} alt={`${title} in BLAVIA`} className="w-full" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mt-24 scroll-mt-24">
          <h2 className="text-center text-2xl font-bold md:text-3xl" style={{ color: BRAND }}>
            How it works
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: BRAND }}
                >
                  {s.n}
                </div>
                <h3 className="mt-3 text-sm font-semibold" style={{ color: BRAND }}>{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section id="about" className="mt-24 scroll-mt-24">
          <h2 className="text-center text-2xl font-bold md:text-3xl" style={{ color: BRAND }}>
            Why we built BLAVIA
          </h2>
          <div
            className="mx-auto mt-8 max-w-2xl rounded-2xl border p-7 md:p-9"
            style={{ borderColor: `${BRAND}20`, background: `${BRAND}05` }}
          >
            <p className="text-base leading-relaxed" style={{ color: BRAND }}>
              BLAVIA didn't start as a product idea — it started from watching Nairobi SME owners get
              penalized for paperwork problems, not business problems. The tools available were built
              for accountants, not for someone running a shop or a small firm on their own. BLAVIA is
              what we wish existed for them.
            </p>

            <p className="mt-5 text-sm font-semibold" style={{ color: BRAND }}>
              The same pattern, over and over:
            </p>
            <ul className="mt-3 space-y-2.5">
              {aboutBullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                  {b}
                </li>
              ))}
            </ul>

            <p className="mt-6 border-t pt-5 text-sm leading-relaxed text-muted-foreground" style={{ borderColor: `${BRAND}15` }}>
              Same pattern, different businesses, every time: real compliance systems, built for people
              without a finance team behind them. That's BLAVIA.
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-24 scroll-mt-24">
          <h2 className="text-center text-2xl font-bold md:text-3xl" style={{ color: BRAND }}>
            Simple pricing
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            One price. Everything included. No tiers to figure out.
          </p>
          <div
            className="mx-auto mt-8 max-w-sm rounded-2xl border p-8 text-center shadow-lg"
            style={{ borderColor: `${BRAND}20` }}
          >
            <p className="text-sm font-semibold text-muted-foreground">BLAVIA — Full Access</p>
            <p className="mt-2">
              <span className="text-4xl font-bold" style={{ color: BRAND }}>KES 3,000</span>
              <span className="text-sm text-muted-foreground"> / month</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-left">
              {[
                "Unlimited invoicing & M-Pesa collection",
                "Payroll — PAYE, NSSF, SHIF, Housing Levy",
                "M-Pesa bulk payroll disbursement",
                "Tax Center — VAT, Turnover Tax, Corporate Tax",
                "eTIMS-ready invoicing",
                "Receivables, payables & balance sheet",
                "Financial reports & dashboard",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} />
                  <span style={{ color: BRAND }}>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              size="lg"
              className="mt-7 w-full hover:opacity-90 shadow-lg"
              style={{ background: GOLD, color: BRAND, border: "none" }}
            >
              <Link to="/signup">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <div
              className="mt-5 flex items-center justify-center gap-1.5 text-xs font-medium"
              style={{ color: BRAND }}
            >
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: GOLD }} />
              Your data is never visible to other businesses
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-24 scroll-mt-24">
          <h2 className="text-center text-2xl font-bold md:text-3xl" style={{ color: BRAND }}>
            Frequently asked questions
          </h2>
          <div className="mx-auto mt-8 max-w-2xl">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={f.q} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-semibold" style={{ color: BRAND }}>
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="mt-24 scroll-mt-24">
          <h2 className="text-center text-2xl font-bold md:text-3xl" style={{ color: BRAND }}>
            Get in touch
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Questions before you sign up? Reach us directly.
          </p>
          <div className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl border p-5 shadow-sm transition-all hover:shadow-lg"
              style={{ borderColor: `${BRAND}20` }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: "#25D36620" }}>
                <MessageCircle className="h-5 w-5" style={{ color: "#25D366" }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: BRAND }}>WhatsApp</p>
                <p className="text-xs text-muted-foreground">Fastest way to reach us</p>
              </div>
            </a>

            <a
              href="mailto:admin@blavia.finance"
              className="flex items-center gap-4 rounded-xl border p-5 shadow-sm transition-all hover:shadow-lg"
              style={{ borderColor: `${BRAND}20` }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${BRAND}10` }}>
                <Mail className="h-5 w-5" style={{ color: BRAND }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: BRAND }}>Email</p>
                <p className="text-xs text-muted-foreground">admin@blavia.finance</p>
              </div>
            </a>
          </div>
        </section>

        {/* CTA Banner */}
        <section
          className="mt-24 rounded-2xl p-8 text-center text-white"
          style={{ background: BRAND }}
        >
          <h2 className="text-2xl font-bold">Ready to take control of your finances?</h2>
          <p className="mt-2 text-sm opacity-80">
            Invoicing, payroll, and tax — set up in a couple of minutes.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 hover:opacity-90"
            style={{ background: GOLD, color: BRAND, border: "none" }}
          >
            <Link to="/signup">
              Get started <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t pt-10" style={{ borderColor: `${BRAND}15` }}>
          <div className="flex flex-col items-center gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="BLAVIA" className="h-6 w-auto" />
              <span className="text-sm font-bold" style={{ color: BRAND }}>BLAVIA</span>
            </div>

            <div className="flex flex-col items-center gap-3 text-xs text-muted-foreground md:items-end">
              <div className="flex items-center gap-4">
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">WhatsApp</a>
                <a href="mailto:admin@blavia.finance" className="hover:underline">admin@blavia.finance</a>
                <a
                  href="https://instagram.com/blaviake"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline"
                >
                  <Instagram className="h-3.5 w-3.5" /> @blaviake
                </a>
              </div>
              <div className="flex items-center gap-4">
                <Link to="/legal#privacy" className="hover:underline">Privacy Policy</Link>
                <Link to="/legal#terms" className="hover:underline">Terms of Service</Link>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-muted-foreground">
            <p>© 2026 Blaviake — BLAVIA. Track. Automate. Grow.</p>
            <p className="mt-1">Built for Kenyan businesses 🇰🇪</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Landing;
