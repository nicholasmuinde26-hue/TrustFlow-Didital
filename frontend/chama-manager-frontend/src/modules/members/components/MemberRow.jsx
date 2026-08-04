import { Trash2 } from "lucide-react";

import PresenceBadge from "@/modules/presence/components/PresenceBadge";
import { ASSIGNABLE_ROLES } from "@/modules/workspaces/permissions/permissions";

function initialsOf(name) {
  return String(name || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function MemberRow({
  member,
  status,
  canManage,
  isSelf,
  onChangeRole,
  onRemove,
}) {
  const name = member.name || member.email || "Member";

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

        {member.email && (
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {member.email}
          </p>
        )}
      </div>

      {canManage && !isSelf ? (
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
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
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
          {member.role || "member"}
        </span>
      )}
    </div>
  );
}