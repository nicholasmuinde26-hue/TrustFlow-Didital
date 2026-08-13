import { useState } from "react";
import { Pencil, Crown, UserX, UserCheck2, ShieldAlert } from "lucide-react";

import { assignableRoles } from "@/modules/workspaces/permissions/Permissions";

const roleLabel = (role) =>
  String(role || "member")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

const statusStyles = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  inactive: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  suspended: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  removed: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function MemberRow({
  member,
  type,
  status, // presence: "online" | "offline"
  canManage,
  canEditProfile,
  isSelf,
  onChangeRole,
  onRemove,
  onEditProfile,
  onToggleStatus,
  onMakeTreasurer,
  updatingRole,
  updatingStatus,
  transferring,
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const user = member.user_id || {};
  const membershipStatus = member.status || "active";
  const isRemoved = membershipStatus === "removed";
  const canSuspend = type === "chama" && canManage && !isSelf && member.role !== "treasurer";
  const canOfferTreasurer =
    type === "chama" && canManage && !isSelf && member.role !== "treasurer" && membershipStatus === "active";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name || "Member"}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {initials(user.name)}
            </div>
          )}
          <span
            title={status === "online" ? "Online" : "Offline"}
            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
              status === "online" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
            }`}
          />
        </div>

        <div>
          <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
            {user.name || "Member"}
            {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
            {member.role === "treasurer" && (
              <Crown size={14} className="text-amber-500" aria-label="Treasurer" />
            )}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {user.phone || user.email || "No contact on file"}
            {type === "chama" && member.payout_position && (
              <span> · Position {member.payout_position}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
            statusStyles[membershipStatus] || statusStyles.active
          }`}
        >
          {roleLabel(membershipStatus)}
        </span>

        {canManage && !isRemoved ? (
          <select
            value={member.role}
            disabled={updatingRole}
            onChange={(e) => onChangeRole(member, e.target.value)}
            className="rounded-lg border p-2 text-sm disabled:opacity-50"
          >
            {assignableRoles(type).map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {roleLabel(member.role)}
          </span>
        )}

        {canEditProfile && (
          <button
            type="button"
            onClick={() => onEditProfile(member)}
            title="Edit profile"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Pencil size={14} /> Edit
          </button>
        )}

        {canOfferTreasurer && (
          <button
            type="button"
            disabled={transferring}
            onClick={() => onMakeTreasurer(member)}
            title="Make treasurer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
          >
            <Crown size={14} /> Make treasurer
          </button>
        )}

        {canSuspend && (
          <button
            type="button"
            disabled={updatingStatus}
            onClick={() => onToggleStatus(member)}
            title={membershipStatus === "active" ? "Suspend member" : "Reactivate member"}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {membershipStatus === "active" ? (
              <>
                <ShieldAlert size={14} /> Suspend
              </>
            ) : (
              <>
                <UserCheck2 size={14} /> Reactivate
              </>
            )}
          </button>
        )}

        {canManage && !isSelf && member.role !== "treasurer" && !isRemoved && (
          <div className="flex items-center gap-1">
            {confirmingRemove ? (
              <>
                <span className="text-xs text-slate-500">Remove?</span>
                <button
                  type="button"
                  onClick={() => {
                    onRemove(member);
                    setConfirmingRemove(false);
                  }}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-500"
                >
                  No
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                title="Remove member"
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
              >
                <UserX size={14} /> Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
