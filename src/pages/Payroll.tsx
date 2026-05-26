import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, FileText, History as HistoryIcon, PlayCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeesSection } from "@/components/payroll/EmployeesSection";
import { PayslipsSection } from "@/components/payroll/PayslipsSection";
import { RunPayrollSection } from "@/components/payroll/RunPayrollSection";
import { PayrollHistorySection } from "@/components/payroll/PayrollHistorySection";
import { ChatbotWidget } from "@/components/dashboard/ChatbotWidget";

const Payroll = () => {
  const [params, setParams] = useSearchParams();
  const initialTab = params.get("tab") || "employees";
  const [tab, setTab] = useState(initialTab);
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(
    params.get("employee"),
  );

  const handleTabChange = (v: string) => {
    setTab(v);
    const next = new URLSearchParams(params);
    next.set("tab", v);
    if (v !== "payslips") next.delete("employee");
    setParams(next, { replace: true });
  };

  const viewPayslipsFor = (id: string) => {
    setEmployeeFilter(id);
    setTab("payslips");
    const next = new URLSearchParams();
    next.set("tab", "payslips");
    next.set("employee", id);
    setParams(next, { replace: true });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Payroll
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage employees, generate payslips, and run monthly payroll.
          </p>
        </header>

        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
            <TabsTrigger value="employees" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Users className="h-4 w-4" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="run" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <PlayCircle className="h-4 w-4" />
              Run Payroll
            </TabsTrigger>
            <TabsTrigger value="payslips" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />
              Payslips
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <HistoryIcon className="h-4 w-4" />
              Payroll History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="mt-0">
            <EmployeesSection onViewPayslips={viewPayslipsFor} />
          </TabsContent>
          <TabsContent value="run" className="mt-0">
            <RunPayrollSection />
          </TabsContent>
          <TabsContent value="payslips" className="mt-0">
            <PayslipsSection
              employeeId={employeeFilter}
              onClearFilter={() => {
                setEmployeeFilter(null);
                const next = new URLSearchParams();
                next.set("tab", "payslips");
                setParams(next, { replace: true });
              }}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            <PayrollHistorySection />
          </TabsContent>
        </Tabs>
      </div>

      <ChatbotWidget />
    </AppShell>
  );
};

export default Payroll;
