import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Wallet, Send } from "lucide-react";

export default function RequestWithdrawalModal({ plans = [], onSubmit, busy, onClose, error }) {
  const [contributionPlanId, setContributionPlanId] = useState(plans[0]?._id || "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!contributionPlanId && plans.length > 0) setContributionPlanId(plans[0]._id);
  }, [plans, contributionPlanId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contributionPlanId || !amount || Number(amount) <= 0) return;
    onSubmit({ contributionPlanId, amount: Number(amount), reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 dark:border-obsidian-border dark:bg-obsidian-card shadow-2xl space-y-5 text-slate-900 dark:text-mist"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-obsidian-border pb-4">
          <div>
            <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold dark:bg-emerald-950 dark:text-emerald-400">
              SAVINGS WITHDRAWAL
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-mist mt-1">Request a Withdrawal</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:text-slate-900 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <label className="block space-y-1 text-xs font-bold text-slate-600 dark:text-mist-muted">
          <span>Savings plan</span>
          <select
            value={contributionPlanId}
            onChange={(e) => setContributionPlanId(e.target.value)}
            required
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-900 focus:border-emerald-600 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
          >
            <option value="" disabled>Select a plan</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>{p.name || p.title || "Savings Plan"}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs font-bold text-slate-600 dark:text-mist-muted">
          <span>Amount (KES)</span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="5,000"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-base font-black text-slate-900 focus:border-emerald-600 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
          />
        </label>

        <label className="block space-y-1 text-xs font-bold text-slate-600 dark:text-mist-muted">
          <span>Reason (optional)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="School fees, emergency, etc."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium text-slate-900 focus:border-emerald-600 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
          />
        </label>

        <button
          type="submit"
          disabled={busy || !contributionPlanId || !amount}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-black text-white text-base shadow-lg hover:bg-emerald-500 transition disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          <span>{busy ? "Submitting..." : "Submit Request"}</span>
        </button>

        {plans.length === 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <Wallet className="h-3.5 w-3.5" /> No active savings plans found for this chama yet.
          </p>
        )}
      </motion.form>
    </div>
  );
}