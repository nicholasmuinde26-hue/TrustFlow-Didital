import { useEffect, useRef, useState } from "react";
import { Smartphone, CheckCircle2, AlertCircle, Loader2, Clock, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";
import useWorkspace from "@/app/hooks/useWorkspace";
import chamaApi from "@/modules/chama/api/chama.api";

export default function SavingsPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const { workspaceId: currentWorkspaceId } = useWorkspace();
  const chamaId = routeWorkspaceId || currentWorkspaceId;

  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [intent, setIntent] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const handleCancelPayment = () => {
    clearTimers();
    setIsPolling(false);
    setSubmitting(false);
    setMessage({
      type: "error",
      text: "Payment process was cancelled by user.",
    });
    setIntent(null);
  };

  const startPolling = (paymentIntent) => {
    clearTimers();
    setIsPolling(true);
    setCountdown(60);

    // Countdown ticker (60 seconds max for M-Pesa PIN entry)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimers();
          setIsPolling(false);
          setMessage({
            type: "error",
            text: "Payment confirmation timed out. If you completed the payment, your balance will update shortly.",
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    let pollCount = 0;
    // Status polling loop. Query Daraja as a fallback after the first few
    // polls so a blocked callback URL does not leave the member waiting.
    pollRef.current = setInterval(async () => {
      try {
        pollCount += 1;
        const response = pollCount >= 4 && pollCount % 4 === 0
          ? await chamaApi.reconcilePaymentIntent(chamaId, paymentIntent._id)
          : await chamaApi.getPaymentIntent(chamaId, paymentIntent._id);
        const { data } = response;
        const updated = data.data.paymentIntent;
        setIntent(updated);

        if (["completed", "failed", "cancelled"].includes(updated.status)) {
          clearTimers();
          setIsPolling(false);

          if (updated.status === "completed") {
            setMessage({
              type: "success",
              text: "Payment confirmed successfully! Your savings deposit has been recorded.",
            });
            window.dispatchEvent(new Event("finance:updated"));
            setPhoneNumber("");
            setAmount("");
          } else {
            setMessage({
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

  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      const idempotencyKey = crypto.randomUUID();
      const { data } = await chamaApi.depositSavings(
        chamaId,
        { amount: Number(amount), phoneNumber },
        idempotencyKey
      );
      
      const paymentIntent = data.data.paymentIntent;
      setIntent(paymentIntent);
      
      // Start countdown & status checks; overlay handles the active display
      startPolling(paymentIntent);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Could not start the M-Pesa payment.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = submitting || isPolling;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Savings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Deposit directly to your chama savings account securely through M-Pesa STK Push.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 relative">
        
        {/* Blocking Overlay During STK Submission & Polling */}
        {isLocked && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs z-10 flex flex-col items-center justify-center rounded-2xl p-6 text-center animate-fade-in">
            <Loader2 size={38} className="animate-spin text-emerald-600 mb-2" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {submitting ? "Sending STK Push..." : `Waiting for M-Pesa PIN Entry (${countdown}s)`}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {submitting
                ? "Connecting to Safaricom Daraja API..."
                : "Check your phone screen for the prompt and enter your PIN."}
            </p>

            {/* Cancel Payment Button */}
            {isPolling && (
              <button
                type="button"
                onClick={handleCancelPayment}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300 transition-colors cursor-pointer shadow-xs"
              >
                <XCircle size={16} />
                Cancel Payment
              </button>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            M-Pesa Phone Number *
          </label>
          <input
            type="tel"
            required
            disabled={isLocked}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="e.g. 0712345678"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Amount (KES) *
          </label>
          <input
            type="number"
            required
            min="1"
            step="1"
            disabled={isLocked}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1000"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLocked || !chamaId}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Smartphone size={18} />
          Deposit with M-Pesa
        </button>
      </form>

      {/* Status Alert & Feedback Box: Only shown when NOT actively polling/submitting */}
      {message && !isLocked && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-medium animate-fade-in ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : message.type === "error"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          }`}
        >
          {message.type === "success" && <CheckCircle2 size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />}
          {message.type === "error" && <AlertCircle size={20} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />}

          <div className="flex-1">
            <p>{message.text}</p>
            {intent && message.type === "success" && (
              <p className="mt-1 text-xs opacity-75 font-mono">
                Receipt Reference: {intent.external_reference || "Confirmed"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
