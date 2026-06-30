import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Smartphone, Loader2, CheckCircle, AlertCircle, Building2 } from "lucide-react";

interface InvoiceData {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  total: number;
  description: string;
  customer_phone: string | null;
  mpesa_reference: string | null;
  paid_at: string | null;
}

interface BusinessData {
  name: string;
  logo_url: string | null;
}

const PublicPayInvoice = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [paybill, setPaybill] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [stkLoading, setStkLoading] = useState(false);
  const [stkSent, setStkSent] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [mpesaReceipt, setMpesaReceipt] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id]);

  // Pre-fill phone if invoice already has one
  useEffect(() => {
    if (invoice?.customer_phone && !phoneNumber) {
      setPhoneNumber(invoice.customer_phone);
    }
  }, [invoice]);

  // Poll for payment confirmation
  useEffect(() => {
    if (!stkSent || !checkoutRequestId) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("mpesa_transactions")
        .select("status, mpesa_receipt_number")
        .eq("checkout_request_id", checkoutRequestId)
        .single();

      if (data?.status === "success") {
        clearInterval(interval);
        setStkSent(false);
        setPaymentConfirmed(true);
        setMpesaReceipt(data.mpesa_receipt_number);
        toast({ title: "Payment received!" });
      } else if (data?.status === "failed" || data?.status === "cancelled") {
        clearInterval(interval);
        setStkSent(false);
        toast({ title: "Payment failed or cancelled", variant: "destructive" });
      }
    }, 5000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setStkSent(false);
    }, 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [stkSent, checkoutRequestId]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-public-invoice", {
        body: { invoice_id: id },
      });

      if (error || !data?.invoice) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setInvoice(data.invoice);
      setBusiness(data.business);
      setPaybill(data.paybill);

      if (data.invoice.status === "paid") {
        setPaymentConfirmed(true);
        setMpesaReceipt(data.invoice.mpesa_reference);
      }
    } catch (err) {
      setNotFound(true);
    }
    setLoading(false);
  };

  const handleStkPush = async () => {
    if (!phoneNumber || !invoice) {
      toast({ title: "Please enter your M-Pesa number", variant: "destructive" });
      return;
    }

    setStkLoading(true);

    let phone = phoneNumber.replace(/\s/g, "");
    if (phone.startsWith("0")) phone = "254" + phone.slice(1);
    if (phone.startsWith("+")) phone = phone.slice(1);

    try {
      const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
        body: {
          business_id: null, // server looks this up from invoice_id instead
          invoice_id: invoice.id,
          phone_number: phone,
          amount: invoice.total,
          account_reference: invoice.invoice_number,
          transaction_desc: invoice.description || "Payment for goods/services",
        },
      });

      if (error || !data?.success) {
        toast({
          title: "Could not send payment request",
          description: data?.error || "Please try again",
          variant: "destructive",
        });
        setStkLoading(false);
        return;
      }

      setCheckoutRequestId(data.checkout_request_id);
      setStkSent(true);
      toast({ title: "Check your phone for the M-Pesa prompt" });

    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }

    setStkLoading(false);
  };

  const formatCurrency = (amount: number) =>
    `KES ${(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  const formatDate = (date: string) =>
    date ? new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "—";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800">Invoice not found</h1>
          <p className="text-gray-500 mt-1">This invoice link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">

        {/* Business Header */}
        <div className="text-center mb-6">
          {business?.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="h-16 mx-auto object-contain mb-2" />
          ) : (
            <div className="h-16 w-16 mx-auto rounded-xl bg-sidebar flex items-center justify-center mb-2">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          )}
          <h1 className="text-lg font-bold text-gray-800">{business?.name}</h1>
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">

          {paymentConfirmed ? (
            // ── Payment Success Screen ──────────────────
            <div className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800">Payment Successful!</h2>
              <p className="text-gray-500 mt-1">Invoice {invoice.invoice_number} has been paid</p>
              <div className="mt-6 bg-green-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-green-700">{formatCurrency(invoice.total)}</p>
                {mpesaReceipt && (
                  <p className="text-sm text-green-600 mt-1">M-Pesa Receipt: {mpesaReceipt}</p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-6">Powered by BLAVIA</p>
            </div>
          ) : (
            <>
              {/* Invoice Details */}
              <div className="p-6 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice</p>
                    <p className="font-bold text-gray-800">{invoice.invoice_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Due</p>
                    <p className="text-sm text-gray-600">{formatDate(invoice.due_date)}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-3">{invoice.description}</p>
              </div>

              {/* Amount */}
              <div className="p-6 bg-gray-50 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Amount Due</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{formatCurrency(invoice.total)}</p>
              </div>

              {/* Payment Section */}
              <div className="p-6 space-y-4">
                {!stkSent ? (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Pay with M-Pesa</label>
                      <Input
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="07XXXXXXXX or 254XXXXXXXXX"
                        className="mt-1.5"
                      />
                    </div>
                    <Button
                      onClick={handleStkPush}
                      disabled={stkLoading || !phoneNumber}
                      className="w-full bg-green-600 hover:bg-green-700 gap-2"
                    >
                      {stkLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
                      ) : (
                        <><Smartphone className="h-4 w-4" />Pay Now with M-Pesa</>
                      )}
                    </Button>

                    {paybill && (
                      <div className="text-center pt-2">
                        <p className="text-xs text-gray-400">Or pay manually via M-Pesa</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Paybill: <span className="font-mono font-semibold">{paybill}</span>
                          {" · "}Account: <span className="font-mono font-semibold">{invoice.invoice_number}</span>
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                    <p className="text-sm font-medium text-gray-700">Check your phone for the M-Pesa prompt</p>
                    <p className="text-xs text-gray-400">Enter your PIN to complete payment</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by BLAVIA — Track. Automate. Grow.</p>
      </div>
    </div>
  );
};

export default PublicPayInvoice;