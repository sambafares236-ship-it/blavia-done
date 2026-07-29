import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  EmployeeStatusBadge,
  PaymentMethodBadge,
} from "./EmployeeBadges";
import { fmtKES, type Employee } from "@/lib/employees";
import { Pencil, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: Employee | null;
  onEdit: () => void;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value || "—"}</span>
  </div>
);

export const EmployeeViewDialog = ({ open, onOpenChange, employee, onEdit }: Props) => {
  const navigate = useNavigate();
  if (!employee) return null;

  const initials = employee.full_name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Employee details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-shield text-sm font-semibold text-shield-foreground">
              {initials || "?"}
            </div>
            <div>
              <div className="text-base font-semibold">{employee.full_name}</div>
              <div className="text-xs text-muted-foreground">
                {employee.position || "—"}
                {employee.department ? ` · ${employee.department}` : ""}
              </div>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              <EmployeeStatusBadge status={employee.status} />
              <PaymentMethodBadge method={employee.payment_method} />
            </div>
          </div>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Personal
            </h3>
            <Row label="Employee ID" value={employee.id.slice(0, 8)} />
            <Row label="Email" value={employee.email} />
            <Row label="Phone" value={employee.phone} />
            <Row label="ID Number" value={employee.id_number} />
            <Row label="KRA PIN" value={employee.kra_pin} />
            <Row label="NSSF" value={employee.nssf_number} />
            <Row label="NHIF / SHIF" value={employee.nhif_number} />
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Compensation
            </h3>
            <Row label="Basic salary" value={fmtKES(employee.basic_salary)} />
            <Row
              label="Allowances"
              value={
                employee.allowances && Object.keys(employee.allowances).length ? (
                  <pre className="whitespace-pre-wrap text-right font-mono text-xs">
                    {JSON.stringify(employee.allowances, null, 2)}
                  </pre>
                ) : (
                  "—"
                )
              }
            />
            <Row
              label="Deductions"
              value={
                employee.deductions && Object.keys(employee.deductions).length ? (
                  <pre className="whitespace-pre-wrap text-right font-mono text-xs">
                    {JSON.stringify(employee.deductions, null, 2)}
                  </pre>
                ) : (
                  "—"
                )
              }
            />
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment
            </h3>
            <Row label="Method" value={employee.payment_method} />
            <Row label="M-Pesa number" value={employee.mpesa_number} />
            <Row label="Bank name" value={employee.bank_name} />
            <Row label="Bank account" value={employee.bank_account} />
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Employment
            </h3>
            <Row label="Hire date" value={employee.hire_date} />
            <Row label="Department" value={employee.department} />
            <Row label="Position" value={employee.position} />
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              navigate(`/payslips?employee=${employee.id}`);
            }}
          >
            <FileText className="mr-1 h-4 w-4" />
            View payslip history
          </Button>
          <Button onClick={onEdit} className="bg-navy text-navy-foreground hover:bg-navy/90">
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};