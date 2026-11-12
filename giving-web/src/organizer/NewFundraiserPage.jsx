import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, LoaderCircle, ShieldCheck } from 'lucide-react';
import { errorMessage, organizerApi } from './organizerApi.js';

// Mirrors ContributionGroup.js's `type` / visibility enums on the backend.
const GROUP_TYPES = ['party', 'wedding', 'graduation', 'funeral', 'birthday', 'emergency', 'medical_emergency', 'fundraiser', 'community', 'other'];
const VISIBILITY = ['private', 'invite_only', 'public'];
const label = (value) => value.replaceAll('_', ' ');

const emptyForm = {
  name: '', description: '', type: 'other', visibility: 'invite_only', targetAmount: '', eventDate: '', contributionEndDate: '',
  beneficiary: '', location: '', nationalIdNumber: '', evidenceKind: 'supporting_document', evidenceUrl: '', publicGivingRequested: false,
  referee1Name: '', referee1Phone: '', referee1Relationship: '', referee2Name: '', referee2Phone: '', referee2Relationship: '',
  payoutMethod: 'mpesa', payoutPhone: '', payoutPaybill: '', payoutAccountName: '',
};

export default function NewFundraiserPage() {
  const [form, setForm] = useState(emptyForm);
  const [request, setRequest] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    organizerApi.myRequests()
      .then((items) => { const existing = items.find((item) => item.entityType === 'contribution_group' && ['PENDING', 'UNDER_REVIEW'].includes(String(item.status).toUpperCase())); if (active && existing) setRequest(existing); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const field = (key) => ({ value: form[key], onChange: (event) => update(key, event.target.value) });

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = {
      entityType: 'contribution_group',
      name: form.name.trim(),
      description: form.description.trim(),
      contributionGroupDetails: {
        type: form.type, visibility: form.visibility, targetAmount: form.targetAmount || 0,
        eventDate: form.eventDate || null, contributionEndDate: form.contributionEndDate || null,
        beneficiary: form.beneficiary.trim(), location: form.location.trim(), nationalIdNumber: form.nationalIdNumber.trim(),
        evidence: [{ kind: form.evidenceKind, url: form.evidenceUrl.trim() }],
        publicGivingRequested: form.publicGivingRequested,
        referees: [
          { name: form.referee1Name.trim(), phone: form.referee1Phone.trim(), relationship: form.referee1Relationship.trim() },
          { name: form.referee2Name.trim(), phone: form.referee2Phone.trim(), relationship: form.referee2Relationship.trim() },
        ],
        payout: { method: form.payoutMethod, phone: form.payoutPhone.trim(), paybill: form.payoutPaybill.trim(), accountName: form.payoutAccountName.trim() },
      },
    };
    try {
      const result = editingId ? await organizerApi.updateRequest(editingId, payload) : await organizerApi.submitRequest(payload);
      setRequest(result?.data || result);
      setEditingId(null);
    } catch (err) { setError(errorMessage(err, 'Could not submit the fundraiser request. Please try again.')); } finally { setSubmitting(false); }
  };

  const editRequest = () => {
    const details = request?.contributionGroupDetails || {};
    const evidence = details.evidence?.[0] || {};
    const [r1 = {}, r2 = {}] = details.referees || [];
    setForm({
      ...emptyForm, name: request.name || '', description: request.description || '', type: details.type || 'other', visibility: details.visibility || 'invite_only',
      targetAmount: details.targetAmount ? String(details.targetAmount) : '', eventDate: details.eventDate ? String(details.eventDate).slice(0, 10) : '',
      contributionEndDate: details.contributionEndDate ? String(details.contributionEndDate).slice(0, 10) : '', beneficiary: details.beneficiary || '', location: details.location || '',
      nationalIdNumber: details.nationalIdNumber || '', evidenceKind: evidence.kind || 'supporting_document', evidenceUrl: evidence.url || '', publicGivingRequested: Boolean(details.publicGivingRequested),
      referee1Name: r1.name || '', referee1Phone: r1.phone || '', referee1Relationship: r1.relationship || '', referee2Name: r2.name || '', referee2Phone: r2.phone || '', referee2Relationship: r2.relationship || '',
      payoutMethod: details.payout?.method || 'mpesa', payoutPhone: details.payout?.phone || '', payoutPaybill: details.payout?.paybill || '', payoutAccountName: details.payout?.accountName || '',
    });
    setEditingId(request._id);
    setRequest(null);
  };

  if (loading) return <div className="org-state"><LoaderCircle className="spin" size={28} /></div>;

  if (request) {
    const status = String(request.status || '').toUpperCase();
    return (
      <section className="org-page org-narrow">
        <div className="org-card org-status-card">
          <span className="org-icon warn"><Clock3 size={21} /></span>
          <p className="landing-eyebrow">VERIFICATION IN PROGRESS</p>
          <h1>{request.name}</h1>
          <p className="org-sub">Your request is {label(status.toLowerCase())}. No fundraiser or public donation link is created until an administrator completes the review.</p>
          <p className="org-ref">Request reference <strong>{request.requestNumber}</strong></p>
          {request.adminNotes && <div className="org-notice"><strong>Message from the review team</strong><p>{request.adminNotes}</p></div>}
          <div className="org-row">{status === 'UNDER_REVIEW' && request.adminNotes && <button type="button" className="org-primary org-inline" onClick={editRequest}>Update request</button>}<Link className="org-ghost" to="/organizer">Back to console</Link></div>
        </div>
      </section>
    );
  }

  return (
    <section className="org-page org-narrow">
      <Link className="org-back" to="/organizer">← Back to console</Link>
      <header className="org-hero">
        <p className="landing-eyebrow">ORGANIZER APPLICATION</p>
        <h1>{editingId ? 'Update fundraiser request' : 'Request a fundraiser'}</h1>
        <p className="org-sub">Tell us what you are raising money for and who will receive it. Our team checks the organizer, evidence, referees and payout details before approving.</p>
        <p className="org-hint"><ShieldCheck size={15} /> Your phone number must be verified. Public donations stay disabled unless an admin separately approves them.</p>
      </header>
      <form className="org-card org-form org-big" onSubmit={submit}>
        <h2>Fundraiser details</h2>
        <label>Name supporters will see</label><input className="org-input" required minLength={2} maxLength={100} placeholder="e.g. Help the Mumo family rebuild" {...field('name')} />
        <label>Purpose and story</label><textarea className="org-input org-area" required rows={4} maxLength={1000} placeholder="Who does this support, what happened, and how will the money be used?" {...field('description')} />
        <div className="org-grid">
          <div><label>Type</label><select className="org-input" {...field('type')}>{GROUP_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></div>
          <div><label>Visibility</label><select className="org-input" {...field('visibility')}>{VISIBILITY.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></div>
          <div><label>Goal (KES)</label><input className="org-input" type="number" min="0" step="1" placeholder="Optional" {...field('targetAmount')} /></div>
          <div><label>Beneficiary</label><input className="org-input" maxLength={120} placeholder="Person or community supported" {...field('beneficiary')} /></div>
          <div><label>Event date</label><input className="org-input" type="date" {...field('eventDate')} /></div>
          <div><label>Contributions close</label><input className="org-input" type="date" {...field('contributionEndDate')} /></div>
        </div>
        <label>Location</label><input className="org-input" maxLength={255} placeholder="Town, county, or venue" {...field('location')} />

        <h2>Organizer verification</h2>
        <label>National ID number</label><input className="org-input" required maxLength={30} autoComplete="off" {...field('nationalIdNumber')} />
        <label className="org-check"><input type="checkbox" checked={form.publicGivingRequested} onChange={(e) => update('publicGivingRequested', e.target.checked)} /><span><strong>Request public giving review.</strong> Asks an admin to consider letting anyone with the giving link donate. It does not enable public donations automatically.</span></label>
        {form.publicGivingRequested && <>
          <p className="org-notice">Public fundraising needs stricter review. Add cause-specific evidence and two referees our team can contact.</p>
          <div className="org-grid">
            <div><label>Evidence type</label><select className="org-input" {...field('evidenceKind')}><option value="medical">Medical letter or invoice</option><option value="funeral">Burial permit or chief’s letter</option><option value="education">School fee structure</option><option value="identity">Organizer identity document</option><option value="supporting_document">Other supporting evidence</option></select></div>
            <div><label>Secure evidence link (HTTPS)</label><input className="org-input" type="url" required placeholder="https://…" {...field('evidenceUrl')} /></div>
          </div>
          <div className="org-grid">{[1, 2].map((n) => <fieldset key={n} className="org-fieldset"><legend>Referee {n}</legend><input className="org-input" required placeholder="Full name" {...field(`referee${n}Name`)} /><input className="org-input" required type="tel" placeholder="Phone number" {...field(`referee${n}Phone`)} /><input className="org-input" placeholder="Relationship to beneficiary" {...field(`referee${n}Relationship`)} /></fieldset>)}</div>
        </>}

        <h2>Payout destination</h2>
        <div className="org-grid">
          <div><label>Payout method</label><select className="org-input" {...field('payoutMethod')}><option value="mpesa">M-Pesa</option><option value="paybill">Paybill</option><option value="till">Till number</option><option value="bank">Bank account</option></select></div>
          <div><label>Name registered to payout account</label><input className="org-input" required maxLength={120} {...field('payoutAccountName')} /></div>
        </div>
        {form.payoutMethod === 'mpesa'
          ? <><label>M-Pesa phone number</label><input className="org-input" required type="tel" {...field('payoutPhone')} /></>
          : <><label>{form.payoutMethod === 'bank' ? 'Bank account number' : form.payoutMethod === 'till' ? 'Till number' : 'Paybill number'}</label><input className="org-input" required {...field('payoutPaybill')} /></>}

        {error && <p className="org-error" role="alert">{error}</p>}
        <button className="org-primary" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={17} /> Submitting for review…</> : <><CheckCircle2 size={17} /> {editingId ? 'Update and resubmit' : 'Submit fundraiser request'}</>}</button>
        <p className="org-fine">Submitting creates a review request only. No group is activated and no money can be collected before approval.</p>
      </form>
    </section>
  );
}
