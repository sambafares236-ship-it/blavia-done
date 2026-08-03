import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Postmark inbound webhook shape (subset we use) ──────────────────────
// https://postmarkapp.com/developer/webhooks/inbound-webhook
interface PostmarkAttachment {
  Name: string;
  Content: string; // base64
  ContentType: string;
  ContentLength: number;
  ContentID?: string;
}
interface PostmarkInboundPayload {
  MessageID: string;
  FromFull?: { Email: string; Name?: string };
  ToFull?: { Email: string; MailboxHash?: string }[];
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Date?: string;
  Attachments?: PostmarkAttachment[];
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Postmark expects a fast 200 regardless of what we did with the email —
// non-2xx makes it retry, and retries are only useful for transient infra
// failures, not "we couldn't classify this email" (that's a normal outcome,
// not an error).
const ACK = () => jsonResponse({ ok: true });

const ATTACHMENT_MIME_ALLOWLIST = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
];

// Loose on purpose — this only decides which review queue an email lands
// in, never anything that gets treated as confirmed without a human
// looking at it.
const PAYMENT_KEYWORDS =
  /\b(paid|payment received|payment confirmation|receipt|transaction confirmation|money received|deposit received)\b/i;
const INVOICE_KEYWORDS = /\b(invoice|bill|statement|quotation|quote)\b/i;

