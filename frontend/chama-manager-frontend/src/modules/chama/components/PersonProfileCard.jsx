import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Mail, MapPin, ShieldCheck, UserRound, X } from "lucide-react";
import chamaApi from "../api/chama.api";
import MemberAvatar from "@/modules/members/components/MemberAvatar";

// ========================================
// PERSON PROFILE (what appears when you tap someone)
// ========================================
//
// Shows only what that person chose to share: photo, headline, bio,
// location and contact email. Identity numbers, KYC documents and
// payment details never reach this component - they are not in the API
// response at all.
//
// `PersonProfileBody` is presentational; `PersonProfileModal` loads one
// person and wraps it in a dialog (used on the public Chama page);
// `PersonProfileLoader` loads one person inline (used inside the member
// drawer).
//
// ========================================

const roleName = (role) => String(role || "member").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function PersonProfileBody({ person, imageSrc }) {
  const hasContent = person.headline || person.bio || person.location || person.contact_email;
  return (
    <div>
      <div className="flex items-center gap-4">
        <MemberAvatar name={person.name} src={imageSrc || person.image_url} size="xl" />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-slate-900 dark:text-white">{person.name}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-bold capitalize text-emerald-700 dark:text-emerald-300">
            {person.is_management && <ShieldCheck size={13} />}
            {roleName(person.role)}
          </p>
          {person.headline && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{person.headline}</p>}
        </div>
      </div>

      {person.bio && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{person.bio}</p>}

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
        {person.location && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800"><MapPin size={13} />{person.location}</span>}
        {person.member_since && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800"><CalendarDays size={13} />Member since {new Date(person.member_since).getFullYear()}</span>}
        {person.contact_email && <a href={`mailto:${person.contact_email}`} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><Mail size={13} />{person.contact_email}</a>}
      </div>

      {!hasContent && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60">{person.name.split(" ")[0]} hasn't added a bio yet.</p>}
    </div>
  );
}

function usePerson(chamaId, membershipId) {
  const [state, setState] = useState({ loading: true, person: null, error: "" });
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, person: null, error: "" });
    chamaApi.getPersonProfile(chamaId, membershipId)
      .then(({ data }) => { if (!cancelled) setState({ loading: false, person: data?.data, error: "" }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, person: null, error: err?.response?.status === 404 ? "This person hasn't shared a profile." : err?.response?.data?.message || "Could not load this profile." }); });
    return () => { cancelled = true; };
  }, [chamaId, membershipId]);
  return state;
}

export function PersonProfileLoader({ chamaId, membershipId }) {
  const { loading, person, error } = usePerson(chamaId, membershipId);
  if (loading) return <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Loading profile…</p>;
  if (error) return <p className="flex items-center gap-2 text-xs text-slate-500"><UserRound size={14} />{error}</p>;
  return <PersonProfileBody person={person} />;
}

export function PersonProfileModal({ chamaId, membershipId, onClose }) {
  const { loading, person, error } = usePerson(chamaId, membershipId);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
        <button type="button" aria-label="Close profile" onClick={onClose} className="absolute right-3 top-3 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        {loading && <p className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading…</p>}
        {error && <p className="py-8 pr-6 text-sm text-slate-500">{error}</p>}
        {person && <PersonProfileBody person={person} />}
      </div>
    </div>
  );
}
