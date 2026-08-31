import React, { useState } from "react";
import { X, CircleDollarSign, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import contributionGroupApi from "../api/contributionGroup.api";

export default function PledgeModal({ isOpen, onClose, groupId, currentPledge = null, onSuccess }) {
  const [amount, setAmount] = useState(currentPledge ? currentPledge.pledged_amount : "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Please enter a valid pledge amount greater than KES 0.");
      return;
    }

    try {
      setLoading(true);
      await contributionGroupApi.pledge(groupId, {
        amount: numericAmount,
        reason
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to save pledge");
    } finally {
      setLoading(false);
    }
  };

  const presetAmounts = [1000, 2500, 5000, 10000, 20000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CircleDollarSign size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {currentPledge ? "Edit Your Pledge" : "Make a Pledge"}
              </h3>
              <p className="text-xs text-slate-500">Pledge your commitment to this cause</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Quick Presets (KES)</label>
            <div className="flex flex-wrap gap-2">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                    Number(amount) === preset
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  KES {preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pledge Amount (KES)</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-xs font-bold text-slate-400">KES</span>
              <input
                type="number"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5,000"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Reason / Note */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Note / Support Message (Optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Standing with the family 🙏"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 px-4 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-xs font-black text-white shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={18} />
                {currentPledge ? "Update Pledge" : "Confirm Pledge"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