// Matches "KES 12,500", "Ksh 12500.00", "KSh. 4,000" etc.
const AMOUNT_RE = /(?:kes|ksh|sh)\.?\s?([\d,]+(?:\.\d{1,2})?)/i;
// Matches "Ref: ABC123", "Reference #INV-004", "Invoice No. 00123"
const REFERENCE_RE = /(?:ref(?:erence)?|invoice\s?(?:no\.?|number)?)[:\-#\s]+([A-Z0-9\-\/]{3,20})/i;

function extractAmount(text: string): number | null {
  const m = text.match(AMOUNT_RE);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function extractReference(text: string): string | null {
  const m = text.match(REFERENCE_RE);
  return m ? m[1].trim() : null;
}

function classify(
  subject: string,
  body: string,
  hasInvoiceLikeAttachment: boolean,
): "payment" | "invoice" | "unrecognized" {
  const combined = `${subject}\n${body}`;
  const looksLikePayment = PAYMENT_KEYWORDS.test(combined) && extractAmount(combined) !== null;
  if (looksLikePayment) return "payment";
  if (hasInvoiceLikeAttachment || INVOICE_KEYWORDS.test(combined)) return "invoice";
  return "unrecognized";
}

serve(async (req) => {
  try {
    if (req.method !== "POST") return jsonResponse({ error: "POST only" }, 405);

    const payload = (await req.json()) as PostmarkInboundPayload;
    const messageId = payload.MessageID;
    if (!messageId) {
      console.error("Inbound email missing MessageID, cannot dedupe — dropping.");
      return ACK();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Idempotency — Postmark retries on anything but a fast 200 ──────
    const { data: existing } = await supabase
      .from("inbound_emails")
      .select("id")
      .eq("provider_message_id", messageId)
      .limit(1);
    if (existing && existing.length > 0) {
      console.log("Duplicate inbound webhook for MessageID, skipping:", messageId);
      return ACK();
    }

    // ── Resolve which business this belongs to, via the mailbox hash ───
    // Postmark passes the "+xyz" part of the inbound address as MailboxHash
    // on the matching ToFull entry — this is what a business's Gmail filter
    // forwards to, e.g. "yourinbound+acme-co-4f2a@inbound.postmarkapp.com".
    const toEntry = payload.ToFull?.find((t) => t.MailboxHash) ?? payload.ToFull?.[0];
    const alias = (toEntry?.MailboxHash || "").trim().toLowerCase();
    const toEmail = toEntry?.Email ?? null;

    let businessId: string | null = null;
    if (alias) {
      const { data: aliasRows } = await supabase
        .from("business_inbound_emails")
        .select("business_id")
        .eq("alias", alias)
        .limit(1);
      businessId = aliasRows && aliasRows.length > 0 ? aliasRows[0].business_id : null;
    }

    const fromEmail = payload.FromFull?.Email ?? null;
    const fromName = payload.FromFull?.Name ?? null;
    const subject = payload.Subject ?? "";
    const textBody = payload.TextBody ?? "";
    const bodySnippet = (textBody || payload.HtmlBody || "").slice(0, 2000);
    const receivedAt = payload.Date ? new Date(payload.Date).toISOString() : new Date().toISOString();

    if (!businessId) {
      // Can't route it anywhere useful, but still log it — lets you debug
      // "why didn't my forwarded email show up" (wrong/missing alias)
      // without silently losing the record entirely.
      console.error("No business found for inbound alias:", alias || "(none)");
      await supabase.from("inbound_emails").insert({
        business_id: null,
        provider_message_id: messageId,
        from_email: fromEmail,
        to_email: toEmail,
        subject,
        received_at: receivedAt,
        body_snippet: bodySnippet,
        classification: "unrecognized",
      });
      return ACK();
    }

    // ── Attachments — save any allow-listed ones to Storage ────────────
    const attachments = payload.Attachments ?? [];
    const savableAttachment = attachments.find((a) =>
      ATTACHMENT_MIME_ALLOWLIST.includes((a.ContentType || "").toLowerCase()),
    );

    let attachmentUrl: string | null = null;
    let attachmentFilename: string | null = null;

    if (savableAttachment) {
      try {
        const bytes = Uint8Array.from(atob(savableAttachment.Content), (c) => c.charCodeAt(0));
        const safeName = savableAttachment.Name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${businessId}/${messageId}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("inbound-attachments")
          .upload(path, bytes, { contentType: savableAttachment.ContentType, upsert: false });
        if (uploadError) {
          console.error("Attachment upload failed:", uploadError.message);
        } else {
          attachmentUrl = path; // stored as a path; generate signed URLs on read, not here
          attachmentFilename = savableAttachment.Name;
        }
      } catch (err) {
        console.error("Attachment decode/upload error:", err);
      }
    }

    const classification = classify(subject, textBody, !!savableAttachment);

    let pendingMatchId: string | null = null;
    let invoiceId: string | null = null;

    if (classification === "payment") {
      const combined = `${subject}\n${textBody}`;
      const amount = extractAmount(combined) ?? 0;
      const reference = extractReference(combined);

      const { data: inserted, error } = await supabase
        .from("pending_matches")
        .insert({
          business_id: businessId,
          // No real network transaction ID exists for an emailed payment
          // confirmation — MessageID is unique per email and doubles as
          // one, so retries/dupes are still caught by the same mechanism
          // pending_matches already relies on for M-Pesa.
          trans_id: `email_${messageId}`,
          trans_amount: amount,
          msisdn: null,
          first_name: fromName || fromEmail,
          trans_time: receivedAt,
          bill_ref_number: reference,
          transaction_type: "Email Payment Confirmation",
          match_status: "pending",
          source: "email",
        })
        .select("id")
        .single();
      if (error) console.error("Failed to insert pending_matches row:", error.message);
      else pendingMatchId = inserted?.id ?? null;
    } else if (classification === "invoice") {
      const combined = `${subject}\n${textBody}`;
      const amount = extractAmount(combined);

      const { data: invNum } = await supabase.rpc("generate_invoice_number", {
        p_business_id: businessId,
      });

      const { data: inserted, error } = await supabase
        .from("invoices")
        .insert({
          business_id: businessId,
          invoice_number: invNum || `EMAIL-${messageId.slice(0, 8).toUpperCase()}`,
          issue_date: receivedAt.slice(0, 10),
          customer_email: fromEmail,
          notes: `Auto-imported from an email${fromName ? ` from ${fromName}` : ""}. Details below were extracted automatically and have not been confirmed.\n\n${bodySnippet}`,
          total: amount, // may be null — reviewer fills in if extraction missed it
          status: "draft",
          source: "email_import",
          needs_review: true,
        })
        .select("id")
        .single();
      if (error) console.error("Failed to insert draft invoice:", error.message);
      else invoiceId = inserted?.id ?? null;
    }

    await supabase.from("inbound_emails").insert({
      business_id: businessId,
      provider_message_id: messageId,
      from_email: fromEmail,
      to_email: toEmail,
      subject,
      received_at: receivedAt,
      body_snippet: bodySnippet,
      attachment_url: attachmentUrl,
      attachment_filename: attachmentFilename,
      classification,
      pending_match_id: pendingMatchId,
      invoice_id: invoiceId,
    });

    return ACK();
  } catch (err) {
    console.error("Inbound email processing error:", err);
    // Still ack — an unexpected error here shouldn't cause Postmark to
    // hammer retries; whatever we managed to log above is enough to debug.
    return ACK();
  }
});