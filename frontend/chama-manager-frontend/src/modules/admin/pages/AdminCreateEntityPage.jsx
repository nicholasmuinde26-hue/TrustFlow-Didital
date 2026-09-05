import { useState } from "react";
import {
  Building2,
  Store,
  Wallet,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Users,
  Info,
} from "lucide-react";
import api from "@/app/services/api";

export default function AdminCreateEntityPage() {
  const [entityType, setEntityType] = useState("chama");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("standard");
  const [monthlySavings, setMonthlySavings] = useState(1000);

  // Client Chairperson / Lead (NOT the admin!)
  const [chairperson, setChairperson] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Client Treasurer
  const [treasurer, setTreasurer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Client Secretary
  const [secretary, setSecretary] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Client Committee members
  const [committeeMembers, setCommitteeMembers] = useState([
    { name: "", phone: "", email: "", role: "Committee Member" },
    { name: "", phone: "", email: "", role: "Committee Member" },
    { name: "", phone: "", email: "", role: "Committee Member" },
  ]);

  // Business Client Owner
  const [businessOwner, setBusinessOwner] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Contribution Group Client Organizer
  const [groupOrganizer, setGroupOrganizer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function addCommitteeMember() {
    setCommitteeMembers((prev) => [
      ...prev,
      { name: "", phone: "", email: "", role: "Committee Member" },
    ]);
  }

  function removeCommitteeMember(idx) {
    setCommitteeMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCommitteeMember(idx, field, value) {
    setCommitteeMembers((prev) =>
      prev.map((cm, i) => (i === idx ? { ...cm, [field]: value } : cm))
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!name.trim()) {
      setError("Please provide an entity name.");
      return;
    }

    setLoading(true);

    try {
      if (entityType === "chama") {
        if (!chairperson.phone && !chairperson.email) {
          setError("Chairperson phone number or email is required.");
          setLoading(false);
          return;
        }

        if (!treasurer.phone && !treasurer.email) {
          setError("Treasurer phone number or email is required.");
          setLoading(false);
          return;
        }

        if (!secretary.phone && !secretary.email) {
          setError("Secretary phone number or email is required.");
          setLoading(false);
          return;
        }

        const validCommittee = committeeMembers
          .map((cm) => cm.phone || cm.email || cm.name)
          .filter(Boolean);

        if (validCommittee.length < 3) {
          setError("At least 3 Committee Members (phone or email) are required.");
          setLoading(false);
          return;
        }

        await api.post("/chamas", {
          name: name.trim(),
          monthlySavings: Number(monthlySavings) || 1000,
          chamaType: category === "burial" ? "burial" : "standard",
          visibility: "public",
          chairpersonInput: chairperson.phone || chairperson.email,
          chairpersonName: chairperson.name || "Chairperson",
          chairpersonPhone: chairperson.phone,
          chairpersonEmail: chairperson.email,
          treasurerInput: treasurer.phone || treasurer.email,
          treasurerName: treasurer.name || "Treasurer",
          treasurerPhone: treasurer.phone,
          treasurerEmail: treasurer.email,
          secretaryInput: secretary.phone || secretary.email,
          secretaryName: secretary.name || "Secretary",
          secretaryPhone: secretary.phone,
          secretaryEmail: secretary.email,
          committeeInputs: validCommittee,
        });

        setNotice(
          `Chama "${name}" created successfully! The designated Chairperson (${chairperson.name || chairperson.phone}) and management team can now log in or register to access their workspace.`
        );
      } else if (entityType === "business") {
        if (!businessOwner.phone && !businessOwner.email) {
          setError("Business Owner phone number or email is required.");
          setLoading(false);
          return;
        }

        await api.post("/businesses", {
          name: name.trim(),
          category,
          category_label: category,
          ownerInput: businessOwner.phone || businessOwner.email,
          ownerName: businessOwner.name || "Business Owner",
          ownerPhone: businessOwner.phone,
          ownerEmail: businessOwner.email,
        });

        setNotice(
          `Business "${name}" created successfully! The client owner (${businessOwner.name || businessOwner.phone}) can now log in or register to access their business dashboard.`
        );
      } else if (entityType === "contribution_group") {
        if (!groupOrganizer.phone && !groupOrganizer.email) {
          setError("Group Organizer phone number or email is required.");
          setLoading(false);
          return;
        }

        await api.post("/contribution-groups", {
          name: name.trim(),
          group_type: category || "community",
          organizerInput: groupOrganizer.phone || groupOrganizer.email,
          organizerName: groupOrganizer.name || "Group Organizer",
          organizerPhone: groupOrganizer.phone,
          organizerEmail: groupOrganizer.email,
        });

        setNotice(
          `Contribution Group "${name}" created successfully! The client organizer (${groupOrganizer.name || groupOrganizer.phone}) can now log in or register to manage contributions.`
        );
      }

      // Reset form
      setName("");
      setChairperson({ name: "", phone: "", email: "" });
      setTreasurer({ name: "", phone: "", email: "" });
      setSecretary({ name: "", phone: "", email: "" });
      setCommitteeMembers([
        { name: "", phone: "", email: "", role: "Committee Member" },
        { name: "", phone: "", email: "", role: "Committee Member" },
        { name: "", phone: "", email: "", role: "Committee Member" },
      ]);
      setBusinessOwner({ name: "", phone: "", email: "" });
      setGroupOrganizer({ name: "", phone: "", email: "" });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to create workspace. Please check all official contact inputs."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          Create Workspace for Client
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Admin privilege: create a verified Chama, Business, or Contribution Group and assign client management. You will not be added as a chairperson or member.
        </p>
      </div>

      {/* Advisory Note */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
        <Info size={18} className="shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Client Provisioning Mode: </span>
          Enter the client's Chairperson and governance management below. When created, the management team will be able to register or log in with their phone/email and select this workspace directly from their dropdown.
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6"
      >
        {/* Entity Type Picker */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { type: "chama", label: "Chama", icon: Building2 },
            { type: "business", label: "Business", icon: Store },
            { type: "contribution_group", label: "Contribution Group", icon: Wallet },
          ].map((et) => {
            const Icon = et.icon;
            const isSelected = entityType === et.type;
            return (
              <button
                key={et.type}
                type="button"
                onClick={() => {
                  setEntityType(et.type);
                  if (et.type === "chama") setCategory("standard");
                  else if (et.type === "business") setCategory("retail");
                  else if (et.type === "contribution_group") setCategory("community");
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-center transition ${
                  isSelected
                    ? "border-violet-600 bg-violet-50/50 dark:border-violet-500 dark:bg-violet-950/30 text-violet-950 dark:text-violet-100"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                <Icon size={20} className={isSelected ? "text-violet-600" : "text-slate-400"} />
                <span className="text-xs font-bold">{et.label}</span>
              </button>
            );
          })}
        </div>

        {/* Basic Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {entityType === "chama" ? "Chama Name *" : entityType === "business" ? "Business Name *" : "Group Name *"}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={entityType === "chama" ? "e.g. Umoja Women Welfare Chama" : entityType === "business" ? "e.g. Nairobi Hardware & Supplies" : "e.g. Kangundo Medical Fund"}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {entityType === "chama" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chama Type
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="standard">Standard Rotating / Savings</option>
                  <option value="burial">Burial & Welfare Chama</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Contribution (KES)
                </label>
                <input
                  type="number"
                  min={100}
                  value={monthlySavings}
                  onChange={(e) => setMonthlySavings(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {entityType === "business" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="retail">Retail / Shop</option>
                <option value="restaurant">Restaurant / Eatery</option>
                <option value="rental">Property Rental</option>
                <option value="service">Services</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          {entityType === "contribution_group" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Group Type / Cause
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="community">Community Fund</option>
                <option value="fundraiser">Fundraiser</option>
                <option value="emergency">Emergency Relief</option>
                <option value="wedding">Wedding Contribution</option>
                <option value="party">Celebration / Party</option>
                <option value="graduation">Graduation</option>
                <option value="funeral">Funeral / Welfare</option>
                <option value="birthday">Birthday</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
        </div>

        {/* CHAMA LEADERSHIP SECTION */}
        {entityType === "chama" && (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Users size={15} className="text-violet-600" />
              Designate Chama Management (Clients)
            </h3>

            {/* Chairperson Section */}
            <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-violet-900 dark:text-violet-300">
                  Chairperson * (Will hold Position 1)
                </h4>
                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                  Client Chairperson
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={chairperson.name}
                  onChange={(e) => setChairperson((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Phone (07XXXXXXXX) *"
                  value={chairperson.phone}
                  onChange={(e) => setChairperson((prev) => ({ ...prev, phone: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={chairperson.email}
                  onChange={(e) => setChairperson((prev) => ({ ...prev, email: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Treasurer Section */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                Treasurer * (Will hold Position 2)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={treasurer.name}
                  onChange={(e) => setTreasurer((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Phone (07XXXXXXXX) *"
                  value={treasurer.phone}
                  onChange={(e) => setTreasurer((prev) => ({ ...prev, phone: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={treasurer.email}
                  onChange={(e) => setTreasurer((prev) => ({ ...prev, email: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Secretary Section */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                Secretary * (Will hold Position 3)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={secretary.name}
                  onChange={(e) => setSecretary((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Phone (07XXXXXXXX) *"
                  value={secretary.phone}
                  onChange={(e) => setSecretary((prev) => ({ ...prev, phone: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={secretary.email}
                  onChange={(e) => setSecretary((prev) => ({ ...prev, email: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Committee Members Section */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Committee Members (3 to 5 Required)
                </h4>
                <button
                  type="button"
                  onClick={addCommitteeMember}
                  disabled={committeeMembers.length >= 5}
                  className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 disabled:opacity-40"
                >
                  <Plus size={14} /> Add Member
                </button>
              </div>

              {committeeMembers.map((cm, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    required
                    placeholder={`Committee Member #${i + 1} Phone (07XXXXXXXX) or Email *`}
                    value={cm.phone}
                    onChange={(e) => updateCommitteeMember(i, "phone", e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  {committeeMembers.length > 3 && (
                    <button
                      type="button"
                      onClick={() => removeCommitteeMember(i)}
                      className="p-2 text-slate-400 hover:text-red-500 transition"
                      title="Remove slot"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BUSINESS OWNER SECTION */}
        {entityType === "business" && (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Users size={15} className="text-blue-600" />
              Designate Client Owner
            </h3>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 space-y-3">
              <h4 className="text-xs font-black uppercase text-blue-900 dark:text-blue-300">
                Business Owner *
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={businessOwner.name}
                  onChange={(e) => setBusinessOwner((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Phone (07XXXXXXXX) *"
                  value={businessOwner.phone}
                  onChange={(e) => setBusinessOwner((prev) => ({ ...prev, phone: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={businessOwner.email}
                  onChange={(e) => setBusinessOwner((prev) => ({ ...prev, email: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* CONTRIBUTION GROUP ORGANIZER SECTION */}
        {entityType === "contribution_group" && (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Users size={15} className="text-emerald-600" />
              Designate Client Organizer
            </h3>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 space-y-3">
              <h4 className="text-xs font-black uppercase text-emerald-900 dark:text-emerald-300">
                Group Organizer *
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={groupOrganizer.name}
                  onChange={(e) => setGroupOrganizer((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Phone (07XXXXXXXX) *"
                  value={groupOrganizer.phone}
                  onChange={(e) => setGroupOrganizer((prev) => ({ ...prev, phone: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={groupOrganizer.email}
                  onChange={(e) => setGroupOrganizer((prev) => ({ ...prev, email: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-50 transition"
        >
          {loading ? "Creating Workspace..." : "Create Workspace for Client"}
        </button>
      </form>
    </div>
  );
}
