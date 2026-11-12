import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useOrganizerAuth } from './AuthContext.jsx';
import { errorMessage, handoffToChamaManager } from './organizerApi.js';
import { Brand } from './OrganizerLayout.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Shell({ title, subtitle, children, footer }) {
  return (
    <main className="landing-shell">
      <nav className="topbar"><Brand /><span className="secure"><ShieldCheck size={15} /> Secure sign in</span></nav>
      <section className="org-auth-card">
        <p className="landing-eyebrow">ORGANIZER CONSOLE</p>
        <h1>{title}</h1>
        <p className="org-sub">{subtitle}</p>
        {children}
        <p className="org-switch">{footer}</p>
      </section>
    </main>
  );
}

function OtpStep({ destination, notice, otp, setOtp, onSubmit, onResend, onBack, submitting, error }) {
  return (
    <form className="org-form" onSubmit={onSubmit}>
      {notice && <p className="org-notice">{notice}</p>}
      <label htmlFor="otp">6-digit code sent to {destination}</label>
      <input id="otp" className="org-input org-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="••••••" required autoFocus />
      {error && <p className="org-error" role="alert">{error}</p>}
      <button className="org-primary" type="submit" disabled={submitting || otp.length < 6}>{submitting ? <LoaderCircle className="spin" size={17} /> : <>Verify and continue <ArrowRight size={16} /></>}</button>
      <div className="org-row"><button type="button" className="org-link" onClick={onResend} disabled={submitting}>Resend code</button><button type="button" className="org-link" onClick={onBack}>Go back</button></div>
    </form>
  );
}

const devNotice = (res, fallback) => {
  let text = res?.message || fallback;
  if (res?.devOtp) text += res.demoAutofill ? ' (code auto-filled for this demo)' : ` (Dev code: ${res.devOtp})`;
  return text;
};

export function LoginPage() {
  const { login, sendOtp, verifyOtp, setHandoffPending } = useOrganizerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [channel, setChannel] = useState('sms');
  const [active, setActive] = useState('');
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEmail = identifier.includes('@');
  const effectiveChannel = isEmail ? 'email' : channel;

  const sendCode = async () => {
    const res = await login({ identifier: (active || identifier).trim(), password, channel: effectiveChannel });
    if (res?.otpRequired === false) return res;
    const used = res?.channel === 'email' ? (res.email || identifier) : (res?.phone || res?.identifier || identifier);
    setActive(used.trim());
    if (res?.devOtp) setOtp(res.devOtp);
    setNotice(devNotice(res, `Security code sent to ${used}`));
    setStep('otp');
    return res;
  };

  const submitCredentials = async (event) => {
    event.preventDefault();
    setError('');
    if (!identifier.trim()) { setError('Enter your phone number or email address.'); return; }
    setSubmitting(true);
    try { await sendCode(); } catch (err) { setError(errorMessage(err, 'Invalid credentials. Check your details and try again.')); } finally { setSubmitting(false); }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      setHandoffPending(true);
      await verifyOtp({ identifier: active || identifier.trim(), otpCode: otp.trim() });
      const requestedGroupId = location.state?.from?.pathname?.match(/^\/organizer\/groups\/([^/]+)/)?.[1] || '';
      await handoffToChamaManager(requestedGroupId);
    } catch (err) {
      setHandoffPending(false);
      setError(errorMessage(err, 'Could not open ChamaManager. Please try again.'));
    } finally { setSubmitting(false); }
  };

  const resend = async () => {
    setError('');
    setSubmitting(true);
    try { await sendCode(); } catch (err) { setError(errorMessage(err, 'Could not resend the code.')); } finally { setSubmitting(false); }
  };

  return (
    <Shell title={step === 'otp' ? 'Verify it’s you' : 'Welcome back'} subtitle="Sign in to open your ChamaManager workspace securely." footer={<>New here? <Link to="/organizer/register" state={location.state}>Create an organizer account</Link></>}>
      {step === 'credentials' ? (
        <form className="org-form" onSubmit={submitCredentials}>
          <label htmlFor="identifier">Phone number or email</label>
          <input id="identifier" className="org-input" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="07XX XXX XXX or you@example.com" required />
          <label htmlFor="password">Password</label>
          <input id="password" className="org-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {!isEmail && <div className="org-channels" role="radiogroup" aria-label="Where to send the code">{['sms', 'whatsapp'].map((value) => <button type="button" key={value} role="radio" aria-checked={channel === value} className={channel === value ? 'selected' : ''} onClick={() => setChannel(value)}>{value === 'sms' ? 'SMS code' : 'WhatsApp code'}</button>)}</div>}
          {error && <p className="org-error" role="alert">{error}</p>}
          <button className="org-primary" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={17} /> : <>Continue <ArrowRight size={16} /></>}</button>
        </form>
      ) : <OtpStep destination={active || identifier} notice={notice} otp={otp} setOtp={setOtp} onSubmit={submitOtp} onResend={resend} onBack={() => { setStep('credentials'); setOtp(''); setError(''); }} submitting={submitting} error={error} />}
    </Shell>
  );
}

