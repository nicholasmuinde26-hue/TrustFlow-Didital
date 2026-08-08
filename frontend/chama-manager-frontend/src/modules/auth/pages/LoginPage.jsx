import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import useAuth from "@/app/hooks/useAuth";
import AuthLayout from "@/layouts/AuthLayout";
import AuthCard from "@/modules/auth/components/AuthCard";
import PasswordInput from "@/modules/auth/components/PasswordInput";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";

export default function LoginPage() {
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState("credentials");

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || "/home";

  // ------------------------------------------------------------------
  // STEP 1: Verify Phone + Password (Triggers SMS OTP)
  // ------------------------------------------------------------------
  async function handleCredentialsSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const res = await login({ phone, password });

      if (res?.otpRequired) {
        // Crucial: Sync state with the exact formatted phone returned by backend
        const activePhone = res.phone || phone;
        setPhone(activePhone);

        setNotice(
          res?.message || `Password verified! Security OTP sent via SMS to ${activePhone}`
        );
        setStep("otp");
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Invalid phone number or password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------------
  // STEP 2: Verify 6-Digit SMS OTP & Finalize Login
  // ------------------------------------------------------------------
  async function handleOtpSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await verifyOtp({ phone, otpCode: otpCode.trim() });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message || "Invalid or expired OTP code."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Resend OTP trigger
  async function handleResendOtp() {
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const res = await login({ phone, password });
      if (res?.phone) setPhone(res.phone);
      setNotice(res?.message || `A new OTP code has been sent to ${res?.phone || phone}`);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to resend OTP code."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <h2 className="text-2xl font-bold">
          {step === "credentials" ? "Welcome Back" : "Security Verification"}
        </h2>
        
        <p className="mt-1 text-slate-500">
          {step === "credentials"
            ? "Sign in with your phone number and password"
            : `Enter the 6-digit security code sent to ${phone}`}
        </p>

        {/* Status Alerts */}
        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        {/* STEP 1 FORM: Phone Number + Password */}
        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="mt-6 space-y-4">
            <Input
              label="Phone Number"
              type="tel"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712345678"
              autoComplete="tel"
              required
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <PasswordInput
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Verifying Credentials..." : "Continue to Verification"}
            </Button>
          </form>
        )}

        {/* STEP 2 FORM: Mandatory 6-Digit SMS OTP Code */}
        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
            <Input
              label="6-Digit Security OTP"
              type="text"
              name="otpCode"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="text-center font-mono text-xl tracking-widest"
              required
            />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Verifying Code..." : "Verify & Sign In"}
            </Button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={submitting}
                className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400 disabled:opacity-50"
              >
                Resend OTP
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setError("");
                  setNotice("");
                }}
                className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Change Phone or Password
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-primary">
            Create one
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}