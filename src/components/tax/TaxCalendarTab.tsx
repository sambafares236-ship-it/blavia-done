import { useState } from "react";
import { AlertCircle, Bell, CalendarClock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

interface Deadline {
  date: string;
  title: string;
  type: "VAT" | "PAYE" | "Corp Tax" | "WHT" | "TOT";
  daysAway: number;
}

const upcoming: Deadline[] = [
  { date: "2025-04-20", title: "VAT3 Return — March", type: "VAT", daysAway: 4 },
  { date: "2025-04-20", title: "WHT Remittance — March", type: "WHT", daysAway: 4 },
  { date: "2025-04-20", title: "Q1 Installment Tax", type: "Corp Tax", daysAway: 4 },
  { date: "2025-05-09", title: "PAYE — April", type: "PAYE", daysAway: 23 },
  { date: "2025-05-20", title: "VAT3 Return — April", type: "VAT", daysAway: 34 },
  { date: "2025-05-20", title: "TOT — April", type: "TOT", daysAway: 34 },
];

const history = [
  { date: "2025-03-20", title: "VAT3 — February", status: "Filed" },
  { date: "2025-03-09", title: "PAYE — February", status: "Filed" },
  { date: "2025-02-20", title: "VAT3 — January", status: "Filed" },
  { date: "2025-02-09", title: "PAYE — January", status: "Filed" },
];

const typeTone: Record<Deadline["type"], string> = {
  VAT: "border-shield/30 bg-shield/10 text-shield",
  PAYE: "border-navy/30 bg-navy/10 text-navy",
  "Corp Tax": "border-primary/30 bg-primary/10 text-primary",
  WHT: "border-warning/30 bg-warning/10 text-warning",
  TOT: "border-success/30 bg-success/10 text-success",
};

export const TaxCalendarTab = () => {
  const [reminders, setReminders] = useState({ email: true, sms: false, push: true });

  return (
    <div className="space-y-6">
      <Card className="border border-border/60 p-6 shadow-card">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Upcoming Deadlines</h3>
        </div>
        <ul className="mt-4 space-y-2">
          {upcoming.map((d) => {
            const urgent = d.daysAway <= 7;
            return (
              <li
                key={`${d.date}-${d.title}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg border ${
                      urgent
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    <span className="text-[9px] font-semibold uppercase">
                      {new Date(d.date).toLocaleString("en", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold leading-none">
                      {new Date(d.date).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Due {d.date} · {d.daysAway} day{d.daysAway === 1 ? "" : "s"} away
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] font-semibold ${typeTone[d.type]}`}>
                    {d.type}
                  </Badge>
                  {urgent && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      Urgent
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="border border-border/60 p-6 shadow-card">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Auto-reminders</h3>
        </div>
        <p className="text-xs text-muted-foreground">Get notified before each deadline.</p>
        <div className="mt-4 space-y-3">
          {(
            [
              { k: "email", label: "Email reminders", desc: "7 and 1 day before due date" },
              { k: "sms", label: "SMS reminders", desc: "1 day before due date" },
              { k: "push", label: "In-app notifications", desc: "Real-time, in dashboard" },
            ] as const
          ).map((r) => (
            <div
              key={r.k}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{r.label}</p>
                <p className="text-[11px] text-muted-foreground">{r.desc}</p>
              </div>
              <Switch
                checked={reminders[r.k]}
                onCheckedChange={(v) => {
                  setReminders((s) => ({ ...s, [r.k]: v }));
                  toast({
                    title: `${r.label} ${v ? "enabled" : "disabled"}`,
                  });
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="border border-border/60 p-6 shadow-card">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <h3 className="text-base font-semibold text-foreground">Filing History</h3>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {history.map((h) => (
            <li key={`${h.date}-${h.title}`} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{h.title}</p>
                <p className="text-[11px] text-muted-foreground">Filed on {h.date}</p>
              </div>
              <Badge
                variant="outline"
                className="border-success/30 bg-success/10 text-[10px] font-semibold uppercase text-success"
              >
                {h.status}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
