import { motion } from "framer-motion";
import { CreditCard, FileText, ArrowUpRight } from "lucide-react";
import LoanStatusBadge from "./LoanStatusBadge";

const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;

export default function LoanList({ loans, onSelect }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            My Personal Borrowing History
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track your individual credit requests, approval status, and repayments.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
          {loans.length} {loans.length === 1 ? "Loan" : "Loans"}
        </span>
      </div>

      <div className="space-y-3">
        {loans && loans.length > 0 ? (
          loans.map((loan) => (
            <motion.div
              key={loan._id}
              whileHover={{ scale: 1.01 }}
              onClick={() => onSelect(loan)}
              className="cursor-pointer flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-slate-900 dark:text-white text-base">
                    {loan.reference || "Credit Application"}
                  </span>
                  <LoanStatusBadge status={loan.status} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{loan.purpose}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Principal</span>
                  <span className="font-black text-slate-900 dark:text-white text-base">{money(loan.amount)}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(loan);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
            <CreditCard className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No Personal Loans Found</p>
            <p className="text-xs text-slate-500 mt-1">Your credit applications and active loans will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
