import { useState } from "react";
import { Scale, Plus, Check, X as XIcon, Ban, Loader2 } from "lucide-react";
import useWorkspace from "../../../app/hooks/useWorkspace";
import useAdjustments from "../hooks/useAdjustments";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import RequestAdjustmentModal from "../components/RequestAdjustmentModal";
import { Card, SectionHeading, StatusPill, EmptyState, formatDate, money } from "../components/FinanceUi";
import Spinner from "../../../shared/components/ui/Spinner";
import financeService from "../services/finance.service";

export default function AdjustmentsPage() {
  const workspace = useWorkspace();
  const { workspaceId } = workspace;
  const { adjustments, loading, refetch } = useAdjustments(workspaceId);
  const { role, membershipId } = useWorkspacePermissions(workspaceId);

  const [isModalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const isTreasurer = role === "treasurer";
  const isChairperson = role === "chairperson";
  const canRequest = isTreasurer;
  const canDecide = isTreasurer || isChairperson;

  const decide = async (adjustment, decision) => {
    setBusyId(adjustment._id);
    setError(null);
    try {
      await financeService.decideAdjustment(workspaceId, adjustment._id, { decision });
      await refetch();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not record that decision.");
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (adjustment) => {
    setBusyId(adjustment._id);
    setError(null);
    try {
      await financeService.cancelAdjustment(workspaceId, adjustment._id);
      await refetch();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not cancel this adjustment.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-mist">Ledger Adjustments</h1>
          <p className="text-slate-500 dark:text-mist-muted">
            Manual DR/CR corrections, each requiring independent sign-off before posting.
          </p>
        </div>

        {canRequest && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus size={16} />
            Request Adjustment
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <Card className="p-5">
        <SectionHeading title="All adjustments" subtitle={`${adjustments.length} total`} />

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : adjustments.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No adjustments yet"
            description={
              canRequest
                ? "Request one when the ledger needs a manual correction."
                : "The treasurer can request one when the ledger needs a manual correction."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:border-obsidian-border">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">DR / CR</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adj) => {
                  const isInitiator = String(adj.initiated_by?._id || adj.initiated_by) === String(membershipId);
                  const isBusy = busyId === adj._id;
                  const canDecideThis = canDecide && adj.status === "pending" && !isInitiator;
                  const canCancelThis =
                    adj.status === "pending" && (isInitiator || isTreasurer || isChairperson);

                  return (
                    <tr key={adj._id} className="border-b border-slate-50 dark:border-obsidian-border/60">
                      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">
                        {formatDate(adj.createdAt)}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="font-semibold text-slate-800 dark:text-mist">
                          {adj.debit_account_id?.name || "—"}
                        </span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-semibold text-slate-800 dark:text-mist">
                          {adj.credit_account_id?.name || "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-bold text-slate-900 dark:text-white">
                        {money(adj.amount)}
                      </td>
                      <td className="py-3 pr-3 max-w-xs truncate text-slate-600 dark:text-slate-300">
                        {adj.reason}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusPill status={adj.status} />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          {canDecideThis && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => decide(adj, "approved")}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => decide(adj, "rejected")}
                                className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
                              >
                                <XIcon size={13} />
                                Reject
                              </button>
                            </>
                          )}
                          {canCancelThis && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => cancel(adj)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <Ban size={13} />
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RequestAdjustmentModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        workspaceId={workspaceId}
        onRequested={() => {
          setModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
