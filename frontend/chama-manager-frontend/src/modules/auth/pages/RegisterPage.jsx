import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import useAuth from "@/app/hooks/useAuth";
import AuthLayout from "@/layouts/AuthLayout";
import AuthCard from "@/modules/auth/components/AuthCard";
import PasswordInput from "@/modules/auth/components/PasswordInput";
import OtpChannelSelect from "@/modules/auth/components/OtpChannelSelect";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";

export default function RegisterPage() {
  const { register, verifyOtp, sendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Registration Steps: "register" (Step 1) | "otp" (Step 2)
  const [step, setStep] = useState("register");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [otpCode, setOtpCode] = useState("");
  const [channel, setChannel] = useState("sms");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Preserve the full path INCLUDING query string (e.g. a Chama
  // join-link's ?token=...) — dropping .search here would silently
  // strip the token and break the join-link flow after registering.
  const redirectTo = location.state?.from
    ? `${location.state.from.pathname || "/home"}${location.state.from.search || ""}`
    : "/home";

  // SMS & WhatsApp ride on the phone number (always offered once one's
  // entered); Email only shows up once the user has typed one in.
  const availableChannels = [
    { channel: "sms", label: "SMS" },
    { channel: "whatsapp", label: "WhatsApp" },
    ...(form.email.trim() ? [{ channel: "email", label: "Email" }] : []),
  ];

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // If the user clears the email field while "email" is selected,
    // fall back to SMS rather than submitting with a dead channel.
    if (name === "email" && !value.trim() && channel === "email") {
      setChannel("sms");
    }
  }

  // ------------------------------------------------------------------
  // STEP 1: Submit Registration Form (Triggers OTP)
  // ------------------------------------------------------------------
  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (channel === "email" && !form.email.trim()) {
      setError("Please provide an email address to receive your security code via Email.");
      return;
    }

    if (form.email.trim()) {
      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!EMAIL_REGEX.test(form.email.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await register({
        name: form.name,
        phone: form.phone,
        email: form.email.trim() || undefined,
        password: form.password,
        channel,
      });

      if (res?.otpRequired) {
        if (res.phone) {
          setForm((prev) => ({ ...prev, phone: res.phone }));
        }
        if (res.channel) setChannel(res.channel);

        const dest = res.channel === "email" ? (res.email || form.email) : (res.phone || form.phone);
        setNotice(
          res?.message || `Account created! Security OTP code sent to ${dest}`
        );
        setStep("otp");
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not create your account."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------------
  // STEP 2: Verify 6-Digit OTP & Activate Account
  // ------------------------------------------------------------------
  async function handleOtpSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const identifier = channel === "email" && form.email.trim() ? form.email.trim() : form.phone;
      await verifyOtp({ identifier, phone: form.phone, email: form.email, otpCode });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message || "Invalid or expired OTP code."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Resend OTP code
  async function handleResendOtp() {
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const identifier = channel === "email" && form.email.trim() ? form.email.trim() : form.phone;
      const res = await sendOtp({ identifier, phone: form.phone, email: form.email, channel });
      const dest = channel === "email" ? form.email : form.phone;
      setNotice(res?.message || `A new OTP code has been sent to ${dest}`);
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
          {step === "register" ? "Create Account" : channel === "email" ? "Email Verification" : "Phone Verification"}
        </h2>

        <p className="mt-1 text-slate-500">
          {step === "register"
            ? "Start managing your Chama today"
            : `Enter the 6-digit security code sent to ${channel === "email" ? form.email : form.phone}`}
        </p>

        {/* Status Alerts & Notifications */}
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

        {/* STEP 1 FORM: Registration Form */}
        {step === "register" && (
          <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
            <Input
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Jane Wanjiru"
              autoComplete="name"
              required
            />

            <Input
              label="Phone Number"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="0712345678"
              autoComplete="tel"
              required
            />

            <Input
              label="Email Address"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="jane@example.com"
              autoComplete="email"
              required={channel === "email"}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <PasswordInput
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <PasswordInput
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password"
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
              {submitting ? "Creating account..." : "Create Account & Send OTP"}
            </Button>
          </form>
        )}

        {/* STEP 2 FORM: Mandatory 6-Digit Security OTP Verification */}
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
              {submitting ? "Verifying Code..." : "Verify & Activate Account"}
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
                  setStep("register");
                  setError("");
                  setNotice("");
                }}
                className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Change Registration Details
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}