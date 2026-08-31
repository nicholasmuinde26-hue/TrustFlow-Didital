import { X, Send, Calendar, CheckCircle2, ShieldAlert } from "lucide-react";
import LoanStatusBadge from "./LoanStatusBadge";

const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;

export default function LoanDetailsPanel({ loan, payments, onClose, onPay, paying }) {
  if (!loan) return null;

  const outstanding =
    Number(loan.balances?.principal_outstanding || 0) +
    Number(loan.balances?.interest_outstanding || 0) +
    Number(loan.balances?.penalty_outstanding || 0);

  const repayable = ["active", "partially_repaid", "overdue", "defaulted"].includes(loan.status);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {loan.reference || "Credit Application Details"}
            </h3>
            <LoanStatusBadge status={loan.status} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Purpose: {loan.purpose}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loan.conflict_of_interest && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-bold uppercase tracking-wider text-[10px]">Conflict-of-interest recusal</p>
            {loan.status === "blocked_conflict" ? (
              <p>{loan.governance_block_reason || "The applicant holds a required approval role and there aren't enough independent officials to form a replacement quorum."}</p>
            ) : (
              <p>
                The applicant is automatically recused from the {(loan.recused_roles || []).join(", ")} seat on this loan.
                {loan.recusal_quorum_required > 0 && ` ${loan.recusal_quorum_required} independent official(s) must approve in their place.`}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Principal Approved</p>
          <b className="mt-1 block text-lg font-black text-slate-900 dark:text-white">{money(loan.amount)}</b>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Outstanding</p>
          <b className="mt-1 block text-lg font-black text-amber-600 dark:text-amber-400">{money(outstanding)}</b>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Payable</p>
          <b className="mt-1 block text-lg font-black text-slate-900 dark:text-white">{money(loan.total_payable)}</b>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Installment Schedule
        </h4>

        {repayable && (
          <button
            disabled={paying}
            onClick={onPay}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{paying ? "Triggering STK..." : "Lipa Loan via M-Pesa"}</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
        <table className="w-full text-xs text-left">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-bold uppercase text-slate-500">
            <tr>
              <th className="p-3">Due Date</th>
              <th className="p-3">Principal</th>
              <th className="p-3">Interest</th>
              <th className="p-3">Penalty</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loan.repayment_schedule && loan.repayment_schedule.length > 0 ? (
              loan.repayment_schedule.map((item) => (
                <tr key={item.installment_number} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                    {new Date(item.due_date).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{money(item.principal_due)}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{money(item.interest_due)}</td>
                  <td className="p-3 text-amber-600 dark:text-amber-400">{money(item.penalty_accrued)}</td>
                  <td className="p-3">
                    <span className="capitalize font-bold text-slate-800 dark:text-slate-200">{item.status}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="p-6 text-center text-slate-500">
                  Repayment schedule generated upon final official approval.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {payments?.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{payments.length} repayment transaction(s) recorded.</span>
        </div>
      )}
    </section>
  );
}
