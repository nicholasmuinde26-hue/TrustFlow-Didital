import { useState } from "react";

import useJoinContributionGroup from "@/modules/contribution-group/hooks/useJoinContributionGroup";

export default function JoinContributionGroupPage() {

  const { join, loading } =
    useJoinContributionGroup();

  const [inviteCode, setInviteCode] =
    useState("");

  async function handleSubmit(e) {

    e.preventDefault();

    try {

      await join({
        inviteCode,
      });

    } catch (error) {

      alert(

        error.response?.data?.message ??

        "Unable to join contribution group."

      );

    }

  }

  return (

    <div className="mx-auto max-w-xl">

      <h1 className="text-3xl font-bold">

        Join Contribution Group

      </h1>

      <p className="mt-2 text-slate-500">

        Enter the invitation code shared by the group administrator.

      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6 rounded-2xl border bg-white p-8"
      >

        <div>

          <label className="mb-2 block font-medium">

            Invitation Code

          </label>

          <input
            required
            value={inviteCode}
            onChange={(e) =>
              setInviteCode(e.target.value)
            }
            className="w-full rounded-xl border p-3"
            placeholder="ABC123XYZ"
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
            ? "Joining..."
            : "Join Group"}
        </button>

      </form>

    </div>

  );
}