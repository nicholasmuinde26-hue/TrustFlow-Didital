import { useState } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  PiggyBank,
  Users,
  ShieldCheck,
  CalendarClock,
} from "lucide-react";
import savingsShareoutService from "../services/savingsShareout.service";

const stepsList = ["Basics & Trigger", "Share Rule", "Recipients", "Approval & Review"];

export default function SavingsSharePolicyWizard({
  workspaceId,
  members = [],
  initialPolicy = null,
  onClose,
  onSuccess,
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isEdit = Boolean(initialPolicy?._id);

  const [formData, setFormData] = useState({
    name: initialPolicy?.name || "Annual Savings Share-Out",
    description: initialPolicy?.description || "Distribute accumulated savings back to contributors",

    // trigger_rule
    triggerType: initialPolicy?.trigger_rule?.type || "manual", // manual | scheduled | both
    scheduleFrequency: initialPolicy?.trigger_rule?.schedule?.frequency || "yearly",
    scheduleDate: initialPolicy?.trigger_rule?.schedule?.date
      ? new Date(initialPolicy.trigger_rule.schedule.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],

    // share_rule
    shareMode: initialPolicy?.share_rule?.mode || "percentage_of_balance", // percentage_of_balance | fixed_amount
    sharePercentage: initialPolicy?.share_rule?.percentage ?? 100,
    fixedAmount: initialPolicy?.share_rule?.fixed_amount ?? 0,
    minRetainedBalance: initialPolicy?.share_rule?.min_retained_balance ?? 0,

    // recipients_rule
    recipientsMode: initialPolicy?.recipients_rule?.mode || "all_contributors", // all_contributors | specific_members
    selectedRecipients: initialPolicy?.recipients_rule?.specific_members
      ? initialPolicy.recipients_rule.specific_members.map((m) => (typeof m === "object" ? m._id : m))
      : [],
    excludedMembers: initialPolicy?.recipients_rule?.exclusions
      ? initialPolicy.recipients_rule.exclusions.map((m) => (typeof m === "object" ? m._id : m))
      : [],

    // approval_rule
    requiredApprovals: initialPolicy?.approval_rule?.required_approvals ?? 1,
    eligibleRoles: initialPolicy?.approval_rule?.eligible_roles || ["chairperson"],
  });

  const toggleInList = (key, memberId) => {
    setFormData((prev) => {
      const exists = prev[key].includes(memberId);
      return {
        ...prev,
        [key]: exists ? prev[key].filter((id) => id !== memberId) : [...prev[key], memberId],
      };
    });
  };

  const toggleRole = (role) => {
    setFormData((prev) => {
      const exists = prev.eligibleRoles.includes(role);
      return {
        ...prev,
        eligibleRoles: exists
          ? prev.eligibleRoles.filter((r) => r !== role)
          : [...prev.eligibleRoles, role],
      };
    });
  };

  function buildPayload() {
    return {
      name: formData.name,
      description: formData.description,
      trigger_rule: {
        type: formData.triggerType,
        ...(formData.triggerType !== "manual"
          ? {
              schedule: {
                frequency: formData.scheduleFrequency,
                date: formData.scheduleDate,
              },
            }
          : {}),
      },
      share_rule: {
        mode: formData.shareMode,
        ...(formData.shareMode === "percentage_of_balance"
          ? { percentage: Number(formData.sharePercentage) }
          : { fixed_amount: Number(formData.fixedAmount) }),
        min_retained_balance: Number(formData.minRetainedBalance),
      },
      recipients_rule: {
        mode: formData.recipientsMode,
        ...(formData.recipientsMode === "specific_members"
          ? { specific_members: formData.selectedRecipients }
          : {}),
        exclusions: formData.excludedMembers,
      },
      approval_rule: {
        required_approvals: Number(formData.requiredApprovals),
        eligible_roles: formData.eligibleRoles,
      },
    };
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await savingsShareoutService.updatePolicy(workspaceId, initialPolicy._id, payload);
      } else {
        await savingsShareoutService.createPolicy(workspaceId, payload);
      }
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save policy");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {isEdit ? "EDIT SAVINGS SHARE-OUT POLICY" : "CREATE SAVINGS SHARE-OUT POLICY"}
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Step {step} of {stepsList.length}: {stepsList[step - 1]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="mt-4 flex gap-1">
          {stepsList.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                idx + 1 <= step ? "bg-emerald-500" : "bg-slate-100 dark:bg-slate-800"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="py-6 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* STEP 1: BASICS & TRIGGER */}
          {step === 1 && (
            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Policy Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <CalendarClock size={14} /> How can this share-out be triggered?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "manual", label: "Manual only" },
                    { value: "scheduled", label: "Scheduled only" },
                    { value: "both", label: "Both" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, triggerType: opt.value })}
                      className={`rounded-2xl border px-3 py-3 text-center font-bold transition ${
                        formData.triggerType === opt.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {formData.triggerType !== "manual" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
                    <select
                      value={formData.scheduleFrequency}
                      onChange={(e) => setFormData({ ...formData, scheduleFrequency: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1">First Run Date</label>
                    <input
                      type="date"
                      value={formData.scheduleDate}
                      onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SHARE RULE */}
          {step === 2 && (
            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <PiggyBank size={14} /> How much of each member's savings is shared out?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "percentage_of_balance", label: "Percentage of balance" },
                    { value: "fixed_amount", label: "Fixed amount per member" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, shareMode: opt.value })}
                      className={`rounded-2xl border px-3 py-3 text-center font-bold transition ${
                        formData.shareMode === opt.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {formData.shareMode === "percentage_of_balance" ? (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Percentage of Balance (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.sharePercentage}
                    onChange={(e) => setFormData({ ...formData, sharePercentage: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Fixed Amount (KES)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.fixedAmount}
                    onChange={(e) => setFormData({ ...formData, fixedAmount: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Minimum Retained Balance (KES)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.minRetainedBalance}
                  onChange={(e) => setFormData({ ...formData, minRetainedBalance: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  A member's balance never drops below this amount, even if the share rule would take more.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: RECIPIENTS */}
          {step === 3 && (
            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Users size={14} /> Who receives a share-out?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "all_contributors", label: "All contributors" },
                    { value: "specific_members", label: "Specific members" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, recipientsMode: opt.value })}
                      className={`rounded-2xl border px-3 py-3 text-center font-bold transition ${
                        formData.recipientsMode === opt.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {formData.recipientsMode === "specific_members" && (
                <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => (
                    <label
                      key={m._id}
                      className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedRecipients.includes(m._id)}
                        onChange={() => toggleInList("selectedRecipients", m._id)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-slate-700 dark:text-slate-200">
                        {m.user_id?.name || m.name || "Member"}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Exclude specific members</label>
                <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => (
                    <label
                      key={m._id}
                      className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={formData.excludedMembers.includes(m._id)}
                        onChange={() => toggleInList("excludedMembers", m._id)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-slate-700 dark:text-slate-200">
                        {m.user_id?.name || m.name || "Member"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: APPROVAL & REVIEW */}
          {step === 4 && (
            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Required Approvals
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.requiredApprovals}
                  onChange={(e) => setFormData({ ...formData, requiredApprovals: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-2">Eligible Roles</label>
                <div className="grid grid-cols-3 gap-2">
                  {["chairperson", "treasurer", "secretary"].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`rounded-2xl border px-3 py-2.5 text-center font-bold capitalize transition ${
                        formData.eligibleRoles.includes(role)
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 space-y-3 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Review
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 font-bold text-[10px]">TRIGGER</span>
                    <p className="text-slate-900 dark:text-white font-black capitalize">
                      {formData.triggerType}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold text-[10px]">SHARE RULE</span>
                    <p className="text-slate-900 dark:text-white font-black">
                      {formData.shareMode === "percentage_of_balance"
                        ? `${formData.sharePercentage}% of balance`
                        : `KES ${Number(formData.fixedAmount).toLocaleString()} fixed`}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold text-[10px]">RECIPIENTS</span>
                    <p className="text-slate-900 dark:text-white font-black">
                      {formData.recipientsMode === "all_contributors"
                        ? "All contributors"
                        : `${formData.selectedRecipients.length} specific member(s)`}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold text-[10px]">APPROVALS</span>
                    <p className="text-slate-900 dark:text-white font-black">
                      {formData.requiredApprovals} of {formData.eligibleRoles.join(", ") || "none"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:text-slate-300"
          >
            <ChevronLeft size={16} /> Previous
          </button>

          {step < stepsList.length ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(stepsList.length, s + 1))}
              className="flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-600"
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-8 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Policy"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}