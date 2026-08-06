import { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { loginStep1, loginStep2 } from "@/lib/authFlow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/blavia-logo.png";

const BRAND = "#0d1f2d";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ??
    "/home";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  // ── New: email-code verification step ──────────────────────
  const [step, setStep] = useState<"password" | "verify">("password");
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  if (!loading && user) {
    return <Navigate to={from === "/" ? "/home" : from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await loginStep1(email, password);
      toast({
        title: "Check your email",
        description: `We sent a verification code to ${email}.`,
      });
      setStep("verify");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setVerifying(true);
    try {
      await loginStep2(email, otp);
      toast({ title: "Welcome back!" });
      navigate(from === "/" ? "/home" : from, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid or expired code.";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
      setOtp("");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await loginStep1(email, password);
      toast({ title: "Code resent", description: `Check ${email} again.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not resend code.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast({ title: "Please enter your email", variant: "destructive" });
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Reset email sent!",
        description: "Check your inbox for a password reset link.",
      });
      setShowForgot(false);
      setForgotEmail("");
    } catch (err) {
      toast({ title: "Error sending reset email", variant: "destructive" });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: BRAND }}>
      <div className="w-full max-w-md space-y-8">

        {/* Logo + Header */}
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="BLAVIA" className="h-14 w-auto" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {step === "verify" ? "Check your email" : "Sign in to BLAVIA"}
          </h1>
          <p className="text-sm text-white/70">
            {step === "verify"
              ? `Enter the code we sent to ${email}`
              : "Welcome back. Enter your credentials."}
          </p>
        </div>

        {step === "verify" ? (
          // ── Email Code Verification ─────────────────────────
          <form
            onSubmit={handleVerify}
            className="space-y-4 rounded-xl border bg-white p-6 shadow-xl"
            style={{ borderColor: `${BRAND}20` }}
          >
            <div className="flex justify-center py-2">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              className="w-full text-white hover:opacity-90"
              style={{ background: BRAND }}
              disabled={verifying || otp.length < 6}
            >
              {verifying ? "Verifying…" : "Verify & Sign in"}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("password");
                  setOtp("");
                }}
                className="text-muted-foreground hover:underline"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="hover:underline"
                style={{ color: BRAND }}
              >
                {resending ? "Resending…" : "Resend code"}
              </button>
            </div>
          </form>
        ) : !showForgot ? (
          // ── Login Form ──────────────────────────────────────
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border bg-white p-6 shadow-xl"
            style={{ borderColor: `${BRAND}20` }}
          >
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs hover:underline"
                  style={{ color: BRAND }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
              {submitting ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-medium hover:underline"
                style={{ color: BRAND }}
              >
                Sign up
              </Link>
            </p>
          </form>
        ) : (
          // ── Forgot Password Form ────────────────────────────
          <form
            onSubmit={handleForgotPassword}
            className="space-y-4 rounded-xl border bg-white p-6 shadow-xl"
            style={{ borderColor: `${BRAND}20` }}
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold" style={{ color: BRAND }}>
                Reset your password
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <Button
              type="submit"
              className="w-full text-white hover:opacity-90"
              style={{ background: BRAND }}
              disabled={sendingReset}
            >
              {sendingReset ? "Sending…" : "Send reset link"}
            </Button>

            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="w-full text-center text-sm text-muted-foreground hover:underline"
            >
              ← Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;