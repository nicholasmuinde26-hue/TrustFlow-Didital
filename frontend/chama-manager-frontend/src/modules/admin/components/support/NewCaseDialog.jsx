import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import clsx from "clsx";

import adminSupportService from "../../services/adminSupport.service";
import { btn, CATEGORIES, errText, inputCls } from "./supportUi";

function SubjectPicker({ value, onChange }) {
  const [type, setType] = useState("user");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
        if (type === "user") {
          const res = await adminSupportService.searchUsers(query.trim());
          setResults(res.users.map((u) => ({ id: u._id, label: u.name || u.phone, sub: u.phone })));
        } else {
          const res = await adminSupportService.searchChamas(query.trim());
          setResults(res.map((c) => ({ id: c._id, label: c.name, sub: c.chama_type })));
        }
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, type]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
        <span>{value.type === "user" ? "User" : "Chama"}: {value.label}</span>
        <button type="button" onClick={() => onChange(null)} aria-label="Change subject"><X size={14} /></button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {["user", "chama"].map((t) => (
          <button key={t} type="button" onClick={() => { setType(t); setResults([]); }}
            className={clsx("rounded-lg px-3 py-1.5 text-[11px] font-bold", type === t ? "bg-violet-600 text-white" : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
            {t === "user" ? "A user" : "A chama"}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={clsx(inputCls, "pl-8")} value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={type === "user" ? "Name, phone or email" : "Chama name"} />
      </div>
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
          {results.map((r) => (
            <button key={r.id} type="button" onClick={() => onChange({ type, id: r.id, label: r.label })}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-100">{r.label}</span>
              <span className="text-slate-400">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Opens a case. Pass `subject` ({type,id,label}) to lock it to a user or chama. */
export default function NewCaseDialog({ open, onClose, subject: presetSubject = null, invoiceId = null, defaultCategory = "other" }) {
  const [subject, setSubject] = useState(presetSubject);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [priority, setPriority] = useState("normal");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setSubject(presetSubject); setTitle(""); setCategory(defaultCategory); setPriority("normal"); setNote(""); setError(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const created = await adminSupportService.createCase({
        subject_type: subject.type, subject_id: subject.id, title, category, priority, note, invoice_id: invoiceId,
      });
      onClose(created);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={busy ? undefined : () => onClose(null)} />
      <form onSubmit={submit} className="relative w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-base font-black text-slate-900 dark:text-white">Open a support case</h3>
        {presetSubject ? (
          <p className="text-xs font-bold text-slate-500">{presetSubject.type === "user" ? "User" : "Chama"}: {presetSubject.label}</p>
        ) : <SubjectPicker value={subject} onChange={setSubject} />}

        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
          What is the problem?
          <input className={clsx(inputCls, "mt-1")} value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Paid twice for Standard, wants one refunded" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
            Type
            <select className={clsx(inputCls, "mt-1")} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
            Priority
            <select className={clsx(inputCls, "mt-1")} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
          First note (optional)
          <textarea className={clsx(inputCls, "mt-1 min-h-[64px]")} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.outline} onClick={() => onClose(null)} disabled={busy}>Cancel</button>
          <button type="submit" className={btn.primary} disabled={busy || !subject || title.trim().length < 4}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : null} Open case
          </button>
        </div>
      </form>
    </div>
  );
}
