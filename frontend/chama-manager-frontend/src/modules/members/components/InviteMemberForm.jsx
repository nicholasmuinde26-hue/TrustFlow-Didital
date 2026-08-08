import { useState } from "react";
import { Mail } from "lucide-react";

import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input/Input";

export default function InviteMemberForm({ onSubmit, submitting }) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!phone.trim()) return;

    await onSubmit({
      phone: phone.trim(),
      message: message.trim() || undefined,
    });
    setPhone("");
    setMessage("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
        <Mail size={18} />
        Invite Someone
      </h3>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Send an invitation using the phone number they used to register.
      </p>

      <div className="mt-4 space-y-3">
        <Input
          type="tel"
          placeholder="Phone number (e.g. 0712 345 678)"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
        <Input
          placeholder="Personal message (optional)"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Sending..." : "Send Invitation"}
        </Button>
      </div>
    </form>
  );
}
