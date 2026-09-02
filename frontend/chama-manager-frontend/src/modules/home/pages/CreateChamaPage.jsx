import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  UserCheck,
  Search,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  Lock,
  X,
  Plus,
  Trash2,
  Users,
  Award,
  FileText,
  HeartHandshake
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import chamaService from "@/modules/chama/services/chama.service";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";

export default function CreateChamaPage() {
  const { createChama, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    monthlySavings: "1000",
    visibility: "private",
    treasurerInput: "",
    secretaryInput: "",
    committeeInputs: ["", "", ""], // 3 required default slots
    patronInput: "",
  });

  // Verified user objects
  const [treasurerUser, setTreasurerUser] = useState(null);
  const [secretaryUser, setSecretaryUser] = useState(null);
  const [committeeUsers, setCommitteeUsers] = useState([null, null, null]);
  const [patronUser, setPatronUser] = useState(null);

  // Verification errors & loading states
  const [verifyingKey, setVerifyingKey] = useState(null);
  const [verifyErrors, setVerifyErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "treasurerInput") setTreasurerUser(null);
    if (name === "secretaryInput") setSecretaryUser(null);
    if (name === "patronInput") setPatronUser(null);
  }

  function handleCommitteeInputChange(index, value) {
    const updatedInputs = [...form.committeeInputs];
    updatedInputs[index] = value;
    setForm((prev) => ({ ...prev, committeeInputs: updatedInputs }));

    const updatedUsers = [...committeeUsers];
    updatedUsers[index] = null;
    setCommitteeUsers(updatedUsers);

    setVerifyErrors((prev) => ({ ...prev, [`committee_${index}`]: "" }));
  }

  function addCommitteeSlot() {
    if (form.committeeInputs.length >= 5) return;
    setForm((prev) => ({
      ...prev,
      committeeInputs: [...prev.committeeInputs, ""],
    }));
    setCommitteeUsers((prev) => [...prev, null]);
  }

  function removeCommitteeSlot(index) {
    if (form.committeeInputs.length <= 3) return; // Keep minimum 3
    setForm((prev) => ({
      ...prev,
      committeeInputs: prev.committeeInputs.filter((_, i) => i !== index),
    }));
    setCommitteeUsers((prev) => prev.filter((_, i) => i !== index));
    setVerifyErrors((prev) => {
      const copy = { ...prev };
      delete copy[`committee_${index}`];
      return copy;
    });
  }

  // Generic verify handler for any governance role slot
  async function handleVerifyUser(key, query, setter) {
    if (!query.trim()) {
      setVerifyErrors((prev) => ({ ...prev, [key]: "Please enter phone number or email." }));
      return;
    }

    setVerifyingKey(key);
    setVerifyErrors((prev) => ({ ...prev, [key]: "" }));

    try {
      const user = await chamaService.verifyTreasurer(query.trim());
      setter(user);
    } catch (err) {
      setter(null);
      setVerifyErrors((prev) => ({
        ...prev,
        [key]: err?.response?.data?.message || "User not found. Must be an active registered account."
      }));
    } finally {
      setVerifyingKey(null);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    // 1. Validate required role verifications
    if (!treasurerUser) {
      setError("Please verify the Treasurer before creating the Chama.");
      return;
    }

    if (!secretaryUser) {
      setError("Please verify the Secretary before creating the Chama.");
      return;
    }

    const verifiedCommitteeCount = committeeUsers.filter(Boolean).length;
    if (verifiedCommitteeCount < 3) {
      setError("Please verify at least 3 Committee Members before creating the Chama.");
      return;
    }

    // 2. Validate distinct user constraint
    const allVerifiedIds = [
      treasurerUser._id,
      secretaryUser._id,
      ...committeeUsers.filter(Boolean).map((u) => u._id),
      patronUser?._id,
    ].filter(Boolean);

    const uniqueIds = new Set(allVerifiedIds);
    if (uniqueIds.size !== allVerifiedIds.length) {
      setError("Each governance role must be assigned to a distinct user account.");
      return;
    }

    setSubmitting(true);

    try {
      const workspace = await createChama({
        name: form.name,
        monthlySavings: Number(form.monthlySavings),
        visibility: form.visibility,
        treasurerUserId: treasurerUser._id,
        treasurerInput: form.treasurerInput.trim(),
        secretaryUserId: secretaryUser._id,
        secretaryInput: form.secretaryInput.trim(),
        committeeUserIds: committeeUsers.filter(Boolean).map((u) => u._id),
        committeeInputs: form.committeeInputs.map((i) => i.trim()),
        patronUserId: patronUser?._id || null,
        patronInput: form.patronInput.trim(),
      });

      selectWorkspace(workspace);
      navigate(`/workspace/${workspace.id ?? workspace._id}`, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not create the Chama.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-indigo-50 p-3.5 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <Building2 size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Create a Chama
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Set up Chama governance rules and assign your leadership team.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition shrink-0"
          title="Close and cancel"
        >
          <X size={18} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            <Building2 size={16} /> 1. Chama Details
          </h2>

          <Input
            label="Chama Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Upendo Investment Chama"
            minLength={2}
            required
          />

          <Input
            label="Monthly Savings Target (KES)"
            name="monthlySavings"
            type="number"
            min="1"
            value={form.monthlySavings}
            onChange={handleChange}
            required
          />

          {/* Directory Visibility */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Directory Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex flex-col p-3 rounded-2xl border cursor-pointer transition-all ${
                  form.visibility === "private"
                    ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500"
                    : "border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                    <Lock size={14} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Private Chama</span>
                  </div>
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={form.visibility === "private"}
                    onChange={handleChange}
                    className="accent-indigo-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Members join via invitation code or share link only.
                </p>
              </label>

              <label
                className={`flex flex-col p-3 rounded-2xl border cursor-pointer transition-all ${
                  form.visibility === "public"
                    ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500"
                    : "border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                    <Eye size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Public Chama</span>
                  </div>
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={form.visibility === "public"}
                    onChange={handleChange}
                    className="accent-indigo-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Discoverable in the Public Directory for users to request join.
                </p>
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Leadership & Governance Roles */}
        <div className="space-y-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <Users size={16} /> 2. Leadership & Governance Team
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Verify active registered users by phone or email to assign key roles.
            </p>
          </div>

          {/* Role: Chairperson */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <Award size={14} /> Chairperson (Creator)
              </span>
              <span className="rounded-md bg-indigo-200 px-2 py-0.5 text-[10px] font-black text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">
                You (Current User)
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">
              Full administrative authority, signs official minutes, and approves disbursements.
            </p>
          </div>

          {/* Role: Treasurer */}
          <div className="space-y-2 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-emerald-600" /> Treasurer (Required)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Financial Officer</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                name="treasurerInput"
                value={form.treasurerInput}
                onChange={handleChange}
                placeholder="Phone or email of registered Treasurer"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleVerifyUser("treasurer", form.treasurerInput, setTreasurerUser)}
                disabled={verifyingKey === "treasurer" || !form.treasurerInput.trim()}
                className="shrink-0 flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
              >
                <Search size={13} /> {verifyingKey === "treasurer" ? "Checking..." : "Verify"}
              </button>
            </div>

            {verifyErrors.treasurer && (
              <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                <AlertCircle size={13} /> {verifyErrors.treasurer}
              </p>
            )}

            {treasurerUser && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-800 dark:bg-emerald-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{treasurerUser.name}</span>
                  <span className="text-slate-500 font-mono text-[11px]">({treasurerUser.phone || treasurerUser.email})</span>
                </div>
                <span className="text-[10px] font-black text-emerald-700 uppercase">Verified</span>
              </div>
            )}
          </div>

          {/* Role: Secretary */}
          <div className="space-y-2 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText size={15} className="text-blue-600" /> Secretary (Required)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Minutes & Communications</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                name="secretaryInput"
                value={form.secretaryInput}
                onChange={handleChange}
                placeholder="Phone or email of registered Secretary"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleVerifyUser("secretary", form.secretaryInput, setSecretaryUser)}
                disabled={verifyingKey === "secretary" || !form.secretaryInput.trim()}
                className="shrink-0 flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
              >
                <Search size={13} /> {verifyingKey === "secretary" ? "Checking..." : "Verify"}
              </button>
            </div>

            {verifyErrors.secretary && (
              <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                <AlertCircle size={13} /> {verifyErrors.secretary}
              </p>
            )}

            {secretaryUser && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-800 dark:bg-emerald-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{secretaryUser.name}</span>
                  <span className="text-slate-500 font-mono text-[11px]">({secretaryUser.phone || secretaryUser.email})</span>
                </div>
                <span className="text-[10px] font-black text-emerald-700 uppercase">Verified</span>
              </div>
            )}
          </div>

          {/* Role: Committee Members (3–5 Required) */}
          <div className="space-y-3 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Users size={15} className="text-purple-600" /> Committee Members (3–5 Required)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Governance & Voting Body</span>
            </div>

            <div className="space-y-3">
              {form.committeeInputs.map((inputVal, index) => {
                const verifiedUser = committeeUsers[index];
                const key = `committee_${index}`;

                return (
                  <div key={index} className="space-y-1.5 border-l-2 border-indigo-400 pl-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Committee Member #{index + 1}
                      </span>
                      {form.committeeInputs.length > 3 && (
                        <button
                          type="button"
                          onClick={() => removeCommitteeSlot(index)}
                          className="text-[11px] font-bold text-rose-500 hover:underline flex items-center gap-0.5"
                        >
                          <Trash2 size={12} /> Remove Slot
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inputVal}
                        onChange={(e) => handleCommitteeInputChange(index, e.target.value)}
                        placeholder={`Phone or email of Committee Member ${index + 1}`}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleVerifyUser(key, inputVal, (u) => {
                            const updated = [...committeeUsers];
                            updated[index] = u;
                            setCommitteeUsers(updated);
                          })
                        }
                        disabled={verifyingKey === key || !inputVal.trim()}
                        className="shrink-0 flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
                      >
                        <Search size={13} /> {verifyingKey === key ? "Checking..." : "Verify"}
                      </button>
                    </div>

                    {verifyErrors[key] && (
                      <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                        <AlertCircle size={13} /> {verifyErrors[key]}
                      </p>
                    )}

                    {verifiedUser && (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-2.5 text-xs dark:border-emerald-800 dark:bg-emerald-950/40 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                          <span>{verifiedUser.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-700 uppercase">Verified</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {form.committeeInputs.length < 5 && (
              <button
                type="button"
                onClick={addCommitteeSlot}
                className="mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition w-full justify-center"
              >
                <Plus size={14} /> Add Committee Member Slot ({form.committeeInputs.length}/5)
              </button>
            )}
          </div>

          {/* Role: Patron (Optional) */}
          <div className="space-y-2 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <HeartHandshake size={15} className="text-amber-500" /> Patron (Optional / Advisory)
              </label>
              <span className="text-[10px] text-amber-600 font-bold uppercase">Optional</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                name="patronInput"
                value={form.patronInput}
                onChange={handleChange}
                placeholder="Phone or email of Patron (leave blank to skip)"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleVerifyUser("patron", form.patronInput, setPatronUser)}
                disabled={verifyingKey === "patron" || !form.patronInput.trim()}
                className="shrink-0 flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
              >
                <Search size={13} /> {verifyingKey === "patron" ? "Checking..." : "Verify"}
              </button>
            </div>

            {verifyErrors.patron && (
              <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                <AlertCircle size={13} /> {verifyErrors.patron}
              </p>
            )}

            {patronUser && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-800 dark:bg-emerald-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{patronUser.name}</span>
                  <span className="text-slate-500 font-mono text-[11px]">({patronUser.phone || patronUser.email})</span>
                </div>
                <span className="text-[10px] font-black text-emerald-700 uppercase">Verified Patron</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full py-3.5 text-xs font-extrabold shadow-lg"
          disabled={submitting}
        >
          {submitting ? "Creating Chama & Governance Team..." : "Create Chama & Assign Leadership Team"}
        </Button>
      </form>
    </div>
  );
}