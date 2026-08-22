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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (!data) return;

    const { chama, profile } = data;
    const loanPolicy = profile?.loan_policy || {};

    setForm({
      name: chama?.name || "",
      monthly_savings: chama?.monthly_savings ?? "",
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

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (saved) setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;

    const chamaUpdates = {
      name: form.name?.trim(),
      monthly_savings: Number(form.monthly_savings),
    };

    const profileUpdates = {
      contribution_cycle: form.contribution_cycle,
      fine_amount: Number(form.fine_amount) || 0,
      meeting_day: form.meeting_day?.trim() || null,
      approval_threshold: Number(form.approval_threshold) || 0,
      required_payout_approvals: Number(form.required_payout_approvals) || 1,
      loan_policy: {
        min_savings_months: Number(form.min_savings_months) || 0,
        max_multiple: Number(form.max_multiple) || 1,
        interest_rate: Number(form.interest_rate) || 0,
        repayment_months: Number(form.repayment_months) || 1,
      },
      mpesa_shortcode: form.mpesa_shortcode?.trim() || null,
      mpesa_account_reference: form.mpesa_account_reference?.trim() || null,
      bank_name: form.bank_name?.trim() || null,
      bank_account_name: form.bank_account_name?.trim() || null,
      bank_account_number: form.bank_account_number?.trim() || null,
    };

    try {
      await updateSettings.mutateAsync({ chamaUpdates, profileUpdates });
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
          Only the treasurer or chairperson can change these settings. You can view them here.
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
          </div>
        </SectionCard>

        {/* ================= CONTRIBUTION & LOAN POLICY ================= */}
        <SectionCard icon={Coins} title="Contribution & Loan Policy">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Contribution Cycle</label>
              <select
                value={form.contribution_cycle}
                onChange={handleChange("contribution_cycle")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              >
                {CONTRIBUTION_CYCLES.map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Late Fine Amount (KES)</label>
              <input
                type="number"
                min="0"
                value={form.fine_amount}
                onChange={handleChange("fine_amount")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Min. Savings Before Loan (months)</label>
              <input
                type="number"
                min="0"
                value={form.min_savings_months}
                onChange={handleChange("min_savings_months")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Max Loan Multiple (of savings)</label>
              <input
                type="number"
                min="1"
                value={form.max_multiple}
                onChange={handleChange("max_multiple")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Loan Interest Rate (%)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.interest_rate}
                onChange={handleChange("interest_rate")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Loan Repayment Period (months)</label>
              <input
                type="number"
                min="1"
                value={form.repayment_months}
                onChange={handleChange("repayment_months")}
                disabled={!canEdit}
                className={FIELD_CLASS}
              />
            </div>
          </div>
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
