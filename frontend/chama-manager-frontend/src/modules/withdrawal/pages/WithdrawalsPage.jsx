import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Wallet, ClipboardList } from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import withdrawalService from "../services/withdrawal.service";
import financeService from "@/modules/finance/services/finance.service";
import WithdrawalList from "../components/WithdrawalList";
import WithdrawalDetailsPanel from "../components/WithdrawalDetailsPanel";
import RequestWithdrawalModal from "../components/RequestWithdrawalModal";
import {
  canViewAllWithdrawals,
  canDecideWithdrawal,
  canSettleWithdrawal,
  canCancelAnyWithdrawal,
} from "@/modules/workspaces/permissions/Permissions";

export default function WithdrawalsPage() {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const workspaceId = paramId || workspaceCtx?.workspaceId;
  const workspaceType = workspaceCtx?.workspaceType || "chama";
  const role = workspaceCtx?.membership?.role;
  const membershipId = workspaceCtx?.membership?._id;

  const isOfficial = canViewAllWithdrawals(role, workspaceType);
  const ownerType = workspaceType === "burial-chama" ? "Chama" : "Chama";

  const [tab, setTab] = useState("mine"); // "mine" | "queue"
  const [mine, setMine] = useState([]);
  const [queue, setQueue] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [actionMessage, setActionMessage] = useState({ text: "", isError: false });
  const [activePolicy, setActivePolicy] = useState(null);
  const [minimumSavingsBalance, setMinimumSavingsBalance] = useState("");
  const [savingPolicy, setSavingPolicy] = useState(false);

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const tasks = [withdrawalService.mine(workspaceId)];
      if (isOfficial) tasks.push(withdrawalService.list(workspaceId));
      const [mineRes, queueRes] = await Promise.allSettled(tasks);
      if (mineRes.status === "fulfilled") setMine(mineRes.value);
      if (isOfficial && queueRes?.status === "fulfilled") setQueue(queueRes.value);
    } catch (err) {
      console.warn("Could not fetch withdrawals", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isOfficial]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!workspaceId) return;
    financeService
      .getContributionPlans(workspaceId, ownerType)
      .then(setPlans)
      .catch(() => setPlans([]));
  }, [workspaceId, ownerType]);

  useEffect(() => {
    if (!workspaceId || !isOfficial) return;
    withdrawalService.policies(workspaceId).then((response) => {
      const data = response?.data?.data ?? response?.data ?? [];
      const policies = Array.isArray(data) ? data : data.policies || [];
      const active = policies.find((policy) => policy.status === "active" && !policy.contribution_plan_id);
      setActivePolicy(active || null);
      const floor = active?.eligibility_conditions?.find((condition) => condition.type === "MIN_SAVINGS_BALANCE")?.params?.amount;
      setMinimumSavingsBalance(floor == null ? "" : String(floor));
    }).catch(() => {});
  }, [workspaceId, isOfficial]);

  const refreshSelected = async (id) => {
    try {
      const fresh = await withdrawalService.get(workspaceId, id);
      setSelected(fresh);
    } catch {
      setSelected(null);
    }
  };

  const handleRequest = async (payload) => {
    setBusy(true);
    setRequestError("");
    try {
      const result = await withdrawalService.request(workspaceId, payload);
      setActionMessage({
        text: result.withdrawal.status === "approved" ? "Withdrawal requested and auto-approved." : "Withdrawal request submitted for approval.",
        isError: false,
      });
      setShowRequest(false);
      loadData();
    } catch (err) {
      setRequestError(err?.response?.data?.message || "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  };

  const handleDecide = async (decision, comment) => {
    setBusy(true);
    try {
      await withdrawalService.decide(workspaceId, selected._id, decision, comment);
      setActionMessage({ text: `Withdrawal ${decision}.`, isError: false });
      refreshSelected(selected._id);
      loadData();
    } catch (err) {
      setActionMessage({ text: err?.response?.data?.message || "Could not record the decision.", isError: true });
    } finally {
      setBusy(false);
    }
  };

  const handleSettle = async (method, ref) => {
    setBusy(true);
    try {
      await withdrawalService.settle(workspaceId, selected._id, method, ref);
      setActionMessage({ text: "Withdrawal marked as paid.", isError: false });
      refreshSelected(selected._id);
      loadData();
    } catch (err) {
      setActionMessage({ text: err?.response?.data?.message || "Could not settle the withdrawal.", isError: true });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (reason) => {
    setBusy(true);
    try {
      await withdrawalService.cancel(workspaceId, selected._id, reason);
      setActionMessage({ text: "Withdrawal cancelled.", isError: false });
      refreshSelected(selected._id);
      loadData();
    } catch (err) {
      setActionMessage({ text: err?.response?.data?.message || "Could not cancel the withdrawal.", isError: true });
    } finally {
      setBusy(false);
    }
  };

  const isOwnRequest = (w) =>
    w && membershipId && [String(w.requested_by), String(w.member_id?._id || w.member_id)].includes(String(membershipId));

  const canCancelSelected = selected && (isOwnRequest(selected) || canCancelAnyWithdrawal(role, workspaceType));

  const activeList = tab === "queue" ? queue : mine;

  const saveSavingsThreshold = async (event) => {
    event.preventDefault();
    setSavingPolicy(true);
    try {
      const conditions = (activePolicy?.eligibility_conditions || []).filter((condition) => condition.type !== "MIN_SAVINGS_BALANCE");
      if (Number(minimumSavingsBalance) > 0) conditions.push({ type: "MIN_SAVINGS_BALANCE", params: { amount: Number(minimumSavingsBalance) }, blocking: true });
      if (activePolicy) {
        const response = await withdrawalService.updatePolicy(workspaceId, activePolicy._id, { eligibility_conditions: conditions });
        const data = response?.data?.data ?? response?.data ?? {};
        setActivePolicy(data.policy || data);
      } else {
        const response = await withdrawalService.createPolicy(workspaceId, { name: "Savings withdrawal eligibility", description: "Minimum member savings balance before requesting withdrawal", eligibilityConditions: conditions, activate: true });
        const data = response?.data?.data ?? response?.data ?? {};
        setActivePolicy(data.policy || data);
      }
      setActionMessage({ text: "Minimum savings balance rule saved.", isError: false });
    } catch (error) {
      setActionMessage({ text: error?.response?.data?.message || "Could not save the savings threshold.", isError: true });
    } finally { setSavingPolicy(false); }
  };

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-mist pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-mist sm:text-3xl">Withdrawals</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-mist-muted">
            Request money out of your savings, or review requests from the chama.
          </p>
        </div>
        <button
          onClick={() => { setRequestError(""); setShowRequest(true); }}
          className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
        >
          <Plus size={16} /> Request Withdrawal
        </button>
      </div>

      {actionMessage.text && (
        <div
          className={`rounded-2xl border p-3 text-xs font-semibold ${
            actionMessage.isError
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {isOfficial && (
        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-obsidian-border dark:bg-obsidian-card w-fit">
          <button
            onClick={() => setTab("mine")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              tab === "mine" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-mist-muted hover:bg-slate-100 dark:hover:bg-obsidian-raised"
            }`}
          >
            <Wallet className="h-3.5 w-3.5" /> My Withdrawals
          </button>
          <button
            onClick={() => setTab("queue")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              tab === "queue" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-mist-muted hover:bg-slate-100 dark:hover:bg-obsidian-raised"
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" /> Review Queue
          </button>
        </div>
      )}

      {isOfficial && (
        <form onSubmit={saveSavingsThreshold} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="min-w-56 flex-1"><p className="text-xs font-bold">Minimum savings balance</p><p className="mt-1 text-[11px] text-slate-500">Members must reach this balance before they can request a savings withdrawal.</p></div>
          <label className="grid gap-1 text-[11px] text-slate-500">KES<input type="number" min="0" step="0.01" value={minimumSavingsBalance} onChange={(event) => setMinimumSavingsBalance(event.target.value)} placeholder="No minimum" className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised" /></label>
          <button disabled={savingPolicy} className="h-9 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-50">{savingPolicy ? "Saving…" : "Save rule"}</button>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <WithdrawalList
          withdrawals={activeList}
          onSelect={setSelected}
          title={tab === "queue" ? "Review Queue" : "My Withdrawals"}
          subtitle={tab === "queue" ? "Every member's request for this chama." : "Your own savings withdrawal requests."}
          showMember={tab === "queue"}
          emptyLabel={loading ? "Loading..." : tab === "queue" ? "No requests to review." : "You haven't requested a withdrawal yet."}
        />

        {selected ? (
          <WithdrawalDetailsPanel
            withdrawal={selected}
            onClose={() => setSelected(null)}
            canDecide={canDecideWithdrawal(role, workspaceType)}
            canSettle={canSettleWithdrawal(role, workspaceType)}
            canCancel={canCancelSelected}
            onDecide={handleDecide}
            onSettle={handleSettle}
            onCancel={handleCancel}
            busy={busy}
          />
        ) : (
          <div className="hidden lg:flex items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center text-slate-400 dark:border-obsidian-border dark:bg-obsidian-raised/20">
            <p className="text-sm font-semibold">Select a request to view details and take action.</p>
          </div>
        )}
      </div>

      {showRequest && (
        <RequestWithdrawalModal
          plans={plans}
          busy={busy}
          error={requestError}
          onSubmit={handleRequest}
          onClose={() => setShowRequest(false)}
        />
      )}
    </div>
  );
}
