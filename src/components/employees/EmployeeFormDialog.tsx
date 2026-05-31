import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  employeeFormSchema,
  type Employee,
  type EmployeeFormValues,
} from "@/lib/employees";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

interface LineItem { label: string; amount: string; }

function LineItemEditor({ title, items, onChange }: {
  title: string; items: LineItem[]; onChange: (items: LineItem[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  const add = () => {
    if (!label.trim() || !amount) return;
    onChange([...items, { label: label.trim(), amount }]);
    setLabel(""); setAmount("");
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{title}</Label>
      {items.length > 0 && (
        <div className="rounded-md border divide-y">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{it.label}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono">KES {Number(it.amount).toLocaleString()}</span>
                <button type="button" onClick={() => remove(i)}
                  className="text-destructive hover:opacity-70">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input className="flex-1"
          placeholder={title === "Allowances" ? "e.g. Housing allowance" : "e.g. PAYE tax"}
          value={label} onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        <Input className="w-32" type="number" placeholder="Amount"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        <Button type="button" size="icon" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">No {title.toLowerCase()} added yet.</p>
      )}
    </div>
  );
}

const toItems = (obj: Record<string, number> | null | undefined): LineItem[] =>
  Object.entries(obj ?? {}).map(([label, amount]) => ({ label, amount: String(amount) }));

const toRecord = (items: LineItem[]): Record<string, number> =>
  Object.fromEntries(items.map((it) => [it.label, Number(it.amount) || 0]));

const empty: EmployeeFormValues = {
  full_name: "", email: "", phone: "",
  id_number: "", kra_pin: "", nssf_number: "", nhif_number: "",
  basic_salary: "",
  allowances_json: "{}", deductions_json: "{}",
  payment_method: "M-Pesa", mpesa_number: "",
  bank_account: "", department: "", position: "",
  hire_date: "", status: "active",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee?: Employee | null;
  onSaved?: () => void;
}

export const EmployeeFormDialog = ({ open, onOpenChange, employee, onSaved }: Props) => {
  const isEdit = !!employee;

  const defaults = useMemo<EmployeeFormValues>(() => {
    if (!employee) return empty;
    return {
      full_name: employee.full_name ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      id_number: employee.id_number ?? "",
      kra_pin: employee.kra_pin ?? "",
      nssf_number: employee.nssf_number ?? "",
      nhif_number: employee.nhif_number ?? "",
      basic_salary: employee.basic_salary != null ? String(employee.basic_salary) : "",
      allowances_json: JSON.stringify(employee.allowances ?? {}),
      deductions_json: JSON.stringify(employee.deductions ?? {}),
      payment_method: employee.payment_method ?? "M-Pesa",
      mpesa_number: employee.mpesa_number ?? "",
      bank_account: employee.bank_account ?? "",
      department: employee.department ?? "",
      position: employee.position ?? "",
      hire_date: employee.hire_date ?? "",
      status: employee.status ?? "active",
    };
  }, [employee]);

  const {
    register, handleSubmit, control, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: defaults,
  });

  const [allowances, setAllowances] = useState<LineItem[]>([]);
  const [deductions, setDeductions] = useState<LineItem[]>([]);

  useEffect(() => {
    if (open) {
      reset(defaults);
      setAllowances(toItems(employee?.allowances));
      setDeductions(toItems(employee?.deductions));
    }
  }, [open, defaults, reset, employee]);

  const paymentMethod = watch("payment_method");
  const basicSalary = Number(watch("basic_salary") || 0);
  const totalAllowances = allowances.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalDeductions = deductions.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const netPay = basicSalary + totalAllowances - totalDeductions;

  const onSubmit = handleSubmit(async (parsed) => {
    const payload = {
      full_name: parsed.full_name,
      email: parsed.email || null,
      phone: parsed.phone,
      id_number: parsed.id_number || null,
      kra_pin: parsed.kra_pin || null,
      nssf_number: parsed.nssf_number || null,
      nhif_number: parsed.nhif_number || null,
      basic_salary: Number(parsed.basic_salary) || 0,
      allowances: toRecord(allowances),
      deductions: toRecord(deductions),
      payment_method: parsed.payment_method,
      mpesa_number: parsed.mpesa_number || null,
      bank_account: parsed.bank_account || null,
      department: parsed.department || null,
      position: parsed.position || null,
      hire_date: parsed.hire_date || null,
      status: parsed.status,
    };

    const { error } = isEdit
      ? await supabase.from("employees").update(payload).eq("id", employee!.id)
      : await supabase.from("employees").insert(payload);

    if (error) {
      let msg = "Something went wrong. Please try again.";
      if (error.message.includes("phone")) msg = "Please check the phone number (+254XXXXXXXXX).";
      if (error.message.includes("salary") || error.message.includes("numeric"))
        msg = "Please enter a valid salary amount.";
      if (error.message.includes("duplicate") || error.message.includes("unique"))
        msg = "An employee with this information already exists.";
      toast({
        title: isEdit ? "Couldn't update employee" : "Couldn't add employee",
        description: msg, variant: "destructive",
      });
      return;
    }
    toast({ title: isEdit ? "Employee updated ✓" : "Employee added ✓" });
    onOpenChange(false);
    onSaved?.();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            Fields marked with <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Tabs defaultValue="personal">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="compensation">Compensation</TabsTrigger>
              <TabsTrigger value="payment">Payment</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-3 pt-3">
              <Field label="Full name" required error={errors.full_name?.message}>
                <Input placeholder="e.g. Jane Wanjiku" {...register("full_name")} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email" error={errors.email?.message}>
                  <Input type="email" placeholder="jane@company.com" {...register("email")} />
                </Field>
                <Field label="Phone" required error={errors.phone?.message}>
                  <Input placeholder="+254712345678" {...register("phone")} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="National ID number" error={errors.id_number?.message}>
                  <Input placeholder="12345678" {...register("id_number")} />
                </Field>
                <Field label="KRA PIN" error={errors.kra_pin?.message}>
                  <Input placeholder="A123456789B" {...register("kra_pin")} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="NSSF number" error={errors.nssf_number?.message}>
                  <Input {...register("nssf_number")} />
                </Field>
                <Field label="NHIF / SHIF number" error={errors.nhif_number?.message}>
                  <Input {...register("nhif_number")} />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="compensation" className="space-y-4 pt-3">
              <Field label="Basic salary (KES)" required error={errors.basic_salary?.message}>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 50000"
                  {...register("basic_salary")}
                />
              </Field>
              <LineItemEditor title="Allowances" items={allowances} onChange={setAllowances} />
              <LineItemEditor title="Deductions" items={deductions} onChange={setDeductions} />
              {basicSalary > 0 && (
                <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Basic salary</span>
                    <span className="font-mono">KES {basicSalary.toLocaleString()}</span>
                  </div>
                  {totalAllowances > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>+ Allowances</span>
                      <span className="font-mono">KES {totalAllowances.toLocaleString()}</span>
                    </div>
                  )}
                  {totalDeductions > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>- Deductions</span>
                      <span className="font-mono">KES {totalDeductions.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span>Net pay</span>
                    <span className="font-mono">KES {netPay.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="payment" className="space-y-3 pt-3">
              <Field label="Payment method" required error={errors.payment_method?.message}>
                <Controller control={control} name="payment_method"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange}
                      className="flex flex-wrap gap-4">
                      {(["M-Pesa", "Bank", "Cash"] as const).map((m) => (
                        <label key={m}
                          className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                          <RadioGroupItem value={m} id={`pm-${m}`} /> {m}
                        </label>
                      ))}
                    </RadioGroup>
                  )} />
              </Field>
              {paymentMethod === "M-Pesa" && (
                <Field label="M-Pesa number" required error={errors.mpesa_number?.message}>
                  <Input placeholder="+254712345678" {...register("mpesa_number")} />
                </Field>
              )}
              {paymentMethod === "Bank" && (
                <Field label="Bank account number" required error={errors.bank_account?.message}>
                  <Input placeholder="e.g. 1234567890" {...register("bank_account")} />
                </Field>
              )}
            </TabsContent>

            <TabsContent value="employment" className="space-y-3 pt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Department" error={errors.department?.message}>
                  <Input placeholder="e.g. Finance" {...register("department")} />
                </Field>
                <Field label="Job title / Position" error={errors.position?.message}>
                  <Input placeholder="e.g. Accountant" {...register("position")} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Hire date" error={errors.hire_date?.message}>
                  <Input type="date" {...register("hire_date")} />
                </Field>
                <Field label="Status" error={errors.status?.message}>
                  <Controller control={control} name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on_leave">On Leave</SelectItem>
                          <SelectItem value="terminated">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
                    )} />
                </Field>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium">
      {label}{required && <span className="text-destructive"> *</span>}
    </Label>
    {children}
    {error && <p className="text-[11px] text-destructive">{error}</p>}
  </div>
);