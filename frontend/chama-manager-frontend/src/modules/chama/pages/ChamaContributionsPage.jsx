import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  HeartHandshake,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Send,
  Wallet,
  Banknote,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import chamaContributionApi from "../api/chamaContribution.api";
import mgrApi from "../api/mgr.api";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

const PURPOSE_LABELS = {
  emergency: "Emergency",
  wedding: "Wedding",
  medical: "Medical",
  funeral: "Funeral",
  purchase: "Chama Purchase",
  other: "Other",
};

const STATUS_BADGE = {
  pending_approval: { label: "Awaiting Approval", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  active: { label: "Collecting", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  rejected: { label: "Rejected", color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted" },
  payout_pending: { label: "Payout Pending Approval", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  completed: { label: "Disbursed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted" },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || { label: status, color: "bg-slate-100 text-slate-500" };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${s.color}`}>
      {s.label}
    </span>
  );
}

// ============================================================
// CREATE MODAL
// ============================================================
function CreateModal({ members, onClose, onSubmit }) {
  const [form, setForm] = useState({
    title: "",
    purpose: "emergency",
    description: "",
    beneficiary_membership_id: "",
    target_amount: "",
    deadline: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError("A title is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        ...form,
        target_amount: form.target_amount ? Number(form.target_amount) : null,
        beneficiary_membership_id: form.beneficiary_membership_id || null,
        deadline: form.deadline || null,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-obsidian-card dark:border-obsidian-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-obsidian-border">
          <div className="flex items-center gap-3">
            <HeartHandshake className="text-rose-500" size={22} />
            <h3 className="text-base font-black text-slate-900 dark:text-mist">Start a Chama Contribution</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-mist">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">Title</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
              placeholder='e.g. "Hospital bill for James"'
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">Purpose</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            >
              {Object.entries(PURPOSE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">
              Beneficiary (optional — the member this is being raised for)
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
              value={form.beneficiary_membership_id}
              onChange={(e) => setForm({ ...form, beneficiary_membership_id: e.target.value })}
            >
              <option value="">— None (e.g. a chama purchase) —</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.user_id?.name || "Member"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">Target amount (optional)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                placeholder="KES"
                value={form.target_amount}
                onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">Deadline (optional)</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">Description (optional)</label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}

          <p className="text-[11px] text-slate-400 dark:text-mist-muted">
            This won't start collecting money until an official (chairperson, treasurer, or secretary) approves it.
          </p>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60"
          >
            {loading ? <Loader2 className="mx-auto animate-spin" size={18} /> : "Submit for approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CONTRIBUTE (CHIP IN) MODAL
// ============================================================
function ContributeModal({ contribution, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!Number(amount) || Number(amount) <= 0) return setError("Enter a valid amount");
    if (!phone.trim()) return setError("M-Pesa phone number is required");
    setLoading(true);
    setError("");
    try {
      await onSubmit({ amount: Number(amount), phone_number: phone.trim() });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-obsidian-card dark:border-obsidian-border">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-obsidian-border">
          <h3 className="text-base font-black text-slate-900 dark:text-mist">Chip in — {contribution.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-mist">
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">Amount (KES)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">M-Pesa phone number</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
              placeholder="07XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {loading ? <Loader2 className="mx-auto animate-spin" size={18} /> : "Send STK push"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PROPOSE PAYOUT MODAL
// ============================================================
function ProposePayoutModal({ contribution, onClose, onSubmit }) {
  const [method, setMethod] = useState("mpesa");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      await onSubmit({ disbursement_method: method, phone_number: phone.trim() || null, notes: notes.trim() });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-obsidian-card dark:border-obsidian-border">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-obsidian-border">
          <h3 className="text-base font-black text-slate-900 dark:text-mist">Propose Payout</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-mist">
            <X size={20} />
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-mist-muted">
          Collected: <span className="font-bold">{money(contribution.balance)}</span>. This needs sign-off from 2
          officials before it can be disbursed.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">Disbursement method</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          {method === "mpesa" && (
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">Recipient phone number</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                placeholder="07XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-mist-muted">Notes (optional)</label>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl bg-purple-500 py-2.5 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-60"
          >
            {loading ? <Loader2 className="mx-auto animate-spin" size={18} /> : "Submit for approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CONTRIBUTION CARD
// ============================================================
function ContributionCard({ contribution, isOfficial, onAction, workspaceId }) {
  const [expanded, setExpanded] = useState(false);
  const [showContribute, setShowContribute] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [payments, setPayments] = useState(null);

  const target = contribution.target_amount ? Number(contribution.target_amount) : null;
  const collected = Number(contribution.balance || contribution.collected_amount || 0);
  const pct = target ? Math.min(100, Math.round((collected / target) * 100)) : null;

  const toggleExpanded = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && payments === null && workspaceId) {
      try {
        const { data } = await chamaContributionApi.get(workspaceId, contribution._id);
        setPayments(data?.data?.contribution?.payments || []);
      } catch {
        setPayments([]);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-obsidian-border dark:bg-obsidian-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-slate-900 dark:text-mist">{contribution.title}</h4>
            <StatusBadge status={contribution.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">
            {PURPOSE_LABELS[contribution.purpose] || contribution.purpose}
            {contribution.beneficiary_membership_id?.user_id?.name
              ? ` · for ${contribution.beneficiary_membership_id.user_id.name}`
              : ""}
          </p>
        </div>
        <button onClick={toggleExpanded} className="text-slate-400 hover:text-slate-700 dark:hover:text-mist">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{money(collected)}</span>
        {target && <span className="text-xs text-slate-400">of {money(target)} target</span>}
      </div>

      {target && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      {expanded && contribution.description && (
        <p className="mt-3 text-xs text-slate-500 dark:text-mist-muted">{contribution.description}</p>
      )}

      {expanded && Array.isArray(payments) && (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-obsidian-border">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Contributions</p>
          {payments.length === 0 && <p className="text-xs text-slate-400">No chip-ins yet.</p>}
          {payments.map((p) => (
            <div key={p._id} className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-mist-muted">
                {p.participant_id?.user_id?.name || "Member"} · {p.status}
              </span>
              <span className="font-bold text-slate-800 dark:text-mist">{money(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {contribution.status === "pending_approval" && isOfficial && (
          <>
            <button
              onClick={() => onAction("approve", contribution)}
              className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
            >
              <CheckCircle2 size={14} /> Approve
            </button>
            <button
              onClick={() => onAction("reject", contribution)}
              className="flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600"
            >
              <XCircle size={14} /> Reject
            </button>
          </>
        )}

        {contribution.status === "active" && (
          <button
            onClick={() => setShowContribute(true)}
            className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
          >
            <Wallet size={14} /> Chip in
          </button>
        )}

        {contribution.status === "active" && isOfficial && (
          <button
            onClick={() => onAction("close", contribution)}
            className="flex items-center gap-1 rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
          >
            <Lock size={14} /> Close Collection
          </button>
        )}

        {contribution.status === "closed" && isOfficial && (
          <button
            onClick={() => setShowPayout(true)}
            className="flex items-center gap-1 rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-600"
          >
            <Send size={14} /> Propose Payout
          </button>
        )}

        {contribution.status === "payout_pending" && isOfficial && (
          <button
            onClick={() => onAction("disburse", contribution)}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Banknote size={14} /> Disburse (once approved)
          </button>
        )}
      </div>

      {showContribute && (
        <ContributeModal
          contribution={contribution}
          onClose={() => setShowContribute(false)}
          onSubmit={(payload) => onAction("contribute", contribution, payload)}
        />
      )}
      {showPayout && (
        <ProposePayoutModal
          contribution={contribution}
          onClose={() => setShowPayout(false)}
          onSubmit={(payload) => onAction("proposePayout", contribution, payload)}
        />
      )}
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function ChamaContributionsPage() {
  const workspace = useWorkspace();
  const workspaceId = workspace?.workspaceId;
  const role = workspace?.activeWorkspace?.role || workspace?.currentWorkspace?.role;
  const isOfficial = ["chairperson", "treasurer", "secretary"].includes(role);

  const [contributions, setContributions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [{ data: listRes }, membersRes] = await Promise.all([
        chamaContributionApi.list(workspaceId),
        mgrApi.getMembers(workspaceId).catch(() => ({ data: { data: { members: [] } } })),
      ]);
      setContributions(listRes?.data?.contributions || []);
      setMembers(membersRes?.data?.data?.members || membersRes?.data?.members || []);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const handleCreate = async (payload) => {
    await chamaContributionApi.create(workspaceId, payload);
    notify("Submitted for official approval");
    load();
  };

  const handleAction = async (action, contribution, payload) => {
    try {
      switch (action) {
        case "approve":
          await chamaContributionApi.approve(workspaceId, contribution._id);
          notify("Contribution approved — members can now chip in");
          break;
        case "reject":
          await chamaContributionApi.reject(workspaceId, contribution._id, "Declined");
          notify("Contribution rejected");
          break;
        case "close":
          await chamaContributionApi.closeCollection(workspaceId, contribution._id);
          notify("Collection closed");
          break;
        case "contribute":
          await chamaContributionApi.contribute(workspaceId, contribution._id, payload);
          notify("STK push sent — check your phone");
          break;
        case "proposePayout":
          await chamaContributionApi.proposePayout(workspaceId, contribution._id, payload);
          notify("Payout proposed — awaiting official sign-off");
          break;
        case "disburse":
          await chamaContributionApi.disburse(workspaceId, contribution._id);
          notify("Contribution disbursed");
          break;
        default:
          break;
      }
      load();
    } catch (err) {
      notify(err?.response?.data?.message || err?.message || "Something went wrong");
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 font-sans md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-mist">Chama Contributions</h1>
          <p className="text-sm text-slate-500 dark:text-mist-muted">
            Chip in for a member's emergency or wedding, or raise money for something the chama wants to buy.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600"
        >
          <Plus size={16} /> New
        </button>
      </div>

      {toast && (
        <div className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-mint dark:text-obsidian-rail">
          {toast}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loading && <Loader2 className="mx-auto animate-spin text-slate-400" size={24} />}

        {!loading && contributions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-obsidian-border">
            No contributions yet. Start one for an emergency, a wedding, or something the chama wants to buy.
          </div>
        )}

        {contributions.map((c) => (
          <ContributionCard
            key={c._id}
            contribution={c}
            isOfficial={isOfficial}
            onAction={handleAction}
            workspaceId={workspaceId}
          />
        ))}
      </div>

      {showCreate && (
        <CreateModal members={members} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      )}
    </div>
  );
}
