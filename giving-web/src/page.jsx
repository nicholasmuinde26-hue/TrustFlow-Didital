import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BadgeCheck, CheckCircle2, Flag, Heart, LoaderCircle, MapPin, ShieldCheck, Sparkles, Users, Search, Plus, HandHeart, UsersRound } from 'lucide-react';
import { donate, getCause, getDonationStatus, reportCause } from './api.js';

const money = (value) => `KES ${Number(value || 0).toLocaleString('en-KE')}`;
const makeToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export default function GivingPage() {
  const { joinCode = '' } = useParams();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState('');
  const [cause, setCause] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('misleading');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState('');
  const idempotencyRef = useRef(null);
  const storageKey = `giving-attempt:${joinCode}`;
  const progress = useMemo(() => {
    const target = Number(cause?.totals?.target || 0);
    const collected = Number(cause?.totals?.collected || 0);
    return target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
  }, [cause]);

  useEffect(() => {
    if (!joinCode) { setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    setCause(null);
    setLoadError('');
    getCause(joinCode)
      .then((value) => { if (active) setCause(value); })
      .catch((error) => { if (active) setLoadError(error.response?.status === 404 ? 'We couldn’t find a cause with that code. Check it and try again.' : error.response?.data?.message || 'We couldn’t load this cause. Check your connection and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [joinCode]);

  useEffect(() => {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { saved = null; }
    if (!saved?.token || !saved?.key) return undefined;
    idempotencyRef.current = { key: saved.key, token: saved.token };
    let active = true;
    getDonationStatus(saved.token)
      .then((result) => {
        if (!active) return;
        setPayment({ ...result, status_token: saved.token });
        setPaymentStatus(result.status || 'processing');
        if (['completed', 'failed', 'cancelled', 'refunded'].includes(result.status)) {
          sessionStorage.removeItem(storageKey);
          idempotencyRef.current = null;
        }
      })
      .catch((error) => {
        if (!active || error.response?.status !== 404) return;
        sessionStorage.removeItem(storageKey);
        idempotencyRef.current = null;
      });
    return () => { active = false; };
  }, [joinCode, storageKey]);

  useEffect(() => {
    if (!payment?.status_token || ['completed', 'failed', 'cancelled', 'refunded'].includes(paymentStatus)) return undefined;
    let active = true;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const result = await getDonationStatus(payment.status_token);
        if (!active) return;
        setPaymentStatus(result.status);
        if (['completed', 'failed', 'cancelled', 'refunded'].includes(result.status)) {
          sessionStorage.removeItem(storageKey);
          idempotencyRef.current = null;
        }
      } catch { /* temporary network errors are retried on the next poll */ }
      if (active && attempts < 120) timer = window.setTimeout(poll, 2500);
    };
    let timer = window.setTimeout(poll, 1500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [payment, paymentStatus, storageKey]);

  const handleDonate = async (event) => {
    event.preventDefault();
    setLoadError('');
    setSubmitting(true);
    setPayment(null);
    setPaymentStatus('');
    if (!idempotencyRef.current) {
      idempotencyRef.current = { key: crypto.randomUUID(), token: makeToken() };
      sessionStorage.setItem(storageKey, JSON.stringify(idempotencyRef.current));
    }
    try {
      const result = await donate(joinCode, {
        donor_name: name,
        phone_number: phone,
        email,
        amount: Number(amount),
        idempotency_key: idempotencyRef.current.key,
        status_token: idempotencyRef.current.token,
      });
      idempotencyRef.current = null;
      setPayment(result);
      setPaymentStatus(result.status || 'processing');
      if (['completed', 'failed', 'cancelled', 'refunded'].includes(result.status)) {
        sessionStorage.removeItem(storageKey);
      }
    } catch (error) {
      setLoadError(error.response?.data?.message || 'We could not start the donation. Please try again.');
      if (error.response?.status && error.response.status < 500) {
        idempotencyRef.current = null;
        sessionStorage.removeItem(storageKey);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async (event) => {
    event.preventDefault();
    setReportSubmitting(true);
    setReportError('');
    try {
      await reportCause(joinCode, { category: reportCategory, details: reportDetails });
      setReportSent(true);
    } catch (error) {
      setReportError(error.response?.data?.message || 'We could not send your report. Please try again.');
    } finally {
      setReportSubmitting(false);
    }
  };

  if (!joinCode) return (
    <main className="landing-shell">
      <nav className="topbar"><a className="brand" href="/"><span className="brand-mark"><Heart size={17} fill="currentColor" /></span> GiveTogether</a><span className="secure"><ShieldCheck size={15} /> Secure M-Pesa giving</span></nav>
      <section className="welcome-hero"><div className="welcome-copy"><p className="landing-eyebrow">COMMUNITY GIVING, MADE SIMPLE</p><h1>Bring people together<br />for what matters.</h1><p className="landing-copy">Support a fundraiser, organize a contribution, or rally your community around a shared goal.</p><div className="benefit-row"><span><ShieldCheck size={16}/> Secure M-Pesa</span><span><UsersRound size={16}/> Built for communities</span></div></div>
        <div className="action-cards">
          <article className="action-card support-card"><span className="action-icon"><HandHeart size={21}/></span><p className="action-eyebrow">I WANT TO CONTRIBUTE</p><h2>Support a cause</h2><p>Enter the code from a shared link to see the goal, progress, and ways to contribute.</p><form className="code-form" onSubmit={(event) => { event.preventDefault(); const code = codeInput.trim(); if (code) navigate(`/${encodeURIComponent(code)}`); }}><label htmlFor="cause-code">Cause or group code</label><div className="code-input"><Search size={17} /><input id="cause-code" value={codeInput} onChange={(event) => setCodeInput(event.target.value)} placeholder="e.g. CG-ABC123" autoCapitalize="characters" autoComplete="off" required /><button type="submit" aria-label="Find cause"><ArrowUpRight size={19} /></button></div></form><p className="landing-help">The code is included at the end of your cause link.</p></article>
          <article className="action-card create-card"><span className="action-icon"><Plus size={21}/></span><p className="action-eyebrow">I WANT TO ORGANIZE</p><h2>Start a fundraiser</h2><p>Create a contribution group, set a target, invite supporters, and share a giving link.</p><Link className="organizer-button" to="/organizer"><span>Organizer console</span><ArrowRight size={17}/></Link><p className="landing-help">Fundraiser setup is reviewed before public donations can be enabled.</p></article>
        </div>
      </section>
      <section className="feature-strip"><div><Heart size={18}/><span><strong>One-time fundraisers</strong><small>Raise support around a clear goal</small></span></div><div><UsersRound size={18}/><span><strong>Group contributions</strong><small>Bring members together to contribute</small></span></div><div><ShieldCheck size={18}/><span><strong>Clear progress</strong><small>See what has been raised and pledged</small></span></div></section>
      <footer>GiveTogether <span>·</span> Community giving, made simple.</footer>
    </main>
  );
  if (loading) return <main className="center-state"><LoaderCircle className="spin" size={32} /><span>Loading cause…</span></main>;
  if (loadError && !cause) return <main className="landing-shell"><nav className="topbar"><a className="brand" href="/"><span className="brand-mark"><Heart size={17} fill="currentColor" /></span> GiveTogether</a><span className="secure"><ShieldCheck size={15} /> Secure M-Pesa giving</span></nav><section className="landing-card error-landing"><span className="landing-icon"><Heart size={25} /></span><p className="landing-eyebrow">LINK CHECK</p><h1>Cause unavailable</h1><p className="landing-copy">{loadError}</p><form className="code-form" onSubmit={(event) => { event.preventDefault(); const code = codeInput.trim(); if (code) navigate(`/${encodeURIComponent(code)}`); }}><label htmlFor="retry-code">Try another cause code</label><div className="code-input"><Search size={17} /><input id="retry-code" value={codeInput} onChange={(event) => setCodeInput(event.target.value)} placeholder="Enter cause code" required /><button type="submit" aria-label="Find cause"><ArrowUpRight size={19} /></button></div></form><a className="home-link" href="/">Back to giving home</a></section><footer>GiveTogether <span>·</span> Community giving, made simple.</footer></main>;

  const group = cause?.group || {};
  const totals = cause?.totals || {};
  const title = group.name || 'Community cause';
  const description = group.description || group.purpose || 'Your contribution helps this community reach its goal.';

  return (
    <main className="page-shell">
      <nav className="topbar"><a className="brand" href="/"><span className="brand-mark"><Heart size={17} fill="currentColor" /></span> GiveTogether</a><span className="secure"><ShieldCheck size={15} /> Secure M-Pesa giving</span></nav>
      <div className="content-grid">
        <section className="cause-column">
          <div className="cause-kicker"><Sparkles size={15} /> COMMUNITY FUNDRAISER <span>·</span> {joinCode}</div>
          <h1>{title}</h1>
          <p className="cause-description">{description}</p>
          <div className="verified-badge"><BadgeCheck size={17} /><span><strong>Verified by GiveTogether</strong><small>Organizer and payout details reviewed</small></span></div>
          <div className="cause-facts">
            <span><Users size={16} /> {Number(cause?.supporterCount ?? cause?.memberCount ?? 0).toLocaleString()} supporters</span>
            {group.location && <span><MapPin size={16} /> {group.location}</span>}
          </div>
          {group.cover_image && <img className="cause-image" src={group.cover_image} alt="" />}
          <section className="progress-card">
            <div className="progress-numbers"><div><span>Raised so far</span><strong>{money(totals.collected)}</strong></div><div className="target"><span>Goal</span><strong>{money(totals.target)}</strong></div></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="progress-foot"><span>{progress}% funded</span><span>{money(totals.pledged)} pledged</span></div>
          </section>
          <div className="trust-note"><ShieldCheck size={18} /><p>Your payment goes directly toward this cause. We’ll send an M-Pesa prompt to your phone; no account is needed.</p></div>
          <button className="report-cause-button" onClick={() => { setReportOpen(true); setReportSent(false); setReportError(''); }}><Flag size={14} /> Report this fundraiser</button>
        </section>

        <aside className="donation-card">
          <div className="donation-heading"><span className="donation-icon"><Heart size={18} /></span><div><h2>Make a donation</h2><p>Every contribution moves this cause forward.</p></div></div>
          {paymentStatus === 'completed' ? (
            <div className="payment-result success"><CheckCircle2 size={34} /><h3>Thank you for giving!</h3><p>Your donation of {money(payment?.amount)} was received.</p><small>Reference: {payment?.reference}</small><button className="secondary-button" onClick={() => { sessionStorage.removeItem(storageKey); idempotencyRef.current = null; setPayment(null); setPaymentStatus(''); setAmount(''); }}>Make another donation</button></div>
          ) : payment ? (
            <div className={`payment-result ${['failed', 'cancelled', 'refunded'].includes(paymentStatus) ? 'failure' : ''}`}><span className="result-loader">{['failed', 'cancelled', 'refunded'].includes(paymentStatus) ? '!' : <LoaderCircle className="spin" size={26} />}</span><h3>{['failed', 'cancelled', 'refunded'].includes(paymentStatus) ? 'Payment not completed' : 'Check your phone'}</h3><p>{['failed', 'cancelled', 'refunded'].includes(paymentStatus) ? 'The M-Pesa payment was not completed. You can try again.' : `An M-Pesa prompt was sent to ${payment.phone_number}. Enter your PIN to finish.`}</p><small>Reference: {payment.reference}</small>{['failed', 'cancelled', 'refunded'].includes(paymentStatus) && <button className="secondary-button" onClick={() => { sessionStorage.removeItem(storageKey); idempotencyRef.current = null; setPayment(null); setPaymentStatus(''); }}>Try again</button>}</div>
          ) : (
            <form className="donation-form" onSubmit={handleDonate}>
              <label>Donation amount <span>KES</span></label>
              <div className="amount-options">{['500', '1000', '2500'].map((value) => <button type="button" className={amount === value ? 'selected' : ''} onClick={() => setAmount(value)} key={value}>{Number(value).toLocaleString()}</button>)}</div>
              <div className="amount-input"><span>KES</span><input type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Enter amount" required /></div>
              <label htmlFor="donor-name">Your name</label><input id="donor-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Name for your receipt" required />
              <label htmlFor="donor-phone">M-Pesa phone number</label><input id="donor-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07XX XXX XXX" required />
              <label htmlFor="donor-email">Email for receipt <span>Optional</span></label><input id="donor-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" />
              {loadError && <p className="inline-error">{loadError}</p>}
              <button className="donate-button" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={18} /> Starting secure payment…</> : <>Donate {amount ? money(amount) : 'now'} <ArrowUpRight size={18} /></>}</button>
              <p className="privacy-note">Your name and phone are used for payment records. Add an email if you want a receipt sent to your inbox. Your details aren’t shown publicly.</p>
            </form>
          )}
        </aside>
      </div>
      {reportOpen && <div className="report-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !reportSubmitting) setReportOpen(false); }}><section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title"><button className="report-close" type="button" onClick={() => setReportOpen(false)} aria-label="Close">×</button>{reportSent ? <><span className="report-success-icon"><CheckCircle2 size={25}/></span><h2 id="report-title">Report received</h2><p>Thank you. Our team will review this fundraiser. Multiple independent reports automatically pause public donations while we investigate.</p><button className="report-submit" type="button" onClick={() => setReportOpen(false)}>Done</button></> : <form onSubmit={handleReport}><p className="report-eyebrow">HELP KEEP GIVING SAFE</p><h2 id="report-title">Report this fundraiser</h2><p className="report-description">Tell our review team what concerns you. Reports are confidential.</p><label htmlFor="report-reason">Reason for report</label><select id="report-reason" value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="misleading">Information appears misleading</option><option value="impersonation">Possible impersonation</option><option value="payout_concern">Payout destination concern</option><option value="harmful_or_illegal">Potentially harmful or illegal</option><option value="other">Other concern</option></select><label htmlFor="report-details">Details (optional)</label><textarea id="report-details" rows="4" maxLength={1000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Share any context that may help our review."/>{reportError && <p role="alert" className="report-error">{reportError}</p>}<button className="report-submit" type="submit" disabled={reportSubmitting}>{reportSubmitting ? 'Sending…' : 'Send confidential report'}</button></form>}</section></div>}
      <footer>GiveTogether <span>·</span> Community giving, made simple.</footer>
    </main>
  );
}
