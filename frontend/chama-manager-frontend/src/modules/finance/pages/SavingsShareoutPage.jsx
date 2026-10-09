import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PiggyBank,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";
import savingsShareoutService from "@/modules/chama/services/savingsShareout.service";
import SavingsShareoutPreviewModal from "@/modules/chama/components/SavingsShareoutPreviewModal";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import { StatCard, money } from "../components/FinanceUi";

// ============================================================
// SAVINGS SHARE-OUT
// ============================================================
//
// Governed distribution of the savings pool back to members.
//
// This used to be a tab inside SavingsPage, with /finance/savings and
// /finance/savings-shareout both mounting that same component — so the
// two nav items led to what looked like one duplicated page. They are
// now genuinely separate:
//
//   Savings         - the pool: deposits, balances, growth
//   Share-Out       - releasing that pool: policy, batches, disbursement
//
// The split also matches how the money actually moves. A deposit is a
// single member action; a share-out is a governed batch that must be
// previewed, approved by the chairperson, and then disbursed line by
// line by the treasurer.
//
// Policy CONFIGURATION deliberately isn't here - the share rule,
// trigger and eligible approvers are a leadership mutation behind the
// leadership PIN (see modules/leadership/tabs/TreasuryOversightTab).
// Running a share-out from an already-active policy is operational, so
// it stays on this page.
//
// ============================================================

