import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type Msg = { role: "user" | "bot"; text: string };

async function fetchBusinessContext(businessId: string) {
  const [txRes, empRes, assetRes, liabRes, schedRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("txn_date,narration,amount,txn_type,category,status")
      .eq("business_id", businessId)
      .order("txn_date", { ascending: false })
      .limit(50),
    supabase
      .from("employees")
      .select("full_name,position,basic_salary,status,department")
      .eq("business_id", businessId),
    supabase
      .from("assets")
      .select("name,category,value")
      .eq("business_id", businessId),
    supabase
      .from("liabilities")
      .select("name,category,value")
      .eq("business_id", businessId),
    supabase
      .from("scheduled_expenses")
      .select("vendor,category,amount,frequency,status,next_due")
      .eq("business_id", businessId),
  ]);

  const transactions = txRes.data ?? [];
  const employees = empRes.data ?? [];
  const assets = assetRes.data ?? [];
  const liabilities = liabRes.data ?? [];
  const scheduled = schedRes.data ?? [];

  // Overall totals
  const totalIncome = transactions
    .filter((t) => t.txn_type === "Income" && t.status === "Approved")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions
    .filter((t) => t.txn_type === "Expense" && t.status === "Approved")
    .reduce((s, t) => s + Number(t.amount), 0);

  // Monthly breakdowns for accurate VAT calculations
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const monthlyData = (monthKey: string) => {
    const txns = transactions.filter(
      (t) => t.txn_date?.startsWith(monthKey) && t.status === "Approved"
    );
    const income = txns.filter((t) => t.txn_type === "Income").reduce((s, t) => s + Number(t.amount), 0);
    const expenses = txns.filter((t) => t.txn_type === "Expense").reduce((s, t) => s + Number(t.amount), 0);
    const outputVat = Math.round((income / 1.16) * 0.16);
    const inputVat = Math.round((expenses / 1.16) * 0.16);
    const netVat = Math.max(0, outputVat - inputVat);
    return { income, expenses, outputVat, inputVat, netVat };
  };

  const thisMonth = monthlyData(thisMonthKey);
  const lastMonth = monthlyData(lastMonthKey);

  // Payroll from employee records (authoritative source)
  const activeEmployees = employees.filter((e) => e.status === "active");
  const monthlyPayroll = activeEmployees.reduce((s, e) => s + Number(e.basic_salary), 0);

  // Assets & liabilities
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.value), 0);

  // Scheduled expenses
  const activeScheduled = scheduled.filter((s) => s.status === "active");
  const monthlyScheduled = activeScheduled.reduce((s, e) => s + Number(e.amount), 0);

  return `
LIVE BUSINESS DATA — use ONLY these exact numbers. Never mix data from other businesses.

═══ OVERALL SUMMARY (all loaded transactions) ═══
Total income: KES ${totalIncome.toLocaleString()}
Total expenses: KES ${totalExpenses.toLocaleString()}
Net profit: KES ${(totalIncome - totalExpenses).toLocaleString()}

═══ ${thisMonthKey} (THIS MONTH) ═══
Income: KES ${thisMonth.income.toLocaleString()}
Expenses: KES ${thisMonth.expenses.toLocaleString()}
Net: KES ${(thisMonth.income - thisMonth.expenses).toLocaleString()}
Output VAT (sales ÷ 1.16 × 16%): KES ${thisMonth.outputVat.toLocaleString()}
Input VAT (purchases ÷ 1.16 × 16%): KES ${thisMonth.inputVat.toLocaleString()}
Net VAT payable: KES ${thisMonth.netVat.toLocaleString()}

═══ ${lastMonthKey} (LAST MONTH) ═══
Income: KES ${lastMonth.income.toLocaleString()}
Expenses: KES ${lastMonth.expenses.toLocaleString()}
Net: KES ${(lastMonth.income - lastMonth.expenses).toLocaleString()}
Output VAT (sales ÷ 1.16 × 16%): KES ${lastMonth.outputVat.toLocaleString()}
Input VAT (purchases ÷ 1.16 × 16%): KES ${lastMonth.inputVat.toLocaleString()}
Net VAT payable: KES ${lastMonth.netVat.toLocaleString()}

═══ PAYROLL (always use employee records for payroll — NOT salary transactions) ═══
Active employees: ${activeEmployees.length}
Monthly payroll total: KES ${monthlyPayroll.toLocaleString()}
${activeEmployees.map((e) => `  • ${e.full_name} (${e.position ?? "Staff"}, ${e.department ?? "—"}): KES ${Number(e.basic_salary).toLocaleString()}/month`).join("\n") || "  No active employees"}

═══ BALANCE SHEET ═══
Total assets: KES ${totalAssets.toLocaleString()}
Total liabilities: KES ${totalLiabilities.toLocaleString()}
Net worth: KES ${(totalAssets - totalLiabilities).toLocaleString()}

Assets:
${assets.length > 0 ? assets.map((a) => `  • ${a.name} (${a.category}): KES ${Number(a.value).toLocaleString()}`).join("\n") : "  No assets recorded"}

Liabilities:
${liabilities.length > 0 ? liabilities.map((l) => `  • ${l.name} (${l.category}): KES ${Number(l.value).toLocaleString()}`).join("\n") : "  No liabilities recorded"}

═══ RECURRING BILLS (scheduled expenses) ═══
Monthly total: KES ${monthlyScheduled.toLocaleString()}
${activeScheduled.map((s) => `  • ${s.vendor} (${s.category}): KES ${Number(s.amount).toLocaleString()} ${s.frequency} — next due ${s.next_due}`).join("\n") || "  No active scheduled expenses"}

═══ RECENT TRANSACTIONS (last 10) ═══
${transactions.slice(0, 10).map((t) => `  • ${t.txn_date} | ${t.txn_type} | ${t.narration ?? t.category} | KES ${Number(t.amount).toLocaleString()} | ${t.status}`).join("\n") || "  No transactions yet"}
`.trim();
}

