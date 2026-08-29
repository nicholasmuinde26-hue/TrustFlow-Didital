import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import useAuth from "@/app/hooks/useAuth";
import AuthLayout from "@/layouts/AuthLayout";
import AuthCard from "@/modules/auth/components/AuthCard";
import PasswordInput from "@/modules/auth/components/PasswordInput";
import OtpChannelSelect from "@/modules/auth/components/OtpChannelSelect";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";

export default function LoginPage() {
  const { login, verifyOtp, getOtpChannels } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState("credentials");

  const [identifier, setIdentifier] = useState("");
  const [activeIdentifier, setActiveIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [channel, setChannel] = useState("sms");
  const [availableChannels, setAvailableChannels] = useState([
    { channel: "sms", label: "SMS" },
    { channel: "whatsapp", label: "WhatsApp" },
  ]);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Preserve the full path INCLUDING query string (e.g. a Chama
  // join-link's ?token=...) — dropping .search here would silently
  // strip the token and break the join-link flow after login.
  const redirectTo = location.state?.from
    ? `${location.state.from.pathname || "/home"}${location.state.from.search || ""}`
    : "/home";

  // Look up which channels this phone or email can receive an OTP on
  useEffect(() => {
    const trimmed = identifier.trim();
    if (trimmed.length < 5) return;

    // If typing an email, default channel option to email
    if (trimmed.includes("@")) {
      setAvailableChannels((prev) => {
        if (!prev.some((c) => c.channel === "email")) {
          return [{ channel: "email", label: "Email" }, ...prev];
        }
        return prev;
      });
      setChannel("email");
    }

    const timer = setTimeout(async () => {
      try {
        const res = await getOtpChannels(trimmed);
        if (res?.availableChannels?.length) {
          setAvailableChannels(res.availableChannels);
          if (!res.availableChannels.some((c) => c.channel === channel)) {
            setChannel(res.availableChannels[0].channel);
          }
        }
      } catch {
        // Silently keep current options if lookup fails
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier]);

  // ------------------------------------------------------------------
  // STEP 1: Verify Identifier (Phone or Email) + Password (Triggers OTP)
  // ------------------------------------------------------------------
  async function handleCredentialsSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!identifier.trim()) {
      setError("Please enter your phone number or email address.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await login({ identifier: identifier.trim(), password, channel });

      if (res?.otpRequired) {
        const usedIdentifier = res.channel === "email" ? (res.email || identifier) : (res.phone || res.identifier || identifier);
        setActiveIdentifier(usedIdentifier);
        if (res.channel) setChannel(res.channel);

        setNotice(
          res?.message || `Password verified! Security OTP sent to ${usedIdentifier}`
        );
        setStep("otp");
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Invalid credentials or password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------------
  // STEP 2: Verify 6-Digit Security OTP & Finalize Login
  // ------------------------------------------------------------------
  async function handleOtpSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await verifyOtp({ identifier: activeIdentifier || identifier, otpCode: otpCode.trim() });
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
      const res = await login({ identifier: activeIdentifier || identifier, password, channel });
      const usedDest = channel === "email" ? (res.email || activeIdentifier) : (res.phone || activeIdentifier);
      setNotice(res?.message || `A new OTP code has been sent to ${usedDest}`);
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
          {step === "credentials"
            ? "Welcome Back"
            : channel === "email"
            ? "Email Verification"
            : "Security Verification"}
        </h2>
        
        <p className="mt-1 text-slate-500">
          {step === "credentials"
            ? "Sign in with your phone number or email address"
            : `Enter the 6-digit security code sent to ${activeIdentifier || identifier}`}
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

        {/* STEP 1 FORM: Phone Number or Email + Password */}
        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="mt-6 space-y-4">
            <Input
              label="Phone Number or Email Address"
              type="text"
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="0712345678 or user@example.com"
              autoComplete="username"
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

            <OtpChannelSelect
              channels={availableChannels}
              value={channel}
              onChange={setChannel}
              disabled={submitting}
            />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Verifying Credentials..." : "Continue to Verification"}
            </Button>
          </form>
        )}

        {/* STEP 2 FORM: Mandatory 6-Digit Security OTP Code */}
        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
            <Input
              label={`6-Digit Security Code (${channel === "email" ? "Email" : "SMS/WhatsApp"})`}
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
                Change Login Details
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