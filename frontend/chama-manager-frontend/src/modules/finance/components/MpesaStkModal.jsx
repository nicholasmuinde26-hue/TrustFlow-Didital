import React, { useEffect, useState } from "react";
import { Smartphone, X, CheckCircle2, AlertCircle, Loader2, Clock, XCircle, RefreshCcw } from "lucide-react";
import chamaApi from "@/modules/chama/api/chama.api";
import financeApi from "@/modules/finance/api/finance.api";
import useStkPushFlow from "@/shared/hooks/useStkPushFlow";

export default function MpesaStkModal({
  isOpen,
  onClose,
  chamaId,
  obligationId = null,
  onSuccess,
  title = "Deposit to Savings via M-Pesa",
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState(null);

  const fetchStatus = async (paymentIntentId) => {
    const { data } = await chamaApi.getPaymentIntent(chamaId, paymentIntentId);
    const intent = data?.data?.paymentIntent;
    if (!intent) return null;
    return { status: intent.status, failureReason: intent.failure_reason, raw: intent };
  };

  const { phase, failureReason, secondsLeft, startSending, beginWaiting, cancel, reset } = useStkPushFlow({
    fetchStatus,
    onResolved: (status, reason, raw) => {
      if (status === "completed") {
        // Balance card doesn't share a data layer with this modal, so nudge
        // it to refetch immediately instead of waiting on its own poll.
        window.dispatchEvent(new Event("finance:updated"));
        onSuccess?.(raw);
        setTimeout(() => onClose(), 2000);
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      setPhoneNumber("");
      setAmount("");
      setFormError(null);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const formatPhoneNumber = (phone) => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
    else if (cleaned.startsWith("7") || cleaned.startsWith("1")) cleaned = "254" + cleaned;
    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!chamaId) return setFormError("No chama selected");

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone || formattedPhone.length !== 12) {
      return setFormError("Please enter a valid Kenyan phone number");
    }
    if (!amount || Number(amount) <= 0) {
      return setFormError("Please enter a valid amount");
    }

    try {
      startSending();
      const idempotencyKey = crypto.randomUUID();

      const { data } = obligationId
        ? await financeApi.initiateMpesaStkPush({
            chamaId,
            productType: "contribution",
            obligationId,
            amount: Number(amount),
            phoneNumber: formattedPhone,
            accountReference: title,
            transactionDescription: title,
            idempotencyKey,
          })
        : await chamaApi.depositSavings(
            chamaId,
            { amount: Number(amount), phoneNumber: formattedPhone },
            idempotencyKey
          );

      // Shape differs by endpoint: depositSavings nests { paymentIntent, stk },
      // while initiateMpesaStkPush (obligation payments) returns the ids flat.
      // The original code only ever read the nested shape, so an obligation
      // payment crashed here with "Cannot read properties of undefined" the
      // instant the request succeeded.
      const paymentIntentId = data.data.paymentIntent?._id || data.data.paymentIntentId;
      const checkoutRequestId = data.data.stk?.checkoutRequestId || data.data.checkoutRequestId;
      beginWaiting(paymentIntentId, checkoutRequestId);
    } catch (err) {
      reset();
      setFormError(err?.response?.data?.message || "Failed to start M-Pesa payment");
    }
  };

  const handleCancel = async () => {
    if (typeof chamaApi.cancelPaymentIntent === "function") {
      try {
        await chamaApi.cancelPaymentIntent(chamaId, undefined);
      } catch {}
    }
    cancel("Payment cancelled by user");
  };

  if (!isOpen) return null;
  const isLocked = phase === "sending" || phase === "awaiting_pin" || phase === "processing";
  // FIX: useStkPushFlow resolves to "completed", never "success" — this
  // compared against the wrong string, so the "Payment Successful!" view
  // below never rendered and the modal just showed a blank body for the
  // 2s between onResolved firing and the auto-close timeout.
  const isDone = phase === "completed";
  const isTerminalError = ["failed", "cancelled", "timeout"].includes(phase);

  const errorText =
    formError ||
    (isTerminalError
      ? failureReason ||
        (phase === "timeout"
          ? "Payment confirmation timed out. If you completed the payment, your balance will update shortly."
          : "The M-Pesa transaction was cancelled or failed.")
      : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">

        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Smartphone size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-xs text-slate-500">
                {phase === "sending" && "Sending STK push..."}
                {phase === "awaiting_pin" && "Awaiting M-Pesa PIN..."}
                {phase === "processing" && "Processing payment..."}
                {(phase === "idle" || isTerminalError) && "Secure STK push"}
                {isDone && "Payment confirmed"}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={isLocked} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30">
            <X size={18} />
          </button>
        </div>

        {errorText && (phase === "idle" || isTerminalError) && (
          <div className="mt-4 flex items-start gap-3 rounded-xl p-3.5 text-xs font-semibold bg-red-50 text-red-800">
            <AlertCircle size={18} />
            <span>{errorText}</span>
          </div>
        )}

        {phase === "sending" && (
          <div className="my-8 flex flex-col items-center text-center space-y-4">
            <Loader2 size={40} className="animate-spin text-emerald-600" />
            <h4 className="font-bold">Sending STK Push...</h4>
            <p className="text-xs text-slate-500">Contacting M-Pesa for <span className="font-semibold">{phoneNumber}</span></p>
          </div>
        )}

        {(phase === "awaiting_pin" || phase === "processing") && (
          <div className="my-8 flex flex-col items-center text-center space-y-4">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Loader2 size={40} className="animate-spin absolute" />
              <Smartphone size={24} />
            </div>
            {phase === "awaiting_pin" ? (
              <>
                <h4 className="font-bold">STK Push Sent</h4>
                <p className="text-xs text-slate-500">Check <span className="font-semibold">{phoneNumber}</span> and enter PIN</p>
              </>
            ) : (
              <>
                <h4 className="font-bold">Processing Payment...</h4>
                <p className="text-xs text-slate-500">Confirming with M-Pesa, this won't take long</p>
              </>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              <Clock size={14} /> <span>Waiting... {secondsLeft}s</span>
            </div>
            <button onClick={handleCancel} className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
              <XCircle size={14} /> Cancel
            </button>
          </div>
        )}

        {isDone && (
          <div className="my-8 flex flex-col items-center text-center space-y-3">
            <CheckCircle2 size={36} className="text-emerald-600" />
            <h4 className="text-lg font-bold">Payment Successful!</h4>
          </div>
        )}

        {isTerminalError && (
          <div className="my-6 flex flex-col items-center text-center space-y-3">
            <XCircle size={32} className="text-red-500" />
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
            >
              <RefreshCcw size={14} /> Try Again
            </button>
          </div>
        )}

        {(phase === "idle" || isTerminalError) && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold">M-Pesa Phone *</label>
              <input type="tel" required disabled={isLocked} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full rounded-xl border px-3.5 py-2.5" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">Amount KES *</label>
              <input type="number" min="1" required disabled={isLocked} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border px-3.5 py-2.5" />
            </div>
            <button type="submit" disabled={isLocked} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white">
              <Smartphone size={18} className="inline mr-2" />
              Deposit with M-Pesa
            </button>
          </form>
        )}
      </div>
    </div>
  );
}