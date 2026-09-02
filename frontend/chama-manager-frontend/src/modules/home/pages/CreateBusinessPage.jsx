import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  ArrowLeft,
  CheckCircle2,
  ShoppingBag,
  Building2,
  UtensilsCrossed,
  Wrench,
  Boxes,
  MapPin,
  Calendar,
  Receipt,
  DollarSign,
  Phone
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import Spinner from "@/shared/components/ui/Spinner";

const CATEGORIES = [
  {
    value: "rental",
    label: "🏠 Rental (Rooms, Apartments & Plots)",
    icon: Building2,
    description: "Properties, Units, Tenants, Leases, Rent Collections & Maintenance.",
  },
  {
    value: "retail",
    label: "🛒 Retail & Wholesale",
    icon: ShoppingBag,
    description: "Products, Inventory Stock, POS, Sales, Purchases & Suppliers.",
  },
  {
    value: "restaurant",
    label: "🍽️ Restaurant & Food",
    icon: UtensilsCrossed,
    description: "Menu Items, Tables & Orders, Kitchen View, Bills & Payments.",
  },
  {
    value: "service",
    label: "🛠️ Service Provider",
    icon: Wrench,
    description: "Services, Appointments, Customer Jobs, Invoices & Expenses.",
  },
  {
    value: "other",
    label: "📦 Other (Generic Business)",
    icon: Boxes,
    description: "Sales, Customers, Suppliers, Invoices, Expenses & General Finance.",
  },
];

export default function CreateBusinessPage() {
  const navigate = useNavigate();
  const { selectWorkspace, createBusiness } = useWorkspace();

  const [formData, setFormData] = useState({
    name: "",
    category: "rental",
    currency: "KES",
    location: "Nairobi, Kenya",
    fiscalYearStart: "January",
    vatRegistered: false,
    vatRate: 16,
    taxId: "",
    mPesaTill: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const selectCategory = (value) => {
    setFormData((prev) => ({ ...prev, category: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);

    try {
      const workspace = await createBusiness({
        name: formData.name,
        category: formData.category,
        currency: formData.currency,
        location: formData.location,
        fiscalYearStart: formData.fiscalYearStart,
        vat_registered: formData.vatRegistered,
        vat_rate: Number(formData.vatRate || 16),
        tax_id: formData.taxId,
        mPesaTill: formData.mPesaTill,
      });

      selectWorkspace(workspace);
      navigate(`/workspace/${workspace.id ?? workspace._id}/business`, { replace: true });
    } catch (err) {
      console.error("Failed to create business workspace:", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-900 px-4 py-8 sm:px-8 pb-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="rounded-2xl bg-blue-50 p-3.5 text-blue-600">
              <Store size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">
                Create Business Workspace
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Set up business details and pick your specialized operational layer.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Select Business Type */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                1. Select Business Type
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {CATEGORIES.map(({ value, label, icon: Icon, description }) => {
                  const active = formData.category === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectCategory(value)}
                      className={`text-left rounded-2xl border p-4 transition-all ${
                        active
                          ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500 shadow-sm"
                          : "border-slate-200 bg-slate-50/40 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                            active ? "bg-blue-600 text-white" : "bg-white text-slate-500 border border-slate-200"
                          }`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">{label}</span>
                      </div>
                      <p className="text-[11px] leading-snug text-slate-500">{description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: General Business Details */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                2. Business Profile & Currency
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
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
                        ? "e.g. Kileleshwa Real Estate & Apartments"
                        : formData.category === "restaurant"
                        ? "e.g. Mama Oliech Restaurant"
                        : "e.g. Nairobi Hardware & Supplies"
                    }
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <DollarSign size={13} className="text-slate-400" /> Currency
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                  >
                    <option value="KES">KES - Kenyan Shilling</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="UGX">UGX - Ugandan Shilling</option>
                    <option value="TZS">TZS - Tanzanian Shilling</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <MapPin size={13} className="text-slate-400" /> Business Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="e.g. Nairobi CBD, Westlands"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Calendar size={13} className="text-slate-400" /> Fiscal Year Start
                  </label>
                  <select
                    name="fiscalYearStart"
                    value={formData.fiscalYearStart}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                  >
                    <option value="January">January</option>
                    <option value="April">April</option>
                    <option value="July">July</option>
                    <option value="October">October</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Tax & Banking Configuration */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                3. Tax & M-Pesa Settings
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="vatRegistered"
                      checked={formData.vatRegistered}
                      onChange={handleChange}
                      className="accent-blue-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Receipt size={14} className="text-blue-600" /> VAT Registered Business
                    </span>
                  </label>
                  {formData.vatRegistered && (
                    <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">
                      VAT Active
                    </span>
                  )}
                </div>

                {formData.vatRegistered && (
                  <div className="grid gap-3 sm:grid-cols-2 pt-2 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        VAT Rate (%)
                      </label>
                      <input
                        type="number"
                        name="vatRate"
                        value={formData.vatRate}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        KRA PIN / Tax ID
                      </label>
                      <input
                        type="text"
                        name="taxId"
                        value={formData.taxId}
                        onChange={handleChange}
                        placeholder="e.g. A012345678Z"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono uppercase text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Phone size={13} className="text-slate-400" /> M-Pesa Till / Paybill (Optional)
                </label>
                <input
                  type="text"
                  name="mPesaTill"
                  value={formData.mPesaTill}
                  onChange={handleChange}
                  placeholder="e.g. 7829101 or 522522"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-xs font-extrabold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Spinner size="xs" /> Creating Workspace...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Launch Tailored Business Dashboard
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}