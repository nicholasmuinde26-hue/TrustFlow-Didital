import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Coins,
  Landmark,
  Loader2,
  Save,
} from "lucide-react";

import loanService from "@/modules/loans/services/loan.service";
import {
  useChamaSettings,
  useUpdateChamaSettings,
} from "@/modules/chama/hooks/useChamaSettings";
import { canEditChamaSettings } from "@/modules/workspaces/permissions/Permissions";

import {
  FIELD_CLASS,
  InputField,
  LABEL_CLASS,
  Notice,
  RoleLocked,
  SectionCard,
  SelectField,
} from "../components/DeskUI";

// ========================================
// GOVERNANCE SETTINGS TAB
// ========================================
//
// This is the old Administration → Settings page, folded in. Two things
// changed in the move.
//
// 1. The Chama settings form and the Command Center's "Treasury & Rules"
//    form used to be two different forms writing overlapping fields
//    (contribution_cycle, fine_amount, meeting_day, mpesa_shortcode,
//    bank details) through two different endpoints. Last-writer-wins
//    between two screens is a genuine data-integrity problem, not just
//    an ugly duplication — so there is now exactly one form, writing
//    through the settings endpoint.
//
// 2. Loan policy and payment details each require a fresh PIN
//    server-side. The prompt is raised globally by the API layer, so
//    saving may pause for a PIN before completing.
//
// ========================================

const CONTRIBUTION_CYCLES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const DEFAULT_LOAN_POLICY = {
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
  approval_matrix: [{ max_amount: null, required_roles: ["chairperson", "treasurer"] }],
};

