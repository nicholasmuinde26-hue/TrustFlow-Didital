import { confirmAction, notifyResult } from "@/shared/feedback/ConfirmProvider";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Settings, Building2, Receipt, Save, CheckCircle2, ShieldCheck, X, Users, UserPlus, Activity, Trash2 } from "lucide-react";
import { useBusinessSummary } from "../hooks/useBusiness";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import businessService from "../services/business.service";
import Spinner from "@/shared/components/ui/Spinner";

export default function BusinessSettingsPage() {
  const navigate = useNavigate();
  const { workspaceId, currentWorkspace } = useWorkspace();
  const { data, isLoading } = useBusinessSummary(workspaceId);
  const [staff, setStaff] = useState([]);
  const [activity, setActivity] = useState([]);
  const [invite, setInvite] = useState({ email: "", role: "cashier" });
  const isBusinessOwner = (currentWorkspace?.type || "").toLowerCase() === "business" && data?.profile?.access?.role === "owner";

  const loadTeam = async () => {
    if (!workspaceId || !isBusinessOwner) return;
    try {
      const [members, events] = await Promise.all([businessService.getStaff(workspaceId), businessService.getActivity(workspaceId)]);
      setStaff(members);
      setActivity(events);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load business team activity");
    }
  };

  useEffect(() => { loadTeam(); }, [workspaceId, isBusinessOwner]);

  const addStaff = async (event) => {
    event.preventDefault();
    try {
      await businessService.appointStaff(workspaceId, invite);
      setInvite({ email: "", role: "cashier" });
      toast.success("Worker added to the business workspace");
      await loadTeam();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not add worker");
    }
  };

  const removeStaff = async (staffId) => {
    const ok = await confirmAction({
      title: "Revoke this worker's access?",
      message: "They will immediately lose access to this business workspace.",
      variant: "danger",
      confirmText: "Revoke access",
    });
    if (!ok) return;
    try {
      await businessService.revokeStaff(workspaceId, staffId);
      toast.success("Worker access revoked");
      await loadTeam();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not revoke worker access");
    }
  };

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
      toast.success("Business settings saved");
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Business Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure your enterprise profiles, tax rates, and payment integration clearing accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
              <CheckCircle2 size={15} /> Settings Saved
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              border
              border-slate-200
              bg-white
              text-slate-500
              hover:bg-slate-50
              hover:text-slate-700
              transition
              dark:border-slate-700
              dark:bg-slate-800
              dark:text-slate-400
              dark:hover:bg-slate-700
              dark:hover:text-slate-200
            "
            aria-label="Close settings"
            title="Close settings"
          >
            <X size={20} />
          </button>
        </div>
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

      {isBusinessOwner && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <Users size={20} className="text-violet-600" />
            <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Business team</h2><p className="text-xs text-slate-500">The owner appoints workers and reviews their recorded sales and expenses.</p></div>
          </div>
          <form onSubmit={addStaff} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <input required type="email" value={invite.email} onChange={(e) => setInvite((prev) => ({ ...prev, email: e.target.value }))} placeholder="Worker's registered email" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            <select value={invite.role} onChange={(e) => setInvite((prev) => ({ ...prev, role: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="cashier">Cashier · sales</option><option value="inventory">Stock manager</option><option value="accountant">Accounts · expenses</option><option value="manager">Manager · full access</option>
            </select>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white"><UserPlus size={16} /> Add worker</button>
          </form>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {staff.length === 0 ? <p className="py-4 text-sm text-slate-500">No workers have been appointed yet.</p> : staff.map((entry) => <div key={entry._id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.user_id?.name || entry.user_id?.email}</p><p className="text-xs text-slate-500">{entry.user_id?.email || entry.user_id?.phone} · {entry.role}</p></div><button type="button" onClick={() => removeStaff(entry._id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Revoke access"><Trash2 size={16} /></button></div>)}
          </div>
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white"><Activity size={16} /> Recent team activity</h3>
            {activity.length === 0 ? <p className="py-3 text-xs text-slate-500">Worker sales and expenses will appear here.</p> : <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">{activity.map((event) => <div key={event.id} className="flex items-center justify-between gap-3 py-2.5 text-xs"><div><p className="font-semibold text-slate-800 dark:text-slate-200">{event.worker?.name || "Former worker"} · {event.action}</p><p className="text-slate-500">{event.description || "Business transaction"} · {new Date(event.created_at).toLocaleString()}</p></div>{Number(event.amount || 0) > 0 && <span className="shrink-0 font-bold text-slate-700 dark:text-slate-300">{currentWorkspace?.currency || "KES"} {Number(event.amount).toLocaleString()}</span>}</div>)}</div>}
          </div>
        </section>
      )}
    </div>
  );
}
