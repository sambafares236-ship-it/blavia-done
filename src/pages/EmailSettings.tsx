import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Mail, Copy, CheckCircle, Loader2, ExternalLink } from "lucide-react";

// The Postmark inbound stream's base address for the whole app — every
// business shares this, distinguished only by their +alias suffix. Not a
// secret (it's meant to be given out to clients/forwarded to), so a
// build-time env var is fine rather than a server-fetched setting.
const INBOUND_BASE_ADDRESS = import.meta.env.VITE_INBOUND_EMAIL_ADDRESS as string | undefined;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);

const randomSuffix = () => Math.random().toString(36).slice(2, 6);

/** Splits "localpart@domain" into ["localpart", "domain"], or null if malformed. */
const splitAddress = (address: string): [string, string] | null => {
  const at = address.indexOf("@");
  if (at <= 0) return null;
  return [address.slice(0, at), address.slice(at + 1)];
};

const EmailSettings = () => {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [alias, setAlias] = useState<string | null>(null);
  const [emailsReceived, setEmailsReceived] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, business_name")
        .eq("owner_id", user.id)
        .limit(1)
        .single();

      if (!biz) {
        setLoading(false);
        return;
      }
      setBusinessId(biz.id);
      setBusinessName(biz.business_name);

      const { data: existing } = await supabase
        .from("business_inbound_emails")
        .select("alias")
        .eq("business_id", biz.id)
        .maybeSingle();

      if (existing) {
        setAlias(existing.alias);
      } else {
        // First visit to this page for this business — assign an alias.
        // Retry on the rare collision (alias is globally unique) rather
        // than failing the whole page load over it.
        let created: string | null = null;
        for (let attempt = 0; attempt < 5 && !created; attempt++) {
          const candidate = `${slugify(biz.business_name) || "business"}-${randomSuffix()}`;
          const { error } = await supabase
            .from("business_inbound_emails")
            .insert({ business_id: biz.id, alias: candidate });
          if (!error) created = candidate;
          else if (error.code !== "23505") break; // not a uniqueness conflict — stop retrying
        }
        setAlias(created);
      }

      const { count } = await supabase
        .from("inbound_emails")
        .select("id", { count: "exact", head: true })
        .eq("business_id", biz.id);
      setEmailsReceived(count ?? 0);

      setLoading(false);
    };
    load();
  }, [user]);

  const parsedBase = INBOUND_BASE_ADDRESS ? splitAddress(INBOUND_BASE_ADDRESS) : null;
  const fullAddress = parsedBase && alias ? `${parsedBase[0]}+${alias}@${parsedBase[1]}` : null;

  const copyAddress = () => {
    if (!fullAddress) return;
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Email Setup</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Automatically catch payment confirmations and invoices your clients send you by email
            </p>
          </div>
          {emailsReceived > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              <CheckCircle className="h-3.5 w-3.5" />
              Connected
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : !parsedBase ? (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-6">
            <h2 className="font-semibold text-warning">Email intake isn't configured yet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This deployment is missing <code className="font-mono text-xs">VITE_INBOUND_EMAIL_ADDRESS</code>.
              Set it to your Postmark inbound stream's address and rebuild.
            </p>
          </div>
        ) : !fullAddress ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
            <h2 className="font-semibold text-destructive">Couldn't set up your inbound address</h2>
            <p className="text-sm text-muted-foreground mt-1">Refresh the page to try again.</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Your Blavia inbound address
              </h2>
              <p className="text-sm text-muted-foreground">
                Emails sent or forwarded to this address are automatically scanned for payment
                confirmations and invoices. Nothing is ever finalized without your review.
              </p>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                <code className="flex-1 text-sm font-mono break-all">{fullAddress}</code>
                <Button size="sm" variant="outline" onClick={copyAddress} className="gap-1.5 shrink-0">
                  {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {emailsReceived > 0
                  ? `${emailsReceived} email${emailsReceived === 1 ? "" : "s"} received so far.`
                  : "No emails received yet — set up the Gmail filter below, then send a test email."}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-6 space-y-3">
              <h2 className="font-semibold">Set up a Gmail filter (one-time, ~2 minutes)</h2>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>
                  In Gmail: <span className="font-medium text-foreground">Settings → See all settings → Forwarding and POP/IMAP → Add a forwarding address</span>, and enter the address above.
                </li>
                <li>Gmail emails a confirmation code to that address — open it and click confirm.</li>
                <li>
                  <span className="font-medium text-foreground">Settings → Filters and Blocked Addresses → Create a new filter</span>, matching e.g. <code className="font-mono text-xs bg-muted px-1 rounded">subject:(invoice OR payment OR receipt)</code>.
                </li>
                <li>Choose <span className="font-medium text-foreground">Forward it to</span> → the address above, and save.</li>
              </ol>
              <a
                href="https://support.google.com/mail/answer/6579"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Google's guide to Gmail filters <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default EmailSettings;