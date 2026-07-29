import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { RecordEtimsDialog } from "@/components/invoices/RecordEtimsDialog";
import { KRA_TAX_TYPES, type EtimsMode } from "@/lib/kraTax";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Send, CheckCircle, Trash2,
  AlertCircle, FileText, Building2, User,
  Calendar, CreditCard, Smartphone, Loader2, Mail, Copy, Shield,
} from "lucide-react";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { PaymentMethod } from "@/lib/instantPayments";

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  notes: string;
  payment_method: string;
  mpesa_reference: string;
  customer_phone: string;
  customer_email: string;
  payment_description: string;
  cuin: string;
  sent_at: string;
  paid_at: string;
  contact_id: string;
  business_id: string;
  contacts: {
    name: string; email: string; phone: string; kra_pin: string; address: string;
  };
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_code: string;
  vat_amount: number;
  total: number;
}

interface Business {
  business_name: string;
  owner_email: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700", icon: Send },
  paid: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

const todayStr = () => new Date().toISOString().split("T")[0];

const InvoiceDetail = () => {
  const { id } = useParams();
  const { user, business: authBusiness } = useAuth();
  const navigate = useNavigate();
  // eTIMS applies to every business, VAT-registered or not; what differs is
  // whether this system submits the invoice or the business issues it on KRA's
  // own channels and records the CUIN back here.
  const [etimsMode, setEtimsMode] = useState<EtimsMode>("none");
  const [etimsSandbox, setEtimsSandbox] = useState(false);
  const [recordEtimsOpen, setRecordEtimsOpen] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [etimsSubmitting, setEtimsSubmitting] = useState(false);

  useEffect(() => {
    if (!authBusiness?.id) return;
    supabase
      .from("etims_configs")
      .select("mode, environment")
      .eq("business_id", authBusiness.id)
      .maybeSingle()
      .then(({ data }) => {
        setEtimsMode((["oscu", "lite"] as const).find((m) => m === data?.mode) ?? "none");
        setEtimsSandbox(data?.environment !== "production");
      });
  }, [authBusiness?.id]);

  const [payAmount, setPayAmount] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [payEmail, setPayEmail] = useState("");
  const [payDueDate, setPayDueDate] = useState(todayStr());
  const [payDescription, setPayDescription] = useState("Payment for goods/services");

  const [sending, setSending] = useState(false);
  const [emailSentForInvoice, setEmailSentForInvoice] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  useEffect(() => {
    if (id && user) {
      fetchInvoice();
      fetchBusiness();
    }
  }, [id, user]);

  useEffect(() => {
    if (!invoice) return;
    setPayAmount(String(invoice.total));
    setPayDescription(invoice.payment_description || "Payment for goods/services");
    setPayDueDate(invoice.due_date || todayStr());

    if (invoice.customer_phone) {
      setPayPhone(invoice.customer_phone);
    } else if (invoice.contacts?.phone) {
      let phone = invoice.contacts.phone.replace(/\s/g, "");
      if (phone.startsWith("0")) phone = "254" + phone.slice(1);
      if (phone.startsWith("+")) phone = phone.slice(1);
      setPayPhone(phone);
    }

    if (invoice.customer_email) {
      setPayEmail(invoice.customer_email);
    } else if (invoice.contacts?.email) {
      setPayEmail(invoice.contacts.email);
    }
  }, [invoice]);

  const fetchBusiness = async () => {
    const { data } = await supabase
      .from("businesses")
      .select("business_name, owner_email")
      .eq("owner_id", user?.id)
      .limit(1)
      .single();
    if (data) setBusiness(data);
  };

  const fetchInvoice = async () => {
    setLoading(true);
    const { data: inv, error } = await supabase
      .from("invoices")
      .select(`*, contacts (name, email, phone, kra_pin, address)`)
      .eq("id", id)
      .single();
    if (error) {
      toast({ title: "Invoice not found", variant: "destructive" });
      navigate("/invoices");
      return;
    }
    setInvoice(inv);

    // Reflect whether an email is already queued/sent for this invoice
    const { data: existingQueue } = await supabase
      .from("invoice_queue")
      .select("id")
      .eq("invoice_id", id)
      .in("status", ["pending", "done"])
      .limit(1);
    setEmailSentForInvoice((existingQueue?.length || 0) > 0);

    const { data: invItems } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at");
    setItems(invItems || []);
    setLoading(false);
  };

  const hasPhone = !!payPhone.trim();
  const hasEmail = !!payEmail.trim();

  const getActionLabel = () => {
    if (!hasEmail) return "Enter an email to send";
    return emailSentForInvoice ? "Resend Invoice Email" : "Send Invoice Email";
  };

  const canSend = hasEmail;

  const handleSmartSend = async () => {
    if (!invoice || !canSend) {
      toast({ title: "Enter an email address first", variant: "destructive" });
      return;
    }

    setSending(true);

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        customer_phone: hasPhone ? payPhone.trim() : null,
        customer_email: payEmail.trim(),
        payment_description: payDescription.trim() || "Payment for goods/services",
        due_date: payDueDate,
        total: Number(payAmount) || invoice.total,
        status: invoice.status === "draft" ? "sent" : invoice.status,
        sent_at: invoice.sent_at || new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (updateError) {
      toast({ title: "Error saving payment details", description: updateError.message, variant: "destructive" });
      setSending(false);
      return;
    }

    // Owner can resend on demand — every click queues a fresh row. The
    // 2-minute n8n poller picks it up and emails the payment details
    // (amount, due date, pay link) to the customer.
    const wasAlreadySent = emailSentForInvoice;
    const { error: queueError } = await supabase.from("invoice_queue").insert({
      invoice_id: invoice.id,
      business_id: invoice.business_id,
      contact_id: invoice.contact_id,
      action: "send_email",
      status: "pending",
    });

    if (queueError) {
      if (queueError.code === "23505") {
        toast({
          title: "Email already queued",
          description: "This invoice already has an email pending — it'll go out shortly.",
        });
        setEmailSentForInvoice(true);
      } else {
        toast({ title: "Error queuing email", description: queueError.message, variant: "destructive" });
      }
    } else {
      setEmailSentForInvoice(true);
      toast({ title: wasAlreadySent ? "Invoice email resent" : "Invoice queued for email" });
    }

    fetchInvoice();
    setSending(false);
  };


  const handleSubmitEtims = async () => {
    if (!invoice) return;
    if (!authBusiness?.id) {
      toast({ title: "No business selected", variant: "destructive" });
      return;
    }
    setEtimsSubmitting(true);
    try {
      // The function requires business_id alongside invoice_id, and verifies
      // the caller's session belongs to that business — so send the user's
      // access token rather than the public anon key.
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/etims-send-invoice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            invoice_id: invoice.id,
            business_id: authBusiness.id,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok || result.error) {
        toast({ title: "eTIMS submission failed", description: result.error || "KRA returned an error", variant: "destructive" });
      } else {
        toast({ title: "Invoice submitted to KRA eTIMS ✓", description: `CUIN: ${result.cuin}` });
        fetchInvoice();
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setEtimsSubmitting(false);
    }
  };

  // Opens RecordPaymentDialog instead of flipping status directly, so the
  // cash/M-Pesa payment actually lands in `transactions` — previously this
  // just updated invoices.status and the money never showed up as collected.
  const handleMarkPaid = () => setMarkPaidOpen(true);

  const finalizeMarkPaid = async (method: PaymentMethod) => {
    setUpdating(true);
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString(), payment_method: method.toLowerCase() })
      .eq("id", id);
    if (error) { toast({ title: "Payment recorded, but invoice status update failed", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Invoice marked as paid!" }); fetchInvoice(); }
    setUpdating(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    setUpdating(true);
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { toast({ title: "Error deleting invoice", variant: "destructive" }); }
    else { toast({ title: "Invoice deleted" }); navigate("/invoices"); }
    setUpdating(false);
  };

  const copyPaymentLink = () => {
    const link = `${window.location.origin}/pay/${invoice?.id}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Payment link copied!" });
  };

  const formatCurrency = (amount: number) =>
    `KES ${(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  const formatDate = (date: string) =>
    date ? new Date(date).toLocaleDateString("en-KE", {
      day: "numeric", month: "long", year: "numeric"
    }) : "—";

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (!invoice) return null;

  const status = statusConfig[invoice.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  // Nothing in this codebase flips invoice.status from "sent" to "overdue"
  // automatically, so derive it from due_date the same way Receivables does,
  // rather than trusting a status value that may never actually get set.
  const isPastDue = !!invoice.due_date && invoice.due_date < todayStr();
  const isOverdue = invoice.status === "overdue" || (isPastDue && invoice.status !== "paid" && invoice.status !== "draft");
  // Draft invoices still need this panel — it's how they get sent the first
  // time. Once sent and not yet due, just show the read-only details below.
  const showPaymentPanel = invoice.status === "draft" || isOverdue;

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/invoices")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Issued {formatDate(invoice.issue_date)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {invoice.status === "sent" && (
              <Button onClick={handleMarkPaid} disabled={updating} className="gap-2 bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4" />
                Mark as Paid
              </Button>
            )}
            {invoice.status === "draft" && (
              <Button variant="outline" onClick={handleDelete} disabled={updating} className="gap-2 text-red-500 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {showPaymentPanel && (
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-800">Request Payment</h3>
              {invoice.id && (
                <button
                  onClick={copyPaymentLink}
                  className="ml-auto flex items-center gap-1 text-xs text-green-700 hover:underline"
                >
                  <Copy className="h-3 w-3" />Copy payment link
                </button>
              )}
            </div>

            <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-green-800 text-xs">Amount (KES)</Label>
                    <Input
                      type="number"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="bg-white border-green-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-green-800 text-xs">Due Date</Label>
                    <Input
                      type="date"
                      value={payDueDate}
                      onChange={(e) => setPayDueDate(e.target.value)}
                      className="bg-white border-green-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-green-800 text-xs flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />Phone number <span className="text-green-500">(optional)</span>
                    </Label>
                    <Input
                      value={payPhone}
                      onChange={(e) => setPayPhone(e.target.value)}
                      placeholder="254700000000"
                      className="bg-white border-green-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-green-800 text-xs flex items-center gap-1">
                      <Mail className="h-3 w-3" />Email <span className="text-green-500">(optional)</span>
                    </Label>
                    <Input
                      type="email"
                      value={payEmail}
                      onChange={(e) => setPayEmail(e.target.value)}
                      placeholder="customer@email.com"
                      className="bg-white border-green-300"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-green-800 text-xs">Description</Label>
                    <Input
                      value={payDescription}
                      onChange={(e) => setPayDescription(e.target.value)}
                      className="bg-white border-green-300"
                    />
                  </div>
                </div>

                {hasEmail && emailSentForInvoice && (
                  <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    An email has already been sent for this invoice — sending again will resend it.
                  </div>
                )}

                <Button
                  onClick={handleSmartSend}
                  disabled={sending || !canSend}
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
                  ) : (
                    <><Send className="h-4 w-4" />{getActionLabel()}</>
                  )}
                </Button>
              </>
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden">

          <div className="bg-sidebar p-6 grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-white/60" />
                <span className="text-xs text-white/60 uppercase font-medium">From</span>
              </div>
              <p className="text-white font-bold text-lg">{business?.business_name}</p>
              <p className="text-white/70 text-sm">{business?.owner_email}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-white/60" />
                <span className="text-xs text-white/60 uppercase font-medium">Bill To</span>
              </div>
              <p className="text-white font-bold text-lg">{invoice.contacts?.name}</p>
              <p className="text-white/70 text-sm">{invoice.customer_email || invoice.contacts?.email}</p>
              <p className="text-white/70 text-sm">{invoice.customer_phone || invoice.contacts?.phone}</p>
              {invoice.contacts?.kra_pin && (
                <p className="text-white/70 text-sm">KRA PIN: {invoice.contacts.kra_pin}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-6 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Invoice No.</p>
                <p className="text-sm font-medium">{invoice.invoice_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="text-sm font-medium">{formatDate(invoice.due_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Payment Method</p>
                <p className="text-sm font-medium capitalize">{invoice.payment_method || "—"}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                  <th className="pb-3 text-center text-xs font-medium text-muted-foreground uppercase">Qty</th>
                  <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                  <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase">VAT</th>
                  <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 text-sm">{item.description}</td>
                    <td className="py-3 text-sm text-center">{item.quantity}</td>
                    <td className="py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 text-sm text-right">{formatCurrency(item.vat_amount)}</td>
                    <td className="py-3 text-sm text-right font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 space-y-2 ml-auto max-w-xs">
              {/* Driven by the invoice, not the business: an all-exempt invoice
                  from a VAT-registered business has no VAT to break out either. */}
              {Number(invoice.vat_amount) > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal (excl. VAT)</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT ({KRA_TAX_TYPES.standard.rate}%)</span>
                    <span>{formatCurrency(invoice.vat_amount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="px-6 pb-6">
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Notes</p>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}

          <div className="bg-muted/30 px-6 py-4 flex items-center justify-between border-t">
            <div>
              {invoice.cuin ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    KRA eTIMS CUIN: <span className="font-medium text-green-600">{invoice.cuin}</span>
                  </p>
                  {etimsMode === "oscu" && etimsSandbox && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Sandbox — not a live filing
                    </span>
                  )}
                </div>
              ) : etimsMode === "oscu" ? (
                <button
                  onClick={handleSubmitEtims}
                  disabled={etimsSubmitting}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {etimsSubmitting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Shield className="h-3 w-3" />
                  )}
                  {etimsSubmitting ? "Submitting to KRA..." : "Submit to eTIMS"}
                </button>
              ) : etimsMode === "lite" ? (
                <button
                  onClick={() => setRecordEtimsOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Shield className="h-3 w-3" />
                  Record eTIMS details
                </button>
              ) : (
                <button
                  onClick={() => navigate("/settings")}
                  className="flex items-center gap-1.5 text-xs text-amber-600 hover:underline"
                >
                  <Shield className="h-3 w-3" />
                  eTIMS not set up
                </button>
              )}
              {invoice.mpesa_reference && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  M-Pesa Ref: <span className="font-medium text-green-600">{invoice.mpesa_reference}</span>
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Powered by <span className="font-semibold text-sidebar">BLAVIA</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">Timeline</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{formatDate(invoice.issue_date)}</span>
            </div>
            {invoice.sent_at && (
              <div className="flex items-center gap-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Sent</span>
                <span className="font-medium">{formatDate(invoice.sent_at)}</span>
              </div>
            )}
            {invoice.paid_at && (
              <div className="flex items-center gap-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Paid{invoice.payment_method ? ` via ${invoice.payment_method}` : ""}</span>
                <span className="font-medium">{formatDate(invoice.paid_at)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {authBusiness?.id && (
        <RecordEtimsDialog
          open={recordEtimsOpen}
          onOpenChange={setRecordEtimsOpen}
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          businessId={authBusiness.id}
          customerName={invoice.contacts?.name ?? null}
          total={invoice.total}
          vatAmount={invoice.vat_amount ?? null}
          onSaved={fetchInvoice}
        />
      )}

      <RecordPaymentDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        businessId={invoice.business_id}
        title="Record Payment & Mark Invoice Paid"
        defaultAmount={invoice.total}
        lockAmount
        defaultNarration={`Invoice ${invoice.invoice_number}${invoice.contacts?.name ? ` — ${invoice.contacts.name}` : ""}`}
        defaultReference={invoice.invoice_number}
        onRecorded={finalizeMarkPaid}
      />
    </AppShell>
  );
};

export default InvoiceDetail;