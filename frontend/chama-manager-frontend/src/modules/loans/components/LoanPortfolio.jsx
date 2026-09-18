import { useState } from "react";
import { ShieldCheck, Send, CheckCircle2, XCircle, Users, Check } from "lucide-react";
import LoanStatusBadge from "./LoanStatusBadge";

const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;

export default function LoanPortfolio({ portfolio, onDecision, onDisburse, onConfirmManual, busy }) {
  if (!portfolio) return null;

  const pendingLoans = (portfolio.loans || []).filter(
    (l) => l.status === "pending_approval" || l.status === "eligible" || l.status === "approved"
  );

  const summary = portfolio.summary || {};
  const repaymentRate = summary.repayment_rate_percent;
  const hasRepaymentRate = typeof repaymentRate === "number";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-obsidian-border dark:bg-obsidian-card space-y-6">
      {/* Official Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-obsidian-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="inline-block rounded-full bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 text-[10px] font-bold dark:bg-sky-950 dark:text-sky-300">
              OFFICIAL TREASURER / CHAIR DASHBOARD
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-mist mt-0.5">
              Member Loan Approvals & B2C Payouts
            </h2>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right dark:border-obsidian-border dark:bg-obsidian-raised">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Pending Review</span>
          <b className="text-xl font-black text-amber-600 dark:text-amber-400">
            {portfolio.summary?.awaiting_decision_count || pendingLoans.length} Applications
          </b>
        </div>
      </div>

      {/* Portfolio Health Strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Loan Book</span>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-mist font-mono">
            {money(summary.total_outstanding)}
          </p>
          <p className="text-xs text-slate-500">{summary.loan_count || 0} loan(s) total</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Repayment Rate</span>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-mist font-mono">
            {hasRepaymentRate ? `${repaymentRate}%` : "—"}
          </p>
          <p className={`text-xs font-bold ${summary.all_loans_current ? "text-emerald-600 dark:text-mint" : "text-amber-600 dark:text-amber-400"}`}>
            {summary.all_loans_current ? "All loans current" : "Some loans overdue"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overdue / Defaulted</span>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-mist font-mono">
            {money((summary.overdue || 0) + (summary.defaulted || 0))}
          </p>
          <p className="text-xs text-slate-500">Interest earned: {money(summary.interest_earned)}</p>
        </div>
      </div>

      {/* 1-Screen Approvals List */}
      <div className="space-y-3">
        {pendingLoans.length > 0 ? (
          pendingLoans.map((loan) => (
            <div
              key={loan.id || loan._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-obsidian-border dark:bg-obsidian-raised/60"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h4 className="font-extrabold text-slate-900 dark:text-mist text-base">
                    {loan.member_name || "Chama Member"}
                  </h4>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 text-base">
                    {money(loan.outstanding || loan.amount)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-mist-muted">Purpose: {loan.purpose || "Personal Credit"}</p>
              </div>

              <div className="flex items-center gap-3">
                <LoanStatusBadge status={loan.status} />

                {(loan.status === "pending_approval" || loan.status === "eligible") && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => onDecision(loan.id || loan._id, "rejected")}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 transition"
                    >
                      Reject
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => onDecision(loan.id || loan._id, "approved")}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-500 transition"
                    >
                      Approve Loan
                    </button>
                  </>
                )}

                {loan.status === "approved" && (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={busy}
                      onClick={() => onDisburse(loan.id || loan._id)}
                      className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-sky-500 transition"
                    >
                      <Send className="h-4 w-4" />
                      <span>M-Pesa B2C</span>
                    </button>
                    {onConfirmManual && (
                      <button
                        disabled={busy}
                        onClick={() => onConfirmManual(loan.id || loan._id)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted transition"
                      >
                        Confirm Cash/Bank
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500 dark:border-obsidian-border dark:bg-obsidian-raised/40">
            <Users className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="font-bold text-slate-800 dark:text-mist text-sm">No Pending Member Approvals</p>
            <p className="text-xs text-slate-500 mt-1">When members request credit, approval cards will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}