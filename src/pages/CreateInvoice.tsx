import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Plus, Trash2, ArrowLeft, Save, Send, User, Check } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  amount_incl: number;
  tax_code: string;
  vat_amount: number;
  unit_price: number;
  total: number;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const VAT_RATE = 0.16;

const calcItem = (item: LineItem): LineItem => {
  const total = parseFloat((item.amount_incl * item.quantity).toFixed(2));
  const vat_amount = item.tax_code === "A"
    ? parseFloat((total - total / (1 + VAT_RATE)).toFixed(2))
    : 0;
  const unit_price = item.tax_code === "A"
    ? parseFloat((item.amount_incl / (1 + VAT_RATE)).toFixed(2))
    : parseFloat(item.amount_incl.toFixed(2));
  return { ...item, total, vat_amount, unit_price };
};

const defaultItem = (vatRegistered: boolean): LineItem => calcItem({
  description: "", quantity: 1, amount_incl: 0,
  tax_code: vatRegistered ? "A" : "B",
  vat_amount: 0, unit_price: 0, total: 0,
});

const todayStr = () => new Date().toISOString().split("T")[0];
const fmt = (n: number) => `KES ${(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

const normalizePhone = (raw: string): string => {
  let p = raw.replace(/\s/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "254" + p.slice(1);
  return p;
};

const CreateInvoice = () => {
  const { user, business } = useAuth();
  const navigate = useNavigate();
  const vatRegistered = business?.vat_registered ?? false;

  const [businessId, setBusinessId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Customer fields
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [contactId, setContactId] = useState<string | null>(null); // matched contact
  const [matchedContact, setMatchedContact] = useState<Contact | null>(null);
  const [phoneSuggestions, setPhoneSuggestions] = useState<Contact[]>([]);
  const [emailSuggestions, setEmailSuggestions] = useState<Contact[]>([]);
  const [showPhoneSugg, setShowPhoneSugg] = useState(false);
  const [showEmailSugg, setShowEmailSugg] = useState(false);

  // Invoice fields
  const [dueDate, setDueDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mpesa");
  const [items, setItems] = useState<LineItem[]>([defaultItem(vatRegistered)]);

  const phoneRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const phoneTimer = useRef<any>(null);
  const emailTimer = useRef<any>(null);

  // Derived totals
  const grandTotal = items.reduce((s, i) => s + i.total, 0);
  const totalVat = items.reduce((s, i) => s + i.vat_amount, 0);
  const subtotal = parseFloat((grandTotal - totalVat).toFixed(2));

  const hasPhone = clientPhone.trim().length >= 9;
  const hasEmail = clientEmail.trim().length > 3;

  const getActionLabel = () => {
    if (hasEmail) return "Save & Send Email";
    return "Save Draft";
  };

  useEffect(() => {
    if (business?.id) {
      setBusinessId(business.id);
    }
  }, [business?.id]);

  useEffect(() => {
    setItems([defaultItem(vatRegistered)]);
  }, [vatRegistered]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (phoneRef.current && !phoneRef.current.contains(e.target as Node)) setShowPhoneSugg(false);
      if (emailRef.current && !emailRef.current.contains(e.target as Node)) setShowEmailSugg(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Phone search (debounced) ──────────────────────────────────────────────
  const handlePhoneChange = (raw: string) => {
    const normalized = normalizePhone(raw);
    setClientPhone(normalized);
    setMatchedContact(null);
    setContactId(null);

    clearTimeout(phoneTimer.current);
    if (normalized.length >= 9 && businessId) {
      phoneTimer.current = setTimeout(async () => {
        const { data } = await supabase
          .from("contacts")
          .select("id, name, email, phone")
          .eq("business_id", businessId)
          .ilike("phone", `%${normalized}%`)
          .limit(5);
        if (data && data.length > 0) {
          setPhoneSuggestions(data);
          setShowPhoneSugg(true);
        } else {
          setPhoneSuggestions([]);
          setShowPhoneSugg(false);
        }
      }, 400);
    } else {
      setPhoneSuggestions([]);
      setShowPhoneSugg(false);
    }
  };

  // ── Email search (debounced) ──────────────────────────────────────────────
  const handleEmailChange = (val: string) => {
    setClientEmail(val);
    setMatchedContact(null);
    setContactId(null);

    clearTimeout(emailTimer.current);
    if (val.length >= 3 && businessId) {
      emailTimer.current = setTimeout(async () => {
        const { data } = await supabase
          .from("contacts")
          .select("id, name, email, phone")
          .eq("business_id", businessId)
          .ilike("email", `%${val}%`)
          .limit(5);
        if (data && data.length > 0) {
          setEmailSuggestions(data);
          setShowEmailSugg(true);
        } else {
          setEmailSuggestions([]);
          setShowEmailSugg(false);
        }
      }, 400);
    } else {
      setEmailSuggestions([]);
      setShowEmailSugg(false);
    }
  };

  // ── Select a suggested contact ────────────────────────────────────────────
  const selectContact = (c: Contact) => {
    setClientName(c.name || "");
    setClientEmail(c.email || "");
    setClientPhone(c.phone || "");
    setContactId(c.id);
    setMatchedContact(c);
    setShowPhoneSugg(false);
    setShowEmailSugg(false);
  };

  // ── Line item helpers ─────────────────────────────────────────────────────
  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    updated[index] = calcItem({ ...updated[index], [field]: value });
    setItems(updated);
  };
  const addItem = () => setItems([...items, defaultItem(vatRegistered)]);
  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // ── Resolve / create contact ──────────────────────────────────────────────
  const resolveContact = async (): Promise<string | null> => {
    if (!clientName && !clientPhone && !clientEmail) return null;

    // Already matched
    if (contactId) return contactId;

    // Try to find existing by phone or email
    if (clientPhone || clientEmail) {
      let query = supabase.from("contacts").select("id").eq("business_id", businessId);
      if (clientPhone && clientEmail) {
        query = query.or(`phone.eq.${clientPhone},email.eq.${clientEmail}`);
      } else if (clientPhone) {
        query = query.eq("phone", clientPhone);
      } else {
        query = query.eq("email", clientEmail);
      }
      const { data } = await query.limit(1).single();
      if (data) return data.id;
    }

    // Create new contact
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        business_id: businessId,
        name: clientName || clientEmail || clientPhone,
        phone: clientPhone || null,
        email: clientEmail || null,
      })
      .select("id")
      .single();

    if (error) {
      toast({ title: "Error saving contact", description: error.message, variant: "destructive" });
      return null;
    }
    return data.id;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (sendAfter = false) => {
    if (!businessId) {
      toast({ title: "Business not loaded", variant: "destructive" });
      return;
    }
    if (items.some(i => !i.description.trim())) {
      toast({ title: "Please fill in all item descriptions", variant: "destructive" });
      return;
    }
    if (grandTotal <= 0) {
      toast({ title: "Invoice total must be greater than zero", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const finalContactId = await resolveContact();
      const { data: invNum } = await supabase.rpc("generate_invoice_number", {
        p_business_id: businessId,
      });

      // "Sent" now means an email actually went out — no more auto-firing an
      // STK push on save. Phone is still captured for records and for the
      // manual "Request Payment" STK trigger on the invoice detail page.
      const willSend = sendAfter && hasEmail;

      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          business_id: businessId,
          contact_id: finalContactId,
          invoice_number: invNum,
          status: willSend ? "sent" : "draft",
          issue_date: todayStr(),
          due_date: dueDate || null,
          subtotal: parseFloat(subtotal.toFixed(2)),
          vat_amount: parseFloat(totalVat.toFixed(2)),
          total: parseFloat(grandTotal.toFixed(2)),
          notes: notes || null,
          payment_method: paymentMethod,
          customer_email: hasEmail ? clientEmail.trim() : null,
          customer_phone: hasPhone ? clientPhone : null,
          sent_at: willSend ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (invError) throw invError;

      await supabase.from("invoice_items").insert(
        items.map(item => ({
          invoice_id: invoice.id,
          business_id: businessId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_code: item.tax_code,
          vat_amount: item.vat_amount,
          total: item.total,
        }))
      );

      // Queue email
      if (willSend && hasEmail) {
        const { error: qErr } = await supabase.from("invoice_queue").insert({
          invoice_id: invoice.id,
          business_id: businessId,
          contact_id: finalContactId,
          action: "send_email",
          status: "pending",
        });
        if (qErr && qErr.code !== "23505") {
          toast({ title: "Warning: email queuing failed", description: qErr.message });
        }
      }

      if (!willSend) {
        toast({ title: "Invoice saved as draft" });
      } else {
        toast({ title: "Invoice saved!", description: "Email queued — will be sent within 2 minutes" });
      }

      navigate(`/invoices/${invoice.id}`);
    } catch (err: any) {
      toast({ title: "Error saving invoice", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/invoices")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Invoice</h1>
            <p className="text-sm text-muted-foreground">
              {vatRegistered
                ? "Amounts are VAT-inclusive — VAT is back-calculated automatically"
                : "VAT not applicable — your business is not VAT registered"}
            </p>
          </div>
        </div>

        {/* Customer */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-base">Customer <span className="text-muted-foreground text-xs font-normal">(all fields optional)</span></h2>

          {matchedContact && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              <Check className="h-4 w-4 shrink-0" />
              Existing customer matched: <strong className="ml-1">{matchedContact.name}</strong>
              <button
                onClick={() => { setMatchedContact(null); setContactId(null); }}
                className="ml-auto text-xs underline"
              >
                Clear
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />Name
              </Label>
              <Input
                placeholder="Customer name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5 relative" ref={phoneRef}>
              <Label>Phone</Label>
              <Input
                placeholder="07XXXXXXXX"
                value={clientPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onFocus={() => phoneSuggestions.length > 0 && setShowPhoneSugg(true)}
              />
              {showPhoneSugg && phoneSuggestions.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden">
                  {phoneSuggestions.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectContact(c)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b last:border-0"
                    >
                      <p className="font-medium">{c.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}{c.email ? ` · ${c.email}` : ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5 relative" ref={emailRef}>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="customer@email.com"
                value={clientEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                onFocus={() => emailSuggestions.length > 0 && setShowEmailSugg(true)}
              />
              {hasEmail && !matchedContact && (
                <p className="text-xs text-green-600">→ Invoice email will be queued</p>
              )}
              {showEmailSugg && emailSuggestions.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden">
                  {emailSuggestions.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectContact(c)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b last:border-0"
                    >
                      <p className="font-medium">{c.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {vatRegistered && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Customer KRA PIN (optional — required for eTIMS)</Label>
              <Input placeholder="A123456789Z" className="max-w-xs font-mono uppercase" />
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-base">Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Payment terms, reference..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-base">Items</h2>

          <div className={`hidden md:grid gap-2 text-xs font-medium text-muted-foreground uppercase px-1 ${vatRegistered ? "grid-cols-12" : "grid-cols-10"}`}>
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">{vatRegistered ? "Amount (incl. VAT)" : "Amount (KES)"}</div>
            {vatRegistered && <div className="col-span-2 text-center">VAT</div>}
            <div className="col-span-1" />
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className={`grid gap-2 items-center ${vatRegistered ? "grid-cols-12" : "grid-cols-10"}`}>
                  <div className="col-span-12 md:col-span-5">
                    <Input
                      placeholder="e.g. Web design services"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Input
                      type="number" min="1" placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 1)}
                    />
                  </div>
                  <div className="col-span-5 md:col-span-2">
                    <Input
                      type="number" min="0" placeholder="0.00"
                      value={item.amount_incl || ""}
                      onChange={(e) => updateItem(index, "amount_incl", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {vatRegistered && (
                    <div className="col-span-5 md:col-span-2">
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={item.tax_code}
                        onChange={(e) => updateItem(index, "tax_code", e.target.value)}
                      >
                        <option value="A">VAT 16%</option>
                        <option value="B">Exempt</option>
                      </select>
                    </div>
                  )}
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {vatRegistered && item.tax_code === "A" && item.amount_incl > 0 && (
                  <p className="text-xs text-muted-foreground pl-1">
                    Excl. VAT: {fmt(item.unit_price * item.quantity)} · VAT: {fmt(item.vat_amount)} · Total: {fmt(item.total)}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button onClick={addItem} className="flex items-center gap-2 text-sm text-primary hover:underline">
            <Plus className="h-4 w-4" />Add line item
          </button>

          <div className="border-t pt-4 space-y-2 ml-auto max-w-xs">
            {vatRegistered && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal (excl. VAT)</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT</span>
                  <span>{fmt(totalVat)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>Total</span>
              <span className="text-primary">{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-6">
          <Button variant="outline" onClick={() => navigate("/invoices")} disabled={saving}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700">
            <Send className="h-4 w-4" />
            {saving ? "Saving..." : getActionLabel()}
          </Button>
        </div>

      </div>
    </AppShell>
  );
};

export default CreateInvoice;