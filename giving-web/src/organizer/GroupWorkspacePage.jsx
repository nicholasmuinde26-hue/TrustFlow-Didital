import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Bell, CalendarClock, Copy, Check, ExternalLink, LoaderCircle, Users } from 'lucide-react';
import { errorMessage, organizerApi } from './organizerApi.js';

const money = (value) => `KES ${Number(value || 0).toLocaleString('en-KE')}`;
const person = (row) => row?.member_id?.user_id?.name || row?.donor_id?.display_name || row?.name || 'Supporter';
const TABS = [['overview', 'Overview'], ['pledges', 'Pledges'], ['members', 'Members']];

export default function GroupWorkspacePage() {
  const { groupId } = useParams();
  const [tab, setTab] = useState('overview');
  const [fund, setFund] = useState(null);
  const [pledges, setPledges] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    const [fundRes, pledgeRes, memberRes] = await Promise.allSettled([organizerApi.fundDashboard(groupId), organizerApi.pledges(groupId), organizerApi.members(groupId)]);
    if (fundRes.status === 'fulfilled') { setFund(fundRes.value); setError(''); }
    else setError(errorMessage(fundRes.reason, 'We could not open this fundraiser. You may not have access to it.'));
    if (pledgeRes.status === 'fulfilled') setPledges(pledgeRes.value?.pledges || []);
    if (memberRes.status === 'fulfilled') setMembers(memberRes.value?.members || []);
    setLoading(false);
  }, [groupId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const group = fund?.group || {};
  const totals = fund?.totals || {};
  const progress = useMemo(() => {
    const target = Number(totals.target || 0);
    return target > 0 ? Math.min(100, Math.round((Number(totals.collected || 0) / target) * 100)) : 0;
  }, [totals]);
  const givingLink = group.join_code ? `${window.location.origin}/${group.join_code}` : '';
  const publicGiving = Boolean(group.verification?.public_giving_enabled);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(givingLink); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setMessage('Copy failed. Select the link and copy it manually.'); }
  };
  const run = async (key, action, success) => {
    setBusy(key); setMessage(''); setError('');
    try { const result = await action(); setMessage(typeof success === 'function' ? success(result) : success); await load(); }
    catch (err) { setError(errorMessage(err, 'That did not work. Please try again.')); } finally { setBusy(''); }
  };

  if (loading) return <div className="org-state"><LoaderCircle className="spin" size={28} /><span>Opening workspace…</span></div>;
  if (!fund) return <section className="org-page org-narrow"><Link className="org-back" to="/organizer">← Back to console</Link><p className="org-error" role="alert">{error || 'Fundraiser not found.'}</p></section>;

  return (
    <section className="org-page">
      <Link className="org-back" to="/organizer">← Back to console</Link>
      <header className="org-head">
        <div>
          <p className="landing-eyebrow">FUNDRAISER WORKSPACE · {String(group.status || '').toUpperCase()}</p>
          <h1>{group.name}</h1>
          <p className="org-sub">{group.description}</p>
        </div>
        {publicGiving && group.join_code && <Link className="org-ghost" to={`/${group.join_code}`} target="_blank"><ExternalLink size={15} /> View public page</Link>}
      </header>

      <div className="org-tabs" role="tablist">{TABS.map(([key, text]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{text}</button>)}</div>
      {error && <p className="org-error" role="alert">{error}</p>}
      {message && <p className="org-notice" role="status">{message}</p>}

      {tab === 'overview' && <>
        <div className="org-card org-progress">
          <div className="org-stats">
            <div><span>Collected</span><strong>{money(totals.collected)}</strong></div>
            <div><span>Pledged</span><strong>{money(totals.pledged)}</strong></div>
            <div><span>Outstanding</span><strong>{money(totals.outstanding)}</strong></div>
            <div><span>Goal</span><strong>{money(totals.target)}</strong></div>
          </div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <p className="org-fine">{progress}% of goal collected{fund.pending_payments ? ` · ${fund.pending_payments} payment(s) awaiting confirmation` : ''}</p>
        </div>

        <div className="org-card">
          <h2>Share your fundraiser</h2>
          {publicGiving ? <p className="org-sub"><BadgeCheck size={15} className="org-inline-icon" /> Public giving is enabled. Anyone with this link can donate by M-Pesa.</p> : <p className="org-sub">Public donations are not enabled yet. Our team reviews every fundraiser before the public link accepts donations.</p>}
          {givingLink && <div className="org-copy"><input className="org-input" readOnly value={givingLink} onFocus={(e) => e.target.select()} aria-label="Giving link" /><button type="button" className="org-primary org-inline" onClick={copyLink}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</button></div>}
          {group.join_code && <p className="org-fine">Join code: <strong>{group.join_code}</strong></p>}
        </div>

        <div className="org-card">
          <h2>Manage</h2>
          <div className="org-actions">
            <button type="button" className="org-ghost" disabled={busy === 'remind'} onClick={() => run('remind', () => organizerApi.sendReminders(groupId), (r) => `Reminders sent: ${r?.sent ?? 0}`)}><Bell size={15} /> {busy === 'remind' ? 'Sending…' : 'Send pledge reminders'}</button>
            <form className="org-extend" onSubmit={(event) => { event.preventDefault(); if (endDate) run('extend', () => organizerApi.extendFund(groupId, endDate), 'Contribution deadline extended.'); }}>
              <CalendarClock size={15} />
              <input className="org-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="New contribution close date" required />
              <button type="submit" className="org-ghost" disabled={busy === 'extend' || !endDate}>Extend deadline</button>
            </form>
          </div>
          {group.contribution_end_date && <p className="org-fine">Contributions currently close on {new Date(group.contribution_end_date).toLocaleDateString('en-KE', { dateStyle: 'long' })}.</p>}
        </div>
      </>}

      {tab === 'pledges' && (
        <div className="org-card">
          <h2>Pledges <span className="org-count">{pledges.length}</span></h2>
          {pledges.length === 0 ? <p className="org-sub">No pledges yet. Share your link to start collecting.</p> : (
            <div className="org-table-wrap"><table className="org-table"><thead><tr><th>Supporter</th><th>Pledged</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
              <tbody>{pledges.map((row) => <tr key={row._id}><td>{person(row)}</td><td>{money(row.pledged_amount?.$numberDecimal ?? row.pledged_amount)}</td><td>{money(row.paid_amount)}</td><td>{money(row.balance)}</td><td><span className="org-pill">{String(row.payment_status || row.status || '').replaceAll('_', ' ')}</span></td></tr>)}</tbody></table></div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="org-card">
          <h2><Users size={17} className="org-inline-icon" /> Members <span className="org-count">{members.length}</span></h2>
          {members.length === 0 ? <p className="org-sub">No members to show.</p> : (
            <ul className="org-list">{members.map((member) => <li key={member._id || member.id}><div><strong>{member.user_id?.name || member.user?.name || member.name || 'Member'}</strong><small>{member.user_id?.phone || member.user?.phone || member.phone || ''}</small></div><span className="org-pill">{String(member.role || 'member').replaceAll('_', ' ')}</span></li>)}</ul>
          )}
        </div>
      )}
    </section>
  );
}
