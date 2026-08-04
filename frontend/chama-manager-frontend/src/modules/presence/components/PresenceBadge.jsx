// A tiny status dot. Pass `withLabel` to also render the text label
// (used in lists); leave it off to overlay the dot on an avatar.
const STATUS_STYLES = {
  online: { color: "bg-green-500", label: "Online" },
  away: { color: "bg-amber-500", label: "Away" },
  offline: { color: "bg-slate-300 dark:bg-slate-600", label: "Offline" },
};

export default function PresenceBadge({ status = "offline", withLabel = false }) {
  const { color, label } = STATUS_STYLES[status] || STATUS_STYLES.offline;

  if (withLabel) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {label}
      </span>
    );
  }

  return (
    <span
      title={label}
      className={`
        h-2.5 w-2.5 rounded-full border-2 border-white
        dark:border-slate-900 ${color}
      `}
    />
  );
}