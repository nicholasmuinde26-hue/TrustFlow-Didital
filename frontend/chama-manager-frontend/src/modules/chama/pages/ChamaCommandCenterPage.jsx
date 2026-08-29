import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  CreditCard,
  Target,
  Users,
  Video,
  CheckCircle2,
  AlertTriangle,
  Send,
  QrCode,
  Sparkles,
  RefreshCw,
  Award,
  ChevronRight,
  Landmark,
} from "lucide-react";
import chamaApi from "../api/chama.api";
import CautionModal from "@/shared/components/ui/CautionModal";

const initialProfile = {
  contribution_cycle: "monthly",
  fine_amount: 0,
  meeting_day: "",
  approval_threshold: 20000,
  required_payout_approvals: 2,
  mpesa_shortcode: "",
  bank_name: "",
  bank_account_number: "",
  constitution_url: "",
};

export default function ChamaCommandCenterPage() {
  const { workspaceId } = useParams();
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(initialProfile);
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [busy, setBusy] = useState(false);

  // Caution Modal State
  const [cautionModal, setCautionModal] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Proceed",
    type: "warning",
    details: [],
    onConfirm: () => {},
  });

  const load = async () => {
    try {
      const response = await chamaApi.getCommandCenter(workspaceId);
      const resData = response.data.data;
      setData(resData);
      setProfile((current) => ({ ...current, ...(resData.profile || {}) }));
    } catch (error) {
      setNotice({
        type: "error",
        text: error?.response?.data?.message || "Could not load Chama command center.",
      });
    }
  };

  useEffect(() => {
    load();
  }, [workspaceId]);

  const runAction = async (action, successMsg) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ type: "success", text: successMsg });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        text: error?.response?.data?.message || error.message || "Action failed.",
      });
    } finally {
      setBusy(false);
      setCautionModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const openCaution = (config) => {
    setCautionModal({
      isOpen: true,
      title: config.title || "Confirm Action",
      description: config.description || "Are you sure you want to proceed?",
      confirmText: config.confirmText || "Yes, Proceed",
      type: config.type || "warning",
      details: config.details || [],
      onConfirm: () => runAction(config.action, config.successMsg),
    });
  };

  if (!data) {
    return (
      <div className="flex h-96 items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
          <span>Initializing Chama Command Center Mission Control...</span>
        </div>
      </div>
    );
  }

  const role = data.membership?.role || "member";
  const official = ["chairperson", "treasurer", "secretary"].includes(role);
  const isTreasurer = role === "treasurer";
  const isChairperson = role === "chairperson";

  const tabs = [
    { id: "overview", label: "Overview & Mission", icon: Sparkles },
    { id: "governance", label: "Treasury & Rules", icon: Landmark },
    { id: "loans", label: "Member Approvals", icon: CreditCard, count: data.loans?.filter(l => l.status === "eligible" || l.status === "approved").length },
    { id: "goals", label: "Goals & Capital", icon: Target, count: data.goals?.length },
    { id: "kyc", label: "KYC & Member Card", icon: Shield },
    { id: "meetings", label: "Live Meetings", icon: Video, count: data.meetings?.filter(m => m.status === "active").length },
    { id: "officials", label: "Officials & Invites", icon: Users },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12 font-sans text-slate-900 dark:text-slate-100">
      {/* Caution Modal */}
      <CautionModal
        isOpen={cautionModal.isOpen}
        onClose={() => setCautionModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={cautionModal.onConfirm}
        title={cautionModal.title}
        description={cautionModal.description}
        confirmText={cautionModal.confirmText}
        type={cautionModal.type}
        details={cautionModal.details}
        busy={busy}
      />

      {/* Header Banner - Matching ChamaOverview styling */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white">
                <Shield className="h-3.5 w-3.5" />
                COMMAND CENTER & GOVERNANCE CONTROL
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/20 border border-white/20 px-3 py-1 text-xs font-bold uppercase text-emerald-100">
                Role: {role}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Chama Operations Dashboard
            </h1>
            <p className="max-w-2xl text-sm text-emerald-100">
              Real-time treasury controls, role-based loan disbursements, KYC verification cards, and meeting resolutions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={load}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm hover:bg-emerald-50 transition"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              <span>Sync Ops</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notice Alert */}
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-medium ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          {notice.type === "error" ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          )}
          <div className="flex-1">{notice.text}</div>
          <button onClick={() => setNotice(null)} className="text-xs opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/60">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}
      <div className="space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Quick Metrics */}
            <div className="md:col-span-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Contribution Cycle"
                value={profile.contribution_cycle?.toUpperCase()}
                icon={Landmark}
                accent="emerald"
                subtitle={`Fine: KES ${Number(profile.fine_amount || 0).toLocaleString()}`}
              />
              <MetricCard
                title="Active Financial Goals"
                value={data.goals?.length || 0}
                icon={Target}
                accent="sky"
                subtitle={`Total goals set by group`}
              />
              <MetricCard
                title="Pending Member Approvals"
                value={data.loans?.filter((l) => l.status === "eligible" || l.status === "approved").length || 0}
                icon={CreditCard}
                accent="amber"
                subtitle="Requires official review"
              />
              <MetricCard
                title="KYC Status"
                value={(data.kyc?.status || "NOT SUBMITTED").toUpperCase()}
                icon={Shield}
                accent={data.kyc?.status === "approved" ? "emerald" : "rose"}
                subtitle={`Member Card Active`}
              />
            </div>

            {/* Governance Summary */}
            <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Treasury & Account Breakdown
                </h3>
                {official && (
                  <button
                    onClick={() => setActiveTab("governance")}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    Edit Rules <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                  <span className="text-xs text-slate-500 dark:text-slate-400">M-Pesa Till / Paybill</span>
                  <p className="font-mono text-base font-bold text-slate-900 dark:text-white mt-1">
                    {profile.mpesa_shortcode || "Not configured"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Bank Account Details</span>
                  <p className="font-mono text-base font-bold text-slate-900 dark:text-white mt-1">
                    {profile.bank_name ? `${profile.bank_name} — ${profile.bank_account_number}` : "Not configured"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Meeting Day</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{profile.meeting_day || "Flexible schedule"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Constitution Document</span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                    {profile.constitution_url ? (
                      <a href={profile.constitution_url} target="_blank" rel="noreferrer" className="underline">
                        View Constitution PDF
                      </a>
                    ) : (
                      "No URL linked"
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Digital Member Card Preview */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">DIGITAL CHAMA CARD</h3>
                  <QrCode className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-800 p-5 text-white shadow-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] tracking-widest text-emerald-100 uppercase font-semibold">
                        OFFICIAL MEMBER BADGE
                      </p>
                      <h4 className="text-xl font-black mt-1 tracking-tight">{data.membership?.user_id?.name || "Member"}</h4>
                    </div>
                    <span className="rounded-lg bg-black/30 px-2.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
                      {role}
                    </span>
                  </div>
                  <div className="mt-8 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-emerald-100">MEMBER ID</p>
                      <p className="font-mono text-xs font-bold tracking-wider">
                        CHAMA-{String(data.membership?._id || "00000").slice(-8).toUpperCase()}
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("kyc")}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                Manage KYC & Identification
              </button>
            </div>
          </div>
        )}

        {/* GOVERNANCE & TREASURY TAB */}
        {activeTab === "governance" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-5 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <Landmark className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Chama Governance & Treasury Settings</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Manage contribution frequency, financial penalty rules, M-Pesa channels, and bank details.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                openCaution({
                  title: "Update Governance & Treasury Settings",
                  description: "Are you sure you want to update core Chama operational settings?",
                  confirmText: "Save Settings",
                  type: "info",
                  action: () => chamaApi.saveProfile(workspaceId, profile),
                  successMsg: "Chama governance settings successfully saved.",
                });
              }}
              className="space-y-6"
            >
              <div className="grid sm:grid-cols-2 gap-5">
                <SelectField
                  label="Contribution Cycle"
                  value={profile.contribution_cycle}
                  onChange={(v) => setProfile({ ...profile, contribution_cycle: v })}
                  options={[
                    { label: "Weekly Cycle", value: "weekly" },
                    { label: "Monthly Cycle", value: "monthly" },
                    { label: "Quarterly Cycle", value: "quarterly" },
                  ]}
                />
                <InputField
                  label="Late Payment Fine (KES)"
                  type="number"
                  value={profile.fine_amount ?? 0}
                  onChange={(v) => setProfile({ ...profile, fine_amount: Number(v) })}
                />
                <InputField
                  label="Official Meeting Schedule / Day"
                  placeholder="e.g. Every First Saturday"
                  value={profile.meeting_day || ""}
                  onChange={(v) => setProfile({ ...profile, meeting_day: v })}
                />
                <InputField
                  label="Constitution Document PDF URL"
                  placeholder="https://..."
                  value={profile.constitution_url || ""}
                  onChange={(v) => setProfile({ ...profile, constitution_url: v })}
                />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-4">
                  Group Banking & M-Pesa Integration
                </h3>
                <div className="grid sm:grid-cols-3 gap-5">
                  <InputField
                    label="M-Pesa Till / Paybill"
                    placeholder="e.g. 522522"
                    value={profile.mpesa_shortcode || ""}
                    onChange={(v) => setProfile({ ...profile, mpesa_shortcode: v })}
                  />
                  <InputField
                    label="Bank Name"
                    placeholder="e.g. KCB Bank"
                    value={profile.bank_name || ""}
                    onChange={(v) => setProfile({ ...profile, bank_name: v })}
                  />
                  <InputField
                    label="Bank Account Number"
                    placeholder="e.g. 1234567890"
                    value={profile.bank_account_number || ""}
                    onChange={(v) => setProfile({ ...profile, bank_account_number: v })}
                  />
                </div>
              </div>

              {official ? (
                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-500 transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Save Governance Configuration</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  Note: Only Chama officials (Chairperson, Treasurer, Secretary) can edit governance settings.
                </p>
              )}
            </form>
          </div>
        )}

        {/* MEMBER LOAN APPROVALS TAB */}
        {activeTab === "loans" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                <CreditCard className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <span className="inline-block rounded-full bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-0.5 text-[10px] font-bold dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">
                  OFFICIAL MEMBER LOAN MANAGEMENT HUB
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Review & Approve Group Member Loans</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  As an official, review loan applications submitted by group members. Approvals require official consensus, and disbursements are executed securely via M-Pesa B2C by the Treasurer.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {data.loans && data.loans.length > 0 ? (
                data.loans.map((loan) => (
                  <div
                    key={loan._id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition hover:border-slate-300"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-slate-900 dark:text-white">
                          KES {Number(loan.amount).toLocaleString()}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border ${
                            loan.status === "approved"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400"
                              : loan.status === "eligible"
                              ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400"
                              : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {loan.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{loan.purpose}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {official && loan.status === "eligible" && (
                        <button
                          onClick={() =>
                            openCaution({
                              title: "Approve Loan Application",
                              description: `You are approving a loan of KES ${Number(loan.amount).toLocaleString()} for ${loan.purpose}.`,
                              confirmText: "Approve Loan",
                              type: "warning",
                              action: () => chamaApi.approveLoan(workspaceId, loan._id),
                              successMsg: "Loan officially approved.",
                            })
                          }
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Approve Loan</span>
                        </button>
                      )}

                      {isTreasurer && loan.status === "approved" && (
                        <button
                          onClick={() =>
                            openCaution({
                              title: "Initiate M-Pesa B2C Disbursement",
                              description: `Disburse KES ${Number(loan.amount).toLocaleString()} via M-Pesa B2C?`,
                              confirmText: "Disburse via B2C",
                              type: "danger",
                              action: () => chamaApi.disburseLoan(workspaceId, loan._id),
                              successMsg: "B2C Disbursement initiated successfully.",
                            })
                          }
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-sky-500 transition"
                        >
                          <Send className="h-4 w-4" />
                          <span>Disburse via M-Pesa B2C</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  <CreditCard className="mx-auto h-10 w-10 text-slate-400 mb-2" />
                  <p className="font-bold text-slate-800 dark:text-slate-200">No Pending Loan Approvals</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GOALS & CAPITAL TAB */}
        {activeTab === "goals" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                Create Group Investment Goal
              </h2>
              <GoalForm
                onSubmit={(payload) =>
                  openCaution({
                    title: "Add Chama Investment Goal",
                    description: `Create goal '${payload.name}' for KES ${Number(payload.target_amount).toLocaleString()}?`,
                    confirmText: "Create Goal",
                    type: "info",
                    action: () => chamaApi.addGoal(workspaceId, payload),
                    successMsg: "Group investment goal created successfully.",
                  })
                }
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {data.goals && data.goals.length > 0 ? (
                data.goals.map((goal) => {
                  const saved = Number(goal.saved_amount || 0);
                  const target = Number(goal.target_amount || 1);
                  const pct = Math.min(100, Math.round((saved / target) * 100));

                  return (
                    <div key={goal._id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-base">{goal.name}</h4>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Target Capital Fund</span>
                        </div>
                        <span className="rounded-full bg-sky-100 text-sky-800 border border-sky-200 px-3 py-1 text-xs font-bold dark:bg-sky-950 dark:text-sky-300">
                          {pct}% Reached
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-500">Saved: KES {saved.toLocaleString()}</span>
                          <span className="text-slate-900 dark:text-white font-bold">Target: KES {target.toLocaleString()}</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8 }}
                            className="h-full bg-gradient-to-r from-emerald-600 to-teal-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="sm:col-span-2 rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  <Target className="mx-auto h-10 w-10 text-slate-400 mb-2" />
                  <p className="font-bold text-slate-800 dark:text-slate-200">No Active Investment Goals</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KYC & DIGITAL MEMBER CARD TAB */}
        {activeTab === "kyc" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Submit KYC Identification
              </h2>
              <KycForm
                onSubmit={(payload) =>
                  openCaution({
                    title: "Submit Member KYC Identification",
                    description: "Submit National ID details for official verification?",
                    confirmText: "Submit KYC",
                    type: "info",
                    action: () => chamaApi.submitKyc(workspaceId, payload),
                    successMsg: "KYC documents submitted for chairperson review.",
                  })
                }
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">DIGITAL CHAMA MEMBER CARD</h3>
                  <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-bold uppercase dark:bg-emerald-950 dark:text-emerald-400">
                    Status: {data.kyc?.status || "Pending"}
                  </span>
                </div>

                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-800 p-6 text-white shadow-xl space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] tracking-widest text-emerald-100 uppercase font-bold">
                        OFFICIAL MEMBER CREDENTIAL
                      </p>
                      <h3 className="text-2xl font-black tracking-tight mt-1">{data.membership?.user_id?.name || "Member"}</h3>
                    </div>
                    <Award className="h-8 w-8 text-amber-300 drop-shadow" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="bg-black/20 p-2.5 rounded-xl backdrop-blur">
                      <span className="text-[10px] text-emerald-100 block">ROLE</span>
                      <strong className="uppercase text-white font-bold">{role}</strong>
                    </div>
                    <div className="bg-black/20 p-2.5 rounded-xl backdrop-blur">
                      <span className="text-[10px] text-emerald-100 block">NATIONAL ID</span>
                      <strong className="text-white font-bold">{data.kyc?.id_number || "Verified"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LIVE MEETINGS & MINUTES TAB */}
        {activeTab === "meetings" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Video className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Launch Live Chama Meeting
              </h2>
              <MeetingForm
                onSubmit={(payload) =>
                  openCaution({
                    title: "Start Live Chama Session",
                    description: `Launch meeting '${payload.title}' and open digital check-in?`,
                    confirmText: "Start Meeting",
                    type: "info",
                    action: () => chamaApi.createMeetingRecord(workspaceId, payload),
                    successMsg: "Live meeting session successfully launched.",
                  })
                }
              />
            </div>
          </div>
        )}

        {/* OFFICIALS & INVITATIONS TAB */}
        {activeTab === "officials" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Chama Officials Registry
              </h3>
              <div className="space-y-3">
                {data.officials && data.officials.length > 0 ? (
                  data.officials.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60"
                    >
                      <div>
                        <b className="text-slate-900 dark:text-white text-sm block">{member.user_id?.name || "Official"}</b>
                        <span className="text-xs text-slate-500 font-mono">{member.user_id?.email || member._id}</span>
                      </div>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-bold uppercase dark:bg-emerald-950 dark:text-emerald-400">
                        {member.role}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No officials assigned.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                Invite New Members
              </h3>
              <InviteForm
                onSubmit={(payload) =>
                  runAction(async () => {
                    const result = await chamaApi.createInvitation(workspaceId, payload);
                    const invitedName = result.data.data.invited_user?.name;
                    setNotice({
                      type: "success",
                      text: invitedName
                        ? `Invitation sent to ${invitedName}. It'll appear instantly on their Invitations page to accept or reject.`
                        : "Invitation sent. It'll appear instantly on their Invitations page to accept or reject.",
                    });
                  }, "Invitation sent.")
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* HELPER INPUT COMPONENTS WITH LIGHT THEME STYLING */

function MetricCard({ title, value, icon: Icon, accent = "emerald", subtitle }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{title}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
        {subtitle && <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
      <span>{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none transition"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none transition"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GoalForm({ onSubmit }) {
  const [name, setName] = useState("");
  const [target_amount, setTarget] = useState("");
  return (
    <form
      className="flex flex-wrap sm:flex-nowrap gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, target_amount: Number(target_amount) });
      }}
    >
      <input
        required
        placeholder="Goal Title (e.g. Plot Purchase)"
        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        required
        type="number"
        placeholder="Target Amount (KES)"
        className="w-full sm:w-48 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        value={target_amount}
        onChange={(e) => setTarget(e.target.value)}
      />
      <button className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-500 transition">
        Add Goal
      </button>
    </form>
  );
}

function KycForm({ onSubmit }) {
  const [form, setForm] = useState({ id_number: "", id_document_url: "", selfie_url: "" });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <InputField
        label="National ID Number"
        placeholder="e.g. 12345678"
        value={form.id_number}
        onChange={(v) => setForm({ ...form, id_number: v })}
      />
      <InputField
        label="ID Document URL"
        placeholder="https://..."
        value={form.id_document_url}
        onChange={(v) => setForm({ ...form, id_document_url: v })}
      />
      <button className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition">
        Submit KYC
      </button>
    </form>
  );
}

function MeetingForm({ onSubmit }) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="flex gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title });
      }}
    >
      <input
        required
        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        placeholder="Meeting Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition">
        Start Meeting
      </button>
    </form>
  );
}

function InviteForm({ onSubmit }) {
  const [phone, setPhone] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ phone });
      }}
    >
      <input
        required
        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        placeholder="Member Phone Number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <button className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-500 transition">
        Create Invite
      </button>
    </form>
  );
}