import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, CreditCard, Wallet, Receipt } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export default function Index() {
  const { user, profile, business, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    pendingInvoices: 0
  });

  useEffect(() => {
    console.log("Dashboard mounted, loading data...");
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    console.log("🔄 Starting dashboard load for user:", user?.email);
    
    const timeoutId = setTimeout(() => {
      console.warn("⚠️ Dashboard load timeout - forcing completion");
      setLoading(false);
    }, 5000);

    try {
      const userEmail = user?.email || '';
      console.log("📧 Fetching data for email:", userEmail);

      // Fetch transactions filtered by user email
      const { data: transactions, error: txnError } = await supabase
        .from('transactions')
        .select('*')
        .or(`created_by_email.eq.${userEmail},business_id.in.(select(id).from(businesses).where(owner_email.eq.${userEmail}))`)
        .limit(10);

      if (txnError) {
        console.error("❌ Transaction error:", txnError);
      } else {
        console.log("✅ Transactions fetched:", transactions?.length);
      }

      // Fetch payments filtered by user email
      const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('*')
        .or(`created_by_email.eq.${userEmail},business_id.in.(select(id).from(businesses).where(owner_email.eq.${userEmail}))`)
        .limit(5);

      if (payError) {
        console.error("❌ Payment error:", payError);
      } else {
        console.log("✅ Payments fetched:", payments?.length);
      }

      const txnArray = transactions || [];
      const payArray = payments || [];

      const revenue = txnArray
        .filter((t: any) => t.txn_type === 'Income')
        .reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0);
        
      const expenses = txnArray
        .filter((t: any) => t.txn_type === 'Expense')
        .reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0);

      const pending = payArray.filter((p: any) => p.status === 'pending').length;

      setStats({
        totalRevenue: revenue,
        totalExpenses: expenses,
        netProfit: revenue - expenses,
        pendingInvoices: pending
      });

      console.log("✅ Stats calculated:", { revenue, expenses });
    } catch (err) {
      console.error("❌ Dashboard error:", err);
    } finally {
      console.log("✅ Setting loading to false");
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your business performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(stats.totalRevenue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Expenses</CardTitle>
              <CreditCard className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.totalExpenses)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Net Profit</CardTitle>
              <Wallet className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(stats.netProfit)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
              <Receipt className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.pendingInvoices}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Business Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Business Name</p>
              <p className="font-semibold">{business?.business_name || profile?.company_name || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Owner</p>
              <p className="font-semibold">{profile?.full_name || user?.user_metadata?.full_name || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold">{user?.email || profile?.email || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Category</p>
              <p className="font-semibold">{business?.business_category || 'Not set'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button onClick={() => window.location.href = '/payments'} className="h-16">
            View Payments
          </Button>
          <Button onClick={() => window.location.href = '/transactions'} className="h-16" variant="outline">
            View Transactions
          </Button>
        </div>
      </div>
    </AppShell>
  );
}