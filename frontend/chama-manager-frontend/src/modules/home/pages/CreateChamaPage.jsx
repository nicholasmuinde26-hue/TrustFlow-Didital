import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, UserCheck, Search, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";

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
    treasurerInput: "",
  });

  const [treasurerUser, setTreasurerUser] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "treasurerInput") {
      setTreasurerUser(null);
      setVerifyError("");
    }
  }

  async function handleVerifyTreasurer(e) {
    if (e) e.preventDefault();
    if (!form.treasurerInput.trim()) {
      setVerifyError("Please enter the treasurer's phone number or email.");
      return;
    }

    setVerifying(true);
    setVerifyError("");
    setTreasurerUser(null);

    try {
      const user = await chamaService.verifyTreasurer(form.treasurerInput.trim());
      setTreasurerUser(user);
    } catch (err) {
      setVerifyError(
        err?.response?.data?.message || "User not found. The treasurer must have an active account on the platform."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!treasurerUser) {
      setError("Please verify the treasurer user before creating the Chama.");
      return;
    }

    setSubmitting(true);

    try {
      const workspace = await createChama({
        name: form.name,
        monthlySavings: Number(form.monthlySavings),
        treasurerUserId: treasurerUser._id,
        treasurerInput: form.treasurerInput.trim(),
      });

      selectWorkspace(workspace);
      navigate(`/workspace/${workspace.id ?? workspace._id}`, {
        replace: true,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not create the Chama."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-12 font-sans">
      <div className="flex items-center gap-3">
        <span className="rounded-2xl bg-indigo-50 p-3.5 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <Building2 size={24} />
        </span>

        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Create a Chama
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            You will be the Chairperson. Instantly assign a registered Treasurer to complete creation.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
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

        {/* Treasurer Verification Section */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Assign Treasurer (Required)
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter the registered phone number or email of the Chama Treasurer.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              name="treasurerInput"
              value={form.treasurerInput}
              onChange={handleChange}
              placeholder="e.g. 0712345678 or treasurer@example.com"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-4 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              required
            />
            <button
              type="button"
              onClick={handleVerifyTreasurer}
              disabled={verifying || !form.treasurerInput.trim()}
              className="shrink-0 flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
            >
              <Search size={14} /> {verifying ? "Verifying..." : "Verify User"}
            </button>
          </div>

          {verifyError && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>{verifyError}</span>
            </div>
          )}

          {treasurerUser && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs dark:border-emerald-800 dark:bg-emerald-950/40 space-y-1 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Verified Registered Treasurer:</span>
              </div>
              <p className="font-extrabold text-slate-900 dark:text-white text-sm pl-6">{treasurerUser.name}</p>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 pl-6">
                Phone: {treasurerUser.phone || "-"} | Email: {treasurerUser.email || "-"}
              </p>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-200/80 px-2 py-0.5 text-[10px] font-black text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200 ml-6 mt-1">
                <ShieldCheck size={10} /> Treasurer Privileges Assigned
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full py-3 text-xs font-bold"
          disabled={submitting || !treasurerUser}
        >
          {submitting ? "Creating Chama..." : "Create Chama & Assign Roles"}
        </Button>
      </form>
    </div>
  );
}