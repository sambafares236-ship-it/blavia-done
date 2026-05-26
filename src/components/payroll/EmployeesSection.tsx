import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Pencil,
  Plus,
  PowerOff,
  Search,
  UserMinus,
  Users,
  Wallet,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { fmtKES, type Employee } from "@/lib/employees";
import {
  EmployeeStatusBadge,
  PaymentMethodBadge,
} from "@/components/employees/EmployeeBadges";
import { EmployeeFormDialog } from "@/components/employees/EmployeeFormDialog";
import { EmployeeViewDialog } from "@/components/employees/EmployeeViewDialog";

type SortKey = "employee_id" | "full_name" | "basic_salary";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

interface Props {
  /** Optional callback when user clicks "View payslips" on a row */
  onViewPayslips?: (employeeId: string) => void;
}

export const EmployeesSection = ({ onViewPayslips }: Props) => {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("employee_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({
        title: "Couldn't load employees",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setRows((data ?? []) as Employee[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("employees-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departments = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.department && set.add(r.department));
    return Array.from(set).sort();
  }, [rows]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active");
    const onLeave = rows.filter((r) => r.status === "on_leave").length;
    const payroll = active.reduce((s, r) => s + (Number(r.basic_salary) || 0), 0);
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const newHires = rows.filter(
      (r) => r.hire_date && new Date(r.hire_date) >= start,
    ).length;
    return { total: active.length, onLeave, payroll, newHires };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (deptFilter !== "all" && (r.department ?? "") !== deptFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.employee_id ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, deptFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "basic_salary") {
        av = Number(a.basic_salary) || 0;
        bv = Number(b.basic_salary) || 0;
      } else {
        av = (a[sortKey] ?? "") as string;
        bv = (b[sortKey] ?? "") as string;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, deptFilter, statusFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? (
        <ChevronUp className="ml-1 inline h-3 w-3" />
      ) : (
        <ChevronDown className="ml-1 inline h-3 w-3" />
      )
    ) : null;

  const exportCsv = () => {
    const headers = [
      "employee_id",
      "full_name",
      "email",
      "phone",
      "department",
      "position",
      "basic_salary",
      "payment_method",
      "status",
      "hire_date",
    ];
    const lines = [headers.join(",")];
    sorted.forEach((r) => {
      const row = headers.map((h) => {
        const v = (r as unknown as Record<string, unknown>)[h];
        const s = v == null ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      });
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deactivate = async (e: Employee, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!confirm(`Mark ${e.full_name} as terminated?`)) return;
    const { error } = await supabase
      .from("employees")
      .update({ status: "terminated" })
      .eq("id", e.id);
    if (error) {
      toast({
        title: "Couldn't update status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Employee marked as terminated" });
      load();
    }
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {sorted.length} of {rows.length} employee{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, ID, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8"
            />
          </div>
          <Button variant="outline" onClick={exportCsv} className="gap-2 rounded-lg">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Employees"
          value={String(stats.total)}
          icon={Users}
          tone="navy"
          loading={loading}
          hint="Active"
        />
        <KpiCard
          label="On Leave"
          value={String(stats.onLeave)}
          icon={UserMinus}
          tone="warning"
          loading={loading}
        />
        <KpiCard
          label="Monthly Payroll"
          value={fmtKES(stats.payroll)}
          icon={Wallet}
          tone="success"
          loading={loading}
          hint="Sum of basic salaries"
        />
        <KpiCard
          label="This Month's Hires"
          value={String(stats.newHires)}
          icon={CalendarPlus}
          tone="success"
          loading={loading}
        />
      </section>

      {/* Filters + Table */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead
                  onClick={() => toggleSort("employee_id")}
                  className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Employee ID <SortIcon k="employee_id" />
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("full_name")}
                  className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Name <SortIcon k="full_name" />
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Department
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Position
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("basic_salary")}
                  className="cursor-pointer select-none text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Basic Salary <SortIcon k="basic_salary" />
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Payment
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!loading && pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No employees match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setViewing(r);
                    setViewOpen(true);
                  }}
                >
                  <TableCell className="font-mono text-xs">
                    {r.employee_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                        {initials(r.full_name) || "?"}
                      </div>
                      <div className="leading-tight">
                        <div className="text-sm font-medium">{r.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.phone}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{r.department ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.position ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {fmtKES(r.basic_salary)}
                  </TableCell>
                  <TableCell>
                    <PaymentMethodBadge method={r.payment_method} />
                  </TableCell>
                  <TableCell>
                    <EmployeeStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit"
                        onClick={() => {
                          setEditing(r);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="View payslips"
                        onClick={() => onViewPayslips?.(r.id)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Deactivate"
                        onClick={(e) => deactivate(r, e)}
                        disabled={r.status === "terminated"}
                      >
                        <PowerOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {pageCount > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                />
              </PaginationItem>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <PaginationItem key={n}>
                  <PaginationLink
                    href="#"
                    isActive={n === currentPage}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(n);
                    }}
                  >
                    {n}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.min(pageCount, p + 1));
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </section>

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing}
        onSaved={load}
      />
      <EmployeeViewDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        employee={viewing}
        onEdit={() => {
          setEditing(viewing);
          setViewOpen(false);
          setFormOpen(true);
        }}
      />
    </div>
  );
};
