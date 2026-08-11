import React, { useState, useEffect, useRef } from "react";
import { Smartphone, X, CheckCircle2, AlertCircle, Loader2, Clock, XCircle } from "lucide-react";
import chamaApi from "@/modules/chama/api/chama.api";
import financeApi from "@/modules/finance/api/finance.api";

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
  const [modalState, setModalState] = useState("form"); // 'form' | 'sending' | 'waiting' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState(null);
  const [countdown, setCountdown] = useState(60);
  const [intentId, setIntentId] = useState(null);

  const pollRef = useRef(null);
  const countdownRef = useRef(null);
  const lastStatusRef = useRef(null); // prevent duplicate success calls

  useEffect(() => {
    if (isOpen) {
      resetForm();
    } else {
      clearTimers();
    }
    return () => clearTimers();
  }, [isOpen]);

  const resetForm = () => {
    setPhoneNumber("");
    setAmount("");
    setModalState("form");
    setStatusMessage(null);
    setCountdown(60);
    setIntentId(null);
    lastStatusRef.current = null;
    clearTimers();
  };

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const handleFinalState = (status, data) => {
    if (lastStatusRef.current === status) return; // prevent double fire
    lastStatusRef.current = status;
    clearTimers();

    if (status === "completed") {
      setModalState("success");
      setStatusMessage({
        type: "success",
        text: obligationId
         ? "Payment confirmed successfully!"
          : "Payment confirmed successfully! Your savings deposit has been recorded.",
      });
      // Balance card doesn't share a data layer with this modal, so nudge
      // it to refetch immediately instead of waiting on its own poll.
      window.dispatchEvent(new Event("finance:updated"));
      if (onSuccess) onSuccess(data);
      setTimeout(() => onClose(), 2000);
    } else {
      setModalState("error");
      setStatusMessage({
        type: "error",
        text: data.failure_reason || "The M-Pesa transaction was cancelled or failed.",
      });
    }
  };

  const startPolling = (newIntentId) => {
    setIntentId(newIntentId);
    clearTimers();
    setModalState("waiting");
    setCountdown(60);

    // 1. Fast countdown - 60s
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleFinalState("timeout", { failure_reason: "Payment confirmation timed out. If you completed the payment, your balance will update shortly." });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 2. Aggressive polling: every 2s for first 20s, then every 3s
    let pollCount = 0;
    pollRef.current = setInterval(async () => {
      pollCount++;
      const interval = pollCount < 10? 2000 : 3000;
      clearInterval(pollRef.current);

      try {
        const { data } = await chamaApi.getPaymentIntent(chamaId, newIntentId);
        const updated = data.data.paymentIntent;

        if (["completed", "failed", "cancelled"].includes(updated.status)) {
          handleFinalState(updated.status, updated);
        } else {
          // restart interval with new timing
          pollRef.current = setInterval(arguments.callee, interval);
        }
      } catch (err) {
        console.debug("Polling error, will retry", err);
      }
    }, 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!chamaId) {
      return setStatusMessage({ type: "error", text: "No chama selected" });
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone || formattedPhone.length!== 12) {
      return setStatusMessage({ type: "error", text: "Please enter a valid Kenyan phone number" });
    }

    if (!amount || Number(amount) <= 0) {
      return setStatusMessage({ type: "error", text: "Please enter a valid amount" });
    }

    try {
      setModalState("sending");
      const idempotencyKey = crypto.randomUUID();

      const { data } = obligationId
       ? await financeApi.initiateMpesaStkPush({
            contributionObligationId: obligationId,
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

      const paymentIntent = data.data.paymentIntent;
      startPolling(paymentIntent._id);
    } catch (err) {
      setModalState("form");
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.message || "Failed to start M-Pesa payment",
      });
    }
  };

  const formatPhoneNumber = (phone) => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
    else if (cleaned.startsWith("7") || cleaned.startsWith("1")) cleaned = "254" + cleaned;
    return cleaned;
  };

  const handleCancel = async () => {
    if (intentId) {
      try {
        await chamaApi.cancelPaymentIntent(chamaId, intentId); // optional: tell backend to stop
      } catch {}
    }
    handleFinalState("cancelled", { failure_reason: "Payment cancelled by user" });
  };

  if (!isOpen) return null;
  const isLocked = modalState === "sending" || modalState === "waiting";

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
                {modalState === "waiting"? "Awaiting M-Pesa PIN..." : "Secure STK push"}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={isLocked} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {statusMessage && modalState!== "waiting" && (
          <div className={`mt-4 flex items-start gap-3 rounded-xl p-3.5 text-xs font-semibold ${
            statusMessage.type === "success"? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}>
            {statusMessage.type === "success"? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {modalState === "waiting" && (
          <div className="my-8 flex flex-col items-center text-center space-y-4">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Loader2 size={40} className="animate-spin absolute" />
              <Smartphone size={24} />
            </div>
            <h4 className="font-bold">STK Push Sent</h4>
            <p className="text-xs text-slate-500">Check <span className="font-semibold">{phoneNumber}</span> and enter PIN</p>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              <Clock size={14} /> <span>Waiting... {countdown}s</span>
            </div>
            <button onClick={handleCancel} className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
              <XCircle size={14} /> Cancel
            </button>
          </div>
        )}

        {modalState === "success" && (
          <div className="my-8 flex flex-col items-center text-center space-y-3">
            <CheckCircle2 size={36} className="text-emerald-600" />
            <h4 className="text-lg font-bold">Payment Successful!</h4>
          </div>
        )}

        {modalState!== "waiting" && modalState!== "success" && (
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
              {modalState === "sending"? <Loader2 size={18} className="animate-spin inline mr-2" /> : <Smartphone size={18} className="inline mr-2" />}
              {modalState === "sending"? "Sending..." : "Deposit with M-Pesa"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}