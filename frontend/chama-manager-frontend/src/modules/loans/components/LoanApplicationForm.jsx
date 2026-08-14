import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, CheckCircle2, ChevronRight, Users, Calendar, Coins, Sparkles, X } from "lucide-react";

export default function LoanApplicationForm({ canApply, onSubmit, busy, members = [], onClose }) {
  const [step, setStep] = useState(1); // 1: Amount, 2: Months, 3: Guarantors
  const [amount, setAmount] = useState("20000");
  const [months, setMonths] = useState("3");
  const [selectedGuarantors, setSelectedGuarantors] = useState([]);

  const presetAmounts = [5000, 10000, 20000, 50000];
  const presetMonths = [1, 2, 3, 6];

  const sampleMembers = members.length > 0 ? members : [
    { _id: "m1", user_id: { name: "Grace Wanjiku" } },
    { _id: "m2", user_id: { name: "Peter Omondi" } },
    { _id: "m3", user_id: { name: "Aminu Hassan" } },
    { _id: "m4", user_id: { name: "Mary Kamau" } },
  ];

  const toggleGuarantor = (id) => {
    if (selectedGuarantors.includes(id)) {
      setSelectedGuarantors(selectedGuarantors.filter((g) => g !== id));
    } else {
      if (selectedGuarantors.length < 2) {
        setSelectedGuarantors([...selectedGuarantors, id]);
      }
    }
  };

  const handleFinalSubmit = () => {
    onSubmit({
      amount: Number(amount),
      purpose: "Personal & Chama Business",
      repayment_period_months: Number(months),
      repayment_frequency: "monthly",
      disbursement_method: "mpesa",
      guarantors: selectedGuarantors,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-2xl space-y-6 text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold dark:bg-emerald-950 dark:text-emerald-400">
              FAST 3-TAP APPLICATION
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Apply for Chama Loan</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-all ${
                s <= step ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-800"
              }`}
            />
          ))}
        </div>

        {/* STEP 1: AMOUNT */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Step 1 of 3: How much do you need?</p>
              <h4 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">Select Amount</h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className={`rounded-2xl p-4 text-center font-black text-lg transition border ${
                    amount === String(amt)
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  KES {amt.toLocaleString()}
                </button>
              ))}
            </div>

            <label className="block space-y-1 text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>Or enter custom amount:</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-base font-black text-slate-900 focus:border-emerald-600 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                placeholder="20,000"
              />
            </label>

            <button
              onClick={() => setStep(2)}
              disabled={!amount || Number(amount) <= 0}
              className="w-full rounded-2xl bg-emerald-600 py-4 font-extrabold text-white text-base shadow-lg hover:bg-emerald-500 transition disabled:opacity-50"
            >
              Next: Select Months →
            </button>
          </div>
        )}

        {/* STEP 2: REPAYMENT TERM */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Step 2 of 3: Repayment Period</p>
              <h4 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">How many months?</h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {presetMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(String(m))}
                  className={`rounded-2xl p-4 text-center font-extrabold text-base transition border ${
                    months === String(m)
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {m} Month{m > 1 ? "s" : ""}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 py-3.5 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-2 rounded-2xl bg-emerald-600 py-3.5 font-extrabold text-white hover:bg-emerald-500 transition"
              >
                Next: Pick 2 Guarantors →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: GUARANTORS */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Step 3 of 3: Chama Guarantors</p>
              <h4 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">Pick 2 Guarantors ({selectedGuarantors.length}/2)</h4>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sampleMembers.map((m) => {
                const isSelected = selectedGuarantors.includes(m._id);
                return (
                  <div
                    key={m._id}
                    onClick={() => toggleGuarantor(m._id)}
                    className={`cursor-pointer flex items-center justify-between rounded-2xl p-3.5 border transition ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <span className="font-bold text-sm">{m.user_id?.name || "Chama Member"}</span>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 py-3.5 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                ← Back
              </button>
              <button
                disabled={busy}
                onClick={handleFinalSubmit}
                className="flex-2 rounded-2xl bg-emerald-600 py-4 font-black text-white text-base shadow-lg hover:bg-emerald-500 transition disabled:opacity-50"
              >
                {busy ? "Submitting..." : "Submit Application ✓"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
