import { useState } from "react";
import {
  Building2,
  Store,
  Wallet,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Users,
  MapPin,
  Calendar,
  FileText,
  BadgeCheck,
} from "lucide-react";
import workspaceRequestService from "@/app/services/workspaceRequest.service";
import useAuth from "@/app/hooks/useAuth";

const ENTITY_TYPES = [
  {
    type: "chama",
    label: "Chama",
    description: "Members, treasury, and rotational or welfare savings",
    icon: Building2,
    color: "violet",
  },
  {
    type: "business",
    label: "Business",
    description: "Sales, point of sale, inventory, and accounts",
    icon: Store,
    color: "blue",
  },
  {
    type: "contribution_group",
    label: "Contribution Group",
    description: "Structured collections and crowd-funding causes",
    icon: Wallet,
    color: "emerald",
  },
];

const KENYA_COUNTIES = [
  "Machakos",
  "Nairobi",
  "Kiambu",
  "Makueni",
  "Kitui",
  "Kajiado",
  "Nakuru",
  "Mombasa",
  "Uasin Gishu",
  "Kisumu",
  "Meru",
  "Nyeri",
  "Murang'a",
  "Embu",
  "Kilifi",
  "Kakamega",
  "Other",
];

const COMMITTEE_ROLES = [
  "Vice Chairperson",
  "Organizing Secretary",
  "Vice Treasurer",
  "Committee Member",
  "Welfare Coordinator",
  "Disciplinary Lead",
  "Elder / Patron",
];

