import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Plus, Trash2, ArrowLeft, Save, Send, Building2 } from "lucide-react";

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_code: string;
  vat_amount: number;
  total: number;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Business {
  id: string;
  business_name: string;
}

const CreateInvoice = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewBusiness, setShowNewBusiness] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState("");
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mpesa");
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", kra_pin: "", address: "" });
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unit_price: 0, tax_code: "A", vat_amount: 0, total: 0 },
  ]);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmount = items.reduce((sum, item) => sum + item.vat_amount, 0);
  const total = subtotal + vatAmount;

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
        fetchContacts(data[0].id);
      }
    };
    if (user) fetchBusinesses();
  }, [user]);

  const fetchContacts = async (bizId: string) => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, email, phone")
      .eq("business_id", bizId)
      .order("name");
    setContacts(data || []);
    setContactId("");
  };

  const handleBusinessChange = (id: string) => {
    setBusinessId(id);
    fetchContacts(id);
  };

  const saveNewBusiness = async () => {
    if (!newBusinessName.trim()) {
      toast({ title: "Business name is required", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("businesses")
      .insert({ business_name: newBusinessName, owner_id: user?.id, owner_email: user?.email, currency: "KES" })
      .select()
      .single();
    if (error) { toast({ title: "Error saving business", variant: "destructive" }); return; }
    setBusinesses([...businesses, data]);
    setBusinessId(data.id);
    setShowNewBusiness(false);
    setNewBusinessName("");
    fetchContacts(data.id);
    toast({ title: "Business saved!" });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    const qty = field === "quantity" ? value : updated[index].quantity;
    const price = field === "unit_price" ? value : updated[index].unit_price;
    const taxCode = field === "tax_code" ? value : updated[index].tax_code;
    const lineTotal = qty * price;
    const vat = taxCode === "A" ? lineTotal * 0.16 : 0;
    updated[index].vat_amount = vat;
    updated[index].total = lineTotal + vat;
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, tax_code: "A", vat_amount: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const saveContact = async () => {
    if (!newContact.name) { toast({ title: "Customer name is required", variant: "destructive" }); return null; }
    const { data, error } = await supabase.from("contacts").insert({ ...newContact, business_id: businessId }).select().single();
    if (error) { toast({ title: "Error saving contact", variant: "destructive" }); return null; }
    setContacts([...contacts, data]);
    setContactId(data.id);
    setShowNewContact(false);
    toast({ title: "Customer saved!" });
    return data.id;
  };

  const handleSave = async (sendAfter = false) => {
    if (!businessId) { toast({ title: "Please select a business", variant: "destructive" }); return; }
    if (!contactId && !showNewContact) { toast({ title: "Please select or add a customer", variant: "destructive" }); return; }
    if (items.some(i => !i.description)) { toast({ title: "Please fill in all item descriptions", variant: "destructive" }); return; }
    setSaving(true);
    try {
      let finalContactId = contactId;
      if (showNewContact) {
        const saved = await saveContact();
        if (!saved) { setSaving(false); return; }
        finalContactId = saved;
      }
      const { data: invNum } = await supabase.rpc("generate_invoice_number", { p_business_id: businessId });
      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          business_id: businessId, contact_id: finalContactId,
          invoice_number: invNum, status: sendAfter ? "sent" : "draft",
          issue_date: issueDate, due_date: dueDate || null,
          subtotal, vat_amount: vatAmount, total, notes,
          payment_method: paymentMethod,
          sent_at: sendAfter ? new Date().toISOString() : null,
        })
        .select().single();
      if (invError) throw invError;
      await supabase.from("invoice_items").insert(
        items.map(item => ({
          invoice_id: invoice.id, business_id: businessId,
          description: item.description, quantity: item.quantity,
          unit_price: item.unit_price, tax_code: item.tax_code,
          vat_amount: item.vat_amount, total: item.total,
        }))
      );
      if (sendAfter) {
        await supabase.from("invoice_queue").insert({
          invoice_id: invoice.id, business_id: businessId,
          contact_id: finalContactId, action: "send_email", status: "pending",
        });
      }
      toast({ title: sendAfter ? "Invoice sent!" : "Invoice saved as draft!" });
      navigate(`/invoices/${invoice.id}`);
    } catch (err: any) {
      toast({ title: "Error saving invoice", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) =>
    `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/invoices")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Invoice</h1>
            <p className="text-muted-foreground text-sm">Fill in the details below</p>
          </div>
        </div>

        {/* Business Selector */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-base">Your Business</h2>
          </div>
          {!showNewBusiness ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Select Business</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={businessId}
                  onChange={(e) => handleBusinessChange(e.target.value)}
                >
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.business_name}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setShowNewBusiness(true)} className="text-sm text-primary hover:underline">
                + Add new business
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Business Name *</Label>
                <Input value={newBusinessName} onChange={(e) => setNewBusinessName(e.target.value)} placeholder="Enter business name" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveNewBusiness}>Save Business</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewBusiness(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Customer Section */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-base">Customer</h2>
          {!showNewContact ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Select Customer</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                >
                  <option value="">-- Select a customer --</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.email ? `— ${c.email}` : ""}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setShowNewContact(true)} className="text-sm text-primary hover:underline">
                + Add new customer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="Customer name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} placeholder="customer@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="07XXXXXXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={newContact.address} onChange={(e) => setNewContact({ ...newContact, address: e.target.value })} placeholder="Nairobi, Kenya" />
                </div>
              </div>
              <button onClick={() => setShowNewContact(false)} className="text-sm text-muted-foreground hover:underline">
                ← Select existing customer
              </button>
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-base">Invoice Details</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Issue Date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-base">Line Items</h2>
          <div className="space-y-3">
            <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase px-1">
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Unit Price</div>
              <div className="col-span-2">VAT</div>
              <div className="col-span-1">Total</div>
              <div className="col-span-1"></div>
            </div>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 md:col-span-4">
                  <Input placeholder="Item description" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <Input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input type="number" min="0" placeholder="Price" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={item.tax_code} onChange={(e) => updateItem(index, "tax_code", e.target.value)}>
                    <option value="A">VAT 16%</option>
                    <option value="B">Exempt</option>
                    <option value="C">Zero Rated</option>
                  </select>
                </div>
                <div className="col-span-4 md:col-span-1 text-sm font-medium text-right">
                  {formatCurrency(item.total)}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => removeItem(index)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addItem} className="flex items-center gap-2 text-sm text-primary hover:underline">
            <Plus className="h-4 w-4" />
            Add line item
          </button>
          <div className="border-t pt-4 space-y-2 ml-auto max-w-xs">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT (16%)</span>
              <span>{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <h2 className="font-semibold text-base">Notes</h2>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Payment instructions, terms, or any other notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-6">
          <Button variant="outline" onClick={() => navigate("/invoices")} disabled={saving}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2">
            <Send className="h-4 w-4" />
            {saving ? "Saving..." : "Save & Send"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
};

export default CreateInvoice;