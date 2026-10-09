import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Pin, PinOff, Send } from "lucide-react";
import toast from "react-hot-toast";

import adminSupportService from "../../services/adminSupport.service";
import { btn, Card, EmptyState, errText, fmtDateTime, inputCls, Pill } from "./supportUi";

/**
 * Internal notes. Pass { subject_type, subject_id } for everything known
 * about a user or chama, or { case_id } for one case's timeline. Notes are
 * never visible to the user or chama and cannot be edited or deleted.
 */
export default function NotesPanel({ subject_type, subject_id, case_id, title = "Internal notes", onChange }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setNotes(await adminSupportService.listNotes(case_id ? { case_id } : { subject_type, subject_id }));
    } catch (error) { toast.error(errText(error, "Could not load notes")); }
    finally { setLoading(false); }
  }, [subject_type, subject_id, case_id]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await adminSupportService.addNote({ subject_type, subject_id, case_id, body });
      setBody("");
      await load();
      onChange?.();
    } catch (error) { toast.error(errText(error, "Could not save the note")); }
    finally { setSending(false); }
  }

  async function togglePin(note) {
    try {
      await adminSupportService.setNotePinned(note._id, !note.pinned);
      await load();
    } catch (error) { toast.error(errText(error)); }
  }

  return (
    <Card title={title}>
      <form onSubmit={add} className="space-y-2">
        <textarea
          className={`${inputCls} min-h-[72px]`} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Only admins see this. Add what you learned or did."
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-400">Notes can't be edited or deleted.</span>
          <button type="submit" className={btn.primary} disabled={sending || !body.trim()}>
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Add note
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-3">
        {loading ? null : notes.length === 0 ? <EmptyState>No notes yet</EmptyState> : notes.map((note) => (
          note.kind === "event" ? (
            <p key={note._id} className="border-l-2 border-slate-200 pl-3 text-[11px] font-semibold text-slate-500 dark:border-slate-700">
              {note.body} <span className="font-normal text-slate-400">· {note.author?.name || "System"} · {fmtDateTime(note.created_at)}</span>
            </p>
          ) : (
            <div key={note._id} className={`rounded-2xl border p-3 ${note.pinned ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20" : "border-slate-100 dark:border-slate-800"}`}>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800 dark:text-slate-200">{note.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                <span>
                  {note.author?.name || "Admin"} · {fmtDateTime(note.created_at)}
                  {!case_id && note.case_id ? <> · <Link to={`/admin/support/cases/${note.case_id}`} className="font-bold text-violet-600 hover:underline">on a case</Link></> : null}
                </span>
                <span className="flex items-center gap-2">
                  {note.pinned ? <Pill tone="amber">Pinned</Pill> : null}
                  <button type="button" onClick={() => togglePin(note)} className="text-slate-400 hover:text-slate-700" title={note.pinned ? "Unpin" : "Pin to top"}>
                    {note.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                </span>
              </div>
            </div>
          )
        ))}
      </div>
    </Card>
  );
}
