import { useEffect, useState } from "react";
import { X, Loader2, Check, Wallet, Banknote, HandCoins, Lock, Send, XCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import chamaContributionApi from "../../api/chamaContribution.api";
import { StatusPill, ProgressBar } from "./ContributionCard";
import {
  STAGES,
  stageIndex,
  purposeOf,
  getCollected,
  getTarget,
  getPct,
  deadlineLabel,
  beneficiaryName,
  formatDate,
  initials,
  money,
  toNumber,
} from "./helpers";

function Stepper({ status }) {
  const current = stageIndex(status);
  if (current < 0) return null;
  return (
    <ol className="flex items-start" aria-label="Progress">
      {STAGES.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span className={`absolute right-1/2 top-3 h-0.5 w-full ${i <= current ? "bg-emerald-500" : "bg-slate-200 dark:bg-obsidian-border"}`} />
            )}
            <span
              className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                done
                  ? "bg-emerald-500 text-white"
                  : now
                  ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20"
                  : "bg-slate-200 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted"
              }`}
            >
              {done ? <Check size={13} /> : i + 1}
            </span>
            <span className={`mt-1.5 text-[11px] leading-tight ${now ? "font-bold text-slate-900 dark:text-mist" : "text-slate-500 dark:text-mist-muted"}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const PAYMENT_STATUS = {
  completed: "text-emerald-600 dark:text-emerald-400",
  pending: "text-amber-600 dark:text-amber-400",
  processing: "text-amber-600 dark:text-amber-400",
  failed: "text-rose-600 dark:text-rose-400",
};

function ActionButton({ icon: Icon, children, tone, ...rest }) {
  return (
    <button
      {...rest}
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition ${tone}`}
    >
      <Icon size={16} /> {children}
    </button>
  );
}

export default function ContributionDrawer({ contribution: c, workspaceId, isOfficial, myMembershipId, nextStep, onClose, onAction, refreshKey }) {
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState("people");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    chamaContributionApi
      .get(workspaceId, c._id)
      .then(({ data }) => live && setDetail(data?.data?.contribution || null))
      .catch(() => live && setDetail(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [workspaceId, c._id, refreshKey]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const purpose = purposeOf(c.purpose);
  const Icon = purpose.icon;
  const collected = getCollected(c);
  const target = getTarget(c);
  const pct = getPct(c);
  const deadline = deadlineLabel(c);
  const forName = beneficiaryName(c);
  const approval = c.payout_approval;
  const contributors = detail?.contributors || [];
  const payments = detail?.payments || [];
  const biggest = contributors[0]?.total || 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={c.title}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-obsidian-border dark:bg-obsidian"
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur dark:border-obsidian-border dark:bg-obsidian/95">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${purpose.tone}`}>
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold leading-tight text-slate-900 dark:text-mist">{c.title}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">
              {purpose.label}
              {forName ? ` for ${forName}` : ""} · started {formatDate(c.createdAt)}
            </p>
            <div className="mt-2.5">
              <StatusPill status={c.status} />
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-obsidian-raised dark:hover:text-mist">
            <X size={20} />
          </button>
        </header>

        <div className="space-y-6 px-6 py-6">
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-mist">{money(collected)}</span>
              {target && <span className="text-sm text-slate-500 dark:text-mist-muted">of {money(target)}</span>}
            </div>
            <div className="mt-3">
              <ProgressBar pct={target ? pct : collected > 0 ? 100 : 0} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-mist-muted">
              <span>{target ? `${pct}% raised · ${money(Math.max(0, target - collected))} to go` : "No target set"}</span>
              <span className={deadline?.urgent ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                {deadline ? deadline.text : c.deadline ? `Deadline ${formatDate(c.deadline)}` : ""}
              </span>
            </div>
          </section>

          <Stepper status={c.status} />

          {c.status === "rejected" && c.rejection_reason && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Rejected: {c.rejection_reason}</p>
          )}
          {c.status === "cancelled" && c.cancel_reason && (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted">Cancelled: {c.cancel_reason}</p>
          )}

          {c.description && <p className="text-sm leading-relaxed text-slate-600 dark:text-mist-muted">{c.description}</p>}

          {c.status === "payout_pending" && approval && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
              <div className="flex items-center gap-2 text-sm font-bold text-violet-800 dark:text-violet-300">
                <ShieldCheck size={16} /> Payout sign-off
              </div>
              <p className="mt-1 text-xs text-violet-700/80 dark:text-violet-300/80">
                {approval.approved} of {approval.required} officials have signed off.
                {approval.status === "approved" ? " Ready to disburse." : ""}
              </p>
              <div className="mt-3 flex gap-1.5">
                {Array.from({ length: approval.required }).map((_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < approval.approved ? "bg-violet-500" : "bg-violet-200 dark:bg-violet-900"}`} />
                ))}
              </div>
              {c.disbursement?.method && (
                <p className="mt-3 text-xs text-violet-800 dark:text-violet-300">
                  Via {c.disbursement.method === "mpesa" ? "M-Pesa" : c.disbursement.method}
                  {c.disbursement.phone_number ? ` to ${c.disbursement.phone_number}` : ""}
                </p>
              )}
            </section>
          )}

          {c.status === "completed" && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {money(c.disbursed_amount)} paid out on {formatDate(c.disbursed_at)}
              {c.disbursement_reference ? ` · ref ${c.disbursement_reference}` : ""}
            </p>
          )}

          {/* ACTIONS */}
          <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {c.status === "pending_approval" && isOfficial && (
              <>
                <ActionButton icon={CheckCircle2} tone="bg-emerald-600 hover:bg-emerald-700" onClick={() => onAction("approve", c)}>Approve</ActionButton>
                <ActionButton icon={XCircle} tone="bg-rose-500 hover:bg-rose-600" onClick={() => onAction("reject", c)}>Reject</ActionButton>
              </>
            )}
            {c.status === "active" && (
              <ActionButton icon={Wallet} tone="bg-emerald-600 hover:bg-emerald-700" onClick={() => onAction("chip_in", c)}>Chip in</ActionButton>
            )}
            {c.status === "active" && isOfficial && (
              <>
                <ActionButton icon={HandCoins} tone="bg-sky-600 hover:bg-sky-700" onClick={() => onAction("record_cash", c)}>Record cash</ActionButton>
                <ActionButton icon={Lock} tone="bg-slate-700 hover:bg-slate-800" onClick={() => onAction("close", c)}>Close collection</ActionButton>
              </>
            )}
            {c.status === "closed" && isOfficial && (
              <ActionButton icon={Send} tone="bg-violet-600 hover:bg-violet-700" onClick={() => onAction("propose_payout", c)}>Propose payout</ActionButton>
            )}
            {nextStep?.key === "sign_off" && (
              <>
                <ActionButton icon={CheckCircle2} tone="bg-violet-600 hover:bg-violet-700" onClick={() => onAction("sign_off", c)}>Sign off payout</ActionButton>
                <ActionButton icon={XCircle} tone="bg-rose-500 hover:bg-rose-600" onClick={() => onAction("reject_payout", c)}>Decline payout</ActionButton>
              </>
            )}
            {nextStep?.key === "disburse" && (
              <ActionButton icon={Banknote} tone="bg-emerald-600 hover:bg-emerald-700" onClick={() => onAction("disburse", c)}>Disburse {money(collected)}</ActionButton>
            )}
            {isOfficial && ["pending_approval", "active"].includes(c.status) && collected === 0 && (
              <button onClick={() => onAction("cancel", c)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised">
                Cancel contribution
              </button>
            )}
          </section>

          {/* PEOPLE / PAYMENTS */}
          <section>
            <div className="flex gap-1 border-b border-slate-100 dark:border-obsidian-border">
              {[
                ["people", `Who gave (${contributors.length})`],
                ["payments", `Payments (${payments.length})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
                    tab === key
                      ? "border-emerald-600 text-slate-900 dark:text-mist"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:text-mist-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <Loader2 className="mx-auto mt-8 animate-spin text-slate-400" size={20} />
            ) : tab === "people" ? (
              contributors.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400 dark:text-mist-muted">Nobody has chipped in yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-obsidian-border">
                  {contributors.map((p) => (
                    <li key={p.membership_id} className="flex items-center gap-3 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted">
                        {initials(p.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-mist">
                          {p.name}
                          {String(p.membership_id) === String(myMembershipId) && <span className="ml-1.5 text-xs font-medium text-emerald-600 dark:text-mint">you</span>}
                        </p>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
                          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${biggest ? (p.total / biggest) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-mist">{money(p.total)}</p>
                        {p.count > 1 && <p className="text-[11px] text-slate-400">{p.count} payments</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400 dark:text-mist-muted">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-obsidian-border">
                {payments.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800 dark:text-mist">{p.participant_id?.user_id?.name || "Member"}</p>
                      <p className="text-xs text-slate-500 dark:text-mist-muted">
                        {formatDate(p.paid_at || p.createdAt)} · {p.payment_method === "mpesa" ? "M-Pesa" : p.payment_method}
                        {" · "}
                        <span className={`font-semibold ${PAYMENT_STATUS[p.status] || ""}`}>{p.status}</span>
                      </p>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-mist">{money(toNumber(p.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
