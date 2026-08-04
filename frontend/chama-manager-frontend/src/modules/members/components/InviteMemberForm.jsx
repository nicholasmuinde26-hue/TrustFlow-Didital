import { useState } from "react";
import { UserPlus } from "lucide-react";

import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input/Input";
import { ASSIGNABLE_ROLES } from "@/modules/workspaces/permissions/permissions";

export default function InviteMemberForm({ onSubmit, submitting }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim()) return;

    await onSubmit({ email: email.trim(), role });
    setEmail("");
    setRole("member");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
        <UserPlus size={18} />
        Invite a Member
      </h3>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            type="email"
            placeholder="member@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="
            rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm
            capitalize outline-none focus:border-primary
            dark:border-slate-700 dark:bg-slate-900 dark:text-white
          "
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Inviting..." : "Invite"}
        </Button>
      </div>
    </form>
  );
}