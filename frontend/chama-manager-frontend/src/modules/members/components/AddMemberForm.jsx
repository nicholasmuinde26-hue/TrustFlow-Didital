import { useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";

import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input/Input";

export default function AddMemberForm({ onSubmit, submitting }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!phone.trim()) return;

    await onSubmit({ 
      phone: phone.trim(), 
      name: name.trim() 
    });

    setPhone("");
    setName("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
        <UserPlus size={18} />
        Add Member by Phone
      </h3>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
        <UserCheck size={14} className="mt-0.5 shrink-0" />
        <span>
          Enter the registered phone number. Members must already have an account on the platform to be added.
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Input
            placeholder="Member Name (Optional)"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <Input
            placeholder="Phone Number (e.g. 0712345678)"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding..." : "Add Member"}
        </Button>
      </div>
    </form>
  );
}