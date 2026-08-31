import React, { useEffect, useRef, useState } from "react";
import { X, Smartphone, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import contributionGroupApi from "../api/contributionGroup.api";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

// Pays down an existing pledge (or creates one on the fly if the member
// hasn't pledged yet) via the contribution group's own fund/pledge STK
// endpoint — POST /contribution-groups/:groupId/fund/pledges/:pledgeId/payments/stk.
// This is deliberately separate from BusinessMpesaModal, which talks to
// /businesses/:id/mpesa/stkpush and has no concept of a ContributionGroup.
export default function PledgeStkModal({ isOpen, onClose, groupId, myPledge, onSuccess }) {
  const balance = myPledge
    ? Math.max(0, Number(myPledge.pledged_amount || 0) - Number(myPledge.obligation_id?.paid_amount || 0))
    : null;

  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [state, setState] = useState("form"); // form | sending | waiting | success | failed
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(40);

  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(balance ? String(balance) : "");
      setPhoneNumber("");
      setState("form");
      setError("");
      setCountdown(40);
    }
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const startPolling = (paymentIntentId) => {
    setState("waiting");
    setCountdown(40);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await contributionGroupApi.getPaymentIntentStatus(paymentIntentId);
        const status = res.data?.data?.status;
        if (status === "completed") {
          clearTimers();
          setState("success");
          onSuccess?.();
        } else if (["failed", "cancelled"].includes(status)) {
          clearTimers();
          setError("The M-Pesa prompt was not completed.");
          setState("failed");
        }
      } catch {
        // transient poll error — keep waiting until countdown expires
      }
    }, 3000);

    setTimeout(() => {
      clearTimers();
      setState((current) => (current === "waiting" ? "failed" : current));
      setError((current) => current || "Timed out waiting for confirmation. Check your phone or try again.");
    }, 40000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter a valid amount greater than KES 0.");
      return;
    }
    if (balance != null && numericAmount > balance) {
      setError(`Amount can't exceed your outstanding balance of ${money(balance)}.`);
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Enter the M-Pesa phone number to charge.");
      return;
    }

    try {
      setState("sending");

      let pledgeId = myPledge?._id;
      if (!pledgeId) {
        // No pledge yet — create one for this exact amount first, then
        // pay it down immediately in the same flow.
        const pledgeRes = await contributionGroupApi.pledge(groupId, { amount: numericAmount });
        pledgeId = pledgeRes.data?.data?.pledge?._id;
      }

      const stkRes = await contributionGroupApi.initiatePledgeStk(groupId, pledgeId, {
        amount: numericAmount,
        phoneNumber: phoneNumber.trim(),
      });

      const paymentIntentId = stkRes.data?.data?.paymentIntentId;
      if (!paymentIntentId) {
        throw new Error("M-Pesa did not return a payment reference");
      }
      startPolling(paymentIntentId);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not start the M-Pesa payment.");
      setState("form");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Pay Your Pledge</h3>
              <p className="text-xs text-slate-500">
                {balance != null ? `Outstanding: ${money(balance)}` : "M-Pesa STK push"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400">
            {error}
          </div>
        )}

        {(state === "form" || state === "sending") && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Amount (KES)</label>
              <input
                type="number"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 px-4 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">M-Pesa Phone Number</label>
              <input
                type="tel"
                required
                placeholder="0712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 px-4 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={state === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-xs font-black text-white shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50"
            >
              {state === "sending" ? <Loader2 size={18} className="animate-spin" /> : <>Send STK Push</>}
            </button>
          </form>
        )}

        {state === "waiting" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Clock size={32} className="text-amber-500 animate-pulse" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Check your phone for the M-Pesa PIN prompt</p>
            <p className="text-xs text-slate-500">Waiting for confirmation… {countdown}s</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Payment confirmed!</p>
            <button
              onClick={onClose}
              className="mt-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-600"
            >
              Done
            </button>
          </div>
        )}

        {state === "failed" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle size={32} className="text-rose-500" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Payment not completed</p>
            <button
              onClick={() => setState("form")}
              className="mt-2 rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
