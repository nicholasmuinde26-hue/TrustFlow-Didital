import { useState } from "react";

import useCreateContributionGroup from "@/modules/contribution-group/hooks/useCreateContributionGroup";

export default function CreateContributionGroupPage() {
  const { create, loading } = useCreateContributionGroup();

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  function handleChange(e) {
    setForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await create(form);
    } catch (error) {
      alert(
        error.response?.data?.message ??
        "Unable to create contribution group."
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl">

      <h1 className="text-3xl font-bold">
        Create Contribution Group
      </h1>

      <p className="mt-2 text-slate-500">
        Create a contribution group and invite members.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6 rounded-2xl border bg-white p-8"
      >

        <div>

          <label className="mb-2 block font-medium">
            Group Name
          </label>

          <input
            required
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-xl border p-3"
          />

        </div>

        <div>

          <label className="mb-2 block font-medium">
            Description
          </label>

          <textarea
            rows={4}
            name="description"
            value={form.description}
            onChange={handleChange}
            className="w-full rounded-xl border p-3"
          />

        </div>

        <button
          disabled={loading}
          className="
            rounded-xl
            bg-primary
            px-6
            py-3
            font-semibold
            text-black
          "
        >
          {loading
            ? "Creating..."
            : "Create Group"}
        </button>

      </form>

    </div>
  );
}