import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  Plus, FileText, Search, Eye, Send,
  CheckCircle, XCircle, AlertCircle,
} from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  total: number;
  currency: string;
  contacts: { name: string; email: string };
}

interface Business {
  id: string;
  business_name: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700", icon: Send },
  paid: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700", icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500", icon: XCircle },
};

const Invoices = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState<string>("");
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0 });

  useEffect(() => {
    const fetchBusinesses = async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, business_name")
        .eq("owner_id", user?.id)
        .order("business_name");
      if (data && data.length > 0) {
        setBusinesses(data);
        setBusinessId(data[0].id);
      } else {
        setLoading(false);
      }
    };
    if (user) fetchBusinesses();
  }, [user]);

  useEffect(() => {
    if (businessId) fetchInvoices();
  }, [businessId, statusFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase
      .from("invoices")
      .select(`id, invoice_number, status, issue_date, due_date, total, currency, contacts (name, email)`)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data, error } = await query;
    if (error) {
      toast({ title: "Error fetching invoices", variant: "destructive" });
    } else {
      setInvoices(data || []);
      const all = data || [];
      setStats({
        total: all.reduce((sum, inv) => sum + (inv.total || 0), 0),
        paid: all.filter(i => i.status === "paid").reduce((sum, inv) => sum + (inv.total || 0), 0),
        pending: all.filter(i => i.status === "sent").length,
        overdue: all.filter(i => i.status === "overdue").length,
      });
    }
    setLoading(false);
  };

  const filteredInvoices = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.contacts?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: number) =>
    `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground">Create and manage your invoices</p>
          </div>
          <Button onClick={() => navigate("/invoices/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </div>

        {/* Business Selector */}
        {businesses.length > 1 && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground">Business:</label>
            <select
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
            >
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.business_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Invoiced</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(stats.total)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-xl font-bold mt-1 text-green-600">{formatCurrency(stats.paid)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-xl font-bold mt-1 text-blue-600">{stats.pending}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-xl font-bold mt-1 text-red-600">{stats.overdue}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by invoice number or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            {["all", "draft", "sent", "paid", "overdue"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "border bg-background hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice Table */}
        <div className="rounded-xl border bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium">No invoices yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first invoice to get started</p>
              <Button onClick={() => navigate("/invoices/new")} className="gap-2">
                <Plus className="h-4 w-4" />
                New Invoice
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Issue Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Due Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => {
                  const status = statusConfig[invoice.status] || statusConfig.draft;
                  const StatusIcon = status.icon;
                  return (
                    <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-sm">{invoice.invoice_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{invoice.contacts?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{invoice.contacts?.email || ""}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString("en-KE") : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-KE") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-sm">{formatCurrency(invoice.total)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/invoices/${invoice.id}`)} className="gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Invoices;