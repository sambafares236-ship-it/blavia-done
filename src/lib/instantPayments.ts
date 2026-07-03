import { supabase } from "@/lib/supabase";

export const PAYMENT_METHODS = ["Cash", "M-Pesa", "Bank Transfer", "Other"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

/**
 * Records an instant (already-settled) payment directly into `transactions`.
 * Used for cash/M-Pesa sales that don't go through invoice creation, and for
 * invoices marked paid manually — both cases previously left no cash trail.
 */
export const recordInstantPayment = (opts: {
  businessId: string;
  amount: number;
  direction: "Income" | "Expense";
  method: PaymentMethod;
  narration: string;
  category?: string;
  reference?: string;
}) => {
  const now = new Date().toISOString();
  return supabase.from("transactions").insert({
    business_id: opts.businessId,
    amount: Math.round(opts.amount * 100) / 100,
    txn_type: opts.direction,
    txn_date: now.slice(0, 10),
    narration: opts.narration,
    category: opts.category || (opts.direction === "Income" ? "Sales" : "Other"),
    ref_number: opts.reference || null,
    source_bank: opts.method,
    status: "Approved",
    approved_at: now,
    input_source: "manual",
  });
};