export default function SavingsShareoutPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const workspace = useWorkspace();
  const chamaId = routeWorkspaceId || workspace.workspaceId;

  const { role, canForOthers } = useWorkspacePermissions(chamaId);

  // Approving a batch and disbursing a line are two different powers and
  // are held by two different officers, so they're asked about
  // separately rather than collapsed into one "is an official" flag the
  // way the old tab did it.
  const isChairperson = String(role || "").toLowerCase() === "chairperson";
  const isTreasurer = String(role || "").toLowerCase() === "treasurer";
  const isOfficial = canForOthers("finance.summary.view") || isChairperson || isTreasurer;

  const [policies, setPolicies] = useState([]);
  const [shareouts, setShareouts] = useState([]);
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedShareoutDetails, setSelectedShareoutDetails] = useState(null);
  const [payingItemId, setPayingItemId] = useState(null);
  const [shareoutMethod, setShareoutMethod] = useState({});
  const [notice, setNotice] = useState(null);

  const notify = (msg, type = "success") => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  };

  // Some workspace types return a wrapped shape here instead of a bare
  // array, so coerce either way and let the rest of the page stop
  // guarding every access.
  const toArray = (val) => {
    if (Array.isArray(val)) return val;
    if (Array.isArray(val?.data)) return val.data;
    if (Array.isArray(val?.policies)) return val.policies;
    if (Array.isArray(val?.shareouts)) return val.shareouts;
    if (Array.isArray(val?.items)) return val.items;
    return [];
  };

  const loadShareoutData = useCallback(async () => {
    if (!chamaId) return;
    setIsLoading(true);

    try {
      const [policiesRes, shareoutsRes, overviewRes] = await Promise.allSettled([
        savingsShareoutService.getPolicies(chamaId),
        savingsShareoutService.getAll(chamaId),
        savingsShareoutService.getOverview(chamaId),
      ]);

      if (policiesRes.status === "fulfilled") setPolicies(toArray(policiesRes.value));
      if (shareoutsRes.status === "fulfilled") setShareouts(toArray(shareoutsRes.value));
      if (overviewRes.status === "fulfilled") setOverview(overviewRes.value);
    } finally {
      setIsLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    loadShareoutData();
  }, [loadShareoutData]);

  const safePolicies = Array.isArray(policies) ? policies : [];
  const activePolicy =
    safePolicies.find((p) => p.status === "active") || safePolicies[0] || null;

  const totals = overview?.totals || {};

  // Batch-level rollups, so the page leads with the position rather than
  // making anyone add up a table to find out what's still unpaid.
  const batchStats = useMemo(() => {
    let distributed = 0;
    let pendingApproval = 0;
    let awaitingDisbursement = 0;

    shareouts.forEach((batch) => {
      const items = batch.items || [];
      const batchTotal =
        Number(batch.total_amount || 0) ||
        items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

      if (batch.status === "pending_approval") {
        pendingApproval += batchTotal;
      } else if (["approved", "completed"].includes(batch.status)) {
        items.forEach((item) => {
          if (item.status === "paid") distributed += Number(item.amount || 0);
          else awaitingDisbursement += Number(item.amount || 0);
        });
      }
    });

    return { distributed, pendingApproval, awaitingDisbursement };
  }, [shareouts]);

  const handleApproveShareout = async (shareoutId) => {
    try {
      await savingsShareoutService.approve(chamaId, shareoutId);
      notify("Savings share-out batch approved successfully!");
      loadShareoutData();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to approve share-out", "error");
    }
  };

  const handlePayItem = async (shareoutId, itemId, method = "mpesa") => {
    setPayingItemId(itemId);
    try {
      await savingsShareoutService.payItem(chamaId, shareoutId, itemId, {
        disbursementMethod: method,
        externalReference: `SAVINGS-DISBURSE-${Date.now()}`,
      });
      notify("Member savings share marked as paid!");
      loadShareoutData();

      if (selectedShareoutDetails && selectedShareoutDetails._id === shareoutId) {
        const updated = await savingsShareoutService.getOne(chamaId, shareoutId);
        setSelectedShareoutDetails(updated);
      }
    } catch (err) {
      notify(err.response?.data?.message || "Failed to disburse share-out item", "error");
    } finally {
      setPayingItemId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900 dark:text-slate-100">
      {notice && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 shadow-lg ${
            notice.type === "error"
              ? "border-rose-300 bg-rose-600 text-white"
              : "border-emerald-300 bg-emerald-600 text-white"
          }`}
        >
          {notice.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <p className="text-xs font-bold">{notice.msg}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Savings Share-Out
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Release the savings pool back to members under a governed, approved policy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadShareoutData}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>

          <Link
            to={`/workspace/${chamaId}/finance/savings`}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Wallet size={14} />
            Back to Savings
          </Link>
        </div>
      </div>

      {/* Position */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pool available"
          value={money(totals.total_savings)}
          icon={Wallet}
          tone="emerald"
          footnote={`${totals.active_savers || 0} member${
            totals.active_savers === 1 ? "" : "s"
          } with a balance`}
        />
        <StatCard
          label="Distributed to date"
          value={money(batchStats.distributed)}
          icon={PiggyBank}
          tone="indigo"
          footnote="Paid out across all approved batches"
        />
        <StatCard
          label="Awaiting disbursement"
          value={money(batchStats.awaitingDisbursement)}
          icon={Clock}
          tone="amber"
          footnote="Approved, not yet paid to the member"
        />
        <StatCard
          label="Pending approval"
          value={money(batchStats.pendingApproval)}
          icon={ShieldCheck}
          tone={batchStats.pendingApproval > 0 ? "rose" : "slate"}
          footnote={
            batchStats.pendingApproval > 0
              ? "Blocked until the chairperson approves"
              : "No batch waiting on a decision"
          }
        />
      </div>

      <div className="space-y-6">
        {/* Active Policy Status Card */}
        <div className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-6 dark:border-indigo-950 dark:bg-indigo-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
              <ShieldCheck size={26} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                SAVINGS SHARE-OUT POLICY
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {activePolicy ? activePolicy.name : "No Policy Configured"}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {activePolicy
                  ? `Mode: ${activePolicy.share_rule?.mode === 'percentage_of_balance' ? `${activePolicy.share_rule?.percentage}% of contributor balance` : `Fixed KES ${activePolicy.share_rule?.fixed_amount}`} · Trigger: ${activePolicy.trigger_rule?.type || 'manual'}`
                  : "Configure a policy to enable automatic or one-click year-end savings share-outs."}
              </p>
            </div>
          </div>

          {isOfficial && (
            <div className="flex items-center gap-2">
              <Link
                to={`/workspace/${chamaId}/leadership?tab=treasury`}
                className="rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
              >
                {activePolicy ? "Edit Policy in Leadership Desk" : "Configure Policy in Leadership Desk"}
              </Link>
              {activePolicy && (
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-indigo-700 transition"
                >
                  <PiggyBank size={15} /> Trigger Share-Out
                </button>
              )}
            </div>
          )}
        </div>

        {/* Share-Out Batches Table */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Share-Out History & Batches</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
                <tr>
                  <th className="px-6 py-4">BATCH / DATE</th>
                  <th className="px-6 py-4">RECIPIENTS</th>
                  <th className="px-6 py-4">TOTAL AMOUNT</th>
                  <th className="px-6 py-4 text-center">STATUS</th>
                  <th className="px-6 py-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                {shareouts.length > 0 ? (
                  shareouts.map((sh) => (
                    <tr key={sh._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {sh.name || `Share-Out #${String(sh._id).slice(-4).toUpperCase()}`}
                        </p>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {sh.createdAt ? new Date(sh.createdAt).toLocaleDateString() : "Recent"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {sh.items?.length || 0} Members
                      </td>
                      <td className="px-6 py-4 font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {money(sh.total_amount || sh.items?.reduce((s, i) => s + Number(i.amount || 0), 0) || 0)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {sh.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 size={12} /> Approved
                          </span>
                        ) : sh.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-extrabold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                            <CheckCircle2 size={12} /> Disbursed
                          </span>
                        ) : sh.status === "cancelled" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            <XCircle size={12} /> Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            <Clock size={12} /> Pending Approval
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {sh.status === "pending_approval" && isChairperson && (
                            <button
                              onClick={() => handleApproveShareout(sh._id)}
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700"
                            >
                              Approve Batch
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedShareoutDetails(sh)}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                          >
                            View Breakdown
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                      No savings share-out runs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Shareout Breakdown Details Modal */}
      {selectedShareoutDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  SHARE-OUT LINE ITEMS
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {selectedShareoutDetails.name || `Shareout #${String(selectedShareoutDetails._id).slice(-4)}`}
                </h3>
              </div>
              <button
                onClick={() => setSelectedShareoutDetails(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="py-4 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 uppercase text-[10px] font-extrabold text-slate-400 sticky top-0 bg-white dark:bg-slate-900">
                  <tr>
                    <th className="py-2.5">MEMBER</th>
                    <th className="py-2.5">SHARE AMOUNT</th>
                    <th className="py-2.5 text-center">STATUS</th>
                    {isTreasurer && <th className="py-2.5 text-right">ACTION</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(selectedShareoutDetails.items || []).map((item) => {
                    const memberName =
                      item.member_id?.user_id?.name ||
                      item.member_id?.name ||
                      item.member_name ||
                      "Member";
                    const isPaid = item.status === "paid";

                    return (
                      <tr key={item._id || item.member_id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-bold text-slate-900 dark:text-white">{memberName}</td>
                        <td className="py-3 font-mono font-black text-emerald-600">{money(item.amount)}</td>
                        <td className="py-3 text-center">
                          {isPaid ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                              Paid
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
                              Pending
                            </span>
                          )}
                        </td>
                        {isTreasurer && (
                          <td className="py-3 text-right">
                            {!isPaid && (
                              <div className="flex justify-end gap-2">
                                <select aria-label={`Disbursement destination for ${memberName}`} value={shareoutMethod[item._id] || "mpesa"} onChange={(event) => setShareoutMethod((current) => ({ ...current, [item._id]: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
                                  <option value="mpesa">M-Pesa</option><option value="wallet">Member wallet</option><option value="bank">Bank</option><option value="cash">Cash</option>
                                </select>
                                <button
                                  disabled={payingItemId === item._id}
                                  onClick={() => handlePayItem(selectedShareoutDetails._id, item._id, shareoutMethod[item._id] || "mpesa")}
                                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                                >{payingItemId === item._id ? "Disbursing..." : "Disburse"}</button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedShareoutDetails(null)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shareout Preview Modal */}
      {showPreviewModal && activePolicy && (
        <SavingsShareoutPreviewModal
          workspaceId={chamaId}
          policy={activePolicy}
          onClose={() => setShowPreviewModal(false)}
          onTriggered={(res) => {
            setShowPreviewModal(false);
            notify("Savings share-out generated & queued for official approval!");
            loadShareoutData();
          }}
        />
      )}
    </div>
  );
}
