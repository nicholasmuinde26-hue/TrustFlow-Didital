import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import financeService from "../../services/finance.service";
import PinPad from "./PinPad";
import Sheet from "./Sheet";
import { PHONE_STORAGE_KEY, kes, normalizePhone, readStored, writeStored } from "./walletFormat";

const POLL_MS = 3000;
const POLL_TRIES = 25;

const CHIPS = { deposit: [100, 500, 1000, 2000], withdraw: [500, 1000, 2000] };

export default function WalletActionSheet({ mode, workspaceId, available, onClose, onDone }) {
  const isDeposit = mode === "deposit";
  const [step, setStep] = useState("form"); // form | pin | processing | result
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(() => readStored(PHONE_STORAGE_KEY));
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { state: success|failed|pending, message }
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  const value = Number(amount);
  const normalized = normalizePhone(phone);

  const formError = (() => {
    if (!amount) return "";
    if (!Number.isFinite(value) || value < 1) return "Enter at least KES 1.";
    if (!isDeposit && value > available) return `You can withdraw up to ${kes(available)}.`;
    if (phone && !normalized) return "Enter a valid Safaricom number, e.g. 0712 345 678.";
    return "";
  })();
  const canContinue = value >= 1 && !!normalized && !formError;

  const poll = async (entryId) => {
    for (let attempt = 0; attempt < POLL_TRIES; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      if (cancelled.current) return;
      const data = await financeService.getMyWallet(workspaceId);
      const entry = data?.member_wallet?.entries?.find((item) => String(item._id) === String(entryId));
      if (entry && entry.status !== "pending") {
        setResult(
          entry.status === "completed"
            ? { state: "success", message: isDeposit ? "Your wallet has been topped up." : "The money has reached your M-Pesa.", receipt: entry.external_reference }
            : { state: "failed", message: entry.failure_reason || "M-Pesa could not complete this request." }
        );
        setStep("result");
        onDone?.();
        return;
      }
    }
    if (cancelled.current) return;
    setResult({ state: "pending", message: "M-Pesa is taking longer than usual. Your balance and history will update automatically once it confirms." });
    setStep("result");
    onDone?.();
  };

  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = { amount: value, phoneNumber: normalized, pin };
      const response = isDeposit
        ? await financeService.depositMemberWallet(workspaceId, payload)
        : await financeService.withdrawMemberWallet(workspaceId, payload);
      writeStored(PHONE_STORAGE_KEY, phone);
      setStep("processing");
      setPin("");
      onDone?.();
      poll(response?.data?.data?.entry?._id);
    } catch (err) {
      setPin("");
      setError(err.response?.data?.message || "We couldn't complete that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const title = isDeposit ? "Add money" : "Withdraw to M-Pesa";
  const inFlight = step === "processing";

  return (
    <Sheet title={title} onClose={onClose} locked={inFlight}>
      {step === "form" && (
        <div className="space-y-5">
          <div className="text-center">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400" htmlFor="wallet-amount">Amount (KES)</label>
            <input
              id="wallet-amount"
              autoFocus
              inputMode="decimal"
              type="number"
              min="1"
              step="0.01"
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 w-full bg-transparent text-center text-5xl font-black tabular-nums text-slate-900 outline-none placeholder:text-slate-300 dark:text-mist"
            />
            {!isDeposit && <p className="mt-1 text-xs text-slate-500">Available {kes(available)}</p>}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {CHIPS[mode].map((chip) => (
              <button key={chip} type="button" onClick={() => setAmount(String(chip))} className="rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-obsidian-border dark:text-mist-muted">
                {chip.toLocaleString("en-KE")}
              </button>
            ))}
            {!isDeposit && available >= 1 && (
              <button type="button" onClick={() => setAmount(String(available))} className="rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30">
                All
              </button>
            )}
          </div>

          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {isDeposit ? "M-Pesa number to charge" : "M-Pesa number to receive"}
            <input
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-emerald-500 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
            />
          </label>

          {formError && <p className="text-center text-xs font-semibold text-red-600">{formError}</p>}

          <button type="button" disabled={!canContinue} onClick={() => { setError(""); setStep("pin"); }} className="h-12 w-full rounded-2xl bg-emerald-700 text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:opacity-40">
            Continue
          </button>
        </div>
      )}

      {step === "pin" && (
        <div className="space-y-5">
          <button type="button" onClick={() => { setPin(""); setError(""); setStep("form"); }} className="flex items-center gap-1 text-xs font-bold text-slate-500">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-obsidian-raised">
            <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-mist">{kes(value)}</p>
            <p className="mt-1 text-xs text-slate-500">{isDeposit ? "from" : "to"} {normalized}</p>
          </div>
          <p className="text-center text-xs font-semibold text-slate-500">Enter your wallet PIN to confirm</p>
          <PinPad value={pin} onChange={setPin} onSubmit={submit} disabled={busy} />
          {error && <p role="alert" className="text-center text-xs font-semibold text-red-600">{error}</p>}
          <button type="button" disabled={pin.length < 4 || busy} onClick={submit} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:opacity-40">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {isDeposit ? "Confirm and send M-Pesa prompt" : "Confirm withdrawal"}
          </button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Loader2 size={44} className="animate-spin text-emerald-600" />
          <p className="text-base font-black text-slate-900 dark:text-mist">
            {isDeposit ? "Check your phone" : "Sending to your M-Pesa"}
          </p>
          <p className="max-w-xs text-xs text-slate-500">
            {isDeposit
              ? "Enter your M-Pesa PIN on the prompt we just sent. This screen updates by itself."
              : "M-Pesa is confirming the transfer. This usually takes a few seconds."}
          </p>
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          {result.state === "success" && <CheckCircle2 size={52} className="text-emerald-600" />}
          {result.state === "failed" && <XCircle size={52} className="text-red-500" />}
          {result.state === "pending" && <Clock size={52} className="text-amber-500" />}
          <p className="text-lg font-black text-slate-900 dark:text-mist">
            {result.state === "success" ? (isDeposit ? "Money added" : "Money sent") : result.state === "failed" ? "Didn't go through" : "Still processing"}
          </p>
          {result.state === "success" && <p className="text-2xl font-black tabular-nums text-emerald-700 dark:text-mint">{kes(value)}</p>}
          <p className="max-w-xs text-xs text-slate-500">{result.message}</p>
          {result.receipt && <p className="text-[11px] font-semibold text-slate-400">M-Pesa receipt {result.receipt}</p>}
          <button type="button" onClick={onClose} className="mt-3 h-12 w-full rounded-2xl bg-slate-900 text-sm font-extrabold text-white dark:bg-emerald-700">Done</button>
        </div>
      )}
    </Sheet>
  );
}
