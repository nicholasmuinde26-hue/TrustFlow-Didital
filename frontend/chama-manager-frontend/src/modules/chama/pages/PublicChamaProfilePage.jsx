import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, Users, CalendarDays, ShieldCheck, BadgeCheck, ArrowRight, Globe } from "lucide-react";
import chamaApi from "../api/chama.api";
import MemberAvatar from "@/modules/members/components/MemberAvatar";
import { PersonProfileModal } from "../components/PersonProfileCard";

const roleName = (role) => String(role || "member").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

// A tappable person card. The photo is loaded by URL (not embedded in the
// page data), so a long member list stays light.
function PersonTile({ chamaId, person, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(person.membership_id)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-400 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500">
      <MemberAvatar name={person.name} src={person.has_image ? chamaApi.personImageUrl(chamaId, person.membership_id) : undefined} size="lg" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-slate-900">{person.name}</span>
        <span className="block truncate text-xs font-semibold text-emerald-700">{roleName(person.role)}</span>
        {person.headline && <span className="block truncate text-xs text-slate-500">{person.headline}</span>}
      </span>
    </button>
  );
}

export default function PublicChamaProfilePage() {
  const { chamaId } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [openPerson, setOpenPerson] = useState(null);

  useEffect(() => {
    let cancelled = false;
    chamaApi.getPublicProfile(chamaId).then(({ data }) => { if (!cancelled) setProfile(data?.data); })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || "This group profile is unavailable."); });
    return () => { cancelled = true; };
  }, [chamaId]);

  if (!profile && !error) return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Loading group profile…</main>;
  if (error) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><ShieldCheck className="mx-auto mb-3 text-emerald-600" /><h1 className="text-xl font-bold">Profile unavailable</h1><p className="mt-2 text-slate-500">{error}</p><Link to="/" className="mt-5 inline-flex items-center gap-2 text-emerald-700">Go to ChamaManager <ArrowRight size={16} /></Link></div></main>;

  const management = profile.management || [];
  const members = profile.members || [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-950 to-slate-950 px-4 py-10 text-white sm:px-6">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-white text-slate-900 shadow-2xl">
        <header className="relative bg-gradient-to-br from-emerald-800 to-teal-600 text-white">
          {profile.cover_url && <img src={profile.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
          <div className="relative px-7 py-10 sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">ChamaManager · Group profile</p>
            <div className="mt-4 flex items-center gap-4">
              {profile.logo_url && <img src={profile.logo_url} alt={`${profile.name} logo`} className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/60 bg-white object-cover shadow-lg sm:h-20 sm:w-20" />}
              <div className="min-w-0">
                <h1 className="flex flex-wrap items-center gap-2 text-3xl font-black sm:text-4xl">
                  {profile.name}
                  {profile.verified && <span title="Registration and officials verified" className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-black text-emerald-800"><BadgeCheck size={14} />Verified group</span>}
                </h1>
                {profile.tagline && <p className="mt-1.5 text-sm font-semibold text-emerald-50">{profile.tagline}</p>}
              </div>
            </div>
            {profile.purpose && <p className="mt-3 max-w-2xl text-emerald-50">{profile.purpose}</p>}
          </div>
        </header>

        <div className="space-y-8 p-7 sm:p-10">
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2"><Users size={16} />{profile.member_count} members</span>
            {profile.location && <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2"><MapPin size={16} />{profile.location}</span>}
            {profile.contribution_cycle && <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2"><CalendarDays size={16} />{profile.contribution_cycle} contributions</span>}
            {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 hover:bg-slate-200"><Globe size={16} />Website</a>}
          </div>

          {profile.description && <section><h2 className="text-lg font-bold">About the group</h2><p className="mt-2 whitespace-pre-line leading-7 text-slate-600">{profile.description}</p></section>}
          {profile.meeting_day && <p className="text-sm text-slate-600"><strong>Meeting schedule:</strong> {profile.meeting_day}</p>}

          {management.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">Leadership</h2>
              <p className="mt-1 text-xs text-slate-500">Tap a name to read their profile.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{management.map((person) => <PersonTile key={person.membership_id} chamaId={chamaId} person={person} onOpen={setOpenPerson} />)}</div>
            </section>
          )}
          {members.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">Members who chose to be listed</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{members.map((person) => <PersonTile key={person.membership_id} chamaId={chamaId} person={person} onOpen={setOpenPerson} />)}</div>
            </section>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6">
            <p className="max-w-md text-xs text-slate-500">This profile is maintained by the Chama. Only people who chose to be public appear above. Identity documents, balances and financial information are private.</p>
            <div className="flex gap-3">{profile.contact_email && <a className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold" href={`mailto:${profile.contact_email}`}>Contact group</a>}<Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Join ChamaManager <ArrowRight size={15} /></Link></div>
          </footer>
        </div>
      </article>
      {openPerson && <PersonProfileModal chamaId={chamaId} membershipId={openPerson} onClose={() => setOpenPerson(null)} />}
    </main>
  );
}
