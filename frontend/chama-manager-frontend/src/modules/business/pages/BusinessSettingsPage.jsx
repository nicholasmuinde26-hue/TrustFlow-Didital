import React, { useState, useEffect } from "react";
import { Settings, Building2, Receipt, Save, CheckCircle2, ShieldCheck } from "lucide-react";
import { useBusinessSummary } from "../hooks/useBusiness";
import Spinner from "@/shared/components/ui/Spinner";

export default function BusinessSettingsPage() {
  const { data, isLoading } = useBusinessSummary();

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    currency: "KES",
    taxRate: 16,
    mPesaTill: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      const profile = data?.profile || data;
      setFormData({
        name: profile?.name || "Kijiji Supplies & Enterprise",
        category: profile?.category || "Retail & Wholesale",
        currency: profile?.currency || "KES",
        taxRate: profile?.taxRate ?? 16,
        mPesaTill: profile?.mPesaTill || "7829101",
      });
    }
  }, [data]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (saved) setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSaving(true);

    // Simulate API update call
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 600);
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Business Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure your enterprise profiles, tax rates, and payment integration clearing accounts.
          </p>
        </div>

        {saved && (
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
            <CheckCircle2 size={15} /> Settings Saved
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ================= 1. PROFILE DETAILS ================= */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Building2 size={20} className="text-violet-600" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              Business Information
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Business Legal / Operating Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:bg-white focus:border-violet-500 focus:outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Industry Category
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:bg-white focus:border-violet-500 focus:outline-none transition"
                required
              />
            </div>
          </div>
        </div>

        {/* ================= 2. TAX & PAYMENT TILLS ================= */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Receipt size={20} className="text-violet-600" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              Tax & Payment Configurations
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                VAT / Tax Rate (%)
              </label>
              <input
                type="number"
                name="taxRate"
                value={formData.taxRate}
                onChange={handleChange}
                min="0"
                max="100"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-mono font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:bg-white focus:border-violet-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Primary Currency
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:bg-white focus:border-violet-500 focus:outline-none transition"
              >
                <option value="KES">KES - Kenyan Shilling</option>
                <option value="USD">USD - US Dollar</option>
                <option value="UGX">UGX - Ugandan Shilling</option>
                <option value="TZS">TZS - Tanzanian Shilling</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Default M-Pesa Till / Paybill
              </label>
              <input
                type="text"
                name="mPesaTill"
                value={formData.mPesaTill}
                onChange={handleChange}
                placeholder="7829101"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-mono font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:bg-white focus:border-violet-500 focus:outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* ================= 3. SAVE BUTTON ================= */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 transition"
          >
            {isSaving ? (
              <>
                <Spinner size="xs" /> Saving...
              </>
            ) : (
              <>
                <Save size={15} /> Save Configurations
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}