export default function GovernanceSettingsTab({ workspaceId, role, isChairperson }) {
  const { data, isLoading, isError } = useChamaSettings(workspaceId, true);
  const updateSettings = useUpdateChamaSettings(workspaceId);

  const canEdit = canEditChamaSettings(role);
  const canEditLoanPolicy = isChairperson;

  const [form, setForm] = useState({
    name: "",
    monthly_savings: "",
    visibility: "private",
    contribution_cycle: "monthly",
    fine_amount: 0,
    meeting_day: "",
    approval_threshold: 20000,
    required_payout_approvals: 2,
    mpesa_shortcode: "",
    mpesa_account_reference: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
  });

  const [loanPolicy, setLoanPolicy] = useState(DEFAULT_LOAN_POLICY);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;

    const { chama, profile } = data;

    setForm({
      name: chama?.name || "",
      monthly_savings: chama?.monthly_savings ?? "",
      visibility: chama?.visibility || "private",
      contribution_cycle: profile?.contribution_cycle || "monthly",
      fine_amount: profile?.fine_amount ?? 0,
      meeting_day: profile?.meeting_day || "",
      approval_threshold: profile?.approval_threshold ?? 20000,
      required_payout_approvals: profile?.required_payout_approvals ?? 2,
      mpesa_shortcode: profile?.mpesa_shortcode || "",
      mpesa_account_reference: profile?.mpesa_account_reference || "",
      bank_name: profile?.bank_name || "",
      bank_account_name: profile?.bank_account_name || "",
      bank_account_number: profile?.bank_account_number || "",
    });
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    setPolicyLoading(true);

    loanService
      .getPolicy(workspaceId)
      .then((policy) => {
        if (!cancelled && policy) {
          setLoanPolicy((previous) => ({ ...previous, ...policy }));
        }
      })
      .catch((error) => console.warn("Could not load loan policy", error))
      .finally(() => {
        if (!cancelled) setPolicyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const setField = (field) => (value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (saved) setSaved(false);
  };

  const setPolicyField = (field, value) => {
    setLoanPolicy((previous) => ({ ...previous, [field]: value }));
    if (saved) setSaved(false);
  };

  const setPolicyList = (field) => (value) =>
    setPolicyField(
      field,
      String(value)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit) return;

    try {
      await updateSettings.mutateAsync({
        chamaUpdates: {
          name: form.name?.trim(),
          monthly_savings: Number(form.monthly_savings),
          visibility: form.visibility,
        },
        profileUpdates: {
          contribution_cycle: form.contribution_cycle,
          fine_amount: Number(form.fine_amount) || 0,
          meeting_day: form.meeting_day?.trim() || null,
          approval_threshold: Number(form.approval_threshold) || 0,
          required_payout_approvals: Number(form.required_payout_approvals) || 1,
          loan_policy: {
            min_savings_months: Number(loanPolicy.min_membership_months) || 0,
            max_multiple: Number(loanPolicy.loan_multiplier) || 1,
            interest_rate: Number(loanPolicy.interest_rate_percent) || 0,
            repayment_months:
              Number(loanPolicy.allowed_repayment_periods_months?.[0]) || 1,
          },
          mpesa_shortcode: form.mpesa_shortcode?.trim() || null,
          mpesa_account_reference: form.mpesa_account_reference?.trim() || null,
          bank_name: form.bank_name?.trim() || null,
          bank_account_name: form.bank_account_name?.trim() || null,
          bank_account_number: form.bank_account_number?.trim() || null,
        },
      });

      if (canEditLoanPolicy) {
        const updated = await loanService.updatePolicy(workspaceId, {
          loan_multiplier: Number(loanPolicy.loan_multiplier),
          interest_rate_percent: Number(loanPolicy.interest_rate_percent),
          interest_type: loanPolicy.interest_type,
          min_membership_months: Number(loanPolicy.min_membership_months),
          max_active_loans_per_member: Number(loanPolicy.max_active_loans_per_member),
          allowed_purposes: loanPolicy.allowed_purposes,
          allowed_repayment_periods_months: (
            loanPolicy.allowed_repayment_periods_months || []
          ).map(Number),
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

        if (updated) setLoanPolicy((previous) => ({ ...previous, ...updated }));
      }

      setSaved(true);
      toast.success("Governance settings saved");
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      // Dismissing the PIN prompt shouldn't read as a save failure.
      if (error?.leadershipCancelled) return;
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Couldn't save settings. Please try again."
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (isError) {
    return <Notice tone="error">Couldn't load Chama settings. Please refresh.</Notice>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!canEdit && (
        <RoleLocked>
          Only the treasurer or chairperson can change these settings. Loan
          policy is the chairperson's alone.
        </RoleLocked>
      )}

      {saved && (
        <Notice tone="success">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Settings saved
          </span>
        </Notice>
      )}

      {/* ---------------- Chama details ---------------- */}
      <SectionCard
        icon={Building2}
        title="Chama details"
        description="Name, savings target and who can find this group."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Chama name"
            value={form.name}
            onChange={setField("name")}
            disabled={!canEdit}
            required
          />
          <InputField
            label="Monthly savings (KES)"
            type="number"
            min="1"
            value={form.monthly_savings}
            onChange={setField("monthly_savings")}
            disabled={!canEdit}
            required
          />

          <div>
            <label className={LABEL_CLASS}>Join code (permanent)</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={data?.chama?.join_code || "Generating…"}
                className={`${FIELD_CLASS} font-mono font-black uppercase tracking-widest`}
              />
              <button
                type="button"
                onClick={() => {
                  if (data?.chama?.join_code) {
                    navigator.clipboard?.writeText(data.chama.join_code);
                    toast.success("Join code copied");
                  }
                }}
                className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                Copy
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Share with people who haven't joined yet.
            </p>
          </div>

          <SelectField
            label="Directory visibility"
            value={form.visibility}
            onChange={setField("visibility")}
            disabled={!canEdit}
            options={[
              { value: "private", label: "Private — reachable by code or link only" },
              { value: "public", label: "Public — discoverable in the directory" },
            ]}
          />
        </div>
      </SectionCard>

      {/* ---------------- Contributions & meetings ---------------- */}
      <SectionCard
        icon={CalendarClock}
        title="Contributions, meetings & approvals"
        description="The rhythm of the group and the thresholds that trigger extra sign-off."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Contribution cycle"
            value={form.contribution_cycle}
            onChange={setField("contribution_cycle")}
            disabled={!canEdit}
            options={CONTRIBUTION_CYCLES}
          />
          <InputField
            label="Late payment fine (KES)"
            type="number"
            min="0"
            value={form.fine_amount}
            onChange={setField("fine_amount")}
            disabled={!canEdit}
          />
          <InputField
            label="Regular meeting day"
            value={form.meeting_day}
            onChange={setField("meeting_day")}
            disabled={!canEdit}
            placeholder="e.g. Last Saturday of the month"
          />
          <InputField
            label="Approval threshold (KES)"
            type="number"
            min="0"
            value={form.approval_threshold}
            onChange={setField("approval_threshold")}
            disabled={!canEdit}
            hint="Payouts above this need extra approvals."
          />
          <InputField
            label="Required payout approvals"
            type="number"
            min="1"
            max="3"
            value={form.required_payout_approvals}
            onChange={setField("required_payout_approvals")}
            disabled={!canEdit}
          />
        </div>
      </SectionCard>

      {/* ---------------- Loan policy ---------------- */}
      <SectionCard
        icon={Coins}
        title="Loan policy"
        description="The Loans page reads these rules directly, so changes take effect there immediately."
      >
        {!canEditLoanPolicy && (
          <RoleLocked>Only the chairperson can edit loan policy rules.</RoleLocked>
        )}

        {policyLoading ? (
          <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
            <Loader2 size={15} className="animate-spin" /> Loading loan policy…
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <InputField
                label="Loan multiplier (× savings)"
                type="number"
                min="0"
                step="0.1"
                value={loanPolicy.loan_multiplier}
                onChange={(value) => setPolicyField("loan_multiplier", value)}
                disabled={!canEditLoanPolicy}
              />
              <InputField
                label="Interest rate (%)"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={loanPolicy.interest_rate_percent}
                onChange={(value) => setPolicyField("interest_rate_percent", value)}
                disabled={!canEditLoanPolicy}
              />
              <SelectField
                label="Interest type"
                value={loanPolicy.interest_type}
                onChange={(value) => setPolicyField("interest_type", value)}
                disabled={!canEditLoanPolicy}
                options={[
                  { value: "flat", label: "Flat" },
                  { value: "reducing_balance", label: "Reducing balance" },
                ]}
              />
              <InputField
                label="Minimum membership (months)"
                type="number"
                min="0"
                value={loanPolicy.min_membership_months}
                onChange={(value) => setPolicyField("min_membership_months", value)}
                disabled={!canEditLoanPolicy}
              />
              <InputField
                label="Max active loans / member"
                type="number"
                min="1"
                value={loanPolicy.max_active_loans_per_member}
                onChange={(value) => setPolicyField("max_active_loans_per_member", value)}
                disabled={!canEditLoanPolicy}
              />
              <InputField
                label="Minimum guarantors"
                type="number"
                min="0"
                value={loanPolicy.min_guarantors_required}
                onChange={(value) => setPolicyField("min_guarantors_required", value)}
                disabled={!canEditLoanPolicy}
              />
              <InputField
                label="Guarantor capacity (% of savings)"
                type="number"
                min="0"
                max="100"
                value={Number(loanPolicy.guarantor_capacity_ratio) * 100}
                onChange={(value) =>
                  setPolicyField("guarantor_capacity_ratio", Number(value) / 100)
                }
                disabled={!canEditLoanPolicy}
              />
              <InputField
                label="Grace period (days)"
                type="number"
                min="0"
                value={loanPolicy.grace_period_days}
                onChange={(value) => setPolicyField("grace_period_days", value)}
                disabled={!canEditLoanPolicy}
              />
              <InputField
                label="Default after (days)"
                type="number"
                min="0"
                value={loanPolicy.default_after_days}
                onChange={(value) => setPolicyField("default_after_days", value)}
                disabled={!canEditLoanPolicy}
              />
              <SelectField
                label="Penalty type"
                value={loanPolicy.penalty_type}
                onChange={(value) => setPolicyField("penalty_type", value)}
                disabled={!canEditLoanPolicy}
                options={[
                  { value: "flat_per_week", label: "Flat per week" },
                  { value: "percentage_of_due", label: "Percentage of due" },
                ]}
              />
              <InputField
                label="Penalty amount / rate"
                type="number"
                min="0"
                step="0.1"
                value={loanPolicy.penalty_amount}
                onChange={(value) => setPolicyField("penalty_amount", value)}
                disabled={!canEditLoanPolicy}
              />
              <InputField
                label="Recusal quorum"
                type="number"
                min="1"
                value={loanPolicy.recusal_quorum_size}
                onChange={(value) => setPolicyField("recusal_quorum_size", value)}
                disabled={!canEditLoanPolicy}
                hint="Committee members who fill a recused official's seat."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Allowed loan purposes"
                value={(loanPolicy.allowed_purposes || []).join(", ")}
                onChange={setPolicyList("allowed_purposes")}
                disabled={!canEditLoanPolicy}
                placeholder="Business, Education, Medical"
                hint="Comma separated"
              />
              <InputField
                label="Repayment periods (months)"
                value={(loanPolicy.allowed_repayment_periods_months || []).join(", ")}
                onChange={setPolicyList("allowed_repayment_periods_months")}
                disabled={!canEditLoanPolicy}
                hint="Comma separated"
              />
              <InputField
                label="Repayment frequencies"
                value={(loanPolicy.allowed_repayment_frequencies || []).join(", ")}
                onChange={setPolicyList("allowed_repayment_frequencies")}
                disabled={!canEditLoanPolicy}
                placeholder="weekly, monthly"
                hint="Comma separated"
              />
              <InputField
                label="Repayment waterfall"
                value={(loanPolicy.repayment_waterfall || []).join(", ")}
                onChange={setPolicyList("repayment_waterfall")}
                disabled={!canEditLoanPolicy}
                hint="Order money is applied: penalty, interest, principal"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["emergency_loan_enabled", "Enable emergency loans"],
                ["topup_enabled", "Enable loan top-ups"],
                ["group_loans_enabled", "Enable group loans"],
                ["allow_guarantor_recovery", "Allow guarantor recovery"],
              ].map(([field, label]) => (
                <label
                  key={field}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs font-semibold dark:border-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(loanPolicy[field])}
                    disabled={!canEditLoanPolicy}
                    onChange={(event) => setPolicyField(field, event.target.checked)}
                    className="accent-emerald-600"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Emergency loan limit (KES)"
                type="number"
                min="0"
                value={loanPolicy.emergency_loan_limit}
                onChange={(value) => setPolicyField("emergency_loan_limit", value)}
                disabled={!canEditLoanPolicy}
              />
              <InputField
                label="Emergency approval roles"
                value={(loanPolicy.emergency_loan_approval_roles || []).join(", ")}
                onChange={setPolicyList("emergency_loan_approval_roles")}
                disabled={!canEditLoanPolicy}
                hint="Comma separated"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Approval matrix
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Each tier names the officials who must independently approve
                    loans up to that amount.
                  </p>
                </div>
                {canEditLoanPolicy && (
                  <button
                    type="button"
                    onClick={() =>
                      setLoanPolicy((previous) => ({
                        ...previous,
                        approval_matrix: [
                          ...(previous.approval_matrix || []),
                          { max_amount: null, required_roles: ["chairperson", "treasurer"] },
                        ],
                      }))
                    }
                    className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-black dark:border-slate-700"
                  >
                    Add tier
                  </button>
                )}
              </div>

              {(loanPolicy.approval_matrix || []).map((tier, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[1fr_2fr_auto]"
                >
                  <input
                    type="number"
                    min="0"
                    placeholder="Max amount (blank = no limit)"
                    value={tier.max_amount ?? ""}
                    disabled={!canEditLoanPolicy}
                    onChange={(event) =>
                      setLoanPolicy((previous) => {
                        const next = [...(previous.approval_matrix || [])];
                        next[index] = {
                          ...next[index],
                          max_amount:
                            event.target.value === "" ? null : Number(event.target.value),
                        };
                        return { ...previous, approval_matrix: next };
                      })
                    }
                    className={FIELD_CLASS}
                  />
                  <input
                    value={(tier.required_roles || []).join(", ")}
                    disabled={!canEditLoanPolicy}
                    placeholder="chairperson, treasurer"
                    onChange={(event) =>
                      setLoanPolicy((previous) => {
                        const next = [...(previous.approval_matrix || [])];
                        next[index] = {
                          ...next[index],
                          required_roles: event.target.value
                            .split(",")
                            .map((entry) => entry.trim())
                            .filter(Boolean),
                        };
                        return { ...previous, approval_matrix: next };
                      })
                    }
                    className={FIELD_CLASS}
                  />
                  {canEditLoanPolicy && (
                    <button
                      type="button"
                      onClick={() =>
                        setLoanPolicy((previous) => ({
                          ...previous,
                          approval_matrix: (previous.approval_matrix || []).filter(
                            (_, position) => position !== index
                          ),
                        }))
                      }
                      className="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-black text-rose-600 dark:border-rose-900"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ---------------- Payment details ---------------- */}
      <SectionCard
        icon={Landmark}
        title="Payment details"
        description="Where members pay in and where payouts are sent from."
      >
        <Notice tone="warn">
          Changing the paybill or bank account changes where the group's money
          goes. Saving asks for your Leadership PIN again.
        </Notice>

        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="M-Pesa shortcode"
            value={form.mpesa_shortcode}
            onChange={setField("mpesa_shortcode")}
            disabled={!canEdit}
            placeholder="e.g. 174379"
          />
          <InputField
            label="M-Pesa account reference"
            value={form.mpesa_account_reference}
            onChange={setField("mpesa_account_reference")}
            disabled={!canEdit}
          />
          <InputField
            label="Bank name"
            value={form.bank_name}
            onChange={setField("bank_name")}
            disabled={!canEdit}
          />
          <InputField
            label="Bank account name"
            value={form.bank_account_name}
            onChange={setField("bank_account_name")}
            disabled={!canEdit}
          />
          <InputField
            label="Bank account number"
            value={form.bank_account_number}
            onChange={setField("bank_account_number")}
            disabled={!canEdit}
          />
        </div>
      </SectionCard>

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateSettings.isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {updateSettings.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save size={15} /> Save governance settings
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}
