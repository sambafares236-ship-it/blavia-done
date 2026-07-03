import { useState, FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Mail, RefreshCw } from "lucide-react";
import logo from "@/assets/blavia-logo.png";

const BRAND = "#0d1f2d";

const Signup = () => {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: fullName,
          company_name: companyName,
          phone,
        },
      },
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setSubmittedEmail(email);
  };

  const handleResend = async () => {
    if (!submittedEmail) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: submittedEmail });
    setResending(false);
    if (error) {
      toast({ title: "Couldn't resend email", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Confirmation email resent" });
    }
  };

  if (submittedEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md space-y-6 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl p-2"
            style={{ background: BRAND }}
          >
            <img src={logo} alt="BLAVIA" className="h-full w-full object-contain" />
          </div>
          <div className="rounded-xl border bg-card p-8 shadow-sm" style={{ borderColor: `${BRAND}20` }}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mt-4 text-xl font-bold" style={{ color: BRAND }}>Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to <span className="font-medium text-foreground">{submittedEmail}</span>.
              Click it to activate your account — you'll be taken straight into BLAVIA to finish setting up your business.
            </p>
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={resending}
              className="mt-6 gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Resending…" : "Resend email"}
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
              Wrong email?{" "}
              <button
                onClick={() => setSubmittedEmail(null)}
                className="font-medium hover:underline"
                style={{ color: BRAND }}
              >
                Go back
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-8">

        {/* Logo + Header */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl p-2"
            style={{ background: BRAND }}
          >
            <img src={logo} alt="BLAVIA" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: BRAND }}>
            Create your BLAVIA account
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage payments, payroll, tax, and reports.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
          style={{ borderColor: `${BRAND}20` }}
        >
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Kamau"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company</Label>
            <Input
              id="companyName"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Kamau Enterprises Ltd"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254700000000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full text-white hover:opacity-90"
            style={{ background: BRAND }}
            disabled={submitting}
          >
            {submitting ? "Creating account…" : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium hover:underline"
              style={{ color: BRAND }}
            >
              Sign in
            </Link>
          </p>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to our{" "}
          <span className="font-medium cursor-pointer hover:underline" style={{ color: BRAND }}>
            Terms of Service
          </span>{" "}
          and{" "}
          <span className="font-medium cursor-pointer hover:underline" style={{ color: BRAND }}>
            Privacy Policy
          </span>
        </p>
      </div>
    </div>
  );
};

export default Signup;