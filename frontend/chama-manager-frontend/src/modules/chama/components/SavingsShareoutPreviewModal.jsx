import { useEffect, useState } from "react";
import { X, AlertTriangle, Loader2, Users, Wallet } from "lucide-react";
import savingsShareoutService from "../services/savingsShareout.service";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function SavingsShareoutPreviewModal({ workspaceId, policy, onClose, onTriggered }) {
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await savingsShareoutService.preview(workspaceId, policy._id);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to generate preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (workspaceId && policy?._id) load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, policy?._id]);

  async function handleTrigger() {
    setTriggering(true);
    setError(null);
    try {
      const shareout = await savingsShareoutService.trigger(workspaceId, { policyId: policy._id });
      onTriggered?.(shareout);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to trigger share-out");
    } finally {
      setTriggering(false);
    }
  }

  const items = preview?.items || [];
  const totalAmount = items.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              PREVIEW SHARE-OUT
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">{policy?.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <div className="py-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-emerald-500" size={28} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <Users size={12} /> Recipients
                  </span>
                  <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{items.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <Wallet size={12} /> Total Amount
                  </span>
                  <p className="mt-1 text-xl font-black text-slate-900 dark:text-white font-mono">
                    {money(totalAmount)}
                  </p>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">MEMBER</th>
                      <th className="px-4 py-3 text-right">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                    {items.length > 0 ? (
                      items.map((item, idx) => (
                        <tr key={item.member_id?._id || item.member_id || idx}>
                          <td className="px-4 py-3 text-slate-900 dark:text-white">
                            {item.member_id?.user_id?.name || item.member_id?.name || item.name || "Member"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">
                            {money(item.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="px-4 py-8 text-center text-slate-400 font-medium">
                          No eligible recipients for this policy right now.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTrigger}
            disabled={loading || triggering || items.length === 0}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-8 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {triggering ? "Triggering..." : "Trigger Share-Out"}
          </button>
        </div>
      </div>
    </div>
  );
}