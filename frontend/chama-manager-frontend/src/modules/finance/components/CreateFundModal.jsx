import { useState } from "react";
import { X, PiggyBank, Plus, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import api from "@/app/services/api";

export default function CreateFundModal({ isOpen, onClose, workspaceId, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    contribution_type: "fixed", // 'fixed' | 'free_will' | 'flexible'
    frequency: "monthly", // 'monthly' | 'weekly' | 'one_time'
    amount: "1000",
    target_amount: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    is_permanent: false,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Please enter a fund name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        owner_type: "Chama",
        owner_id: workspaceId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        contribution_type: form.contribution_type,
        frequency: form.frequency,
        amount: form.contribution_type === "fixed" ? Number(form.amount) : undefined,
        target_amount: form.target_amount ? Number(form.target_amount) : undefined,
        start_date: form.start_date ? new Date(form.start_date) : new Date(),
        end_date: form.end_date ? new Date(form.end_date) : undefined,
        is_permanent: form.is_permanent,
      };

      const { data } = await api.post("/contribution-plans", payload);
      onCreated?.(data.data?.plan || data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create contribution fund");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <PiggyBank size={20} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                CHAMA CONTRIBUTION FUND
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Create Embedded Fund</h3>
            </div>
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Fund Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Welfare & Emergency Fund, Land Project"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Purpose of this fund and how contributions will be managed..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Contribution Type
              </label>
              <select
                value={form.contribution_type}
                onChange={(e) => setForm({ ...form, contribution_type: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none"
              >
                <option value="fixed">Fixed Amount</option>
                <option value="free_will">Free-Will / Flexible</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Frequency
              </label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="one_time">One-Time Event</option>
              </select>
            </div>
          </div>

          {form.contribution_type === "fixed" && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Expected Amount Per Member (KES) *
              </label>
              <input
                type="number"
                min={1}
                required
                placeholder="1000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono font-bold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Pool Goal (KES)
              </label>
              <input
                type="number"
                placeholder="e.g. 500000"
                value={form.target_amount}
                onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="permanent_checkbox"
              checked={form.is_permanent}
              onChange={(e) => setForm({ ...form, is_permanent: e.target.checked })}
              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="permanent_checkbox" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Continuous / Permanent Standing Fund
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 font-black text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span>{loading ? "Creating..." : "Create Fund"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
