import clsx from "clsx";

// ------------------------------------------------------------------
// Small icon set - kept inline so this component has no extra deps.
// ------------------------------------------------------------------
const ICONS = {
  sms: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 4h16v12H7l-3 3V4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 5h16v14H4V5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 6l8 7 8-7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M12 3a9 9 0 00-7.75 13.5L3 21l4.6-1.21A9 9 0 1012 3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 9.5c.3 2.6 2.4 4.7 5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

/**
 * Renders one selectable "pill" per available OTP channel.
 *
 * Props:
 *  - channels: [{ channel: 'sms' | 'email' | 'whatsapp', label: string }]
 *  - value: currently selected channel string
 *  - onChange: (channel: string) => void
 *  - disabled: boolean
 */
export default function OtpChannelSelect({
  channels = [],
  value,
  onChange,
  disabled = false,
}) {
  if (!channels.length) return null;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Send my code via</label>

      <div className="grid grid-cols-3 gap-2">
        {channels.map(({ channel, label }) => {
          const active = value === channel;

          return (
            <button
              key={channel}
              type="button"
              disabled={disabled}
              onClick={() => onChange(channel)}
              aria-pressed={active}
              className={clsx(
                "flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors",
                active
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {ICONS[channel]}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
