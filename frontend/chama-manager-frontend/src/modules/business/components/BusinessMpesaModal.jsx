import React, { useEffect, useState } from "react";
import { Smartphone, X, CheckCircle2, AlertCircle, Loader2, Clock, XCircle, ShieldCheck, ArrowRight, RefreshCcw } from "lucide-react";
import businessService from "../services/business.service";
import useStkPushFlow from "@/shared/hooks/useStkPushFlow";

export default function BusinessMpesaModal({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
  workspaceId,
  title = "Business M-Pesa STK Collection",
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState(null);

  // Uses the same shared useStkPushFlow hook as MpesaStkModal/MGR/Pledge —
  // real sending -> awaiting_pin -> processing phases, Socket.IO-first
  // instant detection with HTTP polling as the fallback, and the specific
  // M-Pesa failure reason (insufficient funds, cancelled, timed out)
  // instead of a generic "not completed" message.
  //
  // Business transactions don't go through the shared PaymentIntent
  // pipeline (see business.service.js), so their own checkStkStatus /
  // reconcileStkCallback already call emitBusinessTransactionStatus() to
  // push "payment:status" straight to this seller's socket room the
  // instant M-Pesa resolves it - this modal just needs to actually be
  // listening, which useStkPushFlow now does correctly.
  const fetchStatus = async (transactionId) => {
    if (!workspaceId) return null;
    const result = await businessService.queryMpesaStkPushStatus(workspaceId, transactionId);
    const transaction = result?.transaction;
    if (!transaction) return null;
    return { status: transaction.status, failureReason: transaction.failure_reason, raw: transaction };
  };

  const { phase, failureReason, secondsLeft, startSending, beginWaiting, cancel, reset } = useStkPushFlow({
    fetchStatus,
    onResolved: (status, reason, raw) => {
      if (status === "completed") {
        onSuccess?.(raw);
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      setPhoneNumber("");
      setAmount("");
      setCustomerName("");
      setDescription("");
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

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone || formattedPhone.length !== 12) {
      return setFormError("Please enter a valid Kenyan M-Pesa phone number (e.g. 0712345678)");
    }
    if (!amount || Number(amount) <= 0) {
      return setFormError("Please enter a valid payment amount (minimum KES 1)");
    }

    try {
      startSending();

      const payload = {
        phoneNumber: formattedPhone,
        amount: Number(amount),
        customerName: customerName.trim() || "Customer",
        description: description.trim() || "Business Sale Payment",
      };

      let result = null;
      if (onSubmit) {
        result = await onSubmit(payload);
      } else if (workspaceId) {
        result = await businessService.initiateMpesaStkPush(workspaceId, payload);
      }

      const txData = result?.data || result;
      const transactionId = txData?.transaction?._id || txData?._id || txData?.id;
      const checkoutRequestId = txData?.checkoutRequestId || txData?.transaction?.checkout_request_id;
      if (!transactionId) throw new Error("M-Pesa did not return a payment reference");

      beginWaiting(transactionId, checkoutRequestId);
    } catch (err) {
      reset();
      setFormError(err?.response?.data?.message || err?.message || "Failed to send STK Push prompt to customer.");
    }
  };

  const handleCancelWaiting = () => cancel("STK Push collection cancelled by seller.");

  if (!isOpen) return null;

  const isLocked = phase === "sending" || phase === "awaiting_pin" || phase === "processing";
  const isDone = phase === "completed";
  const isTerminalError = ["failed", "cancelled", "timeout"].includes(phase);

  const errorText =
    formError ||
    (isTerminalError
      ? failureReason ||
        (phase === "timeout"
          ? "PIN input timed out. If the customer completed the payment, balance will update automatically."
          : "The M-Pesa STK payment was not completed.")
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
                {phase === "awaiting_pin" && "Awaiting customer PIN..."}
                {phase === "processing" && "Processing payment..."}
                {(phase === "idle" || isTerminalError) && "Secure STK collection"}
                {isDone && "Payment received"}
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

        {/* Phase 1: Sending STK Push */}
        {phase === "sending" && (
          <div className="my-8 flex flex-col items-center text-center space-y-4">
            <Loader2 size={40} className="animate-spin text-emerald-600" />
            <h4 className="font-bold">Sending STK Push...</h4>
            <p className="text-xs text-slate-500">Contacting M-Pesa for <span className="font-semibold">{phoneNumber}</span></p>
          </div>
        )}

        {/* Phase 2: Awaiting PIN / Processing */}
        {(phase === "awaiting_pin" || phase === "processing") && (
          <div className="my-4 flex flex-col items-center text-center space-y-4 py-2">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 shadow-inner">
                <Smartphone size={32} className={phase === "awaiting_pin" ? "animate-bounce" : ""} />
              </div>
              {phase === "processing" && <Loader2 size={96} className="animate-spin text-emerald-500/40 absolute -inset-2" />}
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-black text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <Clock size={14} className="animate-spin text-amber-700" />
                <span>{phase === "awaiting_pin" ? "Waiting for Customer PIN" : "Confirming with M-Pesa"}... {secondsLeft}s</span>
              </div>
              <h4 className="mt-2 text-base font-black text-slate-900 dark:text-white">
                {phase === "awaiting_pin" ? "STK Prompt Delivered!" : "Processing Payment..."}
              </h4>
              <p className="text-xs text-slate-500 max-w-xs">
                {phase === "awaiting_pin" ? (
                  <>A prompt of <strong className="font-mono font-bold text-slate-900 dark:text-white">KES {Number(amount).toLocaleString()}</strong> was sent to customer's phone <strong className="font-mono text-slate-900 dark:text-white">{phoneNumber}</strong>.</>
                ) : (
                  "Confirming with M-Pesa, this won't take long"
                )}
              </p>
            </div>

            <div className="w-full rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-left text-xs space-y-1.5 dark:bg-slate-950 dark:border-slate-800">
              <div className="flex justify-between text-slate-500">
                <span>Customer:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{customerName || "Customer"}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Amount:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">KES {Number(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Status:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  {phase === "awaiting_pin" ? "Awaiting PIN input" : "Processing"}
                </span>
              </div>
            </div>

            <button
              onClick={handleCancelWaiting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900/50 transition-colors"
            >
              <XCircle size={14} /> Cancel Collection
            </button>
          </div>
        )}

        {/* Phase 3: Success View (Payment Completed & Posted to Ledger) */}
        {isDone && (
          <div className="my-4 flex flex-col items-center text-center space-y-4 py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 shadow-md">
              <CheckCircle2 size={38} />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900 dark:text-white">Payment Received & Posted!</h4>
              <p className="text-xs text-slate-500 max-w-xs">
                M-Pesa payment of <strong className="font-mono font-bold text-slate-900 dark:text-white">KES {Number(amount).toLocaleString()}</strong> confirmed from <strong className="font-mono text-slate-900 dark:text-white">{phoneNumber}</strong>.
              </p>
            </div>

            <div className="w-full rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-left space-y-2 dark:bg-emerald-950/60 dark:border-emerald-800">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-900 dark:text-emerald-300">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <span>Posted to Double-Entry General Ledger</span>
              </div>
              <ul className="text-[11px] text-emerald-800 dark:text-emerald-300/90 space-y-1 pl-6 list-disc font-medium">
                <li>Debited Asset Account: <strong className="font-mono">MPESA_TILL</strong> (+KES {Number(amount).toLocaleString()})</li>
                <li>Credited Income Account: <strong className="font-mono">SALES_REVENUE</strong> (+KES {Number(amount).toLocaleString()})</li>
                <li>Financial Dashboard & Sales metrics updated live</li>
              </ul>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              Done <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Phase 3 (Alt): Failed / Cancelled / Timeout View */}
        {isTerminalError && (
          <div className="my-4 flex flex-col items-center text-center space-y-4 py-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300">
              <XCircle size={32} />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900 dark:text-white">STK Push Payment Failed</h4>
              <p className="text-xs text-slate-500 max-w-xs">
                {errorText}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full pt-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCcw size={14} /> Try Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Form View (Initial Step) */}
        {phase === "idle" && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">M-Pesa Phone *</label>
              <input
                type="tel"
                required
                disabled={isLocked}
                placeholder="0712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Amount KES *</label>
              <input
                type="number"
                min="1"
                required
                disabled={isLocked}
                placeholder="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Customer Name (Optional)</label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="e.g. John Doe"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Description (Optional)</label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="e.g. Counter Sale Invoice #102"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={isLocked}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Smartphone size={18} />
              Collect with M-Pesa
            </button>
          </form>
        )}
      </div>
    </div>
  );
}