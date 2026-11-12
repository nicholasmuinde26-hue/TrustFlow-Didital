import { useCallback, useEffect, useState } from 'react';
import { BellRing, CircleDollarSign, Loader2, Smartphone, UsersRound } from 'lucide-react';
import membersApi from '@/modules/members/api/members.api';
import finesApi from '@/modules/fines/api/fines.api';
import api from '@/app/services/api';
import { InputField, Notice, SectionCard, SelectField } from '../components/DeskUI';
import MpesaStkModal from '@/modules/finance/components/MpesaStkModal';

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`;
const dateLabel = (value) => value ? new Date(value).toLocaleDateString() : 'No due date';

export default function FinesManagementTab({ workspaceId, role, type, goToTab }) {
  const [members, setMembers] = useState([]);
  const [fines, setFines] = useState([]);
  const [fineTotals, setFineTotals] = useState(null);
  const [shareouts, setShareouts] = useState([]);
  const [shareoutMethod, setShareoutMethod] = useState({});
  const [bulkMethod, setBulkMethod] = useState({});
  const [excludedShareoutItems, setExcludedShareoutItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [stkFine, setStkFine] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({ memberId: '', reasonType: 'late_payment', amount: '', reason: '', dueDate: '' });
  const [shareoutForm, setShareoutForm] = useState({ period_label: '', distribution_basis: 'equal' });
  const isManager = ['treasurer', 'chairperson'].includes(role);

  const load = useCallback(async () => {
    if (!workspaceId || type !== 'chama') return;
    setLoading(true);
    try {
      const [fineResult, memberResult, shareoutResult] = await Promise.all([finesApi.list(workspaceId), membersApi.list(type, workspaceId), finesApi.listShareouts(workspaceId)]);
      setFines(fineResult?.data?.data?.fines || []);
      setFineTotals(fineResult?.data?.data?.totals || null);
      setShareouts(shareoutResult?.data?.data?.shareouts || []);
      const rows = memberResult?.data?.data?.members || memberResult?.data?.members || memberResult?.data || [];
      setMembers(Array.isArray(rows) ? rows.filter((member) => member.status === 'active' && member.role === 'member') : []);
    } catch (error) {
      setFeedback({ tone: 'error', text: error?.response?.data?.message || 'Could not load fines.' });
    } finally { setLoading(false); }
  }, [workspaceId, type]);

  useEffect(() => {
    if (type !== 'chama') { setLoading(false); return undefined; }
    load();
    const interval = window.setInterval(load, 30_000);
    window.addEventListener('finance:updated', load);
    return () => { window.clearInterval(interval); window.removeEventListener('finance:updated', load); };
  }, [load, type]);

  const submit = async (event) => {
    event.preventDefault();
    setBusyId('create'); setFeedback(null);
    try {
      await finesApi.create(workspaceId, { ...form, amount: Number(form.amount), dueDate: form.dueDate || undefined });
      setForm({ memberId: '', reasonType: 'late_payment', amount: '', reason: '', dueDate: '' });
      setFeedback({ tone: 'success', text: 'Fine recorded. The member has been notified.' });
      await load();
    } catch (error) { setFeedback({ tone: 'error', text: error?.response?.data?.message || 'Could not record this fine.' }); }
    finally { setBusyId(''); }
  };

  const act = async (fine, action) => {
    setBusyId(fine.id); setFeedback(null);
    try {
      if (action === 'remind') await finesApi.remind(workspaceId, fine.id);
      else return;
      setFeedback({ tone: 'success', text: 'Payment reminder sent.' });
      await load();
    } catch (error) { setFeedback({ tone: 'error', text: error?.response?.data?.message || 'That action could not be completed.' }); }
    finally { setBusyId(''); }
  };

  const createShareout = async (event) => {
    event.preventDefault(); setBusyId('shareout'); setFeedback(null);
    try {
      await finesApi.createShareout(workspaceId, shareoutForm);
      setFeedback({ tone: 'success', text: 'Fine share-out submitted for chairperson approval.' });
      await load();
    } catch (error) { setFeedback({ tone: 'error', text: error?.response?.data?.message || 'Could not create the share-out.' }); }
    finally { setBusyId(''); }
  };

  const shareoutAction = async (request, successText) => {
    setBusyId('shareout-action'); setFeedback(null);
    try { await request(); setFeedback({ tone: 'success', text: successText }); await load(); }
    catch (error) { setFeedback({ tone: 'error', text: error?.response?.data?.message || 'Could not update the share-out.' }); }
    finally { setBusyId(''); }
  };

  const bulkDisburse = async (batch) => {
    const excluded = new Set(excludedShareoutItems[batch._id] || []);
    const selected = (batch.items || []).filter((item) => item.status === 'pending' && !excluded.has(item._id));
    if (!selected.length) { setFeedback({ tone: 'error', text: 'Select at least one pending member share to disburse.' }); return; }
    const defaultMethod = bulkMethod[batch._id] || 'mpesa';
    const paymentItems = selected.map((item) => ({ item_id: item._id, method: shareoutMethod[item._id] || defaultMethod }));
    setBusyId('shareout-action'); setFeedback(null);
    try {
      const response = await finesApi.payShareoutItems(workspaceId, batch._id, { items: paymentItems });
      const result = response?.data?.data || {};
      const failedCount = result.failed?.length || 0;
      const methods = new Set(paymentItems.map((item) => item.method));
      const methodLabel = methods.size > 1 ? 'selected payment methods' : methods.has('wallet') ? 'member wallet' : 'M-Pesa';
      const failedNames = (result.failed || []).map((failure) => selected.find((item) => item._id === failure.item_id)?.member_id?.user_id?.name).filter(Boolean);
      setFeedback({ tone: failedCount ? 'error' : 'success', text: failedCount
        ? `${result.paid?.length || 0} shares disbursed; ${failedCount} failed${failedNames.length ? ` (${failedNames.slice(0, 3).join(', ')}${failedNames.length > 3 ? ', …' : ''})` : ''}. Failed members remain pending so you can retry them.`
        : `${result.paid?.length || 0} member shares disbursed using ${methodLabel}.` });
      await load();
    } catch (error) { setFeedback({ tone: 'error', text: error?.response?.data?.message || 'Could not disburse the selected shares.' }); }
    finally { setBusyId(''); }
  };

  if (type?.toLowerCase().replace(/[-_]/g, '') === 'burialchama') return <BurialPenaltyWaivers workspaceId={workspaceId} role={role} goToTab={goToTab} />;
  if (type !== 'chama') return <Notice>Fines are currently available for Chama workspaces.</Notice>;
  const outstanding = fines.filter((fine) => fine.status === 'outstanding');
  const total = fineTotals?.outstanding ?? outstanding.reduce((sum, fine) => sum + Number(fine.outstanding || 0), 0);

  return <div className="space-y-6">
    {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
    {isManager && <SectionCard icon={CircleDollarSign} title="Issue a fine" description="Record a late contribution, missed meeting, or another agreed Chama fine. The member is notified immediately.">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <SelectField label="Member" value={form.memberId} onChange={(value) => setForm((old) => ({ ...old, memberId: value }))} options={[{ value: '', label: 'Choose a member' }, ...members.map((member) => ({ value: member._id || member.id, label: member.user?.name || member.name || member.user_id?.name || 'Member' }))]} />
        <SelectField label="Fine type" value={form.reasonType} onChange={(value) => setForm((old) => ({ ...old, reasonType: value }))} options={[{ value: 'late_payment', label: 'Late payment' }, { value: 'meeting_absence', label: 'Missed meeting' }, { value: 'custom', label: 'Other reason' }]} />
        <InputField label="Amount (KES)" type="number" min="0.01" step="0.01" value={form.amount} onChange={(value) => setForm((old) => ({ ...old, amount: value }))} required />
        <InputField label="Payment due date (optional)" type="date" value={form.dueDate} onChange={(value) => setForm((old) => ({ ...old, dueDate: value }))} />
        <div className="md:col-span-2"><InputField label="Reason" value={form.reason} onChange={(value) => setForm((old) => ({ ...old, reason: value }))} placeholder="Explain what the fine is for" required /></div>
        <div className="md:col-span-2"><button disabled={busyId === 'create' || !form.memberId} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyId === 'create' ? 'Recording…' : 'Record fine and notify member'}</button></div>
      </form>
    </SectionCard>}
    <SectionCard icon={CircleDollarSign} title="Fine register" description={`${outstanding.length} outstanding · ${money(total)} to collect`}>
      {fineTotals && <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Assessed', fineTotals.assessed], ['Collected', fineTotals.collected], ['Available to share', fineTotals.availableForShareout], ['Distributed', fineTotals.distributed]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900 dark:text-white">{money(value)}</p></div>)}</div>}
      {loading ? <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Loading fines…</div> : fines.length === 0 ? <p className="py-5 text-sm text-slate-500">No fines have been recorded.</p> : <div className="divide-y divide-slate-200 dark:divide-slate-700">{fines.map((fine) => <div key={fine.id} className="flex flex-wrap items-center gap-3 py-4">
        <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">{fine.memberName} · {money(fine.outstanding)}</p><p className="mt-1 text-sm text-slate-500">{fine.reason} · Due {dateLabel(fine.dueDate)}{fine.paidAmount > 0 ? ` · ${money(fine.paidAmount)} paid` : ''}</p></div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${fine.status === 'outstanding' ? 'bg-amber-100 text-amber-800' : fine.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{fine.status}</span>
        {isManager && fine.status === 'outstanding' && <div className="flex flex-wrap gap-2"><button disabled={busyId === fine.id} onClick={() => act(fine, 'remind')} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"><BellRing size={14} /> Remind</button><button onClick={() => setStkFine(fine)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Smartphone size={14} /> Send STK</button></div>}
      </div>)}</div>}
    </SectionCard>
    <SectionCard icon={UsersRound} title="Fine share-outs" description="Distribute collected fines separately from savings. Choose equal shares or share in proportion to fines paid, then pay by M-Pesa or credit each member wallet.">
      {isManager && <form onSubmit={createShareout} className="mb-5 grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:grid-cols-3">
        <InputField label="Share-out period / agreement" value={shareoutForm.period_label} onChange={(value) => setShareoutForm((old) => ({ ...old, period_label: value }))} placeholder="e.g. 2026 year-end fine share-out" />
        <SelectField label="Distribution rule" value={shareoutForm.distribution_basis} onChange={(value) => setShareoutForm((old) => ({ ...old, distribution_basis: value }))} options={[{ value: 'equal', label: 'Equal among active members' }, { value: 'fines_paid', label: 'In proportion to fines paid' }]} />
        <div className="flex items-end"><button type="submit" disabled={busyId === 'shareout' || Number(fineTotals?.availableForShareout || 0) <= 0} className="w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyId === 'shareout' ? 'Preparing…' : `Prepare share-out · ${money(fineTotals?.availableForShareout || 0)}`}</button></div>
      </form>}
      {shareouts.length === 0 ? <p className="text-sm text-slate-500">No fine share-outs have been created.</p> : <div className="space-y-4">{shareouts.map((batch) => <div key={batch._id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-slate-900 dark:text-white">{batch.period_label || 'Fine share-out'} · {money(batch.total_amount)}</p><p className="text-xs text-slate-500">{batch.distribution_basis === 'equal' ? 'Equal shares' : 'Proportional to fines paid'} · {batch.items?.length || 0} members · {new Date(batch.as_of_date).toLocaleDateString()}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">{String(batch.status).replaceAll('_', ' ')}</span></div>
        {role === 'chairperson' && batch.status === 'pending_approval' && <button disabled={busyId === 'shareout-action'} onClick={() => shareoutAction(() => finesApi.approveShareout(workspaceId, batch._id), 'Fine share-out approved and posted to the ledger.')} className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Approve distribution</button>}
        {(batch.status === 'pending_approval' || batch.status === 'approved') && role === 'treasurer' && <button disabled={busyId === 'shareout-action'} onClick={() => shareoutAction(() => finesApi.cancelShareout(workspaceId, batch._id), 'Fine share-out cancelled.')} className="mt-3 ml-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Cancel</button>}
        {role === 'treasurer' && batch.status === 'approved' && batch.items?.some((item) => item.status === 'pending') && <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Apply payment method to checked members<select value={bulkMethod[batch._id] || 'mpesa'} onChange={(event) => { const method = event.target.value; setBulkMethod((current) => ({ ...current, [batch._id]: method })); setShareoutMethod((current) => { const next = { ...current }; for (const item of batch.items || []) if (item.status === 'pending' && !(excludedShareoutItems[batch._id] || []).includes(item._id)) next[item._id] = method; return next; }); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="mpesa">M-Pesa</option><option value="wallet">Member wallet</option></select></label>
            <button type="button" onClick={() => setExcludedShareoutItems((current) => ({ ...current, [batch._id]: [] }))} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Include all pending</button>
            <button type="button" onClick={() => setExcludedShareoutItems((current) => ({ ...current, [batch._id]: batch.items.filter((item) => item.status === 'pending').map((item) => item._id) }))} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Exclude all</button>
            <button type="button" disabled={busyId === 'shareout-action' || !batch.items.some((item) => item.status === 'pending' && !(excludedShareoutItems[batch._id] || []).includes(item._id))} onClick={() => bulkDisburse(batch)} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busyId === 'shareout-action' ? 'Disbursing…' : 'Disburse selected'}</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Changing the method updates every checked row. You can then change individual rows for exceptions. {batch.items.filter((item) => item.status === 'pending' && !(excludedShareoutItems[batch._id] || []).includes(item._id)).length} selected · {money(batch.items.filter((item) => item.status === 'pending' && !(excludedShareoutItems[batch._id] || []).includes(item._id)).reduce((sum, item) => sum + Number(item.amount || 0), 0))} total.</p>
        </div>}
        {batch.items?.length > 0 && <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">{batch.items.map((item) => { const pending = item.status === 'pending'; const excluded = (excludedShareoutItems[batch._id] || []).includes(item._id); return <div key={item._id} className="flex flex-wrap items-center gap-2 py-2 text-sm">{role === 'treasurer' && batch.status === 'approved' && pending && <input type="checkbox" aria-label={`Include ${item.member_id?.user_id?.name || 'member'} in bulk disbursement`} checked={!excluded} onChange={(event) => { const included = event.target.checked; setExcludedShareoutItems((current) => { const ids = new Set(current[batch._id] || []); if (included) ids.delete(item._id); else ids.add(item._id); return { ...current, [batch._id]: [...ids] }; }); if (included) setShareoutMethod((current) => ({ ...current, [item._id]: bulkMethod[batch._id] || 'mpesa' })); }} className="h-4 w-4 accent-emerald-700" />}<span className="flex-1 font-medium">{item.member_id?.user_id?.name || 'Member'}</span><span>{money(item.amount)}</span><span className="text-xs capitalize text-slate-500">{item.status}{item.disbursement_method ? ` · ${item.disbursement_method}` : ''}</span>{role === 'treasurer' && batch.status === 'approved' && pending && <div className="flex gap-2"><select aria-label={`Disbursement destination for ${item.member_id?.user_id?.name || 'member'}`} value={shareoutMethod[item._id] || bulkMethod[batch._id] || 'mpesa'} onChange={(event) => setShareoutMethod((current) => ({ ...current, [item._id]: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"><option value="mpesa">M-Pesa</option><option value="wallet">Member wallet</option></select><button disabled={busyId === 'shareout-action'} onClick={() => { const method = shareoutMethod[item._id] || bulkMethod[batch._id] || 'mpesa'; shareoutAction(() => finesApi.payShareoutItem(workspaceId, batch._id, item._id, { method }), method === 'wallet' ? 'Fine share credited to the member wallet.' : 'Fine share-out recorded as paid by M-Pesa.'); }} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">{busyId === 'shareout-action' ? 'Paying…' : 'Disburse'}</button></div>}</div>; })}</div>}
      </div>)}</div>}
    </SectionCard>
    {stkFine && <MpesaStkModal isOpen onClose={() => setStkFine(null)} chamaId={workspaceId} obligationId={stkFine.obligationId} initiatedByOfficial initialAmount={stkFine.outstanding} initialPhoneNumber={stkFine.memberPhone} title={`Fine payment: ${stkFine.reason}`} onSuccess={async () => { setFeedback({ tone: 'success', text: 'Payment confirmed. The fine register and member contribution record have been updated.' }); await load(); }} />}
  </div>;
}

function BurialPenaltyWaivers({ workspaceId, role, goToTab }) {
  const [waivers, setWaivers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const mayApprove = ['chairperson', 'treasurer'].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [waiverResponse, memberResponse] = await Promise.all([
        api.get(`/burial-chama/chama/${workspaceId}/penalty-waivers`),
        membersApi.list('burial-chama', workspaceId),
      ]);
      setWaivers(waiverResponse?.data?.data || []);
      const memberRows = memberResponse?.data?.data?.members || [];
      setMembers(Array.isArray(memberRows) ? memberRows : []);
    } catch (error) {
      setFeedback({ tone: 'error', text: error?.response?.data?.message || 'Could not load burial contribution waiver requests.' });
    } finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const decide = async (waiver, status) => {
    const rejectionReason = status === 'rejected' ? window.prompt('Why is this welfare contribution penalty waiver being declined?') : '';
    if (status === 'rejected' && !rejectionReason?.trim()) return;
    setBusyId(waiver._id);
    setFeedback(null);
    try {
      await api.put(`/burial-chama/penalty-waivers/${waiver._id}/approve`, {
        status,
        approval_role: role,
        rejection_reason: rejectionReason?.trim() || undefined,
      });
      setFeedback({ tone: 'success', text: `Penalty waiver ${status}.` });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: error?.response?.data?.message || 'Could not record the waiver decision.' });
    } finally { setBusyId(''); }
  };

  const memberName = (id) => {
    const member = members.find((item) => String(item._id) === String(id?._id || id));
    return member?.user_id?.name || member?.name || 'Member';
  };
  const pending = waivers.filter((item) => item.approval?.status === 'pending');
  const categoryLabel = (value) => String(value || 'other').replace(/_/g, ' ');

  return <div className="space-y-5">
    {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
    <SectionCard icon={CircleDollarSign} title="Burial contribution penalty waivers" description="Review requests to waive late welfare contributions or burial fund penalties. Waivers are recorded for the member and kept with the audit trail." action={<button type="button" onClick={() => goToTab?.("burial-config")} className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400">Review burial penalty rules</button>}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/70">Pending review</p><p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{pending.length}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">All requests</p><p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{waivers.length}</p></div><div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/25"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/70">Coverage rules</p><p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Late penalties are configured with the burial contribution plans.</p></div></div>
      {loading ? <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Loading waiver requests…</div> : waivers.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">No penalty waiver requests have been submitted.</p> : <div className="divide-y divide-slate-200 dark:divide-slate-700">{waivers.map((waiver) => <article key={waiver._id} className="flex flex-wrap items-start justify-between gap-4 py-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 dark:text-white">{memberName(waiver.membership_id)}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{waiver.approval?.status || 'pending'}</span></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{categoryLabel(waiver.waiver?.reason_category)} · {waiver.waiver?.reason || 'No explanation provided'}</p><p className="mt-1 text-xs text-slate-500">Penalty {money(waiver.original_penalty?.amount)} · Requested waiver {money(waiver.waiver?.waived_amount)} · {waiver.approval?.requested_at ? new Date(waiver.approval.requested_at).toLocaleDateString() : 'Date not recorded'}</p>{waiver.approval?.rejection_reason && <p className="mt-1 text-xs text-rose-600">Decision note: {waiver.approval.rejection_reason}</p>}</div>{mayApprove && waiver.approval?.status === 'pending' && <div className="flex gap-2"><button type="button" disabled={busyId === waiver._id} onClick={() => decide(waiver, 'rejected')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Decline</button><button type="button" disabled={busyId === waiver._id} onClick={() => decide(waiver, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busyId === waiver._id ? 'Saving…' : 'Approve waiver'}</button></div>}</article>)}</div>}
      {!mayApprove && <p className="mt-3 text-xs text-slate-500">Only the chairperson or treasurer can decide waiver requests.</p>}
    </SectionCard>
  </div>;
}
