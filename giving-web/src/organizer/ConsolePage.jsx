import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, LoaderCircle, Plus, Wallet } from 'lucide-react';
import { errorMessage, organizerApi } from './organizerApi.js';
import { useOrganizerAuth } from './AuthContext.jsx';

export const isContributionWorkspace = (workspace) => ['contribution', 'contribution_group', 'contribution-group'].includes(String(workspace?.type || '').toLowerCase());
const statusText = (status) => String(status || '').toLowerCase().replaceAll('_', ' ');

export default function ConsolePage() {
  const { user } = useOrganizerAuth();
  const [groups, setGroups] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([organizerApi.workspaces(), organizerApi.myRequests()]).then(([workspaces, myRequests]) => {
      if (!active) return;
      if (workspaces.status === 'fulfilled') setGroups(workspaces.value.filter(isContributionWorkspace));
      else setError(errorMessage(workspaces.reason, 'We could not load your fundraisers. Check your connection and try again.'));
      if (myRequests.status === 'fulfilled') setRequests(myRequests.value.filter((item) => item.entityType === 'contribution_group' && !['APPROVED'].includes(String(item.status).toUpperCase())));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="org-state"><LoaderCircle className="spin" size={28} /><span>Loading your fundraisers…</span></div>;

  return (
    <section className="org-page">
      <header className="org-head">
        <div><p className="landing-eyebrow">ORGANIZER CONSOLE</p><h1>Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1><p className="org-sub">Manage your fundraisers, or start a new one.</p></div>
        <Link className="org-primary org-inline" to="/organizer/new"><Plus size={16} /> New fundraiser</Link>
      </header>
      {error && <p className="org-error" role="alert">{error}</p>}

      {requests.length > 0 && (
        <div className="org-section"><h2>Awaiting review</h2>
          {requests.map((request) => (
            <Link className="org-card org-card-link" key={request._id} to="/organizer/new">
              <span className="org-icon warn"><Clock3 size={19} /></span>
              <div><strong>{request.name}</strong><small>Request {request.requestNumber || ''} · {statusText(request.status)}</small></div>
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      )}

      <div className="org-section"><h2>Your fundraisers</h2>
        {groups.length === 0 ? (
          <div className="org-empty"><span className="org-icon"><Wallet size={21} /></span><h3>No active fundraisers yet</h3><p>Submit a fundraiser request. Once our team approves it, its workspace appears here.</p><Link className="org-primary org-inline" to="/organizer/new"><Plus size={16} /> Request a fundraiser</Link></div>
        ) : groups.map((group) => {
          const id = group.id ?? group._id;
          return (
            <Link className="org-card org-card-link" key={id} to={`/organizer/groups/${id}`}>
              <span className="org-icon"><Wallet size={19} /></span>
              <div><strong>{group.name}</strong><small>{group.role ? `${String(group.role).replaceAll('_', ' ')} · ` : ''}{Number(group.memberCount ?? 0).toLocaleString()} members</small></div>
              <ArrowRight size={16} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
