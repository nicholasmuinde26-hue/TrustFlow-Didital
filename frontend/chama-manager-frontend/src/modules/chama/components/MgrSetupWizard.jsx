import { useState } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Users,
  DollarSign,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";
import mgrApi from "../api/mgr.api";

export default function MgrSetupWizard({ chamaId, members = [], initialPolicy = null, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: initialPolicy?.name || "Monthly MGR 2026",
    description: initialPolicy?.description || "Monthly rotating contribution pool",
    currency: initialPolicy?.currency || "KES",
    frequency: initialPolicy?.frequency || "monthly",
    start_date: initialPolicy?.start_date ? new Date(initialPolicy.start_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    contribution_deadline_day: initialPolicy?.contribution_deadline_day || 5,
    grace_period_days: initialPolicy?.grace_period_days || 3,

    // Participants
    selectedParticipants: initialPolicy?.participants ? initialPolicy.participants.map(p => typeof p === 'object' ? p._id : p) : members.map((m) => m._id),

    // Contribution Rule
    contributionType: initialPolicy?.contribution_rule?.type || "uniform",
    uniformAmount: initialPolicy?.contribution_rule?.uniform_amount || 5000,
    memberAmounts: {},

    // Rotation
    rotationOrder: initialPolicy?.rotation_rule?.order_type || "fixed",
    participantOrder: initialPolicy?.participants ? initialPolicy.participants.map(p => typeof p === 'object' ? p._id : p) : members.map((m) => m._id),

    // Payout Rules
    payoutCalculation: initialPolicy?.payout_rule?.calculation || "actual_collected",
    allowPayoutBefore100Pct: initialPolicy?.payout_rule?.allow_payout_before_100_pct || false,
    minCollectionThresholdPct: initialPolicy?.payout_rule?.min_collection_threshold_pct || 100,
    unpaidHandling: initialPolicy?.payout_rule?.unpaid_handling || "carry_forward",

    // Eligibility
    requireActiveMembership: initialPolicy?.eligibility_rule?.require_active_membership ?? true,
    requireFullContributions: initialPolicy?.eligibility_rule?.require_full_contributions ?? true,
    checkOverdueLoans: initialPolicy?.eligibility_rule?.check_overdue_loans ?? false,
    checkOutstandingPenalties: initialPolicy?.eligibility_rule?.check_outstanding_penalties ?? false,
    checkMinimumSavings: initialPolicy?.eligibility_rule?.check_minimum_savings ?? false,

    // Missed Payment
    penaltyType: initialPolicy?.penalty_rule?.penalty_type || "fixed",
    penaltyAmount: initialPolicy?.penalty_rule?.penalty_amount || 100,
    penaltyGraceDays: initialPolicy?.penalty_rule?.grace_days || 3,
    penaltyDefaultAction: initialPolicy?.penalty_rule?.default_action || "keep_schedule",

    // Approval Policy
    requiredApprovals: initialPolicy?.approval_rule?.required_approvals || 2,
    eligibleRoles: initialPolicy?.approval_rule?.eligible_roles || ["chairperson", "secretary", "treasurer"],
    allowInitiatorApproval: initialPolicy?.approval_rule?.allow_initiator_approval || false,
  });

  const toggleParticipant = (memberId) => {
    setFormData((prev) => {
      const exists = prev.selectedParticipants.includes(memberId);
      const updated = exists
        ? prev.selectedParticipants.filter((id) => id !== memberId)
        : [...prev.selectedParticipants, memberId];
      return {
        ...prev,
        selectedParticipants: updated,
        participantOrder: updated,
      };
    });
  };

  const moveParticipantOrder = (index, direction) => {
    const newOrder = [...formData.participantOrder];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    setFormData((prev) => ({ ...prev, participantOrder: newOrder }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const policyPayload = {
        name: formData.name,
        description: formData.description,
        currency: formData.currency,
        frequency: formData.frequency,
        start_date: formData.start_date,
        contribution_deadline_day: formData.contribution_deadline_day,
        grace_period_days: formData.grace_period_days,
        participants: formData.participantOrder,
        contribution_rule: {
          type: formData.contributionType,
          uniform_amount: formData.uniformAmount,
        },
        rotation_rule: {
          order_type: formData.rotationOrder,
          lock_on_activation: true,
        },
        payout_rule: {
          calculation: formData.payoutCalculation,
          allow_payout_before_100_pct: formData.allowPayoutBefore100Pct,
          min_collection_threshold_pct: formData.minCollectionThresholdPct,
          unpaid_handling: formData.unpaidHandling,
        },
        eligibility_rule: {
          require_active_membership: formData.requireActiveMembership,
          require_full_contributions: formData.requireFullContributions,
          check_overdue_loans: formData.checkOverdueLoans,
          check_outstanding_penalties: formData.checkOutstandingPenalties,
          check_minimum_savings: formData.checkMinimumSavings,
        },
        penalty_rule: {
          penalty_type: formData.penaltyType,
          penalty_amount: formData.penaltyAmount,
          grace_days: formData.penaltyGraceDays,
          default_action: formData.penaltyDefaultAction,
        },
        approval_rule: {
          required_approvals: Number(formData.requiredApprovals),
          eligible_roles: formData.eligibleRoles,
          allow_initiator_approval: formData.allowInitiatorApproval,
        },
      };

      if (initialPolicy?._id) {
        // Edit existing policy
        await mgrApi.updatePolicy(chamaId, initialPolicy._id, policyPayload);
      } else {
        // Create & activate new policy
        const { data: createRes } = await mgrApi.createPolicy(chamaId, policyPayload);
        const policyId = createRes.data._id;
        await mgrApi.activatePolicy(chamaId, policyId);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save MGR policy");
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
    "Basic Info",
    "Participants",
    "Contribution Rule",
    "Rotation Order",
    "Payout Rules",
    "Eligibility Checks",
    "Missed Payments",
    "Approval Engine",
    "Review & Activate",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              CREATE MERRY-GO-ROUND POLICY
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Step {step} of 9: {stepsList[step - 1]}
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
                idx + 1 <= step ? "bg-amber-500" : "bg-slate-100 dark:bg-slate-800"
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
          {/* STEP 1: BASIC INFO */}
          {step === 1 && (
            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">MGR Name</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    Contribution Deadline Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formData.contribution_deadline_day}
                    onChange={(e) =>
                      setFormData({ ...formData, contribution_deadline_day: Number(e.target.value) })
                    }
                    className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    Grace Period (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.grace_period_days}
                    onChange={(e) =>
                      setFormData({ ...formData, grace_period_days: Number(e.target.value) })
                    }
                    className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT PARTICIPANTS */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 dark:bg-amber-950 dark:border-amber-900 flex justify-between items-center text-xs font-bold text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <Users size={18} />
                  <span>MGR PARTICIPANTS</span>
                </div>
                <span>
                  {formData.selectedParticipants.length} of {members.length} members selected
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((m) => {
                  const isChecked = formData.selectedParticipants.includes(m._id);
                  return (
                    <label
                      key={m._id}
                      className="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleParticipant(m._id)}
                          className="h-4 w-4 rounded-md border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {m.user_id?.name || m.name || "Chama Member"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{m.role || "Member"}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: CONTRIBUTION RULE */}
          {step === 3 && (
            <div className="space-y-4 text-xs font-semibold">
              <label className="block text-slate-700 dark:text-slate-300 font-bold">Contribution Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, contributionType: "uniform" })}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between ${
                    formData.contributionType === "uniform"
                      ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 font-bold"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <span className="text-slate-900 dark:text-white">Same amount for everyone</span>
                  <span className="text-[10px] text-slate-400 mt-1">E.g., KSh 5,000 per member</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, contributionType: "custom_member" })}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between ${
                    formData.contributionType === "custom_member"
                      ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 font-bold"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <span className="text-slate-900 dark:text-white">Member-specific amount</span>
                  <span className="text-[10px] text-slate-400 mt-1">Custom tier per member</span>
                </button>
              </div>

              {formData.contributionType === "uniform" && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Contribution Amount (KES)
                  </label>
                  <input
                    type="number"
                    value={formData.uniformAmount}
                    onChange={(e) => setFormData({ ...formData, uniformAmount: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                  <p className="mt-2 text-[11px] text-amber-600 font-bold">
                    Expected Pool per Round: KES{" "}
                    {(formData.uniformAmount * formData.selectedParticipants.length).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: ROTATION ORDER */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-500">
                Reorder payout position by using up/down controls:
              </p>
              <div className="space-y-2">
                {formData.participantOrder.map((id, idx) => {
                  const m = members.find((mem) => mem._id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-amber-600 w-6">#{idx + 1}</span>
                        <span className="text-slate-900 dark:text-white">
                          {m?.user_id?.name || m?.name || "Member"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveParticipantOrder(idx, -1)}
                          disabled={idx === 0}
                          className="px-2 py-1 bg-slate-100 rounded-lg dark:bg-slate-800 text-slate-600 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveParticipantOrder(idx, 1)}
                          disabled={idx === formData.participantOrder.length - 1}
                          className="px-2 py-1 bg-slate-100 rounded-lg dark:bg-slate-800 text-slate-600 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: PAYOUT RULES */}
          {step === 5 && (
            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Payout Calculation Method
                </label>
                <select
                  value={formData.payoutCalculation}
                  onChange={(e) => setFormData({ ...formData, payoutCalculation: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="actual_collected">Actual Collected Amount</option>
                  <option value="expected_pool">Expected Round Amount</option>
                  <option value="fixed_amount">Fixed Payout Amount</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Minimum Collection Threshold (%)
                </label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={formData.minCollectionThresholdPct}
                  onChange={(e) =>
                    setFormData({ ...formData, minCollectionThresholdPct: Number(e.target.value) })
                  }
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  checked={formData.allowPayoutBefore100Pct}
                  onChange={(e) =>
                    setFormData({ ...formData, allowPayoutBefore100Pct: e.target.checked })
                  }
                  className="h-4 w-4 rounded-md border-slate-300 text-amber-600"
                />
                <span className="text-slate-900 dark:text-white font-bold">
                  Can payout occur before 100% collection if approved?
                </span>
              </div>
            </div>
          )}

          {/* STEP 6: ELIGIBILITY CHECKS */}
          {step === 6 && (
            <div className="space-y-3 text-xs font-bold">
              <p className="text-slate-500 mb-2">Member must satisfy selected rules to receive payout:</p>

              {[
                { key: "requireActiveMembership", label: "Be an active MGR participant" },
                { key: "requireFullContributions", label: "Have paid all required contributions" },
                { key: "checkOverdueLoans", label: "Have no overdue Chama loan" },
                { key: "checkOutstandingPenalties", label: "Have no outstanding penalty" },
                { key: "checkMinimumSavings", label: "Have completed required savings" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer"
                >
                  <span className="text-slate-900 dark:text-white">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={formData[item.key]}
                    onChange={(e) => setFormData({ ...formData, [item.key]: e.target.checked })}
                    className="h-4 w-4 rounded-md border-slate-300 text-amber-600"
                  />
                </label>
              ))}
            </div>
          )}

          {/* STEP 7: MISSED PAYMENTS */}
          {step === 7 && (
            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Late Contribution Penalty Amount (KES)
                </label>
                <input
                  type="number"
                  value={formData.penaltyAmount}
                  onChange={(e) => setFormData({ ...formData, penaltyAmount: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Penalty Grace Days
                </label>
                <input
                  type="number"
                  value={formData.penaltyGraceDays}
                  onChange={(e) =>
                    setFormData({ ...formData, penaltyGraceDays: Number(e.target.value) })
                  }
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* STEP 8: APPROVAL ENGINE */}
          {step === 8 && (
            <div className="space-y-4 text-xs font-semibold">
              <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 dark:bg-amber-950 dark:border-amber-900 text-amber-800 dark:text-amber-300">
                <ShieldCheck size={20} className="mb-1" />
                <span className="font-extrabold">PAYOUT APPROVAL POLICY</span>
                <p className="text-[11px] mt-1">
                  Requires authorized officials to sign off on payouts before funds move.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  Required Approvals Count
                </label>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={formData.requiredApprovals}
                  onChange={(e) =>
                    setFormData({ ...formData, requiredApprovals: Number(e.target.value) })
                  }
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  checked={formData.allowInitiatorApproval}
                  onChange={(e) =>
                    setFormData({ ...formData, allowInitiatorApproval: e.target.checked })
                  }
                  className="h-4 w-4 rounded-md border-slate-300 text-amber-600"
                />
                <span className="text-slate-900 dark:text-white font-bold">
                  Can initiator approve own payout request? (Not recommended)
                </span>
              </div>
            </div>
          )}

          {/* STEP 9: REVIEW & ACTIVATE */}
          {step === 9 && (
            <div className="space-y-4 text-xs font-semibold">
              <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-3">
                <h3 className="text-base font-black text-amber-800 dark:text-amber-300">
                  MGR POLICY SUMMARY
                </h3>

                <div className="grid grid-cols-2 gap-4 border-t border-amber-200 pt-3 dark:border-amber-900">
                  <div>
                    <span className="text-slate-400 font-bold text-[10px]">POLICY NAME</span>
                    <p className="text-slate-900 dark:text-white font-black">{formData.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold text-[10px]">PARTICIPANTS</span>
                    <p className="text-slate-900 dark:text-white font-black">
                      {formData.selectedParticipants.length} Members
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold text-[10px]">CONTRIBUTION</span>
                    <p className="text-slate-900 dark:text-white font-black font-mono">
                      KES {formData.uniformAmount.toLocaleString()} / month
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold text-[10px]">TOTAL POOL</span>
                    <p className="text-slate-900 dark:text-white font-black font-mono">
                      KES{" "}
                      {(formData.uniformAmount * formData.selectedParticipants.length).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold text-[10px]">REQUIRED APPROVALS</span>
                    <p className="text-slate-900 dark:text-white font-black">
                      {formData.requiredApprovals} Officials
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

          {step < 9 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(9, s + 1))}
              className="flex items-center gap-1.5 rounded-2xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-amber-600"
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
              {loading ? "Activating MGR..." : "Activate MGR Policy"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}