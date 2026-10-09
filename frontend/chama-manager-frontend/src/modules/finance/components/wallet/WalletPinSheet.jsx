import React, { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import financeService from "../../services/finance.service";
import PinPad from "./PinPad";
import Sheet from "./Sheet";

// mode "setup": new PIN + confirm.  mode "change": current PIN, then new + confirm.
export default function WalletPinSheet({ mode, workspaceId, onClose, onDone }) {
  const steps = mode === "change" ? ["current", "new", "confirm"] : ["new", "confirm"];
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState({ current: "", new: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const stepKey = steps[index];
  const prompts = {
    current: "Enter your current PIN",
    new: mode === "change" ? "Choose a new PIN (4–6 digits)" : "Choose a wallet PIN (4–6 digits)",
    confirm: "Enter the new PIN again",
  };

  const setValue = (next) => setValues((old) => ({ ...old, [stepKey]: next }));

  const next = async () => {
    const value = values[stepKey];
    if (value.length < 4 || busy) return;
    setError("");
    if (stepKey !== "confirm") return setIndex(index + 1);
    if (values.new !== values.confirm) {
      setValues((old) => ({ ...old, confirm: "" }));
      return setError("The two PINs don't match. Try again.");
    }
    setBusy(true);
    try {
      if (mode === "change") await financeService.changeMemberWalletPin(workspaceId, { currentPin: values.current, newPin: values.new });
      else await financeService.setMemberWalletPin(workspaceId, values.new);
      setDone(true);
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your PIN.");
      // A rejected current PIN or a weak new PIN sends the member back to fix it.
      setValues({ current: "", new: "", confirm: "" });
      setIndex(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={mode === "change" ? "Change wallet PIN" : "Set your wallet PIN"} onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <ShieldCheck size={52} className="text-emerald-600" />
          <p className="text-lg font-black text-slate-900 dark:text-mist">{mode === "change" ? "PIN changed" : "Wallet PIN set"}</p>
          <p className="max-w-xs text-xs text-slate-500">You'll enter it to add money or withdraw. Never share it with anyone.</p>
          <button type="button" onClick={onClose} className="mt-3 h-12 w-full rounded-2xl bg-emerald-700 text-sm font-extrabold text-white">Continue</button>
        </div>
      ) : (
        <div className="space-y-5">
          {mode !== "change" && index === 0 && (
            <p className="rounded-2xl bg-emerald-50 p-3 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              Your wallet holds money that belongs only to you. A PIN keeps it safe — avoid simple ones like 1234 or 1111.
            </p>
          )}
          <p className="text-center text-sm font-bold text-slate-700 dark:text-mist">{prompts[stepKey]}</p>
          <PinPad value={values[stepKey]} onChange={setValue} onSubmit={next} disabled={busy} />
          {error && <p role="alert" className="text-center text-xs font-semibold text-red-600">{error}</p>}
          <button type="button" disabled={values[stepKey].length < 4 || busy} onClick={next} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 text-sm font-extrabold text-white disabled:opacity-40">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {stepKey === "confirm" ? (mode === "change" ? "Change PIN" : "Set PIN") : "Next"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
