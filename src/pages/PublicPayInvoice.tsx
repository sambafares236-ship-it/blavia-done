import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle, AlertCircle, Building2 } from "lucide-react";

interface InvoiceData {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  total: number;
  description: string;
  customer_phone: string | null;
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
  const [notFound, setNotFound] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id]);

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

      if (data.invoice.status === "paid") {
        setPaymentConfirmed(true);
      }
    } catch (err) {
      setNotFound(true);
    }
    setLoading(false);
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
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by BLAVIA — Track. Automate. Grow.</p>
      </div>
    </div>
  );
};

export default PublicPayInvoice;