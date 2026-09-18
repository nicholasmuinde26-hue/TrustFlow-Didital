import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Building2,
  Coins,
  CalendarClock,
  ShieldCheck,
  Landmark,
  Save,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Trash2,
  Lock,
  X,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import Spinner from "@/shared/components/ui/Spinner";
import loanService from "@/modules/loans/services/loan.service";

import {
  useChamaSettings,
  useUpdateChamaSettings,
  useDeleteChama,
} from "@/modules/chama/hooks/useChamaSettings";

const CONTRIBUTION_CYCLES = ["weekly", "monthly", "quarterly"];

const FIELD_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-primary focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

const LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300";

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <Icon size={20} className="text-primary" />
        <span className="text-sm font-bold text-slate-900 dark:text-white">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams();
  const { activeWorkspace, isChama, refresh } = useWorkspace();
  const navigate = useNavigate();

  const canEdit = ["treasurer", "chairperson"].includes(activeWorkspace?.role);
  const canEditLoanPolicy = activeWorkspace?.role === "chairperson";
  const canDelete = activeWorkspace?.role === "treasurer";

  const { data, isLoading, isError } = useChamaSettings(workspaceId, isChama);
  const updateSettings = useUpdateChamaSettings(workspaceId);
  const deleteChama = useDeleteChama(workspaceId);

  const [form, setForm] = useState({
    name: "",
    monthly_savings: "",
    contribution_cycle: "monthly",
    fine_amount: "",
    meeting_day: "",
    approval_threshold: "",
    required_payout_approvals: "",
    min_savings_months: "",
    max_multiple: "",
    interest_rate: "",
    repayment_months: "",
    mpesa_shortcode: "",
    mpesa_account_reference: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
  });

  const [saved, setSaved] = useState(false);
  const [loanPolicyLoading, setLoanPolicyLoading] = useState(true);
  const [loanPolicy, setLoanPolicy] = useState({
    loan_multiplier: 3,
    interest_rate_percent: 10,
    interest_type: "flat",
    min_membership_months: 3,
    max_active_loans_per_member: 1,
    allowed_purposes: [],
    allowed_repayment_periods_months: [1, 2, 3, 6, 12],
    allowed_repayment_frequencies: ["weekly", "monthly"],
    grace_period_days: 7,
    default_after_days: 30,
    penalty_type: "flat_per_week",
    penalty_amount: 100,
    repayment_waterfall: ["penalty", "interest", "principal"],
    guarantor_capacity_ratio: 0.5,
    allow_guarantor_recovery: true,
    min_guarantors_required: 0,
    recusal_quorum_size: 2,
    emergency_loan_enabled: true,
    emergency_loan_limit: 5000,
    emergency_loan_approval_roles: ["treasurer"],
    topup_enabled: true,
    group_loans_enabled: true,
    approval_matrix: [{ max_amount: null, required_roles: ["chairperson", "treasurer"] }]
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (!data) return;

    const { chama, profile } = data;
    const loanPolicy = profile?.loan_policy || {};

    setForm({
      name: chama?.name || "",
      monthly_savings: chama?.monthly_savings ?? "",
      visibility: chama?.visibility || "private",
      contribution_cycle: profile?.contribution_cycle || "monthly",
      fine_amount: profile?.fine_amount ?? 0,
      meeting_day: profile?.meeting_day || "",
      approval_threshold: profile?.approval_threshold ?? 20000,
      required_payout_approvals: profile?.required_payout_approvals ?? 2,
      min_savings_months: loanPolicy.min_savings_months ?? 3,
      max_multiple: loanPolicy.max_multiple ?? 3,
      interest_rate: loanPolicy.interest_rate ?? 0,
      repayment_months: loanPolicy.repayment_months ?? 6,
      mpesa_shortcode: profile?.mpesa_shortcode || "",
      mpesa_account_reference: profile?.mpesa_account_reference || "",
      bank_name: profile?.bank_name || "",
      bank_account_name: profile?.bank_account_name || "",
      bank_account_number: profile?.bank_account_number || "",
    });
  }, [data]);

  useEffect(() => {
    if (!workspaceId || !isChama) return;
    let cancelled = false;
    setLoanPolicyLoading(true);
    loanService.getPolicy(workspaceId)
      .then((policy) => {
        if (!cancelled && policy) setLoanPolicy((prev) => ({ ...prev, ...policy }));
      })
      .catch((err) => console.warn("Could not load loan policy", err))
      .finally(() => { if (!cancelled) setLoanPolicyLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId, isChama]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (saved) setSaved(false);
  };

  const handleLoanPolicyChange = (field, value) => {
    setLoanPolicy((prev) => ({ ...prev, [field]: value }));
    if (saved) setSaved(false);
  };

  const handleLoanListChange = (field) => (e) => {
    const values = e.target.value.split(",").map((v) => v.trim()).filter(Boolean);
    handleLoanPolicyChange(field, values);
  };

  const handleApprovalMatrixChange = (index, field, value) => {
    setLoanPolicy((prev) => {
      const next = [...(prev.approval_matrix || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, approval_matrix: next };
    });
    if (saved) setSaved(false);
  };

  const addApprovalTier = () => {
    setLoanPolicy((prev) => ({
      ...prev,
      approval_matrix: [...(prev.approval_matrix || []), { max_amount: null, required_roles: ["chairperson", "treasurer"] }]
    }));
  };

  const removeApprovalTier = (index) => {
    setLoanPolicy((prev) => ({
      ...prev,
      approval_matrix: (prev.approval_matrix || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;

    const chamaUpdates = {
      name: form.name?.trim(),
      monthly_savings: Number(form.monthly_savings),
      visibility: form.visibility,
    };

    const profileUpdates = {
      contribution_cycle: form.contribution_cycle,
      fine_amount: Number(form.fine_amount) || 0,
      meeting_day: form.meeting_day?.trim() || null,
      approval_threshold: Number(form.approval_threshold) || 0,
      required_payout_approvals: Number(form.required_payout_approvals) || 1,
      loan_policy: {
        min_savings_months: Number(loanPolicy.min_membership_months) || 0,
        max_multiple: Number(loanPolicy.loan_multiplier) || 1,
        interest_rate: Number(loanPolicy.interest_rate_percent) || 0,
        repayment_months: Number(loanPolicy.allowed_repayment_periods_months?.[0]) || 1,
      },
      mpesa_shortcode: form.mpesa_shortcode?.trim() || null,
      mpesa_account_reference: form.mpesa_account_reference?.trim() || null,
      bank_name: form.bank_name?.trim() || null,
      bank_account_name: form.bank_account_name?.trim() || null,
      bank_account_number: form.bank_account_number?.trim() || null,
    };

    try {
      await updateSettings.mutateAsync({ chamaUpdates, profileUpdates });
      if (canEditLoanPolicy) {
        const updatedPolicy = await loanService.updatePolicy(workspaceId, {
          loan_multiplier: Number(loanPolicy.loan_multiplier),
          interest_rate_percent: Number(loanPolicy.interest_rate_percent),
          interest_type: loanPolicy.interest_type,
          min_membership_months: Number(loanPolicy.min_membership_months),
          max_active_loans_per_member: Number(loanPolicy.max_active_loans_per_member),
          allowed_purposes: loanPolicy.allowed_purposes,
          allowed_repayment_periods_months: loanPolicy.allowed_repayment_periods_months.map(Number),
          allowed_repayment_frequencies: loanPolicy.allowed_repayment_frequencies,
          grace_period_days: Number(loanPolicy.grace_period_days),
          default_after_days: Number(loanPolicy.default_after_days),
          penalty_type: loanPolicy.penalty_type,
          penalty_amount: Number(loanPolicy.penalty_amount),
          repayment_waterfall: loanPolicy.repayment_waterfall,
          guarantor_capacity_ratio: Number(loanPolicy.guarantor_capacity_ratio),
          allow_guarantor_recovery: Boolean(loanPolicy.allow_guarantor_recovery),
          min_guarantors_required: Number(loanPolicy.min_guarantors_required),
          approval_matrix: loanPolicy.approval_matrix,
          recusal_quorum_size: Number(loanPolicy.recusal_quorum_size),
          emergency_loan_enabled: Boolean(loanPolicy.emergency_loan_enabled),
          emergency_loan_limit: Number(loanPolicy.emergency_loan_limit),
          emergency_loan_approval_roles: loanPolicy.emergency_loan_approval_roles,
          topup_enabled: Boolean(loanPolicy.topup_enabled),
          group_loans_enabled: Boolean(loanPolicy.group_loans_enabled),
        });
        if (updatedPolicy) setLoanPolicy((prev) => ({ ...prev, ...updatedPolicy }));
      }
      setSaved(true);
      toast.success("Chama settings saved");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Couldn't save settings. Please try again."
      );
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== form.name) return;

    try {
      await deleteChama.mutateAsync();
      toast.success("Chama deleted");
      if (refresh) await refresh();
      navigate("/home", { replace: true });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Couldn't delete this chama. Please try again."
      );
    }
  };

  if (!isChama) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 font-sans">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
              RULES ENGINE & GOVERNANCE
            </span>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              Contribution Group Rules Engine
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Configure governance rules, late fee penalties, minimum contributions, and multi-admin approval thresholds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Rules Configuration */}
          <SectionCard icon={ShieldCheck} title="Group Rules Engine">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>Late Fee Penalty (KES)</label>
                <input
                  type="number"
                  defaultValue="50"
                  className={FIELD_CLASS}
                />
                <p className="mt-1 text-[11px] text-slate-400">Auto-applied if contribution is overdue</p>
              </div>

              <div>
                <label className={LABEL_CLASS}>Minimum Contribution (KES)</label>
                <input
                  type="number"
                  defaultValue="1000"
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Default Payout Channel</label>
                <select defaultValue="mpesa" className={FIELD_CLASS}>
                  <option value="mpesa">M-Pesa Direct (STK & B2C)</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>Expense Multi-Admin Approvals</label>
                <select defaultValue="2" className={FIELD_CLASS}>
                  <option value="1">1 Admin Approval</option>
                  <option value="2">2 Admins Approval (Recommended)</option>
                  <option value="3">All Admins Approval</option>
                </select>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Landmark} title="Default M-Pesa Till / Paybill Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>M-Pesa Till / Paybill Number</label>
                <input
                  type="text"
                  placeholder="e.g. 522522"
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Account Reference</label>
                <input
                  type="text"
                  placeholder="e.g. PARTY-GROUP"
                  className={FIELD_CLASS}
                />
              </div>
            </div>
          </SectionCard>

          <div className="flex justify-end">
            <button
              onClick={() => toast.success("Contribution Group rules updated!")}
              className="flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-violet-800"
            >
              <Save size={16} /> Save Rules Engine Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
          Couldn't load chama settings. Please refresh and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 font-sans">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Chama Settings
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Configure contribution rules, loan policy, meetings, and payment details.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/60 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 size={15} /> Settings saved
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              border
              border-slate-200
              bg-white
              text-slate-500
              hover:bg-slate-50
              hover:text-slate-700
              transition
              dark:border-slate-700
              dark:bg-slate-800
              dark:text-slate-400
              dark:hover:bg-slate-700
              dark:hover:text-slate-200
            "
            aria-label="Close settings"
            title="Close settings"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {!canEdit && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
          <Lock size={15} />
          Only the treasurer or chairperson can change general Chama settings. Loan policy rules are controlled by the chairperson.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ================= CHAMA DETAILS ================= */}
        <SectionCard icon={Building2} title="Chama Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Chama Name</label>
              <input
                type="text"
                value={form.name}
                onChange={handleChange("name")}
                disabled={!canEdit}
                required
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Monthly Savings (KES)</label>
              <input
                type="number"
                min="1"
                value={form.monthly_savings}
                onChange={handleChange("monthly_savings")}
                disabled={!canEdit}
                required
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Join Invitation Code (Permanent)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={data?.chama?.join_code || "Generating..."}
                  className={`${FIELD_CLASS} font-mono font-bold tracking-widest bg-violet-50/50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 uppercase`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (data?.chama?.join_code) {
                      navigator.clipboard.writeText(data.chama.join_code);
                      toast.success("Join code copied to clipboard!");
                    }
                  }}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-900/80 transition-colors"
                >
                  Copy
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Share this code with non-joined members so they can join directly.
              </p>
            </div>

            <div>
              <label className={LABEL_CLASS}>Directory Visibility</label>
              <select
                value={form.visibility}
                onChange={handleChange("visibility")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              >
                <option value="private">Private (Only reachable via code or link)</option>
                <option value="public">Public (Discoverable in Browse Public Chamas)</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Public Chamas can be found and requested by any registered platform user.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ================= CONTRIBUTION & LOAN POLICY ================= */}
        <SectionCard icon={Coins} title="Contribution & Loan Policy">
          <div className="mb-2 rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-[11px] text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
            <strong>Loan policy:</strong> The Loans page reads these rules directly from the Chama loan policy, so changes take effect there automatically. Interest-rate and other sensitive rule changes trigger a management-first notification.
          </div>
          {!canEditLoanPolicy && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              <Lock size={14} /> Only the chairperson can edit loan policy rules.
            </div>
          )}
          {loanPolicyLoading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-slate-500"><Loader2 size={15} className="animate-spin" /> Loading loan policy...</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div><label className={LABEL_CLASS}>Loan Multiplier (× savings)</label><input type="number" min="0" step="0.1" value={loanPolicy.loan_multiplier} onChange={(e) => handleLoanPolicyChange("loan_multiplier", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Interest Rate (%)</label><input type="number" min="0" max="100" step="0.1" value={loanPolicy.interest_rate_percent} onChange={(e) => handleLoanPolicyChange("interest_rate_percent", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Interest Type</label><select value={loanPolicy.interest_type} onChange={(e) => handleLoanPolicyChange("interest_type", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS}><option value="flat">Flat</option><option value="reducing_balance">Reducing balance</option></select></div>
                <div><label className={LABEL_CLASS}>Minimum Membership (months)</label><input type="number" min="0" value={loanPolicy.min_membership_months} onChange={(e) => handleLoanPolicyChange("min_membership_months", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Max Active Loans / Member</label><input type="number" min="1" value={loanPolicy.max_active_loans_per_member} onChange={(e) => handleLoanPolicyChange("max_active_loans_per_member", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Min Guarantors</label><input type="number" min="0" value={loanPolicy.min_guarantors_required} onChange={(e) => handleLoanPolicyChange("min_guarantors_required", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Guarantor Capacity (% savings)</label><input type="number" min="0" max="100" step="1" value={Number(loanPolicy.guarantor_capacity_ratio) * 100} onChange={(e) => handleLoanPolicyChange("guarantor_capacity_ratio", Number(e.target.value) / 100)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Grace Period (days)</label><input type="number" min="0" value={loanPolicy.grace_period_days} onChange={(e) => handleLoanPolicyChange("grace_period_days", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Default After (days)</label><input type="number" min="0" value={loanPolicy.default_after_days} onChange={(e) => handleLoanPolicyChange("default_after_days", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Penalty Type</label><select value={loanPolicy.penalty_type} onChange={(e) => handleLoanPolicyChange("penalty_type", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS}><option value="flat_per_week">Flat per week</option><option value="percentage_of_due">Percentage of due</option></select></div>
                <div><label className={LABEL_CLASS}>Penalty Amount / Rate</label><input type="number" min="0" step="0.1" value={loanPolicy.penalty_amount} onChange={(e) => handleLoanPolicyChange("penalty_amount", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Recusal Quorum</label><input type="number" min="1" value={loanPolicy.recusal_quorum_size} onChange={(e) => handleLoanPolicyChange("recusal_quorum_size", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={LABEL_CLASS}>Allowed Loan Purposes (comma separated)</label><input value={(loanPolicy.allowed_purposes || []).join(", ")} onChange={handleLoanListChange("allowed_purposes")} disabled={!canEditLoanPolicy} className={FIELD_CLASS} placeholder="Business, Education, Medical" /></div>
                <div><label className={LABEL_CLASS}>Repayment Periods (months, comma separated)</label><input value={(loanPolicy.allowed_repayment_periods_months || []).join(", ")} onChange={handleLoanListChange("allowed_repayment_periods_months")} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Repayment Frequencies (comma separated)</label><input value={(loanPolicy.allowed_repayment_frequencies || []).join(", ")} onChange={handleLoanListChange("allowed_repayment_frequencies")} disabled={!canEditLoanPolicy} className={FIELD_CLASS} placeholder="weekly, monthly" /></div>
                <div><label className={LABEL_CLASS}>Repayment Waterfall (comma separated)</label><input value={(loanPolicy.repayment_waterfall || []).join(", ")} onChange={handleLoanListChange("repayment_waterfall")} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
                <div><label className={LABEL_CLASS}>Emergency Approval Roles</label><input value={(loanPolicy.emergency_loan_approval_roles || []).join(", ")} onChange={handleLoanListChange("emergency_loan_approval_roles")} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["emergency_loan_enabled", "Enable emergency loans"],
                  ["topup_enabled", "Enable loan top-ups"],
                  ["group_loans_enabled", "Enable group loans"],
                  ["allow_guarantor_recovery", "Allow guarantor recovery"]
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs font-semibold dark:border-slate-800">
                    <input type="checkbox" checked={Boolean(loanPolicy[field])} onChange={(e) => handleLoanPolicyChange(field, e.target.checked)} disabled={!canEditLoanPolicy} /> {label}
                  </label>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={LABEL_CLASS}>Emergency Loan Limit (KES)</label><input type="number" min="0" value={loanPolicy.emergency_loan_limit} onChange={(e) => handleLoanPolicyChange("emergency_loan_limit", e.target.value)} disabled={!canEditLoanPolicy} className={FIELD_CLASS} /></div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-800 dark:text-slate-200">Approval Matrix</p><p className="text-[11px] text-slate-500">Each tier can require independent Chama officials to approve loans up to the specified amount.</p></div>{canEditLoanPolicy && <button type="button" onClick={addApprovalTier} className="rounded-lg border px-3 py-2 text-[11px] font-bold">Add tier</button>}</div>
                {(loanPolicy.approval_matrix || []).map((tier, index) => (
                  <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_auto] dark:border-slate-800">
                    <input type="number" min="0" placeholder="Max amount (blank = no limit)" value={tier.max_amount ?? ""} onChange={(e) => handleApprovalMatrixChange(index, "max_amount", e.target.value === "" ? null : Number(e.target.value))} disabled={!canEditLoanPolicy} className={FIELD_CLASS} />
                    <input value={(tier.required_roles || []).join(", ")} onChange={(e) => handleApprovalMatrixChange(index, "required_roles", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} disabled={!canEditLoanPolicy} className={FIELD_CLASS} placeholder="chairperson, treasurer" />
                    {canEditLoanPolicy && <button type="button" onClick={() => removeApprovalTier(index)} className="rounded-lg border border-red-200 px-3 py-2 text-[11px] font-bold text-red-600">Remove</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ================= MEETINGS & APPROVALS ================= */}
        <SectionCard icon={CalendarClock} title="Meetings & Approvals">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={LABEL_CLASS}>Regular Meeting Day</label>
              <input
                type="text"
                placeholder="e.g. Last Saturday of the month"
                value={form.meeting_day}
                onChange={handleChange("meeting_day")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Approval Threshold (KES)</label>
              <input
                type="number"
                min="0"
                value={form.approval_threshold}
                onChange={handleChange("approval_threshold")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Payouts above this amount need extra approvals.
              </p>
            </div>

            <div>
              <label className={LABEL_CLASS}>Required Payout Approvals</label>
              <input
                type="number"
                min="1"
                max="3"
                value={form.required_payout_approvals}
                onChange={handleChange("required_payout_approvals")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>
          </div>
        </SectionCard>

        {/* ================= PAYMENT DETAILS ================= */}
        <SectionCard icon={Landmark} title="Payment Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>M-Pesa Shortcode</label>
              <input
                type="text"
                placeholder="e.g. 174379"
                value={form.mpesa_shortcode}
                onChange={handleChange("mpesa_shortcode")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>M-Pesa Account Reference</label>
              <input
                type="text"
                value={form.mpesa_account_reference}
                onChange={handleChange("mpesa_account_reference")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Bank Name</label>
              <input
                type="text"
                value={form.bank_name}
                onChange={handleChange("bank_name")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Bank Account Name</label>
              <input
                type="text"
                value={form.bank_account_name}
                onChange={handleChange("bank_account_name")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Bank Account Number</label>
              <input
                type="text"
                value={form.bank_account_number}
                onChange={handleChange("bank_account_number")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>
          </div>
        </SectionCard>

        {/* ================= SAVE ================= */}
        {canEdit && (
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="submit"
              disabled={updateSettings.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {updateSettings.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={15} /> Save Settings
                </>
              )}
            </button>
          </div>
        )}
      </form>

      {/* ================= DANGER ZONE ================= */}
      {canDelete && (
        <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50/40 p-6 dark:border-red-900 dark:bg-red-950/20">
          <div className="flex items-center gap-3 border-b border-red-200/60 pb-4 dark:border-red-900">
            <AlertTriangle size={20} className="text-red-500" />
            <span className="text-sm font-bold text-red-600 dark:text-red-400">
              Danger Zone
            </span>
          </div>

          {!confirmingDelete ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Delete this chama
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Permanently removes the chama and every member's association with it.
                  This cannot be undone.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-300 px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"
              >
                <Trash2 size={15} /> Delete Chama
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Type <span className="font-bold">{form.name}</span> to confirm
                deletion. This will remove all members and cannot be undone.
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={form.name}
                className="w-full max-w-sm rounded-xl border border-red-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-red-500 dark:border-red-800 dark:bg-slate-900 dark:text-white"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={
                    deleteConfirmText !== form.name || deleteChama.isPending
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteChama.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  Confirm Delete
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteConfirmText("");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!canDelete && (
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheck size={15} />
          Only the treasurer can delete this chama.
        </div>
      )}
    </div>
  );
}