export function RegisterPage() {
  const { register, sendOtp, verifyOtp, setHandoffPending } = useOrganizerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('details');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirm: '' });
  const [channel, setChannel] = useState('sms');
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const hasEmail = Boolean(form.email.trim());
  const effectiveChannel = channel === 'email' && !hasEmail ? 'sms' : channel;
  const identifier = effectiveChannel === 'email' ? form.email.trim() : form.phone.trim();

  const submitDetails = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Use a password of at least 8 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (hasEmail && !EMAIL.test(form.email.trim())) { setError('Enter a valid email address.'); return; }
    setSubmitting(true);
    try {
      const res = await register({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || undefined, password: form.password, channel: effectiveChannel });
      if (res?.phone) setForm((current) => ({ ...current, phone: res.phone }));
      if (res?.devOtp) setOtp(res.devOtp);
      setNotice(devNotice(res, `Security code sent to ${effectiveChannel === 'email' ? form.email : res?.phone || form.phone}`));
      setStep('otp');
    } catch (err) { setError(errorMessage(err, 'We could not create your account. Please try again.')); } finally { setSubmitting(false); }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      setHandoffPending(true);
      await verifyOtp({ identifier, phone: form.phone.trim(), email: form.email.trim() || undefined, otpCode: otp.trim() });
      const requestedGroupId = location.state?.from?.pathname?.match(/^\/organizer\/groups\/([^/]+)/)?.[1] || '';
      await handoffToChamaManager(requestedGroupId);
    } catch (err) {
      setHandoffPending(false);
      setError(errorMessage(err, 'Could not open ChamaManager. Please try again.'));
    } finally { setSubmitting(false); }
  };

  const resend = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await sendOtp({ identifier, phone: form.phone.trim(), email: form.email.trim() || undefined, channel: effectiveChannel });
      if (res?.devOtp) setOtp(res.devOtp);
      setNotice(devNotice(res, 'A new code has been sent.'));
    } catch (err) { setError(errorMessage(err, 'Could not resend the code.')); } finally { setSubmitting(false); }
  };

  return (
    <Shell title={step === 'otp' ? 'Verify your account' : 'Create your organizer account'} subtitle="One account lets you request a fundraiser, track donations and manage supporters." footer={<>Already have an account? <Link to="/organizer/login" state={location.state}>Sign in</Link></>}>
      {step === 'details' ? (
        <form className="org-form" onSubmit={submitDetails}>
          <label htmlFor="name">Full name</label>
          <input id="name" className="org-input" autoComplete="name" value={form.name} onChange={set('name')} minLength={2} required />
          <label htmlFor="phone">Phone number</label>
          <input id="phone" className="org-input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="07XX XXX XXX" required />
          <label htmlFor="email">Email <span>Optional</span></label>
          <input id="email" className="org-input" type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
          <label htmlFor="new-password">Password</label>
          <input id="new-password" className="org-input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" className="org-input" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required />
          <div className="org-channels" role="radiogroup" aria-label="Where to send the code">{[['sms', 'SMS code'], ['whatsapp', 'WhatsApp code'], ...(hasEmail ? [['email', 'Email code']] : [])].map(([value, label]) => <button type="button" key={value} role="radio" aria-checked={effectiveChannel === value} className={effectiveChannel === value ? 'selected' : ''} onClick={() => setChannel(value)}>{label}</button>)}</div>
          {error && <p className="org-error" role="alert">{error}</p>}
          <button className="org-primary" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={17} /> : <>Create account <ArrowRight size={16} /></>}</button>
        </form>
      ) : <OtpStep destination={effectiveChannel === 'email' ? form.email : form.phone} notice={notice} otp={otp} setOtp={setOtp} onSubmit={submitOtp} onResend={resend} onBack={() => { setStep('details'); setOtp(''); setError(''); }} submitting={submitting} error={error} />}
    </Shell>
  );
}
