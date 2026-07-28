import { z } from "zod";

export type EmployeeStatus = "active" | "on_leave" | "terminated";
export type PaymentMethod = "M-Pesa" | "Bank" | "Cash";

/**
 * Mirrors the `employees` table. Note there is no separate payroll-number
 * column in the database — `id` is the only identifier — so the UI shows a
 * short prefix of it wherever an employee reference is needed.
 */
export interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  id_number: string | null;
  kra_pin: string | null;
  nssf_number: string | null;
  nhif_number: string | null;
  basic_salary: number;
  allowances: Record<string, number> | null;
  deductions: Record<string, number> | null;
  payment_method: PaymentMethod;
  mpesa_number: string | null;
  bank_account: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  status: EmployeeStatus;
  created_at?: string;
  updated_at?: string;
}

const phoneRegex = /^\+254\d{9}$/;

/**
 * Accepts common local input formats (0700920985, 700920985, 254700920985,
 * +254700920985) and standardizes to +254XXXXXXXXX for storage.
 */
export const normalizeKenyanPhone = (raw: string): string => {
  let p = (raw ?? "").trim().replace(/[\s-]/g, "");
  if (!p) return p;
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "254" + p.slice(1);
  else if (!p.startsWith("254") && p.length === 9) p = "254" + p;
  return `+${p}`;
};

const isValidKenyanPhone = (raw: string): boolean => phoneRegex.test(normalizeKenyanPhone(raw));

export const parseJsonObject = (v: string | undefined): Record<string, number> => {
  if (!v || v.trim() === "") return {};
  try {
    const p = JSON.parse(v);
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
};

export const employeeFormSchema = z
  .object({
    full_name: z.string().trim().min(1, "Full name is required").max(120),
    email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
    phone: z.string().trim().refine(isValidKenyanPhone, "Enter a valid Kenyan number, e.g. 0700920985"),
    id_number: z.string().trim().max(50).optional().or(z.literal("")),
    kra_pin: z.string().trim().max(50).optional().or(z.literal("")),
    nssf_number: z.string().trim().max(50).optional().or(z.literal("")),
    nhif_number: z.string().trim().max(50).optional().or(z.literal("")),
    basic_salary: z.string().min(1, "Please enter a salary amount"),
    allowances_json: z.string().optional().or(z.literal("")),
    deductions_json: z.string().optional().or(z.literal("")),
    payment_method: z.enum(["M-Pesa", "Bank", "Cash"]),
    mpesa_number: z.string().trim().optional().or(z.literal("")),
    bank_account: z.string().trim().max(50).optional().or(z.literal("")),
    department: z.string().trim().max(80).optional().or(z.literal("")),
    position: z.string().trim().max(80).optional().or(z.literal("")),
    hire_date: z.string().optional().or(z.literal("")),
    status: z.enum(["active", "on_leave", "terminated"]),
  })
  .superRefine((data, ctx) => {
    const salary = Number(data.basic_salary);
    if (isNaN(salary) || salary < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["basic_salary"],
        message: "Please enter a valid salary amount",
      });
    }
    if (data.payment_method === "M-Pesa") {
      if (!data.mpesa_number || !isValidKenyanPhone(data.mpesa_number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mpesa_number"],
          message: "Please enter the M-Pesa number, e.g. 0700920985",
        });
      }
    }
    if (data.payment_method === "Bank") {
      if (!data.bank_account || data.bank_account.length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bank_account"],
          message: "Please enter a valid bank account number",
        });
      }
    }
  });

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const fmtKES = (n: number | null | undefined) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Number(n ?? 0));

export const employeeStatusLabel = (s: EmployeeStatus) =>
  s === "active" ? "Active" : s === "on_leave" ? "On Leave" : "Terminated";