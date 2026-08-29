import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Store,
  ArrowLeft,
  CheckCircle2,
  ShoppingBag,
  Building2,
  UtensilsCrossed,
  Wrench,
  Boxes,
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import Spinner from "@/shared/components/ui/Spinner";

const CATEGORIES = [
  {
    value: "retail",
    label: "Retail & Wholesale",
    icon: ShoppingBag,
    description: "Sell physical products — track stock, restock, and sell in-store or online.",
  },
  {
    value: "rental",
    label: "Rental (Rooms & Plots)",
    icon: Building2,
    description: "List vacant rooms, apartments, or plots with photos for tenants to browse.",
  },
  {
    value: "restaurant",
    label: "Restaurant & Food",
    icon: UtensilsCrossed,
    description: "Manage a menu of dishes — no stock counts, just add, edit, and price items.",
  },
  {
    value: "service",
    label: "Service Provider",
    icon: Wrench,
    description: "Offer services (repairs, salons, consulting) priced per booking, not stocked.",
  },
  {
    value: "other",
    label: "Other",
    icon: Boxes,
    description: "Anything else — you'll get the general product & storefront tools.",
  },
];

export default function CreateBusinessPage() {
  const navigate = useNavigate();
  const { selectWorkspace, createBusiness } = useWorkspace();

  const [formData, setFormData] = useState({
    name: "",
    category: "retail",
    mPesaTill: "",
    currency: "KES",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const selectCategory = (value) => {
    setFormData((prev) => ({ ...prev, category: value }));
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
      <div className="max-w-2xl mx-auto space-y-6">
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
                Pick what kind of business this is — the tools you get are tailored to it.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                What kind of business is this?
              </label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {CATEGORIES.map(({ value, label, icon: Icon, description }) => {
                  const active = formData.category === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectCategory(value)}
                      className={`text-left rounded-xl border p-3.5 transition ${
                        active
                          ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500"
                          : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            active ? "bg-blue-600 text-white" : "bg-white text-slate-500 border border-slate-200"
                          }`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="text-xs font-bold text-slate-900">{label}</span>
                      </div>
                      <p className="text-[11px] leading-snug text-slate-500">{description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Business Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={
                  formData.category === "rental"
                    ? "e.g. Kileleshwa Rentals"
                    : "e.g. Nairobi Hardware & Supplies"
                }
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
              />
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