import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FolderPlus } from "lucide-react";
import toast from "react-hot-toast";

import Spinner from "@/shared/components/ui/Spinner";
import adminSupportService from "../../services/adminSupport.service";
import NewCaseDialog from "./NewCaseDialog";
import { ActionDialog, btn, Card, EmptyState, errText, fmtDate, fmtDateTime, kes, Pill } from "./supportUi";

const ISSUE = {
  double_payment: ["Double payment", "red"],
  underpayment: ["Underpayment", "amber"],
  other: ["Needs a look", "slate"],
};
const RESOLUTION_LABEL = { marked_paid: "Marked paid", refunded: "Refunded", credited: "Credited as time", dismissed: "Dismissed" };
const ATTEMPT_TONE = { completed: "green", failed: "red", duplicate: "red", cancelled: "slate", pending: "amber" };

export function AttemptList({ attempts }) {
  if (!attempts?.length) return <p className="text-[11px] text-slate-400">No M-Pesa attempts recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="text-[10px] uppercase tracking-wider text-slate-400">
          <tr><th className="py-1 pr-3">When</th><th className="pr-3">Status</th><th className="pr-3">Amount</th><th className="pr-3">Receipt</th><th>Detail</th></tr>
        </thead>
        <tbody className="text-slate-700 dark:text-slate-300">
          {attempts.map((a) => (
            <tr key={a._id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="whitespace-nowrap py-1.5 pr-3">{fmtDateTime(a.at)}</td>
              <td className="pr-3"><Pill tone={ATTEMPT_TONE[a.status] || "slate"}>{a.status}</Pill></td>
              <td className="pr-3 tabular-nums">{kes(a.amount)}</td>
              <td className="pr-3 font-mono">{a.mpesa_receipt || "—"}</td>
              <td className="text-slate-500">{a.result_desc || "—"}{a.phone ? ` · ${a.phone}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewCard({ item, canFinance, onChanged, onOpenCase }) {
  const [dialog, setDialog] = useState(null); // markPaid | refunded | credited | dismissed
  const [label, tone] = ISSUE[item.issue] || ISSUE.other;
  const resolved = Boolean(item.review?.resolution);
  const isDouble = item.issue === "double_payment";
  const isUnder = item.issue === "underpayment";

  const dialogs = {
    markPaid: {
      title: `Mark ${item.number} paid`,
      description: `Records the payment against this invoice and gives ${item.chama_name || "the chama"} its ${item.months}-month ${item.plan_name} period, exactly as if the M-Pesa callback had arrived. Check the receipt in your M-Pesa statement first.`,
      confirmLabel: "Mark as paid",
      fields: [
        { name: "receipt", label: "M-Pesa receipt", placeholder: "e.g. SLK4X9ABCD", help: "As in the confirmation SMS or the statement. If the customer topped up, use the latest receipt and mention the earlier one in the reason." },
        { name: "amount", label: "Total amount received (KES)", type: "number", min: item.amount, initial: item.amount, help: `The invoice is ${kes(item.amount)}. It can't be marked paid for less.` },
      ],
      run: (v) => adminSupportService.markPaid(item._id, { receipt: v.receipt, amount: Number(v.amount), reason: v.reason }),
      needsStepUp: true,
    },
    refunded: {
      title: "Record a refund",
      description: "Use this after you've reversed or refunded the money outside the app. The reference lets finance trace it later.",
      confirmLabel: "Record refund",
      fields: [{ name: "reference", label: "Refund / reversal reference", placeholder: "M-Pesa reversal receipt" }],
      run: (v) => adminSupportService.resolveReview(item._id, { resolution: "refunded", reference: v.reference, note: v.reason }),
      needsStepUp: true,
    },
    credited: {
      title: "Credit the extra payment as time",
      description: `Adds ${item.months} month${item.months === 1 ? "" : "s"} to ${item.chama_name || "the chama"}'s access instead of refunding the second payment.`,
      confirmLabel: "Add the time",
      fields: [],
      run: (v) => adminSupportService.resolveReview(item._id, { resolution: "credited", note: v.reason }),
      needsStepUp: true,
    },
    dismissed: {
      title: "Dismiss this flag",
      description: "Closes the review without changing the invoice or the chama's access. Say why nothing needs doing.",
      confirmLabel: "Dismiss",
      fields: [],
      run: (v) => adminSupportService.resolveReview(item._id, { resolution: "dismissed", note: v.reason }),
      needsStepUp: true,
    },
  };
  const active = dialog ? dialogs[dialog] : null;

  return (
    <Card className="!rounded-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-slate-900 dark:text-white">{item.number}</span>
            {resolved ? <Pill tone="green">{RESOLUTION_LABEL[item.review.resolution]}</Pill> : <Pill tone={tone}>{label}</Pill>}
            <Pill tone={item.status === "paid" ? "green" : "slate"}>{item.status}</Pill>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            <Link to={`/admin/support/chamas/${item.chama_id}`} className="font-bold text-violet-600 hover:underline">{item.chama_name || "Chama"}</Link>
            {" · "}{item.plan_name} × {item.months} mo · charged <b>{kes(item.amount)}</b> · created {fmtDate(item.created_at)}
          </p>
          {item.paid_at ? <p className="text-[11px] text-slate-400">Paid {fmtDateTime(item.paid_at)}{item.mpesa_receipt ? ` · ${item.mpesa_receipt}` : ""}</p> : null}
        </div>
        <button type="button" className={btn.outline} onClick={() => onOpenCase(item)}><FolderPlus size={13} /> Open case</button>
      </div>

      <div className="mt-3"><AttemptList attempts={item.attempts} /></div>

      {resolved ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={12} className="mr-1 inline" />
          {RESOLUTION_LABEL[item.review.resolution]} · {fmtDateTime(item.review.resolved_at)}
          {item.review.reference ? ` · ref ${item.review.reference}` : ""} — {item.review.note}
        </p>
      ) : canFinance ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.status !== "paid" ? <button type="button" className={btn.primary} onClick={() => setDialog("markPaid")}>Mark paid by receipt</button> : null}
          {isDouble ? <button type="button" className={btn.outline} onClick={() => setDialog("credited")}>Credit as extra time</button> : null}
          {isDouble || isUnder ? <button type="button" className={btn.outline} onClick={() => setDialog("refunded")}>Record refund</button> : null}
          <button type="button" className={btn.outline} onClick={() => setDialog("dismissed")}>Dismiss</button>
        </div>
      ) : (
        <p className="mt-3 text-[11px] font-semibold text-slate-400">Resolving a payment needs the Finance permission. Open a case to hand it over.</p>
      )}

      <ActionDialog
        open={Boolean(active)} onClose={(done) => { setDialog(null); if (done) { toast.success("Saved"); onChanged(); } }}
        title={active?.title} description={active?.description} confirmLabel={active?.confirmLabel}
        fields={active?.fields || []} needsStepUp={active?.needsStepUp}
        onSubmit={(v) => active.run(v)}
      />
    </Card>
  );
}

