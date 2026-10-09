import { useCallback, useEffect, useState } from "react";
import { BookOpen, Building2, Landmark, Loader2, Pencil, PiggyBank, Plus, Shield, ShieldCheck, Star, Target, Trash2, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import chamaApi from "@/modules/chama/api/chama.api";
import KycDocumentsModal from "@/modules/chama/components/KycDocumentsModal";
import {
  canViewFullBooks,
  canManageSavingsShareout,
  canViewAllWithdrawals,
  canDecideWithdrawal,
  canSettleWithdrawal,
  canCancelAnyWithdrawal,
} from "@/modules/workspaces/permissions/Permissions";
import useBankAccounts from "@/modules/finance/hooks/useBankAccounts";
import BankAccountModal from "@/modules/finance/components/BankAccountModal";
import financeService from "@/modules/finance/services/finance.service";
import savingsShareoutService from "@/modules/chama/services/savingsShareout.service";
import SavingsSharePolicyWizard from "@/modules/chama/components/Savingssharepolicywizard";
import { useMembers } from "@/modules/members/hooks/useMembers";
import withdrawalService from "@/modules/withdrawal/services/withdrawal.service";
import WithdrawalList from "@/modules/withdrawal/components/WithdrawalList";
import WithdrawalDetailsPanel from "@/modules/withdrawal/components/WithdrawalDetailsPanel";

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
  const [kycDocs, setKycDocs] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const goals = data?.goals || [];
  const savedAcrossGoals = goals.reduce((sum, goal) => sum + Number(goal.saved_amount || 0), 0);
  const targetAcrossGoals = goals.reduce((sum, goal) => sum + Number(goal.target_amount || 0), 0);
  const goalProgress = targetAcrossGoals > 0
    ? Math.min(100, Math.round((savedAcrossGoals / targetAcrossGoals) * 100))
    : 0;
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

  // ---------------- Withdrawal requests (chairperson approves, treasurer disburses) ----------------
  // The request -> approve -> reserve -> settle lifecycle itself lives in
  // withdrawal.service.js on the backend; this reuses that module's own
  // list/details components rather than re-implementing them, so the desk
  // stays on the one API surface the standalone Withdrawals page already
  // trusts. Settling (the treasurer actually disbursing) asks for the PIN
  // again — that prompt comes from requireLeadershipStepUp on the /pay
  // route and is handled generically by the api.js interceptor, not by
  // anything here.
  const mayViewWithdrawals = canViewAllWithdrawals(role, type);
  const mayDecideWithdrawal = canDecideWithdrawal(role, type);
  const maySettleWithdrawal = canSettleWithdrawal(role, type);
  const mayCancelWithdrawal = canCancelAnyWithdrawal(role, type);

  const [withdrawalQueue, setWithdrawalQueue] = useState([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(true);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [withdrawalBusy, setWithdrawalBusy] = useState(false);

  const loadWithdrawalQueue = useCallback(async () => {
    if (!workspaceId || !mayViewWithdrawals) {
      setLoadingWithdrawals(false);
      return;
    }
    setLoadingWithdrawals(true);
    try {
      const all = await withdrawalService.list(workspaceId);
      // Awaiting a chairperson decision, or approved and awaiting the
      // treasurer's disbursement — settled/rejected/cancelled requests
      // stay on the full Withdrawals page, not this at-a-glance queue.
      setWithdrawalQueue(all.filter((w) => ["pending", "approved"].includes(w.status)));
    } catch (error) {
      report(error, "Could not load withdrawal requests.");
    } finally {
      setLoadingWithdrawals(false);
    }
  }, [workspaceId, mayViewWithdrawals]);

  useEffect(() => {
    loadWithdrawalQueue();
  }, [loadWithdrawalQueue]);

  const refreshSelectedWithdrawal = async (id) => {
    try {
      setSelectedWithdrawal(await withdrawalService.get(workspaceId, id));
    } catch {
      setSelectedWithdrawal(null);
    }
  };

  const decideWithdrawalRequest = async (decision, comment) => {
    setWithdrawalBusy(true);
    try {
      await withdrawalService.decide(workspaceId, selectedWithdrawal._id, decision, comment);
      setFeedback({ tone: "success", text: `Withdrawal ${decision}.` });
      await refreshSelectedWithdrawal(selectedWithdrawal._id);
      loadWithdrawalQueue();
    } catch (error) {
      report(error, "Could not record that decision.");
    } finally {
      setWithdrawalBusy(false);
    }
  };

  const settleWithdrawalRequest = async (method, ref) => {
    setWithdrawalBusy(true);
    try {
      await withdrawalService.settle(workspaceId, selectedWithdrawal._id, method, ref);
      setFeedback({ tone: "success", text: "Withdrawal disbursed and marked as paid." });
      await refreshSelectedWithdrawal(selectedWithdrawal._id);
      loadWithdrawalQueue();
    } catch (error) {
      report(error, "Could not settle that withdrawal.");
    } finally {
      setWithdrawalBusy(false);
    }
  };

  const cancelWithdrawalRequest = async (reason) => {
    setWithdrawalBusy(true);
    try {
      await withdrawalService.cancel(workspaceId, selectedWithdrawal._id, reason);
      setFeedback({ tone: "success", text: "Withdrawal cancelled." });
      await refreshSelectedWithdrawal(selectedWithdrawal._id);
      loadWithdrawalQueue();
    } catch (error) {
      report(error, "Could not cancel that withdrawal.");
    } finally {
      setWithdrawalBusy(false);
    }
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
      const reason = status === "rejected" ? window.prompt("Why is this KYC submission being rejected? The member will see this reason:") : undefined;
      if (status === "rejected" && !reason?.trim()) return;
      await chamaApi.verifyKyc(workspaceId, membershipId, status, reason?.trim());
      setFeedback({
        tone: "success",
        text: `KYC ${status === "verified" ? "verified" : "rejected"}.`,
      });
      reload?.();
    } catch (error) {
      report(error, "Could not record that KYC decision.");
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      {feedback && <div className="lg:col-span-12"><Notice tone={feedback.tone}>{feedback.text}</Notice></div>}

      {/* ---------------- Goals ---------------- */}
      <SectionCard
        icon={Target}
        title="Group investment goals"
        description="What the Chama is saving toward, and how far along it is."
        className="lg:col-span-7"
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

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 dark:border-emerald-950 dark:from-emerald-950/30 dark:to-obsidian-card">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700/70 dark:text-emerald-300/70">Saved toward goals</p>
            <p className="mt-2 text-lg font-black tracking-tight text-slate-900 dark:text-white">{money(savedAcrossGoals)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/30">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Combined targets</p>
            <p className="mt-2 text-lg font-black tracking-tight text-slate-900 dark:text-white">{money(targetAcrossGoals)}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 dark:border-amber-950 dark:from-amber-950/25 dark:to-obsidian-card">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700/70 dark:text-amber-300/70">Overall progress</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white">{goalProgress}%</p>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-100 dark:bg-slate-700" role="progressbar" aria-label="Overall goal progress" aria-valuenow={goalProgress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${goalProgress}%` }} />
              </div>
            </div>
          </div>
        </div>

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
                  className="group/goal relative space-y-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/70 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-slate-800 dark:from-obsidian-card dark:to-slate-800/40 dark:hover:border-emerald-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">
                      <Target size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
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

      {/* ---------------- Withdrawal requests ---------------- */}
      {mayViewWithdrawals && (
        <SectionCard
          icon={Wallet}
          title="Withdrawal requests"
          description="Chairperson approves, treasurer disburses. Settled, rejected and cancelled requests live on the full Withdrawals page."
          className="lg:col-span-5"
        >
          {loadingWithdrawals ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <WithdrawalList
                withdrawals={withdrawalQueue}
                onSelect={setSelectedWithdrawal}
                title="Awaiting action"
                subtitle="Pending sign-off, or approved and awaiting disbursement."
                showMember
                emptyLabel="No withdrawal requests need attention right now."
              />

              {selectedWithdrawal ? (
                <WithdrawalDetailsPanel
                  withdrawal={selectedWithdrawal}
                  onClose={() => setSelectedWithdrawal(null)}
                  canDecide={mayDecideWithdrawal}
                  canSettle={maySettleWithdrawal}
                  canCancel={mayCancelWithdrawal}
                  onDecide={decideWithdrawalRequest}
                  onSettle={settleWithdrawalRequest}
                  onCancel={cancelWithdrawalRequest}
                  busy={withdrawalBusy}
                />
              ) : (
                <div className="hidden lg:flex items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-800/20">
                  <p className="text-sm font-semibold">Select a request to approve or disburse.</p>
                </div>
              )}
            </div>
          )}

          {!maySettleWithdrawal && (
            <p className="text-[11px] text-slate-400">
              Approving a request is open to the chairperson and treasurer; disbursing it is treasurer-only and asks for your PIN again.
            </p>
          )}
        </SectionCard>
      )}

      {/* ---------------- Bank accounts ---------------- */}
      <SectionCard
        icon={Landmark}
        title="Bank accounts"
        description="Real-world bank accounts this chama deposits cash into. Members see these read-only; registering or changing one happens here."
        className="lg:col-span-6"
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
                className="group/account space-y-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/70 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg dark:border-slate-800 dark:from-obsidian-card dark:to-slate-800/40 dark:hover:border-sky-900"
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
        className="lg:col-span-6"
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
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {activeShareoutPolicy.name}
              </p>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-700 shadow-sm dark:bg-indigo-900/50 dark:text-indigo-300">Active</span>
            </div>
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
        description="The chairperson and treasurer verify member and official identity submissions. Nobody can review their own."
        className="lg:col-span-7"
      >
        {!(["chairperson", "treasurer"].includes(role)) ? (
          <RoleLocked>Only the chairperson or treasurer can review identity documents.</RoleLocked>
        ) : pendingKyc.length === 0 ? (
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
                    {entry.membership_id?.user_id?.name || "Member"}
                    {entry.membership_id?.role && entry.membership_id.role !== "member" && (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{String(entry.membership_id.role).replace(/_/g, " ")}</span>
                    )}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    National ID {entry.id_number ? `${String(entry.id_number).slice(0, 2)}••••${String(entry.id_number).slice(-2)}` : "—"} · Submitted {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "recently"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button type="button" onClick={() => setKycDocs({ id: entry.membership_id?._id || entry.membership_id || entry._id, name: entry.membership_id?.user_id?.name || "Member" })} className="font-semibold text-emerald-700 underline">View ID document and selfie</button>
                    {Object.entries(entry.additional_details || {}).map(([key, value]) => <span key={key} className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{key.replaceAll("_", " ")}: {String(value)}</span>)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={verifyingId === (entry.membership_id?._id || entry._id)}
                    onClick={() => decideKyc(entry.membership_id?._id || entry.membership_id || entry._id, "rejected")}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={verifyingId === (entry.membership_id?._id || entry._id)}
                    onClick={() => decideKyc(entry.membership_id?._id || entry.membership_id || entry._id, "verified")}
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

      {kycDocs && <KycDocumentsModal workspaceId={workspaceId} membershipId={kycDocs.id} name={kycDocs.name} onClose={() => setKycDocs(null)} />}

      {/* ---------------- Books ---------------- */}
      <SectionCard
        icon={Landmark}
        title="The books"
        description="Ledger, trial balance and account balances — the raw double-entry records."
        className="lg:col-span-5"
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
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-900 dark:hover:bg-slate-700"
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
