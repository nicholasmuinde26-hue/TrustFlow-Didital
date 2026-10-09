import { useEffect, useState } from "react";

// ========================================
// MEMBER AVATAR
// ========================================
//
// Shows the member's profile photo when they have one, otherwise their
// initials. A photo that fails to load (corrupt data URI, deleted file)
// falls back to initials instead of leaving a broken-image icon.
//
// `src` is the user's avatar_url (a base64 data URI today — see User.js).
//
// ========================================

export function initialsOf(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

const SIZES = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-base",
};

export default function MemberAvatar({
  name,
  src,
  size = "md",
  tone = "default",
  className = "",
}) {
  const [failed, setFailed] = useState(false);

  // A new photo (after the member edits their profile) gets a fresh try.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const toneClass =
    tone === "amber"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200/60"
      : "bg-slate-100 text-slate-800 dark:bg-obsidian-raised dark:text-mist border-slate-200/60 dark:border-obsidian-border";

  const showPhoto = Boolean(src) && !failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-bold ${SIZES[size] || SIZES.md} ${toneClass} ${className}`}
      title={name || undefined}
    >
      {showPhoto ? (
        <img
          src={src}
          alt={name ? `${name}'s profile photo` : "Profile photo"}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </div>
  );
}