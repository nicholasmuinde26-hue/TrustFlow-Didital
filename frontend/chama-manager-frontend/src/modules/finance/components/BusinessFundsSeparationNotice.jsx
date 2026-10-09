import { useState } from "react";
import { Info, Loader2 } from "lucide-react";

import financeApi from "../api/finance.api";

const money = (v) => `KES ${Math.abs(Number(v || 0)).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Shown only when business or property income posted BEFORE the business fund existed is
// still counted inside the chama balance. One click moves it into the business fund; the
// balance and every dashboard refresh straight after. Renders nothing otherwise.
export default function BusinessFundsSeparationNotice({ workspaceId, pending }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const amount = Number(pending || 0);
  if (done || Math.abs(amount) < 0.01) return null;

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await financeApi.applyBusinessFundSeparation(workspaceId);
      setDone(true);
      window.dispatchEvent(new Event("finance:updated"));
    } catch (err) {
      setError(err?.response?.data?.message || "Could not move the business money. Only the treasurer or chairperson can do this.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <Info size={15} className="mt-0.5 shrink-0" />
        <p className="font-medium">
          <span className="font-extrabold">{money(amount)}</span>{" "}
          {amount > 0
            ? "of earlier business and property income is still counted in the chama balance. Move it to the business fund so the chama balance shows member money only."
            : "was moved out of the chama balance more than once. Correct it to return the extra amount to the chama balance."}
          {error ? <span className="mt-1 block font-bold text-rose-700 dark:text-rose-300">{error}</span> : null}
        </p>
      </div>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-amber-700 disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {amount > 0 ? "Move to business fund" : "Correct the balance"}
      </button>
    </div>
  );
}
