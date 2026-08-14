import { ShieldAlert, Check, X } from "lucide-react";

const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;

export default function GuarantorInbox({ requests, onRespond, busy }) {
  if (!requests?.length) return null;

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-900 dark:bg-amber-950/30 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <span className="inline-block rounded-full bg-amber-200/80 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-[10px] font-extrabold dark:bg-amber-900 dark:text-amber-200">
            GUARANTOR REQUEST ({requests.length})
          </span>
          <h3 className="text-base font-bold text-amber-950 dark:text-amber-100 mt-0.5">Guarantor Approval Inbox</h3>
        </div>
      </div>

      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
        Caution: Pledging your guarantee encumbers a portion of your Chama savings balance to back this member's loan.
      </p>

      <div className="space-y-3">
        {requests.map((r) => (
          <div
            key={r.loan_id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200/60 bg-white p-4 dark:border-amber-900/40 dark:bg-slate-900"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-sm">{r.reference || "Loan Guarantee Request"}</span>
                <span className="rounded-full bg-amber-100 text-amber-900 font-mono font-bold px-2.5 py-0.5 text-xs dark:bg-amber-950 dark:text-amber-300">
                  {money(r.guaranteed_amount)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Purpose: {r.purpose}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={busy}
                onClick={() => onRespond(r.loan_id, "declined")}
                className="flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
              >
                <X className="h-3.5 w-3.5" />
                <span>Decline</span>
              </button>
              <button
                disabled={busy}
                onClick={() => onRespond(r.loan_id, "accepted")}
                className="flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Pledge Guarantee</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
