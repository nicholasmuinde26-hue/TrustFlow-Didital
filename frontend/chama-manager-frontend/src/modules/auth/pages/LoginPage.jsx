import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, Store, Wallet, ArrowRight } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import workspaceService from "@/app/services/workspace.service";

import AuthLayout from "@/layouts/AuthLayout";
import AuthCard from "@/modules/auth/components/AuthCard";
import PasswordInput from "@/modules/auth/components/PasswordInput";
import OtpChannelSelect from "@/modules/auth/components/OtpChannelSelect";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";

/* ============================================================
   WORKSPACE TYPE HELPERS — same normalization used across the
   workspace switcher / hub, so a workspace lands in the same
   bucket here as it does everywhere else.
============================================================ */

const TYPE_META = {
  chama: { label: "Chama", icon: Building2 },
  business: { label: "Business", icon: Store },
  contribution: { label: "Contribution Group", icon: Wallet },
};

function normalizeType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "business") return "business";
  if (t === "contribution-group" || t === "contribution_group" || t === "contribution") {
    return "contribution";
  }
  return "chama";
}

export default function LoginPage() {
  const { login, sendOtp, verifyOtp, getOtpChannels, setSuppressGuestRedirect } = useAuth();
  const { selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState("credentials");
  // "password" (default) verifies identifier + password before sending the
  // OTP. "otp-only" skips password entirely — for accounts that were
  // created for someone without setting a password yet (e.g. a treasurer
  // or committee member added while an admin approved a workspace
  // request), this is how they get in the first time.
  const [loginMode, setLoginMode] = useState("password");

  const [identifier, setIdentifier] = useState("");
  const [activeIdentifier, setActiveIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [channel, setChannel] = useState("sms");
  const [availableChannels, setAvailableChannels] = useState([
    { channel: "sms", label: "SMS" },
    { channel: "whatsapp", label: "WhatsApp" },
  ]);

  // Workspace-picker step (post-authentication) state
  const [myWorkspaces, setMyWorkspaces] = useState([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If the person was bounced here from a specific link (a join-link
  // token, a deep link to a particular page), honor that destination
  // instead of interrupting it with the workspace picker — the picker
  // only makes sense for a plain "sign in" with nowhere specific to go.
  const hasExplicitRedirect = Boolean(location.state?.from);

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
      const res =
        loginMode === "otp-only"
          ? await sendOtp({ identifier: identifier.trim(), channel })
          : await login({ identifier: identifier.trim(), password, channel });

      if (res?.otpRequired) {
        const usedIdentifier = res.channel === "email" ? (res.email || identifier) : (res.phone || res.identifier || identifier);
        setActiveIdentifier(usedIdentifier);
        if (res.channel) setChannel(res.channel);

        let noticeText = res?.message || `Security OTP sent to ${usedIdentifier}`;
        if (res?.devOtp) {
          noticeText += ` (Dev Code: ${res.devOtp})`;
          setOtpCode(res.devOtp);
        }
        setNotice(noticeText);
        setStep("otp");
      } else {
        await finishLogin();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          (loginMode === "otp-only" ? "Couldn't send a code to that phone/email." : "Invalid credentials or password.")
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

    // Block GuestRoute's own auto-redirect for the duration of this
    // flow — verifyOtp() below flips isAuthenticated true, and without
    // this GuestRoute would immediately send the person to /home
    // before finishLogin() gets to show the workspace picker.
    setSuppressGuestRedirect?.(true);

    try {
      const result = await verifyOtp({ identifier: activeIdentifier || identifier, otpCode: otpCode.trim() });
      const authedUser = result?.user;
      const isAdmin = authedUser?.systemRole === "super_admin" || authedUser?.systemRole === "sub_admin";

      if (hasExplicitRedirect) {
        navigate(redirectTo, { replace: true });
        return;
      }

      if (isAdmin) {
        navigate("/admin", { replace: true });
        return;
      }

      await finishLogin();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Invalid or expired OTP code."
      );
      // Safe to clear here: verifyOtp threw, so isAuthenticated never
      // flipped true and GuestRoute wouldn't have redirected anyway.
      // We deliberately do NOT clear this in the success path — if
      // finishLogin() landed on the workspace picker (still on this
      // page), clearing it here would let GuestRoute's redirect fire
      // immediately and yank the person to /home before they can use
      // the picker it just rendered.
      setSuppressGuestRedirect?.(false);
    } finally {
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------------
  // After credentials are fully verified: there's no homepage to land
  // on anymore, so — unless the person was headed somewhere specific —
  // pull their workspaces and let them pick exactly which one to open
  // straight into. Someone with none yet, or nowhere else to fetch
  // this from, just goes to /home (which onboards a brand-new user or
  // resolves a returning one on its own).
  // ------------------------------------------------------------------
  async function finishLogin() {
    if (hasExplicitRedirect) {
      navigate(redirectTo, { replace: true });
      return;
    }

    setWorkspacesLoading(true);

    try {
      const items = await workspaceService.getWorkspaces();

      if (!items.length) {
        navigate("/home", { replace: true });
        return;
      }

      setMyWorkspaces(items);
      if (items.length > 0) {
        setSelectedWorkspaceId(items[0].id ?? items[0]._id);
        setSelectedType(normalizeType(items[0].type));
      }
      setStep("workspace");
    } catch {

      // Couldn't fetch the list — fall back to the resolver, which
      // will fetch again and route the person in on its own.
      navigate("/home", { replace: true });
    } finally {
      setWorkspacesLoading(false);
    }
  }

  // ------------------------------------------------------------------
  // STEP 3: Choose which workspace to open into
  // ------------------------------------------------------------------
  function handleOpenWorkspace(event) {
    event.preventDefault();

    const workspace = myWorkspaces.find(
      (w) => String(w.id ?? w._id) === String(selectedWorkspaceId)
    );

    if (!workspace) {
      setError("Please choose a workspace to continue.");
      return;
    }

    selectWorkspace(workspace);

    const workspaceId = workspace.id ?? workspace._id;
    const type = normalizeType(workspace.type);

    navigate(type === "business" ? `/workspace/${workspaceId}/business` : `/workspace/${workspaceId}`, {
      replace: true,
    });
  }

  // Resend OTP trigger
  async function handleResendOtp() {
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const res =
        loginMode === "otp-only"
          ? await sendOtp({ identifier: activeIdentifier || identifier, channel })
          : await login({ identifier: activeIdentifier || identifier, password, channel });
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

  // Types the person actually has at least one workspace of — no
  // point offering "Business" in the dropdown if they don't have one.
  const availableTypes = Object.keys(TYPE_META).filter((type) =>
    myWorkspaces.some((w) => normalizeType(w.type) === type)
  );

  const workspacesOfSelectedType = myWorkspaces.filter(
    (w) => normalizeType(w.type) === selectedType
  );

  return (
    <AuthLayout>
      <AuthCard>
        <h2 className="text-2xl font-bold">
          {step === "credentials"
            ? "Welcome Back"
            : step === "otp"
            ? channel === "email"
              ? "Email Verification"
              : "Security Verification"
            : "Choose a Workspace"}
        </h2>

        <p className="mt-1 text-slate-500">
          {step === "credentials"
            ? "Sign in with your phone number or email address"
            : step === "otp"
            ? `Enter the 6-digit security code sent to ${activeIdentifier || identifier}`
            : "Pick which workspace you'd like to open."}
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

        {/* STEP 1 FORM: Phone Number or Email + Password (or OTP-only) */}
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

            {loginMode === "password" && (
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
            )}

            <OtpChannelSelect
              channels={availableChannels}
              value={channel}
              onChange={setChannel}
              disabled={submitting}
            />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? "Sending Code..."
                : loginMode === "otp-only"
                ? "Send Login Code"
                : "Continue to Verification"}
            </Button>

            <p className="text-center text-xs text-slate-500">
              {loginMode === "password" ? (
                <>
                  New to the platform, or don&apos;t have a password yet (e.g. you were just added as a
                  treasurer, secretary, or committee member)?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode("otp-only");
                      setError("");
                    }}
                    className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    Log in with a one-time code instead
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("password");
                    setError("");
                  }}
                  className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Have a password? Log in with it instead
                </button>
              )}
            </p>
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

            <Button type="submit" className="w-full" disabled={submitting || workspacesLoading}>
              {submitting || workspacesLoading ? "Verifying Code..." : "Verify & Sign In"}
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

        {/* STEP 3: WORKSPACE PICKER — appears only once credentials
            are fully verified, and only when the person wasn't
            already headed somewhere specific. Type dropdown first;
            the workspace dropdown only appears (and is only
        {/* STEP 3: WORKSPACE PICKER — appears once credentials
            and OTP are verified, listing all assigned Chamas / Workspaces. */}
        {step === "workspace" && (
          <form onSubmit={handleOpenWorkspace} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Select Your Chama / Workspace
              </label>
              <select
                value={selectedWorkspaceId}
                onChange={(e) => {
                  const wid = e.target.value;
                  setSelectedWorkspaceId(wid);
                  const match = myWorkspaces.find((w) => String(w.id ?? w._id) === String(wid));
                  if (match) setSelectedType(normalizeType(match.type));
                  setError("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 dark:bg-slate-900 text-sm font-medium"
                required
              >
                <option value="" disabled>
                  -- Choose Your Chama or Workspace --
                </option>
                {myWorkspaces.map((workspace) => {
                  const wid = workspace.id ?? workspace._id;
                  const typeLabel = TYPE_META[normalizeType(workspace.type)]?.label || "Chama";
                  const roleLabel = workspace.role ? ` — ${workspace.role.replace(/_/g, " ")}` : "";
                  return (
                    <option key={wid} value={wid}>
                      [{typeLabel}] {workspace.name}{roleLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            {availableTypes.length > 1 && (
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-400">Filter:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedType("");
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                    !selectedType ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  All ({myWorkspaces.length})
                </button>
                {availableTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setSelectedType(type);
                      const firstOfType = myWorkspaces.find((w) => normalizeType(w.type) === type);
                      if (firstOfType) setSelectedWorkspaceId(firstOfType.id ?? firstOfType._id);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                      selectedType === type ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {TYPE_META[type].label}
                  </button>
                ))}
              </div>
            )}

            <Button type="submit" className="w-full mt-2" disabled={!selectedWorkspaceId}>
              Enter Workspace
              <ArrowRight size={16} />
            </Button>
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