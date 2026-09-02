import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  PiggyBank,
  RotateCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Users,
  Send,
  Calendar,
  Sparkles,
  ChevronRight,
  Eye,
  Check,
} from "lucide-react";
import { useParams } from "react-router-dom";
import useWorkspace from "@/app/hooks/useWorkspace";
import MpesaStkModal from "@/modules/finance/components/MpesaStkModal";
import useFinanceSummary from "@/modules/finance/hooks/useFinanceSummary";
import financeService from "@/modules/finance/services/finance.service";
import savingsShareoutService from "@/modules/chama/services/savingsShareout.service";
import SavingsSharePolicyWizard from "@/modules/chama/components/SavingsSharePolicyWizard";
import SavingsShareoutPreviewModal from "@/modules/chama/components/SavingsShareoutPreviewModal";
import memberService from "@/modules/members/services/members.service";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function SavingsPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const workspace = useWorkspace();
  const chamaId = routeWorkspaceId || workspace.workspaceId;

  const userRole = (
    workspace?.activeWorkspace?.role ||
    workspace?.currentWorkspace?.role ||
    ""
  ).toLowerCase();

  const isTreasurer = userRole === "treasurer";
  const isChairperson = userRole === "chairperson";
  const isOfficial = isTreasurer || isChairperson || userRole === "admin" || userRole === "secretary";

  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'shareout'

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [chamaMembers, setChamaMembers] = useState([]);

  // Share-Out State
  const [policies, setPolicies] = useState([]);
  const [shareouts, setShareouts] = useState([]);
  const [loadingShareouts, setLoadingShareouts] = useState(false);
  const [showPolicyWizard, setShowPolicyWizard] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedShareoutDetails, setSelectedShareoutDetails] = useState(null);
  const [payingItemId, setPayingItemId] = useState(null);
  const [notice, setNotice] = useState(null);

  const { summary: financeSummary, refetch: refetchFinance } = useFinanceSummary(chamaId);

  const notify = (msg, type = "success") => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadBaseData = useCallback(async () => {
    if (!chamaId) return;
    try {
      const [accRes, membRes] = await Promise.allSettled([
        financeService.getAccounts(chamaId),
        memberService.getMembers(chamaId),
      ]);

      if (accRes.status === "fulfilled") setAccounts(accRes.value || []);
      if (membRes.status === "fulfilled") setChamaMembers(membRes.value || []);
    } catch {
      // ignore
    }
  }, [chamaId]);

  const loadShareoutData = useCallback(async () => {
    if (!chamaId) return;
    setLoadingShareouts(true);
    try {
      const [policiesRes, shareoutsRes] = await Promise.allSettled([
        savingsShareoutService.getPolicies(chamaId),
        savingsShareoutService.getAll(chamaId),
      ]);

      // Normalize defensively: some workspace types (e.g. burial chama)
      // can have this endpoint return a wrapped shape ({ data: [...] },
      // { policies: [...] }, etc.) instead of a bare array. Coerce to an
      // array either way so the rest of the page never has to guard.
      const toArray = (val) => {
        if (Array.isArray(val)) return val;
        if (Array.isArray(val?.data)) return val.data;
        if (Array.isArray(val?.policies)) return val.policies;
        if (Array.isArray(val?.shareouts)) return val.shareouts;
        if (Array.isArray(val?.items)) return val.items;
        return [];
      };

      if (policiesRes.status === "fulfilled") setPolicies(toArray(policiesRes.value));
      if (shareoutsRes.status === "fulfilled") setShareouts(toArray(shareoutsRes.value));
    } catch {
      // ignore
    } finally {
      setLoadingShareouts(false);
    }
  }, [chamaId]);

  useEffect(() => {
    loadBaseData();
    loadShareoutData();
  }, [chamaId, loadBaseData, loadShareoutData]);

  const safePolicies = Array.isArray(policies) ? policies : [];
  const activePolicy = safePolicies.find((p) => p.status === "active") || safePolicies[0] || null;

  // Handle Approving Shareout (Chairperson)
  const handleApproveShareout = async (shareoutId) => {
    try {
      await savingsShareoutService.approve(chamaId, shareoutId);
      notify("Savings share-out batch approved successfully!");
      loadShareoutData();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to approve share-out", "error");
    }
  };

  // Handle Paying an individual member's share (Treasurer)
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

  // Dynamic Savings numbers
  const totalSavings = financeSummary?.savings_balance ?? 0;
  const monthDeposits = financeSummary?.cash_in ?? 0;
  const monthWithdrawals = financeSummary?.cash_out ?? 0;
  const totalMembers = financeSummary?.accounts || accounts.length || 0;

  const memberSavingsList = accounts.map((acc, idx) => ({
    id: String(acc._id || idx),
    name: acc.account_code || acc.name || `Member Account ${idx + 1}`,
    balance: Number(acc.balance || acc.current_balance || 0),
    thisMonth: Number(acc.balance || 0) > 0 ? Math.round(acc.balance * 0.1) : 0,
    lastActivity: acc.updatedAt ? new Date(acc.updatedAt).toLocaleDateString() : "Recent",
  }));

  const topSavers = [...memberSavingsList]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Toast Notice */}
      {notice && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 shadow-lg animate-fade-in ${
            notice.type === "error"
              ? "border-rose-300 bg-rose-600 text-white"
              : "border-emerald-300 bg-emerald-600 text-white"
          }`}
        >
          {notice.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <p className="text-xs font-bold">{notice.msg}</p>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Savings & Share-Outs
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Manage member deposits, flexible balances, and governed savings share-outs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
          >
            <Plus size={16} /> Deposit Savings
          </button>
          {isOfficial && (
            <button
              onClick={() => {
                if (activePolicy) setShowPreviewModal(true);
                else setShowPolicyWizard(true);
              }}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
            >
              <PiggyBank size={16} /> {activePolicy ? "Trigger Share-Out" : "Setup Share-Out Policy"}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "overview"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <PiggyBank size={15} /> Savings Overview
        </button>
        <button
          onClick={() => setActiveTab("shareout")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "shareout"
              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <RotateCw size={15} /> Share-Out & Distribution ({shareouts.length})
        </button>
      </div>

      {/* Top 4 Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">TOTAL SAVINGS POOL</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(totalSavings)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">DEPOSITS (INFLOW)</span>
          <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">+{money(monthDeposits)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">SHARED OUT (OUTFLOW)</span>
          <p className="mt-2 text-2xl font-black text-rose-500">-{money(monthWithdrawals)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">ACTIVE ACCOUNTS</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{totalMembers}</p>
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          {/* Savings Growth & Top Savers */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Savings Growth</h2>
              <div className="relative h-56 w-full pt-4">
                <svg className="h-full w-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="savingsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="40" x2="500" y2="40" stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
                  <line x1="0" y1="80" x2="500" y2="80" stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
                  <path d="M 10 150 Q 100 140, 180 110 T 320 70 T 490 30 L 490 160 L 10 160 Z" fill="url(#savingsAreaGradient)" />
                  <path d="M 10 150 Q 100 140, 180 110 T 320 70 T 490 30" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" />
                  <circle cx="490" cy="30" r="5" fill="#10b981" />
                </svg>
                <div className="mt-2 flex justify-between text-[11px] font-bold text-slate-400 px-1">
                  <span>Current Year Growth Trend</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Top Savers</h2>
              <div className="space-y-3.5">
                {topSavers.length > 0 ? (
                  topSavers.map((saver) => (
                    <div key={saver.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {saver.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{saver.name}</span>
                      </div>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">{money(saver.balance)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-6">No member savings accounts recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Member Savings Table */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Member Savings Accounts</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
                  <tr>
                    <th className="px-6 py-4">MEMBER</th>
                    <th className="px-6 py-4">SAVINGS BALANCE</th>
                    <th className="px-6 py-4">EST. RECENT DEPOSITS</th>
                    <th className="px-6 py-4">LAST ACTIVITY</th>
                    <th className="px-6 py-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                  {memberSavingsList.length > 0 ? (
                    memberSavingsList.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                        <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{row.name}</td>
                        <td className="px-6 py-4 text-slate-900 dark:text-white font-mono font-bold">{money(row.balance)}</td>
                        <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-mono font-bold">+{money(row.thisMonth)}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono">{row.lastActivity}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedMember(row);
                              setIsDepositModalOpen(true);
                            }}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
                          >
                            Deposit
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-400 font-medium">
                        No savings accounts or deposits recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "shareout" && (
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
                <button
                  onClick={() => setShowPolicyWizard(true)}
                  className="rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
                >
                  {activePolicy ? "Edit Policy" : "Configure Policy"}
                </button>
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
      )}

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
                              <button
                                disabled={payingItemId === item._id}
                                onClick={() =>
                                  handlePayItem(selectedShareoutDetails._id, item._id, "mpesa")
                                }
                                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                {payingItemId === item._id ? "Disbursing..." : "Disburse via M-Pesa"}
                              </button>
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

      {/* Policy Wizard Modal */}
      {showPolicyWizard && (
        <SavingsSharePolicyWizard
          workspaceId={chamaId}
          members={chamaMembers}
          initialPolicy={activePolicy}
          onClose={() => setShowPolicyWizard(false)}
          onSuccess={() => {
            setShowPolicyWizard(false);
            notify("Savings share-out policy saved & activated!");
            loadShareoutData();
          }}
        />
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

      <MpesaStkModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        chamaId={chamaId}
        title={`Deposit Savings${selectedMember ? ` (${selectedMember.name})` : ""}`}
      />
    </div>
  );
}