import { useState } from "react";

import useCreateChama from "@/modules/chama/hooks/useCreateChama";

export default function CreateChamaPage() {
  const { create, loading } = useCreateChama();

  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    currency: "KES",
  });

  function update(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function submit(e) {
    e.preventDefault();

    await create(form);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">
        Create Chama
      </h1>

      <form
        onSubmit={submit}
        className="mt-8 space-y-6"
      >
        <input
          name="name"
          placeholder="Chama Name"
          value={form.name}
          onChange={update}
          className="w-full rounded-xl border p-4"
        />

        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={update}
          className="w-full rounded-xl border p-4"
        />

        <input
          name="location"
          placeholder="Location"
          value={form.location}
          onChange={update}
          className="w-full rounded-xl border p-4"
        />

        <select
          name="currency"
          value={form.currency}
          onChange={update}
          className="w-full rounded-xl border p-4"
        >
          <option value="KES">KES</option>
          <option value="USD">USD</option>
        </select>

        <button
          disabled={loading}
          className="rounded-xl bg-primary px-6 py-3"
        >
          {loading ? "Creating..." : "Create Chama"}
        </button>
      </form>
    </div>
  );
}