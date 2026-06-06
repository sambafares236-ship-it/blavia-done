import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, CalendarClock, Landmark, PiggyBank, Receipt } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatbotWidget } from "@/components/dashboard/ChatbotWidget";
import { supabase, Transaction } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { VatTab } from "@/components/tax/VatTab";
import { CorporateTaxTab } from "@/components/tax/CorporateTaxTab";
import { WithholdingTaxTab } from "@/components/tax/WithholdingTaxTab";
import { TurnoverTaxTab } from "@/components/tax/TurnoverTaxTab";
import { TaxCalendarTab } from "@/components/tax/TaxCalendarTab";
import { useAuth } from "@/contexts/AuthContext";

const Tax = () => {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "vat");
  const [txns, setTxns] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!profile?.business_id) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("txn_date", { ascending: false })
        .limit(2000);
      if (error) {
        toast({ title: "Couldn't load transactions", description: error.message, variant: "destructive" });
      } else {
        setTxns((data ?? []) as Transaction[]);
      }
    };
    load();
  }, [profile?.business_id]);

  const onTab = (v: string) => {
    setTab(v);
    const next = new URLSearchParams(params);
    next.set("tab", v);
    setParams(next, { replace: true });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Tax Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            VAT, corporate tax, withholding, turnover tax & KRA filing calendar.
          </p>
        </header>
        <Tabs value={tab} onValueChange={onTab} className="space-y-6">
          <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
            <TabsTrigger value="vat" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Receipt className="h-4 w-4" /> VAT Management
            </TabsTrigger>
            <TabsTrigger value="corp" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Building2 className="h-4 w-4" /> Corporate Tax
            </TabsTrigger>
            <TabsTrigger value="wht" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Landmark className="h-4 w-4" /> Withholding Tax
            </TabsTrigger>
            <TabsTrigger value="tot" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <PiggyBank className="h-4 w-4" /> Turnover Tax
            </TabsTrigger>
            <TabsTrigger value="cal" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <CalendarClock className="h-4 w-4" /> Tax Calendar
            </TabsTrigger>
          </TabsList>
          <TabsContent value="vat" className="mt-0"><VatTab txns={txns} /></TabsContent>
          <TabsContent value="corp" className="mt-0"><CorporateTaxTab txns={txns} /></TabsContent>
          <TabsContent value="wht" className="mt-0"><WithholdingTaxTab /></TabsContent>
          <TabsContent value="tot" className="mt-0"><TurnoverTaxTab txns={txns} /></TabsContent>
          <TabsContent value="cal" className="mt-0"><TaxCalendarTab /></TabsContent>
        </Tabs>
      </div>
      <ChatbotWidget />
    </AppShell>
  );
};

export default Tax;