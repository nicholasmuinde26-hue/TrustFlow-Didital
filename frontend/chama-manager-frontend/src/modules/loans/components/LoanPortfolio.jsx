import { useState } from "react";
import { ShieldCheck, Send, CheckCircle2, XCircle, Users, Check } from "lucide-react";
import LoanStatusBadge from "./LoanStatusBadge";

const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;

export default function LoanPortfolio({ portfolio, onDecision, onDisburse, onConfirmManual, busy }) {
  if (!portfolio) return null;

  const pendingLoans = (portfolio.loans || []).filter(
    (l) => l.status === "pending_approval" || l.status === "eligible" || l.status === "approved"
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
      {/* Official Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="inline-block rounded-full bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 text-[10px] font-bold dark:bg-sky-950 dark:text-sky-300">
              OFFICIAL TREASURER / CHAIR DASHBOARD
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              Member Loan Approvals & B2C Payouts
            </h2>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right dark:border-slate-800 dark:bg-slate-800">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Pending Review</span>
          <b className="text-xl font-black text-amber-600 dark:text-amber-400">
            {portfolio.summary?.awaiting_decision_count || pendingLoans.length} Applications
          </b>
        </div>
      </div>

      {/* 1-Screen Approvals List */}
      <div className="space-y-3">
        {pendingLoans.length > 0 ? (
          pendingLoans.map((loan) => (
            <div
              key={loan.id || loan._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/60"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                    {loan.member_name || "Chama Member"}
                  </h4>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 text-base">
                    {money(loan.outstanding || loan.amount)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Purpose: {loan.purpose || "Personal Credit"}</p>
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
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
            <Users className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No Pending Member Approvals</p>
            <p className="text-xs text-slate-500 mt-1">When members request credit, approval cards will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
