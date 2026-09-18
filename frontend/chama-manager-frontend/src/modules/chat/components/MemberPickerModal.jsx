import { useMemo, useState } from "react";
import { X, Search } from "lucide-react";

const CARD_BG = "#16211e";
const PANEL_BG = "#0d1a16";
const BORDER = "rgba(255,255,255,0.08)";

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Lists the chama's real members (fetched by the page via useMembers)
// so the person can pick who to start a direct message with. currentUserId
// is excluded — you can't DM yourself.
export default function MemberPickerModal({ members, currentUserId, onSelect, onClose }) {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    return members
      .map((member) => {
        const user = member.user_id || {};
        const userId = user._id || user.id || member.user_id;
        const name = user.name || user.first_name || "Member";
        return { userId, name, role: member.role };
      })
      .filter((option) => option.userId && String(option.userId) !== String(currentUserId))
      .filter((option) => option.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [members, currentUserId, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border p-5"
        style={{ backgroundColor: PANEL_BG, borderColor: BORDER }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">New message</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ backgroundColor: CARD_BG }}
        >
          <Search size={14} className="text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search members"
            className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-slate-500">
              No members match your search
            </p>
          )}
          {options.map((option) => (
            <button
              key={option.userId}
              type="button"
              onClick={() => onSelect(option)}
              className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition"
              style={{ backgroundColor: "transparent" }}
              onMouseEnter={(event) => (event.currentTarget.style.backgroundColor = CARD_BG)}
              onMouseLeave={(event) => (event.currentTarget.style.backgroundColor = "transparent")}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "#0f9d70" }}
              >
                {initials(option.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{option.name}</p>
                {option.role && (
                  <p className="truncate text-[11px] capitalize text-slate-400">{option.role}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}