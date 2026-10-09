import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { PURPOSES, money, getCollected, errMessage } from "./helpers";

const inputCls =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist";

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600 dark:text-mist-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400 dark:text-mist-muted">{hint}</span>}
    </label>
  );
}

export function Modal({ title, subtitle, onClose, children, width = "max-w-md" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`max-h-[92vh] w-full ${width} overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-3xl dark:border-obsidian-border dark:bg-obsidian-card`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-mist">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-mist-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-obsidian-raised dark:hover:text-mist"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function SubmitButton({ loading, children, tone = "bg-emerald-600 hover:bg-emerald-700", ...rest }) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-60 ${tone}`}
    >
      {loading ? <Loader2 className="animate-spin" size={17} /> : children}
    </button>
  );
}

// Runs an async submit, closes on success, shows the server's message on failure.
function useSubmit(onSubmit, onClose) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const run = async (payload) => {
    setLoading(true);
    setError("");
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  };
  return { loading, error, setError, run };
}

const ErrorLine = ({ error }) =>
  error ? <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p> : null;

// ============================================================
// CREATE
// ============================================================
export function CreateModal({ members, isOfficial, onClose, onSubmit }) {
  const [form, setForm] = useState({
    title: "",
    purpose: "emergency",
    description: "",
    beneficiary_membership_id: "",
    target_amount: "",
    deadline: "",
  });
  const { loading, error, setError, run } = useSubmit(onSubmit, onClose);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = () => {
    if (form.title.trim().length < 2) return setError("Give it a title, for example \"Hospital bill for James\"");
    if (form.target_amount && !(Number(form.target_amount) > 0)) return setError("Target must be more than zero");
    run({
      ...form,
      title: form.title.trim(),
      target_amount: form.target_amount ? Number(form.target_amount) : null,
      beneficiary_membership_id: form.beneficiary_membership_id || null,
      deadline: form.deadline || null,
    });
  };

  return (
    <Modal title="Start a contribution" subtitle="Raise money from members for a cause." onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <Field label="What is it for?">
          <input className={inputCls} placeholder='e.g. "Hospital bill for James"' value={form.title} onChange={set("title")} autoFocus />
        </Field>

        <div>
          <span className="text-xs font-semibold text-slate-600 dark:text-mist-muted">Type</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {Object.entries(PURPOSES).map(([key, p]) => {
              const Icon = p.icon;
              const on = form.purpose === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, purpose: key })}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    on
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-obsidian-border dark:text-mist-muted"
                  }`}
                >
                  <Icon size={13} /> {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Raising it for" hint="Leave empty when it benefits the whole chama, like a purchase.">
          <select className={inputCls} value={form.beneficiary_membership_id} onChange={set("beneficiary_membership_id")}>
            <option value="">The whole chama</option>
            {members.map((m) => (
              <option key={m._id} value={m._id}>
                {m.user_id?.name || "Member"}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target (KES)" hint="Optional">
            <input type="number" min="0" className={inputCls} value={form.target_amount} onChange={set("target_amount")} />
          </Field>
          <Field label="Closes on" hint="Optional">
            <input type="date" className={inputCls} value={form.deadline} onChange={set("deadline")} />
          </Field>
        </div>

        <Field label="Details">
          <textarea rows={3} className={inputCls} value={form.description} onChange={set("description")} placeholder="Anything members should know before chipping in" />
        </Field>

        <ErrorLine error={error} />
        <p className="text-[11px] text-slate-400 dark:text-mist-muted">
          {isOfficial
            ? "You'll still need to approve it before members can chip in."
            : "Collecting starts once the chairperson, treasurer or secretary approves it."}
        </p>
        <SubmitButton loading={loading} onClick={submit} tone="bg-rose-500 hover:bg-rose-600">
          Submit for approval
        </SubmitButton>
      </div>
    </Modal>
  );
}

// ============================================================
// CHIP IN (M-Pesa STK push)
// ============================================================
const QUICK_AMOUNTS = [100, 200, 500, 1000];
const PHONE_KEY = "chama-contribution:last-phone";

export function ChipInModal({ contribution, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(() => {
    try {
      return window.localStorage.getItem(PHONE_KEY) || "";
    } catch {
      return "";
    }
  });
  const { loading, error, setError, run } = useSubmit(onSubmit, onClose);

  const submit = () => {
    if (!(Number(amount) > 0)) return setError("Enter how much you want to give");
    if (!phone.trim()) return setError("Enter the M-Pesa number to charge");
    try {
      window.localStorage.setItem(PHONE_KEY, phone.trim());
    } catch {
      /* remembering the number is a convenience only */
    }
    run({ amount: Number(amount), phone_number: phone.trim() });
  };

  return (
    <Modal title="Chip in" subtitle={contribution.title} onClose={onClose} width="max-w-sm">
      <div className="space-y-4">
        <div>
          <span className="text-xs font-semibold text-slate-600 dark:text-mist-muted">Amount (KES)</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  Number(amount) === q
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-obsidian-border dark:text-mist-muted"
                }`}
              >
                {q.toLocaleString()}
              </button>
            ))}
          </div>
          <input type="number" min="1" className={inputCls} placeholder="Or type an amount" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <Field label="M-Pesa number" hint="You'll get a prompt on this phone to enter your PIN.">
          <input className={inputCls} placeholder="07XXXXXXXX" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <ErrorLine error={error} />
        <SubmitButton loading={loading} onClick={submit}>
          {Number(amount) > 0 ? `Send prompt for ${money(amount)}` : "Send M-Pesa prompt"}
        </SubmitButton>
      </div>
    </Modal>
  );
}

// ============================================================
// RECORD CASH (officials)
// ============================================================
export function RecordCashModal({ contribution, members, onClose, onSubmit }) {
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const { loading, error, setError, run } = useSubmit(onSubmit, onClose);

  const submit = () => {
    if (!memberId) return setError("Pick the member who paid");
    if (!(Number(amount) > 0)) return setError("Enter the amount received");
    run({ member_id: memberId, amount: Number(amount) });
  };

  return (
    <Modal title="Record cash received" subtitle={contribution.title} onClose={onClose} width="max-w-sm">
      <div className="space-y-4">
        <Field label="Member who paid">
          <select className={inputCls} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Select a member</option>
            {members.map((m) => (
              <option key={m._id} value={m._id}>
                {m.user_id?.name || "Member"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount (KES)">
          <input type="number" min="1" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <ErrorLine error={error} />
        <SubmitButton loading={loading} onClick={submit}>
          Record cash
        </SubmitButton>
      </div>
    </Modal>
  );
}

// ============================================================
// PROPOSE PAYOUT (officials)
// ============================================================
export function ProposePayoutModal({ contribution, onClose, onSubmit }) {
  const [method, setMethod] = useState("mpesa");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const { loading, error, setError, run } = useSubmit(onSubmit, onClose);

  const submit = () => {
    if (method === "mpesa" && !phone.trim()) return setError("Enter the phone number to send the money to");
    run({ disbursement_method: method, phone_number: method === "mpesa" ? phone.trim() : null, notes: notes.trim() });
  };

  return (
    <Modal title="Propose payout" subtitle={contribution.title} onClose={onClose} width="max-w-sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-obsidian-raised">
          <span className="text-slate-500 dark:text-mist-muted">To be paid out </span>
          <span className="font-bold text-slate-900 dark:text-mist">{money(getCollected(contribution))}</span>
          <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">
            Two officials besides you must sign off before this can be disbursed.
          </p>
        </div>
        <Field label="How will it be paid?">
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="mpesa">M-Pesa</option>
            <option value="wallet">Member wallet</option>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </Field>
        {method === "mpesa" && (
          <Field label="Recipient phone number">
            <input className={inputCls} placeholder="07XXXXXXXX" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        )}
        <Field label="Notes">
          <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <ErrorLine error={error} />
        <SubmitButton loading={loading} onClick={submit} tone="bg-violet-600 hover:bg-violet-700">
          Send for sign-off
        </SubmitButton>
      </div>
    </Modal>
  );
}

// ============================================================
// CONFIRM (close / cancel / reject / sign-off / disburse)
// ============================================================
export function ConfirmModal({ title, body, confirmLabel, tone = "bg-slate-800 hover:bg-slate-900", withReason, reasonLabel = "Reason", reasonRequired, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const { loading, error, setError, run } = useSubmit(onSubmit, onClose);

  const submit = () => {
    if (withReason && reasonRequired && !reason.trim()) return setError("Add a short reason");
    run(reason.trim());
  };

  return (
    <Modal title={title} onClose={onClose} width="max-w-sm">
      <div className="space-y-4">
        {body && <p className="text-sm leading-relaxed text-slate-600 dark:text-mist-muted">{body}</p>}
        {withReason && (
          <Field label={reasonLabel}>
            <textarea rows={2} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
        )}
        <ErrorLine error={error} />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-obsidian-border dark:text-mist-muted dark:hover:bg-obsidian-raised"
          >
            Not now
          </button>
          <div className="flex-1">
            <SubmitButton loading={loading} onClick={submit} tone={tone}>
              {confirmLabel}
            </SubmitButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}