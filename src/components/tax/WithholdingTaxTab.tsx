import { useState } from "react";
import { CheckCircle2, FileBadge, ShieldCheck, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

type WhtType = "consultant" | "rent" | "professional";

const WHT_RATES: Record<WhtType, { rate: number; label: string }> = {
  consultant: { rate: 0.05, label: "Consultant" },
  rent: { rate: 0.1, label: "Rent" },
  professional: { rate: 0.2, label: "Professional Fees (non-resident)" },
};

const KRA_PIN_REGEX = /^[AP]\d{9}[A-Z]$/;

export const WithholdingTaxTab = () => {
  const [type, setType] = useState<WhtType>("consultant");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [pinValid, setPinValid] = useState<null | boolean>(null);

  const rate = WHT_RATES[type].rate;
  const gross = Number(amount) || 0;
  const wht = gross * rate;
  const net = gross - wht;

  const validatePin = () => {
    const ok = KRA_PIN_REGEX.test(pin.trim().toUpperCase());
    setPinValid(ok);
    toast({
      title: ok ? "PIN format valid" : "Invalid KRA PIN format",
      description: ok
        ? "Use eTIMS or KRA portal for full validation."
        : "Expected format: A123456789Z",
      variant: ok ? "default" : "destructive",
    });
  };

  const generateCertificate = () => {
    if (!gross || !pin || !name) {
      toast({
        title: "Missing details",
        description: "Provide payee name, PIN and amount.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "WHT Certificate generated",
      description: `Certificate for ${name} (${fmtKES(wht)} withheld) is ready.`,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/60 p-6 shadow-card">
        <h3 className="text-base font-semibold text-foreground">Withholding Tax Calculator</h3>
        <p className="text-xs text-muted-foreground">
          Compute WHT and generate certificates for KRA filing.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="payee">Payee Name</Label>
            <Input
              id="payee"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
              placeholder="Acme Consultants Ltd"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">KRA PIN</Label>
            <div className="flex gap-2">
              <Input
                id="pin"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.toUpperCase().slice(0, 11));
                  setPinValid(null);
                }}
                placeholder="A123456789Z"
                maxLength={11}
                className="uppercase"
              />
              <Button
                type="button"
                variant="outline"
                onClick={validatePin}
                className="shrink-0 gap-1.5"
              >
                {pinValid === true && <CheckCircle2 className="h-4 w-4 text-success" />}
                {pinValid === false && <XCircle className="h-4 w-4 text-destructive" />}
                {pinValid === null && <ShieldCheck className="h-4 w-4" />}
                Validate
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">WHT Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as WhtType)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultant">Consultant — 5%</SelectItem>
                <SelectItem value="rent">Rent — 10%</SelectItem>
                <SelectItem value="professional">Professional Fees — 20%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amt">Gross Amount (KES)</Label>
            <Input
              id="amt"
              type="number"
              min={0}
              max={1_000_000_000}
              value={amount}
              onChange={(e) => setAmount(e.target.value.slice(0, 12))}
              placeholder="0"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Gross</p>
            <p className="mt-1 text-base font-bold tabular-nums">{fmtKES(gross)}</p>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-warning">WHT ({Math.round(rate * 100)}%)</p>
            <p className="mt-1 text-base font-bold tabular-nums text-warning">{fmtKES(wht)}</p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-success">Net to Payee</p>
            <p className="mt-1 text-base font-bold tabular-nums text-success">{fmtKES(net)}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={generateCertificate}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <FileBadge className="h-4 w-4" />
            Generate WHT Certificate
          </Button>
        </div>
      </Card>

      <Card className="border border-border/60 p-5 shadow-card">
        <h3 className="text-base font-semibold text-foreground">Rates Reference</h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {Object.entries(WHT_RATES).map(([k, v]) => (
            <li
              key={k}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
            >
              <span className="text-sm font-medium text-foreground">{v.label}</span>
              <Badge variant="outline" className="bg-muted text-xs font-semibold">
                {Math.round(v.rate * 100)}%
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
