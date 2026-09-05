import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Store,
  Wallet,
  ArrowRight,
  PlusCircle,
  KeyRound,
  Users,
  Sparkles,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import workspaceService from "@/app/services/workspace.service";

import AuthLayout from "@/layouts/AuthLayout";
import AuthCard from "@/modules/auth/components/AuthCard";
import PasswordInput from "@/modules/auth/components/PasswordInput";
import OtpChannelSelect from "@/modules/auth/components/OtpChannelSelect";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";
import WorkspaceRequestModal from "@/modules/workspaces/components/WorkspaceRequestModal";

/* ============================================================
   WORKSPACE TYPE HELPERS — same normalization used on LoginPage
   and across the workspace switcher / hub, so a workspace lands
   in the same bucket here as it does everywhere else.
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

export default function RegisterPage() {
  const { register, verifyOtp, sendOtp, setSuppressGuestRedirect } = useAuth();
  const { selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  // Registration Steps: "register" (Step 1) | "otp" (Step 2) | "workspace" (Step 3)
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

  // Workspace-picker step (post-verification) state — mirrors LoginPage's
  // step 3 exactly, for someone who registered but already belongs to a
  // workspace (e.g. auto-added via a join-link/invite during signup).
  const [myWorkspaces, setMyWorkspaces] = useState([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");

  // Post-OTP Onboarding & Discovery State
  const [onboardingType, setOnboardingType] = useState("chama");
  const [directoryItems, setDirectoryItems] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Preserve the full path INCLUDING query string (e.g. a Chama
  // join-link's ?token=...) — dropping .search here would silently
  // strip the token and break the join-link flow after registering.
  // If the person was bounced here from a specific link, honor that
  // destination instead of interrupting it with the workspace picker —
  // the picker only makes sense when there's nowhere specific to go.
  const hasExplicitRedirect = Boolean(location.state?.from);

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
        await finishRegistration();
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

    // Block GuestRoute's own auto-redirect for the duration of this
    // flow — verifyOtp() below flips isAuthenticated true, and without
    // this GuestRoute would immediately send the person to /home
    // before finishRegistration() gets to show the workspace picker.
    setSuppressGuestRedirect?.(true);

    try {
      const identifier = channel === "email" && form.email.trim() ? form.email.trim() : form.phone;
      await verifyOtp({ identifier, phone: form.phone, email: form.email, otpCode });
      await finishRegistration();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Invalid or expired OTP code."
      );
      setSuppressGuestRedirect?.(false);
    } finally {
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------------
  // After the account is fully verified: there's no homepage to land
  // on anymore, so — unless the person was headed somewhere specific —
  // pull their workspaces and let them pick exactly which one to open
  // straight into. A brand-new account almost always has none yet, in
  // which case this falls through to /home, which handles first-time
  // onboarding (create/join) on its own. But someone who registered
  // via a join-link or was auto-added to a workspace during signup
  // gets the same type → workspace picker Login offers, instead of a
  // homepage flash.
  // ------------------------------------------------------------------
  async function finishRegistration() {
    if (hasExplicitRedirect) {
      navigate(redirectTo, { replace: true });
      return;
    }

    setWorkspacesLoading(true);

    try {
      const [items, dir] = await Promise.all([
        workspaceService.getWorkspaces().catch(() => []),
        workspaceService.getDirectory("chama").catch(() => []),
      ]);

      setMyWorkspaces(items);
      setDirectoryItems(dir);
      if (items.length > 0) {
        setSelectedWorkspaceId(items[0].id ?? items[0]._id);
        setSelectedType(normalizeType(items[0].type));
        setStep("workspace");
      } else {
        setOnboardingType("chama");
        setStep("onboarding");
      }
    } catch {
      setStep("onboarding");
    } finally {

      setWorkspacesLoading(false);
    }
  }

  async function handleOnboardingTypeChange(newType) {
    setOnboardingType(newType);
    setDirectorySearch("");
    setDirectoryLoading(true);
    try {
      const items = await workspaceService.getDirectory(newType);
      setDirectoryItems(items);
    } catch (err) {
      console.error(err);
    } finally {
      setDirectoryLoading(false);
    }
  }

  async function handleSearchDirectory(query) {
    setDirectoryLoading(true);
    try {
      const items = await workspaceService.getDirectory(onboardingType, query);
      setDirectoryItems(items);
    } catch (err) {
      console.error(err);
    } finally {
      setDirectoryLoading(false);
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
          {step === "register"
            ? "Create Account"
            : step === "otp"
            ? channel === "email"
              ? "Email Verification"
              : "Phone Verification"
            : step === "workspace"
            ? "Your Assigned Chama"
            : "Discover & Join Workspaces"}
        </h2>

        <p className="mt-1 text-slate-500">
          {step === "register"
            ? "Start managing your Chama today"
            : step === "otp"
            ? `Enter the 6-digit security code sent to ${channel === "email" ? form.email : form.phone}`
            : step === "workspace"
            ? "You have been set as management for the workspace below. Select your Chama to enter:"
            : "Select an entity type to discover verified workspaces or submit a creation request for your committee."}
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

            <Button type="submit" className="w-full" disabled={submitting || workspacesLoading}>
              {submitting || workspacesLoading ? "Verifying Code..." : "Verify & Activate Account"}
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

        {/* STEP 3 (IF PRE-ASSIGNED): WORKSPACE PICKER FOR DESIGNATED MANAGEMENT */}
        {step === "workspace" && (
          <form onSubmit={handleOpenWorkspace} className="mt-6 space-y-4">
            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-4 dark:border-violet-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/20">
              <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 mb-1">
                <Building2 size={18} />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Assigned Chama / Workspace Found!
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                You have been set as management for the workspace below by the Platform Admin. Select your Chama to enter directly:
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Your Assigned Chama / Workspace
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
                <option value="" disabled>-- Select Your Chama or Workspace --</option>
                {myWorkspaces.map((workspace) => {
                  const wid = workspace.id ?? workspace._id;
                  const typeLabel = TYPE_META[normalizeType(workspace.type)]?.label || "Chama";
                  const roleLabel = workspace.role ? ` (${workspace.role.replace(/_/g, " ")})` : "";
                  return (
                    <option key={wid} value={wid}>
                      [{typeLabel}] {workspace.name}{roleLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={!selectedWorkspaceId}>
              Enter Chama Workspace
              <ArrowRight size={16} />
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep("onboarding")}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Or explore public directory / request new workspace
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: POST-OTP ONBOARDING & ACCESS SELECTION */}
        {step === "onboarding" && (

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                What would you like to access?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose an organization type to discover verified workspaces or submit a creation request
              </p>
            </div>

            {/* Access Cards: Chama, Business, Contribution Group */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                {
                  type: "chama",
                  title: "Join a Chama",
                  desc: "Join an existing chama or request a new chama workspace",
                  icon: Building2,
                  color: "violet",
                },
                {
                  type: "business",
                  title: "Join a Business",
                  desc: "Access a business that has already been registered on Vericircle",
                  icon: Store,
                  color: "blue",
                },
                {
                  type: "contribution_group",
                  title: "Join a Group",
                  desc: "Join an existing contribution or fundraising group",
                  icon: Wallet,
                  color: "emerald",
                },
              ].map((card) => {
                const Icon = card.icon;
                const isSelected = onboardingType === card.type;
                return (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => handleOnboardingTypeChange(card.type)}
                    className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-violet-600 bg-violet-50/50 dark:border-violet-500 dark:bg-violet-950/40 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl mb-2 ${
                        isSelected
                          ? "bg-violet-600 text-white"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {card.title}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      {card.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Chamas / Workspaces */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select your {onboardingType === "chama" ? "Chama" : onboardingType === "business" ? "Business" : "Contribution Group"}
                </h4>
                {directoryLoading && (
                  <span className="text-[10px] font-bold text-violet-600">Searching...</span>
                )}
              </div>

              <input
                type="text"
                placeholder={`Search ${onboardingType === "chama" ? "Chamas (e.g. Umoja, Machakos...)" : "workspaces"}...`}
                value={directorySearch}
                onChange={(e) => {
                  setDirectorySearch(e.target.value);
                  handleSearchDirectory(e.target.value);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              {/* Workspaces List */}
              {directoryLoading ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Fetching verified {onboardingType}s...
                </div>
              ) : directoryItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    No existing {onboardingType}s found matching your search.
                  </p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {directoryItems.map((item) => (
                    <div
                      key={item.id || item._id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 transition hover:border-violet-300 hover:bg-violet-50/20 dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Active
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span>{item.location || item.county || item.chama_type || "Standard"}</span>
                          {item.memberCount !== undefined && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <Users size={12} />
                                {item.memberCount} members
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <Link
                        to="/chamas/join"
                        className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
                      >
                        Request to Join
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Can't find your Chama? Request Workspace Card */}
            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-4 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    Can't find your {onboardingType === "chama" ? "Chama" : onboardingType === "business" ? "Business" : "Group"}?
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Submit your committee details and Vericircle platform administration will create your workspace.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-violet-700 transition"
                >
                  <PlusCircle size={14} />
                  Request Workspace
                </button>
              </div>
            </div>

            {/* If user belongs to an existing workspace, offer opening it */}
            {myWorkspaces.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Your Pre-Assigned Workspaces:
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedWorkspaceId}
                    onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Select workspace</option>
                    {myWorkspaces.map((w) => (
                      <option key={w.id ?? w._id} value={w.id ?? w._id}>
                        {w.name} ({w.type})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={handleOpenWorkspace}
                    disabled={!selectedWorkspaceId}
                    className="px-4 py-2 text-xs font-bold"
                  >
                    Open
                  </Button>
                </div>
              </div>
            )}

            {/* Continue to Platform */}
            <div>
              <button
                type="button"
                onClick={() => navigate("/home", { replace: true })}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              >
                Continue to App Home
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </AuthCard>

      <WorkspaceRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        initialType={onboardingType}
        onSuccess={() => {
          setNotice("Your workspace request has been submitted to the Admin team for setup!");
        }}
      />
    </AuthLayout>
  );
}