export default function WorkspaceRequestModal({
  isOpen,
  onClose,
  initialType = "chama",
  onSuccess,
}) {
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1); // 1: Entity & Location Details, 2: Leadership, 3: Committee
  const [entityType, setEntityType] = useState(initialType || "chama");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("standard");
  const [monthlySavings, setMonthlySavings] = useState(1000);
  const [description, setDescription] = useState("");

  // Detailed Kenyan Chama / Organization Details
  const [details, setDetails] = useState({
    registrationType: "Self-Help Group",
    county: "Machakos",
    subCounty: "",
    location: "Kangundo",
    physicalAddress: "",
    phone: user?.phone || "",
    email: user?.email || "",
    yearEstablished: new Date().getFullYear().toString(),
    purpose: "Savings, Investment, and Community Welfare",
    memberCount: 20,
    meetingFrequency: "Monthly",
    contributionFrequency: "Monthly",
  });

  // Leadership Contacts (Chairperson, Treasurer, Secretary)
  const [chairperson, setChairperson] = useState({
    fullName: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    idNumber: "",
  });

  const [treasurer, setTreasurer] = useState({
    fullName: "",
    phone: "",
    email: "",
    idNumber: "",
  });

  const [secretary, setSecretary] = useState({
    fullName: "",
    phone: "",
    email: "",
    idNumber: "",
  });

  // Dynamic Committee Members list
  const [committeeMembers, setCommitteeMembers] = useState([
    { role: "Vice Chairperson", fullName: "", phone: "", email: "", idNumber: "" },
    { role: "Organizing Secretary", fullName: "", phone: "", email: "", idNumber: "" },
    { role: "Committee Member", fullName: "", phone: "", email: "", idNumber: "" },
  ]);

  const [extraNotes, setExtraNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedData, setSubmittedData] = useState(null);

  if (!isOpen) return null;

  function addCommitteeMember() {
    setCommitteeMembers((prev) => [
      ...prev,
      { role: "Committee Member", fullName: "", phone: "", email: "", idNumber: "" },
    ]);
  }

  function removeCommitteeMember(index) {
    setCommitteeMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCommitteeMember(index, field, value) {
    setCommitteeMembers((prev) =>
      prev.map((cm, i) => (i === index ? { ...cm, [field]: value } : cm))
    );
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter the name of your Chama or Organization.");
      return;
    }

    if (entityType === "chama") {
      if (!chairperson.fullName || !chairperson.phone) {
        setError("Chairperson full name and phone number are required.");
        setCurrentStep(2);
        return;
      }
      if (!treasurer.fullName || !treasurer.phone) {
        setError("Treasurer full name and phone number are required.");
        setCurrentStep(2);
        return;
      }
      if (!secretary.fullName || !secretary.phone) {
        setError("Secretary full name and phone number are required.");
        setCurrentStep(2);
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        entityType,
        name: name.trim(),
        description: description.trim(),
        category,
        monthlySavings: Number(monthlySavings) || 1000,
        details,
        chairperson,
        treasurer,
        secretary,
        committeeMembers: committeeMembers.filter(
          (cm) => cm.fullName.trim() || cm.phone.trim()
        ),
        extraNotes: extraNotes.trim(),
      };

      const res = await workspaceRequestService.submitRequest(payload);
      setSubmittedData(res.request || res);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to submit workspace creation request. Please verify inputs."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X size={20} />
        </button>

        {/* SUBMITTED CONFIRMATION SCREEN */}
        {submittedData ? (
          <div className="space-y-6 py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 font-mono text-xs font-black text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                <BadgeCheck size={14} />
                <span>{submittedData.requestNumber || "CHAMA-REQ-000184"}</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Workspace Request Submitted
              </h3>
              <p className="mx-auto max-w-md text-xs text-slate-500 leading-relaxed dark:text-slate-400">
                Your Chama Workspace Request has been submitted. Vericircle administration will review the leadership and committee contacts and create your workspace once approved.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left dark:border-slate-800 dark:bg-slate-800/40 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded dark:bg-amber-950/50">
                  PENDING_REVIEW
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Workspace:</span>
                <span className="font-bold text-slate-900 dark:text-white">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">County / Location:</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {details.county} {details.location ? `• ${details.location}` : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chairperson:</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {chairperson.fullName} ({chairperson.phone})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-violet-600 py-3 text-xs font-black text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 transition"
            >
              Done & Return
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Modal Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                <ShieldCheck size={14} />
                <span>Vericircle Governance Provisioning</span>
              </div>
              <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                Request Workspace Creation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Workspaces are reviewed and activated by Vericircle platform administrators.
              </p>
            </div>

            {/* Step Indicators (For Chama) */}
            {entityType === "chama" && (
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs font-bold dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`flex items-center gap-1.5 ${
                    currentStep === 1
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] dark:bg-violet-950">
                    1
                  </span>
                  Chama Details
                </button>
                <span className="text-slate-300">→</span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`flex items-center gap-1.5 ${
                    currentStep === 2
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] dark:bg-violet-950">
                    2
                  </span>
                  Leadership Contacts
                </button>
                <span className="text-slate-300">→</span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className={`flex items-center gap-1.5 ${
                    currentStep === 3
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] dark:bg-violet-950">
                    3
                  </span>
                  Committee Members
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* STEP 1: Chama / Entity Details */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  {/* Entity Type Picker */}
                  <div className="grid grid-cols-3 gap-2">
                    {ENTITY_TYPES.map((et) => {
                      const Icon = et.icon;
                      const isSelected = entityType === et.type;
                      return (
                        <button
                          key={et.type}
                          type="button"
                          onClick={() => setEntityType(et.type)}
                          className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${
                            isSelected
                              ? "border-violet-600 bg-violet-50/60 dark:border-violet-500 dark:bg-violet-950/30 text-violet-900 dark:text-violet-200"
                              : "border-slate-200 hover:border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <Icon size={18} className={isSelected ? "text-violet-600" : "text-slate-400"} />
                          <span className="text-xs font-black">{et.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {entityType === "chama" ? "Chama Name *" : "Workspace Name *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Umoja Welfare Chama, Kangundo"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {entityType === "chama" && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Registration Type
                          </label>
                          <select
                            value={details.registrationType}
                            onChange={(e) => setDetails((p) => ({ ...p, registrationType: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="Self-Help Group">Self-Help Group</option>
                            <option value="CBO">Community-Based Org (CBO)</option>
                            <option value="Welfare Society">Welfare Society</option>
                            <option value="Informal Table Banking">Table Banking / Merry-Go-Round</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            County
                          </label>
                          <select
                            value={details.county}
                            onChange={(e) => setDetails((p) => ({ ...p, county: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            {KENYA_COUNTIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Location / Sub-County
                          </label>
                          <input
                            type="text"
                            value={details.location}
                            onChange={(e) => setDetails((p) => ({ ...p, location: e.target.value }))}
                            placeholder="e.g. Kangundo / Machakos Town"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Estimated Members
                          </label>
                          <input
                            type="number"
                            min={2}
                            value={details.memberCount}
                            onChange={(e) => setDetails((p) => ({ ...p, memberCount: Number(e.target.value) }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Monthly Savings (KES)
                          </label>
                          <input
                            type="number"
                            min={100}
                            value={monthlySavings}
                            onChange={(e) => setMonthlySavings(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Meeting Frequency
                          </label>
                          <select
                            value={details.meetingFrequency}
                            onChange={(e) => setDetails((p) => ({ ...p, meetingFrequency: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="Weekly">Weekly</option>
                            <option value="Bi-Weekly">Bi-Weekly</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Chama Purpose / Goals
                    </label>
                    <textarea
                      rows={2}
                      value={details.purpose}
                      onChange={(e) => setDetails((p) => ({ ...p, purpose: e.target.value }))}
                      placeholder="Describe the objective (e.g. Rotational Merry-Go-Round, Welfare, Investment...)"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    {entityType === "chama" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!name.trim()) {
                            setError("Please enter a Chama name.");
                            return;
                          }
                          setError("");
                          setCurrentStep(2);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white hover:bg-violet-700"
                      >
                        Next: Leadership
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-2xl bg-violet-600 py-3 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        {loading ? "Submitting..." : "Submit Workspace Request"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: Leadership Contacts */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {/* Chairperson */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                    <h4 className="text-xs font-black uppercase text-violet-700 dark:text-violet-400">
                      Chairperson Details *
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Full Name *"
                        value={chairperson.fullName}
                        onChange={(e) => setChairperson((p) => ({ ...p, fullName: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Phone (07XXXXXXXX) *"
                        value={chairperson.phone}
                        onChange={(e) => setChairperson((p) => ({ ...p, phone: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={chairperson.email}
                        onChange={(e) => setChairperson((p) => ({ ...p, email: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="National ID / Reference"
                        value={chairperson.idNumber}
                        onChange={(e) => setChairperson((p) => ({ ...p, idNumber: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Treasurer */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                    <h4 className="text-xs font-black uppercase text-violet-700 dark:text-violet-400">
                      Treasurer Details *
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Full Name *"
                        value={treasurer.fullName}
                        onChange={(e) => setTreasurer((p) => ({ ...p, fullName: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Phone (07XXXXXXXX) *"
                        value={treasurer.phone}
                        onChange={(e) => setTreasurer((p) => ({ ...p, phone: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={treasurer.email}
                        onChange={(e) => setTreasurer((p) => ({ ...p, email: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="National ID / Reference"
                        value={treasurer.idNumber}
                        onChange={(e) => setTreasurer((p) => ({ ...p, idNumber: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Secretary */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                    <h4 className="text-xs font-black uppercase text-violet-700 dark:text-violet-400">
                      Secretary Details *
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Full Name *"
                        value={secretary.fullName}
                        onChange={(e) => setSecretary((p) => ({ ...p, fullName: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Phone (07XXXXXXXX) *"
                        value={secretary.phone}
                        onChange={(e) => setSecretary((p) => ({ ...p, phone: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={secretary.email}
                        onChange={(e) => setSecretary((p) => ({ ...p, email: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="National ID / Reference"
                        value={secretary.idNumber}
                        onChange={(e) => setSecretary((p) => ({ ...p, idNumber: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!chairperson.fullName || !chairperson.phone) {
                          setError("Chairperson full name and phone number are required.");
                          return;
                        }
                        if (!treasurer.fullName || !treasurer.phone) {
                          setError("Treasurer full name and phone number are required.");
                          return;
                        }
                        if (!secretary.fullName || !secretary.phone) {
                          setError("Secretary full name and phone number are required.");
                          return;
                        }
                        setError("");
                        setCurrentStep(3);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white hover:bg-violet-700"
                    >
                      Next: Committee Members
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Dynamic Committee Members */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                        Additional Committee Members
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Add elders, vice leaders, or organizing members
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addCommitteeMember}
                      className="inline-flex items-center gap-1 rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-300"
                    >
                      <Plus size={14} />
                      Add Member
                    </button>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {committeeMembers.map((cm, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <select
                            value={cm.role}
                            onChange={(e) => updateCommitteeMember(idx, "role", e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          >
                            {COMMITTEE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>

                          {committeeMembers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCommitteeMember(idx)}
                              className="text-slate-400 hover:text-red-500 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Full Name"
                            value={cm.fullName}
                            onChange={(e) => updateCommitteeMember(idx, "fullName", e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="Phone (07XXXXXXXX)"
                            value={cm.phone}
                            onChange={(e) => updateCommitteeMember(idx, "phone", e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-50"
                    >
                      {loading ? "Submitting to Admin..." : "Submit Workspace Request"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
