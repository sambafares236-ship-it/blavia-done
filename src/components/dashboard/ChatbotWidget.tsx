import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type Msg = { role: "user" | "bot"; text: string };

// Fetch this user's actual business data to give Claude real context
async function fetchBusinessContext(businessId: string) {
  const [txRes, empRes, assetRes, liabRes, schedRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("txn_date,narration,amount,txn_type,category,status")
      .eq("business_id", businessId)
      .order("txn_date", { ascending: false })
      .limit(30),
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

  const totalIncome = transactions
    .filter((t) => t.txn_type === "Income" && t.status === "Approved")
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter((t) => t.txn_type === "Expense" && t.status === "Approved")
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.value), 0);
  const monthlyPayroll = employees
    .filter((e) => e.status === "active")
    .reduce((s, e) => s + Number(e.basic_salary), 0);

  return `
LIVE BUSINESS DATA (use these exact numbers when answering):
- Total income (last 30 transactions): KES ${totalIncome.toLocaleString()}
- Total expenses (last 30 transactions): KES ${totalExpenses.toLocaleString()}
- Net position: KES ${(totalIncome - totalExpenses).toLocaleString()}
- Total assets: KES ${totalAssets.toLocaleString()}
- Total liabilities: KES ${totalLiabilities.toLocaleString()}
- Net worth: KES ${(totalAssets - totalLiabilities).toLocaleString()}
- Active employees: ${employees.filter((e) => e.status === "active").length}
- Monthly payroll: KES ${monthlyPayroll.toLocaleString()}
- Scheduled expenses: ${scheduled.filter((s) => s.status === "active").length} active

Recent transactions (last 10):
${transactions.slice(0, 10).map((t) => `  - ${t.txn_date} | ${t.txn_type} | ${t.narration ?? t.category} | KES ${Number(t.amount).toLocaleString()}`).join("\n") || "  No transactions yet"}

Employees:
${employees.length > 0 ? employees.map((e) => `  - ${e.full_name} (${e.position ?? "Staff"}) — KES ${Number(e.basic_salary).toLocaleString()}/month — ${e.status}`).join("\n") : "  No employees yet"}

Assets:
${assets.length > 0 ? assets.map((a) => `  - ${a.name} (${a.category}): KES ${Number(a.value).toLocaleString()}`).join("\n") : "  No assets recorded"}

Liabilities:
${liabilities.length > 0 ? liabilities.map((l) => `  - ${l.name} (${l.category}): KES ${Number(l.value).toLocaleString()}`).join("\n") : "  No liabilities recorded"}

Scheduled expenses:
${scheduled.length > 0 ? scheduled.map((s) => `  - ${s.vendor} (${s.category}): KES ${Number(s.amount).toLocaleString()} ${s.frequency} — due ${s.next_due}`).join("\n") : "  No scheduled expenses"}
`.trim();
}

const BASE_SYSTEM = `You are BLAVIA's AI financial assistant — a smart, friendly advisor for Kenyan small businesses.

You have access to this specific user's LIVE business data (provided below). Always use their actual numbers when answering. Never mix up data between businesses.

You help with:
- Analysing their specific income, expenses, cash flow and net profit
- Kenyan tax guidance: VAT 16%, Corporate Tax 30%, PAYE, NSSF, NHIF/SHIF, WHT, TOT 3%
- Payroll calculations and KRA compliance using their actual employee salaries
- Balance sheet interpretation using their real assets and liabilities
- General business finance advice tailored to their situation
- How to use BLAVIA features

Rules:
- Always use KES for currency
- Be concise and practical
- When doing calculations, show the working
- If data shows KES 0 everywhere, tell the user to add their transactions first
- Never reveal data from other businesses`;

export const ChatbotWidget = () => {
  const { profile, business } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [businessContext, setBusinessContext] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text: `Hi${profile?.full_name ? " " + profile.full_name.split(" ")[0] : ""}! 👋 I'm your BLAVIA financial assistant. I can answer questions about your specific business data, taxes, payroll, and more. What would you like to know?`,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load live business data when chat opens
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
      // Refresh business context on every send to keep data current
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

      const history = messages
        .slice(-8)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [...history, { role: "user", content: text }],
        }),
      });

      const data = await res.json();
      const reply =
        data.content?.[0]?.text ??
        "Sorry, I couldn't get a response. Please try again.";

      setMessages((m) => [...m, { role: "bot", text: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    "What is my net profit?",
    "Calculate PAYE for KES 80,000",
    "Am I profitable this month?",
    "What taxes do I owe?",
    "Explain my balance sheet",
    "How much is my monthly payroll?",
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
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
                {business?.business_name ?? "Your business"} · Powered by Claude AI
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-primary-foreground/70 hover:text-primary-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex max-h-[400px] flex-col gap-3 overflow-y-auto p-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
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