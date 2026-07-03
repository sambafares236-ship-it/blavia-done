import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Index from "./pages/Index.tsx";
import ExecutiveDashboard from "./pages/ExecutiveDashboard.tsx";
import Analytics from "./pages/Analytics.tsx";
import Payroll from "./pages/Payroll.tsx";
import Reports from "./pages/Reports.tsx";
import Payments from "./pages/Payments.tsx";
import Tax from "./pages/Tax.tsx";
import BalanceSheet from "./pages/BalanceSheet.tsx";
import ScheduledExpenses from "./pages/ScheduledExpenses.tsx";
import Settings from "./pages/Settings.tsx";
import EtimsSettings from "./pages/EtimsSettings.tsx";
import MpesaSettings from "./pages/MpesaSettings.tsx";
import Invoices from "./pages/Invoices.tsx";
import Receivables from "./pages/Receivables.tsx";
import Payables from "./pages/Payables.tsx";
import CreateInvoice from "./pages/CreateInvoice.tsx";
import InvoiceDetail from "./pages/InvoiceDetail.tsx";
import PublicPayInvoice from "./pages/PublicPayInvoice.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public � no login required */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/pay/:id" element={<PublicPayInvoice />} />

            {/* Protected */}
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/executive" element={<ProtectedRoute><ExecutiveDashboard /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
            <Route path="/tax" element={<ProtectedRoute><Tax /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/balance-sheet" element={<ProtectedRoute><BalanceSheet /></ProtectedRoute>} />
            <Route path="/scheduled-expenses" element={<ProtectedRoute><ScheduledExpenses /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/etims-settings" element={<ProtectedRoute><EtimsSettings /></ProtectedRoute>} />
            <Route path="/mpesa-settings" element={<ProtectedRoute><MpesaSettings /></ProtectedRoute>} />

            {/* Invoice Routes */}
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
            <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
            <Route path="/receivables" element={<ProtectedRoute><Receivables /></ProtectedRoute>} />
            <Route path="/payables" element={<ProtectedRoute><Payables /></ProtectedRoute>} />

            {/* Legacy redirects */}
            <Route path="/transactions" element={<Navigate to="/payments" replace />} />
            <Route path="/employees" element={<Navigate to="/payroll?tab=employees" replace />} />
            <Route path="/payslips" element={<Navigate to="/payroll?tab=payslips" replace />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;