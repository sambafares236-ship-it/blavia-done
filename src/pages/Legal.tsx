import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/blavia-logo.png";

const BRAND = "#0d1f2d";
const GOLD_TEXT = "#B8860B";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-6">
    <h3 className="text-base font-semibold" style={{ color: BRAND }}>{title}</h3>
    <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  </div>
);

const Legal = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-5 md:px-10" style={{ borderColor: `${BRAND}15` }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="BLAVIA" className="h-7 w-auto" />
            <span className="text-base font-bold tracking-tight" style={{ color: BRAND }}>BLAVIA</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium hover:underline" style={{ color: BRAND }}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD_TEXT }}>
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight" style={{ color: BRAND }}>
          Privacy Policy &amp; Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 28 July 2026</p>

        {/* Privacy Policy */}
        <section id="privacy" className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-bold" style={{ color: BRAND }}>Privacy Policy</h2>

          <Section title="1. Who we are">
            <p>
              Blavia is operated by Blaviake, based in Nairobi, Kenya ("Blavia," "we," "us"). Blavia is
              a financial management platform built for Kenyan small and medium businesses, covering
              invoicing, M-Pesa reconciliation, payroll, tax (including KRA eTIMS), and financial reporting.
            </p>
            <p>Contact: admin@blavia.finance</p>
          </Section>

          <Section title="2. What data we collect">
            <p><strong className="text-foreground">Account &amp; business data</strong> — name, email, phone number, business name, business category, address, and login credentials.</p>
            <p><strong className="text-foreground">Financial data</strong> — invoices, payments, transactions, contacts, and categories you create; M-Pesa transaction data via Safaricom's Daraja API once you connect your till/paybill; balance sheet, asset, liability, and budget data.</p>
            <p><strong className="text-foreground">Payroll data</strong> — employee names, ID/KRA PIN numbers, salaries, and other data required to run payroll and generate payslips.</p>
            <p><strong className="text-foreground">Tax &amp; compliance data</strong> — KRA eTIMS credentials and invoice data submitted via eTIMS on your behalf.</p>
            <p><strong className="text-foreground">Usage data</strong> — log data, device/browser information, and interactions with the in-app assistant.</p>
          </Section>

          <Section title="3. How we use your data">
            <p>To provide the core service (invoicing, M-Pesa reconciliation, payroll, tax support, reporting), to communicate with you, to generate financial insights, to improve the platform, and to comply with legal and regulatory obligations under Kenyan law.</p>
            <p>We do not sell your data.</p>
          </Section>

          <Section title="4. Who we share data with">
            <p>We use third-party processors, each receiving only what's necessary for its function: Supabase (database, authentication, hosting), Safaricom Daraja API (payments), Kenya Revenue Authority eTIMS (tax invoicing), Resend (transactional email), OpenAI (in-app assistant), AWS (application hosting), and n8n (workflow automation, e.g. invoice ingestion).</p>
            <p>We do not share your data with other businesses on the platform — each business's data is isolated.</p>
          </Section>

          <Section title="5. Data retention">
            <p>We retain your data for as long as your account is active, plus a period required to comply with Kenyan tax record-keeping obligations. You can request deletion of your account and data, subject to legal retention requirements.</p>
          </Section>

          <Section title="6. Your rights">
            <p>Under Kenya's Data Protection Act, 2019, you can request access to, correction of, or deletion of your personal data, object to certain processing, and lodge a complaint with the Office of the Data Protection Commissioner (ODPC). Contact admin@blavia.finance to exercise these rights.</p>
          </Section>

          <Section title="7. Security">
            <p>We use encrypted connections, row-level security enforcing isolation between businesses, and access controls on sensitive credentials. No system is 100% secure — please use a strong, unique password.</p>
          </Section>

          <Section title="8. Children's data">
            <p>Blavia is a business tool not directed at or intended for use by children. We do not knowingly collect data from anyone under 18.</p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>We may update this policy as Blavia evolves. Material changes will be communicated by email or in-app notice before they take effect.</p>
          </Section>
        </section>

        {/* Terms of Service */}
        <section id="terms" className="mt-14 scroll-mt-24">
          <h2 className="text-xl font-bold" style={{ color: BRAND }}>Terms of Service</h2>

          <Section title="1. Acceptance of terms">
            <p>By creating a Blavia account, you agree to these Terms of Service and the Privacy Policy above. If creating an account on behalf of a business, you confirm you have authority to bind that business.</p>
          </Section>

          <Section title="2. The service">
            <p>Blavia provides invoicing, M-Pesa reconciliation, payroll processing, tax compliance support (including KRA eTIMS), and financial reporting for Kenyan SMEs. Blavia is a software tool, not an accounting firm, law firm, or tax advisory service.</p>
          </Section>

          <Section title="3. Your responsibilities">
            <p>You're responsible for the accuracy of data you enter, for keeping your credentials (login, M-Pesa, eTIMS) secure, for your own compliance with Kenyan tax and labor law, and for being authorized to connect the M-Pesa and eTIMS credentials you provide.</p>
          </Section>

          <Section title="4. Payments and third-party services">
            <p>Blavia integrates with Safaricom's M-Pesa Daraja API and KRA's eTIMS system. We're not responsible for outages, errors, or changes made by these third parties. Transaction fees charged by Safaricom or other processors are separate from any Blavia subscription fee.</p>
          </Section>

          <Section title="5. Payroll & tax accuracy disclaimer">
            <p>Blavia calculates PAYE and other statutory deductions based on configured tax rules, which can change. You're responsible for verifying payroll and tax calculations before relying on them for filing or payment.</p>
          </Section>

          <Section title="6. Data isolation">
            <p>Each business's data on Blavia is isolated from every other business. We do not permit cross-business visibility of financial, payroll, or customer data.</p>
          </Section>

          <Section title="7. Limitation of liability">
            <p>Blavia is provided "as is." To the maximum extent permitted by Kenyan law, Blavia and Blaviake are not liable for indirect, incidental, or consequential damages arising from use of the service — including financial losses from tax penalties, missed filings, or payment errors — except where such loss results directly from our negligence or breach of these terms.</p>
          </Section>

          <Section title="8. Termination">
            <p>You may close your account at any time. We may suspend or terminate accounts that violate these terms, engage in fraudulent activity, or misuse the platform, including its M-Pesa or eTIMS integrations.</p>
          </Section>

          <Section title="9. Governing law">
            <p>These terms are governed by the laws of Kenya. Disputes are subject to the jurisdiction of Kenyan courts.</p>
          </Section>

          <Section title="10. Changes to these terms">
            <p>We may update these terms as the product evolves. Continued use after changes take effect constitutes acceptance. Material changes will be communicated in advance.</p>
          </Section>

          <Section title="11. Contact">
            <p>Questions about these terms: admin@blavia.finance</p>
          </Section>
        </section>
      </main>
    </div>
  );
};

export default Legal;