const BASE_SYSTEM = `You are BLAVIA's AI financial assistant — a smart, friendly advisor for Kenyan small businesses.

You have this user's LIVE business data. Always use their exact numbers.

CRITICAL RULES:
1. VAT is MONTHLY — never apply VAT to all-time totals. Use the monthly VAT figures already calculated in the data
2. Corporate Tax is ANNUAL — 30% of annual net profit, not monthly
3. For payroll, ALWAYS use the PAYROLL section (from employee records). Never use salary transaction amounts
4. Always show your calculation working so the user can verify
5. Use KES for all amounts
6. KRA deadlines: VAT by 20th of next month, PAYE by 9th of next month
7. If unsure which month to use for taxes, ask the user

KENYAN TAX RATES:
- VAT: 16% (output on sales, input on purchases, net = output - input)
- Corporate Tax: 30% of annual net profit
- PAYE: graduated (0% up to 24,000 | 25% 24,001–32,333 | 30% 32,334–500,000 | 32.5% above 500,000)
- NSSF: KES 200 employee + KES 200 employer
- NHIF/SHIF: 2.75% of gross salary
- Withholding Tax: 5% on professional fees, 3% on construction
- Turnover Tax (TOT): 3% for businesses below KES 5M annual revenue`;

interface ChatbotWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChatbotWidget = ({ open, onOpenChange }: ChatbotWidgetProps) => {
  const { profile, business } = useAuth();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [businessContext, setBusinessContext] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text: `Hi${profile?.full_name ? " " + profile.full_name.split(" ")[0] : ""}! 👋 I'm your BLAVIA financial assistant powered by GPT-4o. Ask me about your income, expenses, taxes, payroll or anything finance-related!`,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && business?.id && !businessContext) {
      fetchBusinessContext(business.id).then(setBusinessContext);
    }
  }, [open, business?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);

    try {
      let ctx = businessContext;
      if (business?.id) {
        ctx = await fetchBusinessContext(business.id);
        setBusinessContext(ctx);
      }

      const systemPrompt = `${BASE_SYSTEM}

Business name: ${business?.business_name ?? "Unknown"}
Business category: ${business?.business_category ?? "Unknown"}
VAT registered: ${business?.vat_registered ? "Yes" : "No"}

${ctx}`;

      const history = messages.slice(-8).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const { data, error } = await supabase.functions.invoke("chat", {
        body: { systemPrompt, history, message: text },
      });

      if (error) throw new Error(error.message);

      const reply = data?.reply ?? "Sorry, I couldn't get a response. Please try again.";
      setMessages((m) => [...m, { role: "bot", text: reply }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: "Sorry, I'm having trouble connecting right now. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    "What is my net profit?",
    "What VAT do I owe this month?",
    "Calculate PAYE for KES 45,000",
    "How much is my monthly payroll?",
    "What taxes do I owe?",
    "Explain my balance sheet",
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => onOpenChange(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Open AI Assistant"
      >
        {open ? (
          <X className="h-6 w-6 text-primary-foreground" />
        ) : (
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[370px] flex-col rounded-2xl border border-border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 rounded-t-2xl bg-primary px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary-foreground truncate">
                BLAVIA Assistant
              </p>
              <p className="text-xs text-primary-foreground/70">
                {business?.business_name ?? "Your business"} · Powered by GPT-4o
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-primary-foreground/70 hover:text-primary-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex max-h-[400px] flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border p-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask about your business…"
              className="flex-1 text-sm"
              disabled={sending}
            />
            <Button size="icon" onClick={send} disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};