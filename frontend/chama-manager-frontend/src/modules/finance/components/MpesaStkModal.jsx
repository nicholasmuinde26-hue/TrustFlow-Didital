import React, { useState, useEffect, useRef } from "react";
import { Smartphone, X, CheckCircle2, AlertCircle, Loader2, Clock, XCircle } from "lucide-react";
import chamaApi from "@/modules/chama/api/chama.api";

export default function MpesaStkModal({
  isOpen,
  onClose,
  chamaId,
  onSuccess,
  title = "Deposit to Savings via M-Pesa",
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [modalState, setModalState] = useState("form"); // 'form' | 'sending' | 'waiting' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState(null);
  const [countdown, setCountdown] = useState(60);

  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPhoneNumber("");
      setAmount("");
      setModalState("form");
      setStatusMessage(null);
      setCountdown(60);
      clearTimers();
    } else {
      clearTimers();
    }
    return () => clearTimers();
  }, [isOpen]);

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  if (!isOpen) return null;

  const formatPhoneNumber = (phone) => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "254" + cleaned.slice(1);
    } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
      cleaned = "254" + cleaned;
    }
    return cleaned;
  };

  const startPolling = (intentId) => {
    clearTimers();
    setModalState("waiting");
    setCountdown(60);

    // Countdown timer ticker (60 seconds for M-Pesa PIN entry)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimers();
          setModalState("error");
          setStatusMessage({
            type: "error",
            text: "Payment confirmation timed out. If you completed the payment, your balance will update shortly.",
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    let pollCount = 0;
    // Query Daraja periodically as a recovery path if the provider callback
    // cannot reach this deployment.
    pollRef.current = setInterval(async () => {
      try {
        pollCount += 1;
        const response = pollCount >= 4 && pollCount % 4 === 0
          ? await chamaApi.reconcilePaymentIntent(chamaId, intentId)
          : await chamaApi.getPaymentIntent(chamaId, intentId);
        const { data } = response;
        const updated = data.data.paymentIntent;

        if (["completed", "failed", "cancelled"].includes(updated.status)) {
          clearTimers();
          if (updated.status === "completed") {
            setModalState("success");
            setStatusMessage({
              type: "success",
              text: "Payment confirmed successfully! Your savings deposit has been recorded.",
            });
            if (onSuccess) onSuccess(updated);
            setTimeout(() => {
              onClose();
            }, 2500);
          } else {
            setModalState("error");
            setStatusMessage({
              type: "error",
              text: updated.failure_reason || "The M-Pesa transaction was cancelled or failed.",
            });
          }
        }
      } catch (err) {
        console.debug("Polling attempt failed, retrying...", err);
      }
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone || formattedPhone.length !== 12) {
      setStatusMessage({
        type: "error",
        text: "Please enter a valid Kenyan phone number (e.g. 0712345678).",
      });
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setStatusMessage({
        type: "error",
        text: "Please enter a valid amount (minimum KES 1).",
      });
      return;
    }

    try {
      setModalState("sending");
      const idempotencyKey = crypto.randomUUID();
      const { data } = await chamaApi.depositSavings(
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
        text:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to start M-Pesa payment. Please check your network.",
      });
    }
  };

  const handleCancel = () => {
    clearTimers();
    setModalState("form");
    setStatusMessage({
      type: "error",
      text: "Payment process was cancelled.",
    });
  };

  const isLocked = modalState === "sending" || modalState === "waiting";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400">
              <Smartphone size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500">
                {modalState === "waiting" ? "Awaiting M-Pesa PIN entry..." : "Secure STK push collection"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              clearTimers();
              onClose();
            }}
            disabled={modalState === "sending"}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMessage && modalState !== "waiting" && (
          <div
            className={`mt-4 flex items-start gap-3 rounded-xl p-3.5 text-xs font-semibold ${
              statusMessage.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle size={18} className="shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* WAITING / POLLING STATE */}
        {modalState === "waiting" && (
          <div className="my-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
              <Loader2 size={40} className="animate-spin absolute" />
              <Smartphone size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                STK Push Sent to Phone
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Please check <span className="font-semibold text-slate-700 dark:text-slate-300">{phoneNumber}</span> and enter your M-Pesa PIN.
              </p>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
              <Clock size={14} />
              <span>Waiting for confirmation ({countdown}s)</span>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              className="mt-2 inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300 transition-colors cursor-pointer shadow-xs"
            >
              <XCircle size={14} />
              Cancel Payment
            </button>
          </div>
        )}

        {/* SUCCESS STATE */}
        {modalState === "success" && (
          <div className="my-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 size={36} />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Payment Successful!</h4>
            <p className="text-xs text-slate-500">{statusMessage?.text}</p>
          </div>
        )}

        {/* REGULAR INPUT FORM */}
        {modalState !== "waiting" && modalState !== "success" && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                M-Pesa Phone Number *
              </label>
              <input
                type="tel"
                required
                disabled={isLocked}
                placeholder="e.g. 0712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Amount (KES) *
              </label>
              <input
                type="number"
                min="1"
                required
                disabled={isLocked}
                placeholder="e.g. 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono disabled:opacity-50"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLocked || !chamaId}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {modalState === "sending" ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending STK Push Prompt...
                  </>
                ) : (
                  <>
                    <Smartphone size={18} />
                    Deposit with M-Pesa
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
