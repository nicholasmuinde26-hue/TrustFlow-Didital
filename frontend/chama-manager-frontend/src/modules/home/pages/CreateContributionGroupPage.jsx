import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import { GROUP_TYPES, GROUP_VISIBILITY } from "@/modules/contribution-group/constants";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";

export default function CreateContributionGroupPage() {
  const { createContributionGroup, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "other",
    event_date: "",
    location: "",
    visibility: "invite_only",
  });

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
      const workspace = await createContributionGroup({
        ...form,
        event_date: form.event_date || undefined,
      });

      selectWorkspace(workspace);
      navigate(`/workspace/${workspace.id ?? workspace._id}`, {
        replace: true,
      });
    } catch (err) {
      // The backend allows only ONE active contribution group per creator
      // — surface that 409 clearly instead of a generic error.
      setError(
        err?.response?.data?.message ||
          "Could not create the contribution group."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-xl bg-primary/10 p-3">
          <Wallet size={22} className="text-primary" />
        </span>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Create a Contribution Group
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            You can only have one active group at a time.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <Input
          label="Group Name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Wedding Contribution"
          minLength={2}
          required
        />

        <Input
          label="Description (optional)"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="What is this fund for?"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>

            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm capitalize outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {GROUP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Visibility</label>

            <select
              name="visibility"
              value={form.visibility}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm capitalize outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {GROUP_VISIBILITY.map((v) => (
                <option key={v} value={v}>
                  {v.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Event Date (optional)"
            name="event_date"
            type="date"
            value={form.event_date}
            onChange={handleChange}
          />

          <Input
            label="Location (optional)"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Nairobi"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating..." : "Create Group"}
        </Button>
      </form>
    </div>
  );
}