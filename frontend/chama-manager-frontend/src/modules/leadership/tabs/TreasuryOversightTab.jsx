import { useCallback, useEffect, useState } from "react";
import { BookOpen, Building2, Landmark, Loader2, Pencil, PiggyBank, Plus, Shield, ShieldCheck, Star, Target, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import chamaApi from "@/modules/chama/api/chama.api";
import { canViewFullBooks, canManageSavingsShareout } from "@/modules/workspaces/permissions/Permissions";
import useBankAccounts from "@/modules/finance/hooks/useBankAccounts";
import BankAccountModal from "@/modules/finance/components/BankAccountModal";
import financeService from "@/modules/finance/services/finance.service";
import savingsShareoutService from "@/modules/chama/services/savingsShareout.service";
import SavingsSharePolicyWizard from "@/modules/chama/components/Savingssharepolicywizard";
import { useMembers } from "@/modules/members/hooks/useMembers";

import {
  EmptyState,
  InputField,
  Notice,
  RoleLocked,
  SectionCard,
  money,
} from "../components/DeskUI";

// ========================================
// TREASURY OVERSIGHT TAB
// ========================================
//
// Goals, member KYC verification, and the way into the raw books.
//
// Note what is NOT here: the leader's own KYC submission form, which the
// old Command Center mixed into its "KYC & Member Card" tab. Submitting
// your own ID is a member action and belongs on a member-facing page —
// putting it behind the leadership PIN would mean a treasurer has to
// unlock the desk to do something every ordinary member does. Reviewing
// OTHER people's KYC is the leadership half, and that's what stays.
//
// ========================================

export default function TreasuryOversightTab({
  workspaceId,
  role,
  type,
  data,
  reload,
}) {
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const goals = data?.goals || [];
  const pendingKyc = (data?.pendingKyc || data?.kycQueue || []).filter(Boolean);
  const mayViewBooks = canViewFullBooks(role, type);

  // ---------------- Bank accounts ----------------
  // Registering/editing a bank account is treasurer-only backend-side
  // (finance.transactions.create) — mirrors BankAccountsPage's own note.
  // Moved here so the actual mutation happens behind the leadership PIN;
  // the public Bank Accounts page is now read-only for everyone.
  const { bankAccounts, loading: loadingBankAccounts, refetch: refetchBankAccounts } =
    useBankAccounts(workspaceId);
  const isBankTreasurer = role === "treasurer";
  const [bankModalState, setBankModalState] = useState({ open: false, bankAccount: null });
  const [deactivatingBankId, setDeactivatingBankId] = useState(null);

  const handleBankAccountSaved = () => {
    setBankModalState({ open: false, bankAccount: null });
    refetchBankAccounts();
    window.dispatchEvent(new Event("finance:updated"));
    setFeedback({ tone: "success", text: "Bank account saved." });
  };

  const handleDeactivateBankAccount = async (bankAccount) => {
    if (!window.confirm(`Deactivate ${bankAccount.bank_name} — ${bankAccount.account_name}?`)) return;
    setDeactivatingBankId(bankAccount._id);
    try {
      await financeService.deactivateBankAccount(workspaceId, bankAccount._id);
      refetchBankAccounts();
      window.dispatchEvent(new Event("finance:updated"));
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error?.response?.data?.message || "Could not deactivate this bank account.",
      });
    } finally {
      setDeactivatingBankId(null);
    }
  };

  // ---------------- Savings share-out policy ----------------
  // The policy itself (share rule, trigger, eligible approvers) is a
  // leadership mutation — mirrors canManageSavingsShareout on the
  // backend (treasurer or chairperson). It used to be configurable
  // straight from the public Savings page; that page now only shows
  // the active policy read-only and lets an official trigger a run
  // from it. Editing the policy happens only here, behind the PIN.
  const mayManageShareout = canManageSavingsShareout(role, type);
  const { data: chamaMembers = [] } = useMembers(type, workspaceId);
  const [shareoutPolicies, setShareoutPolicies] = useState([]);
  const [loadingShareoutPolicies, setLoadingShareoutPolicies] = useState(true);
  const [showPolicyWizard, setShowPolicyWizard] = useState(false);

  const loadShareoutPolicies = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingShareoutPolicies(true);
    try {
      const res = await savingsShareoutService.getPolicies(workspaceId);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.policies)
        ? res.policies
        : [];
      setShareoutPolicies(list);
    } catch (error) {
      // Leave the previous list in place; the section below shows its
      // own empty state rather than a hard error for a read fetch.
    } finally {
      setLoadingShareoutPolicies(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadShareoutPolicies();
  }, [loadShareoutPolicies]);

  const activeShareoutPolicy =
    shareoutPolicies.find((p) => p.status === "active") || shareoutPolicies[0] || null;

  const report = (error, fallback) => {
    if (error?.leadershipCancelled) return;
    setFeedback({
      tone: "error",
      text: error?.response?.data?.message || fallback,
    });
  };

  const addGoal = async (event) => {
    event.preventDefault();
    if (!goalName.trim() || !goalTarget || busy) return;

    setBusy(true);
    setFeedback(null);

    try {
      await chamaApi.addGoal(workspaceId, {
        name: goalName.trim(),
        target_amount: Number(goalTarget),
      });
      setGoalName("");
      setGoalTarget("");
      setFeedback({ tone: "success", text: "Goal created." });
      reload?.();
    } catch (error) {
      report(error, "Could not create that goal.");
    } finally {
      setBusy(false);
    }
  };

  const decideKyc = async (membershipId, status) => {
    setVerifyingId(membershipId);
    setFeedback(null);

    try {
      await chamaApi.verifyKyc(workspaceId, membershipId, status);
      setFeedback({
        tone: "success",
        text: `KYC ${status === "approved" ? "approved" : "rejected"}.`,
      });
      reload?.();
    } catch (error) {
      report(error, "Could not record that KYC decision.");
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}

      {/* ---------------- Goals ---------------- */}
      <SectionCard
        icon={Target}
        title="Group investment goals"
        description="What the Chama is saving toward, and how far along it is."
      >
        <form onSubmit={addGoal} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <InputField
            label="Goal"
            value={goalName}
            onChange={setGoalName}
            placeholder="e.g. Plot purchase"
          />
          <InputField
            label="Target (KES)"
            type="number"
            min="0"
            value={goalTarget}
            onChange={setGoalTarget}
            placeholder="500000"
          />
          <button
            type="submit"
            disabled={busy || !goalName.trim() || !goalTarget}
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
            Add goal
          </button>
        </form>

        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No goals set"
            detail="A goal gives members something concrete to contribute toward."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {goals.map((goal) => {
              const saved = Number(goal.saved_amount || 0);
              const target = Number(goal.target_amount || 1);
              const percent = Math.min(100, Math.round((saved / target) * 100));

              return (
                <li
                  key={goal._id}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {goal.name}
                    </p>
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {percent}%
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                    <span>Saved {money(saved)}</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      Target {money(target)}
                    </span>
                  </div>

                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* ---------------- Bank accounts ---------------- */}
      <SectionCard
        icon={Landmark}
        title="Bank accounts"
        description="Real-world bank accounts this chama deposits cash into. Members see these read-only; registering or changing one happens here."
        action={
          isBankTreasurer && (
            <button
              type="button"
              onClick={() => setBankModalState({ open: true, bankAccount: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:bg-emerald-500"
            >
              <Plus size={14} />
              Add account
            </button>
          )
        }
      >
        {loadingBankAccounts ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          </div>
        ) : bankAccounts.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No bank account registered"
            detail={
              isBankTreasurer
                ? "Add one so cash-in-hand has somewhere to be deposited."
                : "The treasurer hasn't registered one yet."
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {bankAccounts.map((acc) => (
              <li
                key={acc._id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                      <Building2 size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{acc.bank_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{acc.account_name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {acc.masked_account_number || acc.account_number}
                      </p>
                    </div>
                  </div>
                  {acc.is_primary && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <Star size={10} />
                      Primary
                    </span>
                  )}
                </div>

                {(acc.branch || acc.paybill_or_till) && (
                  <div className="space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {acc.branch && <p>Branch: {acc.branch}</p>}
                    {acc.paybill_or_till && <p>Paybill/Till: {acc.paybill_or_till}</p>}
                  </div>
                )}

                {isBankTreasurer && (
                  <div className="flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                    <button
                      onClick={() => setBankModalState({ open: true, bankAccount: acc })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                    >
                      <Pencil size={11} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeactivateBankAccount(acc)}
                      disabled={deactivatingBankId === acc._id}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <Trash2 size={11} />
                      {deactivatingBankId === acc._id ? "Deactivating..." : "Deactivate"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!isBankTreasurer && (
          <p className="text-[11px] text-slate-400">
            Registering or editing an account is treasurer-only; the chairperson can view but not manage it here.
          </p>
        )}
      </SectionCard>

      <BankAccountModal
        isOpen={bankModalState.open}
        onClose={() => setBankModalState({ open: false, bankAccount: null })}
        workspaceId={workspaceId}
        bankAccount={bankModalState.bankAccount}
        onSaved={handleBankAccountSaved}
      />

      {/* ---------------- Savings share-out policy ---------------- */}
      <SectionCard
        icon={PiggyBank}
        title="Savings share-out policy"
        description="How and when accumulated savings get distributed back to contributors. Members see the active policy read-only on the Savings page."
        action={
          mayManageShareout && (
            <button
              type="button"
              onClick={() => setShowPolicyWizard(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:bg-indigo-500"
            >
              <ShieldCheck size={14} />
              {activeShareoutPolicy ? "Edit policy" : "Configure policy"}
            </button>
          )
        }
      >
        {loadingShareoutPolicies ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          </div>
        ) : activeShareoutPolicy ? (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-950 dark:bg-indigo-950/30">
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {activeShareoutPolicy.name}
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Mode:{" "}
              {activeShareoutPolicy.share_rule?.mode === "percentage_of_balance"
                ? `${activeShareoutPolicy.share_rule?.percentage}% of contributor balance`
                : `Fixed KES ${activeShareoutPolicy.share_rule?.fixed_amount}`}{" "}
              · Trigger: {activeShareoutPolicy.trigger_rule?.type || "manual"}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={PiggyBank}
            title="No policy configured"
            detail={
              mayManageShareout
                ? "Set one up to enable automatic or one-click savings share-outs."
                : "The treasurer or chairperson hasn't set one up yet."
            }
          />
        )}
        {!mayManageShareout && (
          <p className="text-[11px] text-slate-400">
            Configuring this policy is limited to the treasurer and chairperson.
          </p>
        )}
      </SectionCard>

      {showPolicyWizard && (
        <SavingsSharePolicyWizard
          workspaceId={workspaceId}
          members={chamaMembers}
          initialPolicy={activeShareoutPolicy}
          onClose={() => setShowPolicyWizard(false)}
          onSuccess={() => {
            setShowPolicyWizard(false);
            setFeedback({ tone: "success", text: "Savings share-out policy saved & activated." });
            loadShareoutPolicies();
          }}
        />
      )}

      {/* ---------------- KYC review ---------------- */}
      <SectionCard
        icon={Shield}
        title="Member KYC review"
        description="Verify the ID documents members have submitted."
      >
        {pendingKyc.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No KYC submissions waiting"
            detail="Members submit their ID from their own profile; verified records appear on the member directory."
          />
        ) : (
          <ul className="space-y-2.5">
            {pendingKyc.map((entry) => (
              <li
                key={entry._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {entry.user_id?.name || entry.membership_id || "Member"}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    ID {entry.id_number || "—"} · {entry.status || "pending"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={verifyingId === entry._id}
                    onClick={() => decideKyc(entry.membership_id || entry._id, "rejected")}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={verifyingId === entry._id}
                    onClick={() => decideKyc(entry.membership_id || entry._id, "approved")}
                    className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ---------------- Books ---------------- */}
      <SectionCard
        icon={Landmark}
        title="The books"
        description="Ledger, trial balance and account balances — the raw double-entry records."
      >
        {mayViewBooks ? (
          <div className="flex flex-wrap gap-2.5">
            {[
              ["finance", "Finance dashboard"],
              ["ledger", "General ledger"],
              ["trial-balance", "Trial balance"],
              ["reports", "Reports"],
            ].map(([path, label]) => (
              <Link
                key={path}
                to={`/workspace/${workspaceId}/${path}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <BookOpen size={14} /> {label}
              </Link>
            ))}
          </div>
        ) : (
          <RoleLocked>
            The raw books are open to the chairperson, treasurer and auditor.
            Member-facing statements and reports remain available to everyone.
          </RoleLocked>
        )}
      </SectionCard>
    </div>
  );
}