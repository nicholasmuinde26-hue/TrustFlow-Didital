import React, { useEffect, useState } from "react";
import { X, Smartphone, Loader2, CheckCircle2, XCircle, Clock, RefreshCcw } from "lucide-react";
import contributionGroupApi from "../api/contributionGroup.api";
import useStkPushFlow from "@/shared/hooks/useStkPushFlow";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

// Pays down an existing pledge (or creates one on the fly if the member
// hasn't pledged yet) via the contribution group's own fund/pledge STK
// endpoint — POST /contribution-groups/:groupId/fund/pledges/:pledgeId/payments/stk.
// This is deliberately separate from BusinessMpesaModal, which talks to
// /businesses/:id/mpesa/stkpush and has no concept of a ContributionGroup.
//
// Uses the shared useStkPushFlow hook (same one MpesaStkModal and the MGR
// contribution modal use) so this gets the same real sending -> awaiting_pin
// -> processing phases, the same Socket.IO-first / polling-fallback instant
// detection, and the same specific M-Pesa failure reason (insufficient
// funds, cancelled, timed out) instead of a generic "not completed" message.
export default function PledgeStkModal({ isOpen, onClose, groupId, myPledge, onSuccess }) {
  const balance = myPledge
    ? Math.max(0, Number(myPledge.pledged_amount || 0) - Number(myPledge.obligation_id?.paid_amount || 0))
    : null;

  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [formError, setFormError] = useState("");

  const fetchStatus = async (paymentIntentId) => {
    const { data } = await contributionGroupApi.getPaymentIntentStatus(paymentIntentId);
    const intent = data?.data;
    if (!intent) return null;
    return { status: intent.status, failureReason: intent.failure_reason, raw: intent };
  };

  const { phase, failureReason, secondsLeft, startSending, beginWaiting, cancel, reset } = useStkPushFlow({
    fetchStatus,
    onResolved: (status) => {
      if (status === "completed") {
        onSuccess?.();
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      setAmount(balance ? String(balance) : "");
      setPhoneNumber("");
      setFormError("");
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const isLocked = phase === "sending" || phase === "awaiting_pin" || phase === "processing";
  const isDone = phase === "completed";
  const isTerminalError = ["failed", "cancelled", "timeout"].includes(phase);

  const errorText =
    formError ||
    (isTerminalError
      ? failureReason ||
        (phase === "timeout"
          ? "Timed out waiting for confirmation. Check your phone or try again."
          : "The M-Pesa prompt was not completed.")
      : null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setFormError("Enter a valid amount greater than KES 0.");
      return;
    }
    if (balance != null && numericAmount > balance) {
      setFormError(`Amount can't exceed your outstanding balance of ${money(balance)}.`);
      return;
    }
    if (!phoneNumber.trim()) {
      setFormError("Enter the M-Pesa phone number to charge.");
      return;
    }

    try {
      startSending();

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
      const checkoutRequestId = stkRes.data?.data?.checkoutRequestId;
      if (!paymentIntentId) {
        throw new Error("M-Pesa did not return a payment reference");
      }
      beginWaiting(paymentIntentId, checkoutRequestId);
    } catch (err) {
      reset();
      setFormError(err?.response?.data?.message || err.message || "Could not start the M-Pesa payment.");
    }
  };

  const handleCancel = () => cancel("Payment cancelled by user");

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
                {phase === "sending" && "Sending STK push..."}
                {phase === "awaiting_pin" && "Awaiting M-Pesa PIN..."}
                {phase === "processing" && "Processing payment..."}
                {(phase === "idle" || isTerminalError) &&
                  (balance != null ? `Outstanding: ${money(balance)}` : "M-Pesa STK push")}
                {isDone && "Payment confirmed"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLocked}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {errorText && (phase === "idle" || isTerminalError) && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400">
            {errorText}
          </div>
        )}

        {(phase === "idle" || isTerminalError) && (
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-xs font-black text-white shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50"
            >
              {isTerminalError ? (
                <>
                  <RefreshCcw size={16} /> Try Again
                </>
              ) : (
                <>Send STK Push</>
              )}
            </button>
          </form>
        )}

        {phase === "sending" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 size={32} className="animate-spin text-emerald-600" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Sending STK push...</p>
            <p className="text-xs text-slate-500">Contacting M-Pesa for {phoneNumber}</p>
          </div>
        )}

        {(phase === "awaiting_pin" || phase === "processing") && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Clock size={32} className="text-amber-500 animate-pulse" />
            {phase === "awaiting_pin" ? (
              <>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Check your phone for the M-Pesa PIN prompt</p>
                <p className="text-xs text-slate-500">Sent to {phoneNumber}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Processing payment...</p>
                <p className="text-xs text-slate-500">Confirming with M-Pesa, this won't take long</p>
              </>
            )}
            <p className="text-xs text-slate-500">Waiting for confirmation… {secondsLeft}s</p>
            <button
              onClick={handleCancel}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              <XCircle size={14} /> Cancel
            </button>
          </div>
        )}

        {isDone && (
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
      </div>
    </div>
  );
}