export default function ReviewQueueTab({ canFinance, onCountChange }) {
  const [mode, setMode] = useState("pending");
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [caseFor, setCaseFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminSupportService.listReviewQueue({ resolved: mode === "resolved" ? "true" : "false", limit: 50 });
      setData(res);
      if (mode === "pending") onCountChange?.(res.total);
    } catch (error) { toast.error(errText(error, "Could not load the review queue")); }
    finally { setLoading(false); }
  }, [mode, onCountChange]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {[["pending", "Needs review"], ["resolved", "Resolved"]].map(([key, text]) => (
            <button key={key} type="button" onClick={() => setMode(key)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${mode === key ? "bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300" : "text-slate-500"}`}>
              {text}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-bold text-slate-400">{data.total} {data.total === 1 ? "payment" : "payments"}</span>
      </div>

      {loading ? <Spinner /> : data.items.length === 0 ? (
        <Card><EmptyState>{mode === "pending" ? "Nothing waiting. Every platform payment has settled cleanly." : "No resolved payments yet."}</EmptyState></Card>
      ) : data.items.map((item) => (
        <ReviewCard key={item._id} item={item} canFinance={canFinance} onChanged={load} onOpenCase={setCaseFor} />
      ))}

      <NewCaseDialog
        open={Boolean(caseFor)} onClose={(created) => { setCaseFor(null); if (created) toast.success(`Opened ${created.number}`); }}
        subject={caseFor ? { type: "chama", id: caseFor.chama_id, label: caseFor.chama_name || "Chama" } : null}
        invoiceId={caseFor?._id} defaultCategory="payment"
      />
    </div>
  );
}
