import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Store, ArrowLeft, CheckCircle2 } from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import Spinner from "@/shared/components/ui/Spinner";

export default function CreateBusinessPage() {
  const navigate = useNavigate();
  const { selectWorkspace, createBusiness } = useWorkspace();

  const [formData, setFormData] = useState({
    name: "",
    category: "Retail & Wholesale",
    mPesaTill: "",
    currency: "KES",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);

    try {
      const workspace = await createBusiness(formData);
      selectWorkspace(workspace);
      navigate(`/workspace/${workspace.id ?? workspace._id}/business`, { replace: true });
    } catch (err) {
      console.error("Failed to create business workspace:", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-900 px-4 py-8 sm:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        <Link
          to="/home"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft size={14} /> Back to Home
        </Link>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Store size={24} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">
                Create Business Workspace
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Setup sales invoicing, inventory tracking, and M-Pesa clearing.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Business Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Nairobi Hardware & Supplies"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Category / Industry
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                >
                  <option value="Retail & Wholesale">Retail & Wholesale</option>
                  <option value="Hardware & Construction">Hardware & Construction</option>
                  <option value="Pharmacy & Healthcare">Pharmacy & Healthcare</option>
                  <option value="Services & Logistics">Services & Logistics</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  M-Pesa Till / Paybill (Optional)
                </label>
                <input
                  type="text"
                  name="mPesaTill"
                  value={formData.mPesaTill}
                  onChange={handleChange}
                  placeholder="e.g. 7829101"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Spinner size="xs" /> Creating Workspace...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Launch Business Dashboard
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
