import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Store,
  Wallet,
  Crown,
  Phone,
  Mail,
  KeyRound,
  ShieldAlert,
  UserCog,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  Landmark,
  Receipt,
} from "lucide-react";
import adminService from "../services/admin.service";
import Spinner from "@/shared/components/ui/Spinner";

const TYPE_META = {
  chama: { label: "Chama", icon: Building2 },
  business: { label: "Business", icon: Store },
  contribution_group: { label: "Contribution Group", icon: Wallet },
};

const CHAMA_ROLES = ["chairperson", "treasurer", "secretary", "auditor", "committee_member", "patron", "member"];

function formatKES(amount) {
  const n = Number(amount || 0);
  return `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export default function AdminEntityDetailPage() {
  const { type, id } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // membershipId currently acting on
  const [alertMsg, setAlertMsg] = useState({ text: "", type: "" });

  const meta = TYPE_META[type] || TYPE_META.chama;
  const Icon = meta.icon;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getEntityDetail(type, id);
      setDetail(data);
    } catch (err) {
      setAlertMsg({
        text: err?.response?.data?.message || "Failed to load workspace details",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [type, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRoleChange(membershipId, currentRole, newRole, memberName) {
    if (newRole === currentRole) return;

    const isChairTransfer = newRole === "chairperson";
    const confirmMsg = isChairTransfer
      ? `Make ${memberName || "this member"} the new Chairperson? The current Chairperson (if any) will automatically be moved to Member.`
      : `Change ${memberName || "this member"}'s role to ${newRole.replace("_", " ")}?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(membershipId);
    setAlertMsg({ text: "", type: "" });
    try {
      const res = await adminService.updateChamaMember(id, membershipId, { role: newRole });
      setDetail(res.data);
      setAlertMsg({ text: res.message || "Member updated", type: "success" });
    } catch (err) {
      setAlertMsg({
        text: err?.response?.data?.message || "Failed to update member",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStatusToggle(membershipId, currentStatus, memberName) {
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    const confirmMsg =
      nextStatus === "suspended"
        ? `Suspend ${memberName || "this member"}? They will lose access to this Chama's workspace until reactivated.`
        : `Reactivate ${memberName || "this member"}?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(membershipId);
    setAlertMsg({ text: "", type: "" });
    try {
      const res = await adminService.updateChamaMember(id, membershipId, { status: nextStatus });
      setDetail(res.data);
      setAlertMsg({ text: res.message || "Member updated", type: "success" });
    } catch (err) {
      setAlertMsg({
        text: err?.response?.data?.message || "Failed to update member",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <Spinner />;

  if (!detail) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Workspace not found</p>
        <Link to="/admin/directory" className="mt-3 inline-block text-xs font-bold text-violet-600">
          Back to Directory
        </Link>
      </div>
    );
  }

  const { entity, members = [], finance, contributions = [], outstandingLoans } = detail;
  const isChama = type === "chama";

  return (
    <div className="space-y-6">
      <Link
        to="/admin/directory"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft size={14} /> Back to Directory
      </Link>

      {alertMsg.text && (
        <div
          className={`rounded-2xl p-4 text-xs font-semibold ${
            alertMsg.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
          }`}
        >
          {alertMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Icon size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">{entity.name}</h1>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {meta.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Created by {entity.created_by?.name || "Unknown"}
              {entity.created_by?.phone ? ` • ${entity.created_by.phone}` : ""}
            </p>
            {entity.join_code && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1 text-xs font-mono font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <KeyRound size={13} className="text-violet-600" /> {entity.join_code}
              </div>
            )}
          </div>
        </div>

        <Link
          to={type === "business" ? `/workspace/${id}/business` : `/workspace/${id}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-violet-600 hover:bg-violet-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Open Workspace <ExternalLink size={13} />
        </Link>
      </div>

      {/* Finance Snapshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Landmark size={14} /> Total Balance
          </div>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
            {formatKES(finance?.totalBalance)}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <UserCog size={14} /> People Involved
          </div>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{members.length}</p>
        </div>
        {isChama && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Receipt size={14} /> Outstanding Loans
            </div>
            <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{outstandingLoans ?? 0}</p>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-6 dark:border-slate-800">
          <h2 className="text-base font-black text-slate-900 dark:text-white">Members &amp; People Involved</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isChama
              ? "Fix a role assignment or hand over the Chairperson seat directly — no need to visit the workspace."
              : "Everyone associated with this workspace."}
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {members.map((m) => {
            const busy = actionLoading === m.membershipId;
            const isSuspended = m.status === "suspended";
            return (
              <div
                key={m.membershipId || m.user?._id}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {m.user?.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {m.user?.name || "Unnamed Member"}
                      </span>
                      {m.role === "chairperson" && (
                        <Crown size={14} className="text-amber-500" title="Chairperson" />
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          isSuspended
                            ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                      {m.user?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} /> {m.user.phone}
                        </span>
                      )}
                      {m.user?.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={12} /> {m.user.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold capitalize text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    {(m.role || "").replace("_", " ")}
                  </span>

                  {isChama && m.membershipId && (
                    <>
                      <select
                        disabled={busy}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleRoleChange(m.membershipId, m.role, e.target.value, m.user?.name);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-600 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <option value="">Change role…</option>
                        {CHAMA_ROLES.filter((r) => r !== m.role).map((r) => (
                          <option key={r} value={r}>
                            {r === "chairperson" ? "Make Chairperson" : `Set as ${r.replace("_", " ")}`}
                          </option>
                        ))}
                      </select>

                      <button
                        disabled={busy}
                        onClick={() => handleStatusToggle(m.membershipId, m.status, m.user?.name)}
                        title={isSuspended ? "Reactivate member" : "Suspend member"}
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                          isSuspended
                            ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300"
                            : "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300"
                        }`}
                      >
                        {isSuspended ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                        {isSuspended ? "Reactivate" : "Suspend"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="p-8 text-center text-xs font-semibold text-slate-500">
              No members found for this workspace.
            </div>
          )}
        </div>
      </div>

      {/* Finance Accounts */}
      {finance?.accounts?.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-6 dark:border-slate-800">
            <h2 className="text-base font-black text-slate-900 dark:text-white">Financial Accounts</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {finance.accounts.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-4 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {a.name} <span className="text-slate-400">({a.account_type})</span>
                </span>
                <span className="font-black text-slate-900 dark:text-white">{formatKES(a.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Contributions (Chama only) */}
      {isChama && contributions.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-6 dark:border-slate-800">
            <h2 className="text-base font-black text-slate-900 dark:text-white">Recent Contribution Rounds</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {contributions.map((c) => (
              <div key={c._id} className="flex items-center justify-between p-4 text-xs">
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{c.title}</span>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                    {c.status}
                  </span>
                </div>
                <span className="font-black text-slate-900 dark:text-white">
                  {formatKES(c.collected_amount)} / {formatKES(c.target_amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {members.some((m) => m.status === "suspended") && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>Suspended members lose management access but remain visible here for audit purposes.</p>
        </div>
      )}
    </div>
  );
}
