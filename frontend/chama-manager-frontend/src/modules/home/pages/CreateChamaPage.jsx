import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";

export default function CreateChamaPage() {
  const { createChama, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();

  // The backend Chama model only stores { name, monthly_savings } — there
  // is no description field, so this form deliberately doesn't ask for one.
  const [form, setForm] = useState({ name: "", monthlySavings: "1000" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const workspace = await createChama({
        name: form.name,
        monthlySavings: Number(form.monthlySavings),
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
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-xl bg-primary/10 p-3">
          <Building2 size={22} className="text-primary" />
        </span>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Create a Chama
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            You'll be the first member and treasurer.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <Input
          label="Chama Name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="ABC Investment Chama"
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating..." : "Create Chama"}
        </Button>
      </form>
    </div>
  );
}