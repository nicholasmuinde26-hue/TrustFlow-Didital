import { Trash2 } from "lucide-react";

import PresenceBadge from "@/modules/presence/components/PresenceBadge";
import { assignableRoles } from "@/modules/workspaces/permissions/permissions";

function initialsOf(name) {
  return String(name || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// The backend populates the person's account details under `user_id`
// (name/phone/status) — the membership document itself only holds role,
// status, and timestamps. This reads that shape directly rather than a
// flattened { name, email } like a typical REST API might return.
export default function MemberRow({
  member,
  type,
  status,
  canManage,
  isSelf,
  onChangeRole,
  onRemove,
}) {
  const user = member.user_id || {};
  const name = user.name || user.phone || "Member";

  // Chama's treasurer and a Contribution Group's primary organizer aren't
  // reassignable from this list (treasurer transfer has its own backend
  // flow; organizer status follows the group's created_by field) — lock
  // those rows even for a manager viewing someone else.
  const isLockedRole =
    (type === "chama" && member.role === "treasurer") ||
    (type === "contribution-group" && member.role === "organizer");

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="relative shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary font-semibold text-white">
          {initialsOf(name)}
        </div>

        <span className="absolute -bottom-0.5 -right-0.5">
          <PresenceBadge status={status} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900 dark:text-white">
          {name}
          {isSelf && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              (you)
            </span>
          )}
        </p>

        {user.phone && (
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {user.phone}
          </p>
        )}
      </div>

      {canManage && !isSelf && !isLockedRole ? (
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={member.role || "member"}
            onChange={(event) => onChangeRole(member, event.target.value)}
            className="
              rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm
              capitalize outline-none focus:border-primary
              dark:border-slate-700 dark:bg-slate-800 dark:text-white
            "
          >
            {assignableRoles(type).map((role) => (
              <option key={role} value={role}>
                {role.replace("_", " ")}
              </option>
            ))}
          </select>

          <button
            onClick={() => onRemove(member)}
            title="Remove member"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {String(member.role || "member").replace("_", " ")}
        </span>
      )}
    </div>
  );
}