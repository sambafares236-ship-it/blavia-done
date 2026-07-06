import { useEffect, useRef, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  onCompleted: () => void;
}

const normalizePhone = (raw: string) => {
  let p = raw.replace(/\s/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  return p;
};

export const RequestStkPaymentDialog = ({ open, onOpenChange, businessId, onCompleted }: Props) => {
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<{ interval: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setPhone("");
      setDescription("");
      setWaiting(false);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current.interval);
        clearTimeout(pollRef.current.timeout);
      }
    };
  }, [open]);

  const handleSend = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!phone.trim()) {
      toast({ title: "Enter a phone number", variant: "destructive" });
      return;
    }

    setSending(true);
    const formattedPhone = normalizePhone(phone.trim());

    const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
      body: {
        business_id: businessId,
        phone_number: formattedPhone,
        amount: amt,
        account_reference: "BLAVIA",
        transaction_desc: description.trim() || "Payment via Blavia",
      },
    });

    if (error || !data?.success) {
      toast({
        title: "STK Push failed",
        description: data?.error || "Could not send payment request",
        variant: "destructive",
      });
      setSending(false);
      return;
    }

    setSending(false);
    setWaiting(true);
    toast({ title: "STK Push sent!", description: `Check ${formattedPhone} for the M-Pesa prompt` });

    const checkoutRequestId = data.checkout_request_id;
    const interval = setInterval(async () => {
      const { data: row } = await supabase
        .from("mpesa_transactions")
        .select("status")
        .eq("checkout_request_id", checkoutRequestId)
        .single();

      if (row?.status === "success") {
        clearInterval(interval);
        clearTimeout(timeout);
        setWaiting(false);
        toast({ title: "Payment received!", description: `${formattedPhone} paid ${amount}` });
        onOpenChange(false);
        onCompleted();
      } else if (row?.status === "failed") {
        clearInterval(interval);
        clearTimeout(timeout);
        setWaiting(false);
        toast({ title: "Payment failed or cancelled", variant: "destructive" });
      }
    }, 5000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setWaiting(false);
      onOpenChange(false);
      onCompleted();
    }, 120000);

    pollRef.current = { interval, timeout };
  };

  const cancelWaiting = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current.interval);
      clearTimeout(pollRef.current.timeout);
    }
    setWaiting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !waiting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Payment (STK Push)</DialogTitle>
        </DialogHeader>

        {!waiting ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stk-amount">Amount (KES)</Label>
                <Input
                  id="stk-amount"
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stk-phone">Phone number</Label>
                <Input
                  id="stk-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="254700000000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stk-desc">Description (optional)</Label>
                <Input
                  id="stk-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Walk-in sale"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending} className="gap-2 bg-green-600 hover:bg-green-700">
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Smartphone className="h-4 w-4" />Send STK Push</>}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Waiting for payment from {normalizePhone(phone)}...</p>
              <p className="text-xs text-green-600">Customer should see an M-Pesa prompt. This updates automatically when paid.</p>
            </div>
            <Button variant="outline" size="sm" onClick={cancelWaiting} className="shrink-0 border-green-300 text-green-700">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
