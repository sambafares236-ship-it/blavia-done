import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// TODO: Replace with your real n8n webhook URL.
const N8N_WEBHOOK_URL = "https://YOUR-N8N-INSTANCE/webhook/blavia-chat";

type Msg = { role: "user" | "bot"; text: string };

export const ChatbotWidget = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text: "Hi! I'm your BLAVIA assistant. Ask me anything about your transactions.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, ts: new Date().toISOString() }),
      });
      let reply = "Got it. (No reply payload received.)";
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const data = await res.json();
          reply = data.reply ?? data.message ?? data.output ?? JSON.stringify(data);
        } else {
          reply = (await res.text()) || reply;
        }
      } else {
        reply = `Webhook error (${res.status}). Update N8N_WEBHOOK_URL in ChatbotWidget.tsx.`;
      }
      setMessages((m) => [...m, { role: "bot", text: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text:
            "Couldn't reach the n8n webhook. Set N8N_WEBHOOK_URL in src/components/dashboard/ChatbotWidget.tsx.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-navy-foreground shadow-elevated transition-transform hover:scale-105",
          "bg-gradient-navy"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[480px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-xl border bg-card shadow-elevated">
          <div className="flex items-center gap-2 bg-gradient-navy px-4 py-3 text-navy-foreground">
            <MessageCircle className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold leading-tight">BLAVIA Assistant</p>
              <p className="text-[11px] opacity-80">Powered by n8n</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm",
                    m.role === "user"
                      ? "bg-shield text-shield-foreground"
                      : "bg-card text-foreground border"
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2 border-t bg-card p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};
