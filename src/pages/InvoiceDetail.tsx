import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Send, CheckCircle, Trash2,
  AlertCircle, FileText, Building2, User,
  Calendar, CreditCard,
} from "lucide-react";

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

const InvoiceDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id && user) { fetchInvoice(); fetchBusiness(); }
  }, [id, user]);

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
    if (error) { toast({ title: "Invoice not found", variant: "destructive" }); navigate("/invoices"); return; }
    setInvoice(inv);
    const { data: invItems } = await supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at");
    setItems(invItems || []);
    setLoading(false);
  };

  const handleMarkPaid = async () => {
    setUpdating(true);
    const { error } = await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ title: "Error updating invoice", variant: "destructive" }); }
    else { toast({ title: "Invoice marked as paid!" }); fetchInvoice(); }
    setUpdating(false);
  };

  const handleSend = async () => {
    setUpdating(true);
    const { error } = await supabase.from("invoices").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ title: "Error sending invoice", variant: "destructive" }); setUpdating(false); return; }
    if (invoice) {
      await supabase.from("invoice_queue").insert({
        invoice_id: id,
        business_id: invoice.business_id,
        contact_id: invoice.contact_id,
        action: "send_email",
        status: "pending",
      });
    }
    toast({ title: "Invoice queued for sending!" });
    fetchInvoice();
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

  const formatCurrency = (amount: number) =>
    `KES ${(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  const formatDate = (date: string) =>
    date ? new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "—";

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

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
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
            {invoice.status === "draft" && (
              <Button onClick={handleSend} disabled={updating} className="gap-2">
                <Send className="h-4 w-4" />
                Send Invoice
              </Button>
            )}
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

        {/* Invoice Card */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Business + Customer Header */}
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
              <p className="text-white/70 text-sm">{invoice.contacts?.email}</p>
              <p className="text-white/70 text-sm">{invoice.contacts?.phone}</p>
              {invoice.contacts?.kra_pin && (
                <p className="text-white/70 text-sm">KRA PIN: {invoice.contacts.kra_pin}</p>
              )}
            </div>
          </div>

          {/* Invoice Meta */}
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

          {/* Line Items */}
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

            {/* Totals */}
            <div className="mt-4 space-y-2 ml-auto max-w-xs">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT (16%)</span>
                <span>{formatCurrency(invoice.vat_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="px-6 pb-6">
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Notes</p>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="bg-muted/30 px-6 py-4 flex items-center justify-between border-t">
            <div>
              {invoice.cuin ? (
                <p className="text-xs text-muted-foreground">KRA eTIMS CUIN: <span className="font-medium">{invoice.cuin}</span></p>
              ) : (
                <p className="text-xs text-muted-foreground">eTIMS: Not yet submitted</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Powered by <span className="font-semibold text-sidebar">BLAVIA</span>
            </p>
          </div>
        </div>

        {/* Timeline */}
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
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium">{formatDate(invoice.paid_at)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default InvoiceDetail;