import { cn } from "@/lib/utils";
import {
  employeeStatusLabel,
  type EmployeeStatus,
  type PaymentMethod,
} from "@/lib/employees";

export const EmployeeStatusBadge = ({ status }: { status: EmployeeStatus }) => {
  const styles: Record<EmployeeStatus, string> = {
    active: "bg-success/15 text-success border border-success/30",
    on_leave: "bg-shield/15 text-shield border border-shield/30",
    terminated: "bg-destructive/15 text-destructive border border-destructive/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {employeeStatusLabel(status)}
    </span>
  );
};

export const PaymentMethodBadge = ({ method }: { method: PaymentMethod }) => {
  const styles: Record<PaymentMethod, string> = {
    "M-Pesa": "bg-success/15 text-success border border-success/30",
    Bank: "bg-shield/15 text-shield border border-shield/30",
    Cash: "bg-muted text-muted-foreground border border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[method] ?? "bg-muted text-muted-foreground",
      )}
    >
      {method}
    </span>
  );
};
