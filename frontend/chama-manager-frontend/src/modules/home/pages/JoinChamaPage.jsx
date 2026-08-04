import { useState } from "react";

import useJoinChama from "@/modules/chama/hooks/useJoinChama";

export default function JoinChamaPage() {
  const { join, loading } = useJoinChama();

  const [inviteCode, setInviteCode] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    await join({
      inviteCode,
    });
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold">
        Join a Chama
      </h1>

      <p className="mt-2 text-slate-500">
        Enter the invitation code shared with you.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-5"
      >
        <input
          className="w-full rounded-xl border p-3"
          placeholder="Invitation Code"
          value={inviteCode}
          onChange={(e) =>
            setInviteCode(e.target.value)
          }
        />

        <button
          disabled={loading}
          className="rounded-xl bg-primary px-6 py-3 font-semibold"
        >
          {loading ? "Joining..." : "Join Chama"}
        </button>
      </form>
    </div>
  );
}