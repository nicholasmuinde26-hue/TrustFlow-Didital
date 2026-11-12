import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AlertCircle, ArrowDownUp, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Clock3, FileHeart, FileText, Heart, HeartHandshake, Plus, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import Card from '@/shared/components/ui/Card/Card';
import Button from '@/shared/components/ui/Button/Button';
import Input from '@/shared/components/ui/Input/Input';
import Dialog from '@/shared/components/ui/Dialog';
import api from '@/app/services/api';

const INITIAL_FORM = {
  case_type: 'member_death', deceased_first_name: '', deceased_last_name: '',
  relationship_to_member: 'self', date_of_death: '', claimant_name: '',
  claimant_phone: '', claimant_relationship: 'spouse'
};

const STATUS = {
  reported: { label: 'Reported', tone: 'amber', Icon: Clock3 },
  under_review: { label: 'Under review', tone: 'blue', Icon: Search },
  documentation_required: { label: 'Documents needed', tone: 'orange', Icon: FileText },
  verified: { label: 'Verified', tone: 'emerald', Icon: ShieldCheck },
  eligibility_check: { label: 'Eligibility check', tone: 'blue', Icon: Search },
  benefit_calculated: { label: 'Benefit calculated', tone: 'violet', Icon: CheckCircle2 },
  committee_review: { label: 'Committee review', tone: 'violet', Icon: Users },
  approved: { label: 'Approved', tone: 'emerald', Icon: CheckCircle2 },
  payment_authorized: { label: 'Payment authorized', tone: 'blue', Icon: ShieldCheck },
  disbursement: { label: 'Payment in progress', tone: 'blue', Icon: ArrowDownUp },
  confirmed: { label: 'Payment confirmed', tone: 'emerald', Icon: CheckCircle2 },
  closed: { label: 'Closed', tone: 'slate', Icon: CheckCircle2 },
  rejected: { label: 'Declined', tone: 'rose', Icon: AlertCircle },
  appeal: { label: 'Appeal', tone: 'orange', Icon: AlertCircle },
  cancelled: { label: 'Cancelled', tone: 'slate', Icon: X }
};

const badgeTone = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-200', blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200', emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200', slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200'
};

function Field({ label, children, className = '' }) {
  return <div className={className}><label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>{children}</div>;
}

function StatusBadge({ status }) {
  const config = STATUS[status] || STATUS.reported;
  const { Icon } = config;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeTone[config.tone]}`}><Icon size={13} />{config.label}</span>;
}

export default function BurialCasesPage() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [reportStep, setReportStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: cases = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['burial-cases', workspaceId],
    queryFn: async () => (await api.get(`/burial-chama/chama/${workspaceId}/cases`)).data.data || []
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data) => (await api.post('/burial-chama/cases', {
      ...data,
      chamaId: workspaceId,
      burial_chama_profile_id: workspaceId
    })).data,
    onSuccess: () => {
      toast.success('Case reported. Your chama officials can now review it.');
      setIsAddFormOpen(false);
      setReportStep(1);
      setFormData(INITIAL_FORM);
      queryClient.invalidateQueries({ queryKey: ['burial-cases', workspaceId] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not report the case. Please try again.')
  });

  const filteredCases = useMemo(() => cases.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesText = !query || [item.case_number, item.deceased?.full_name, item.claimant?.name, item.case_type]
      .some((value) => String(value || '').toLowerCase().includes(query));
    return matchesText && (statusFilter === 'all' || item.status === statusFilter);
  }), [cases, search, statusFilter]);

  const activeCount = cases.filter((item) => !['closed', 'rejected', 'cancelled'].includes(item.status)).length;
  const approvedCount = cases.filter((item) => ['approved', 'payment_authorized', 'disbursement', 'confirmed', 'closed'].includes(item.status)).length;

  const handleSubmit = (event) => {
    event.preventDefault();
    createCaseMutation.mutate({
      case_type: formData.case_type,
      deceased: {
        first_name: formData.deceased_first_name.trim(), last_name: formData.deceased_last_name.trim(),
        relationship_to_member: formData.relationship_to_member, date_of_death: formData.date_of_death
      },
      claimant: { name: formData.claimant_name.trim(), phone: formData.claimant_phone.trim(), relationship: formData.claimant_relationship }
    });
  };

  const selectRelationship = (relationship) => {
    const caseType = relationship === 'self' ? 'member_death'
      : relationship === 'spouse' ? 'spouse_death'
        : relationship === 'child' ? 'child_death'
          : relationship === 'parent' ? 'parent_death' : 'dependant_death';
    setFormData((current) => ({ ...current, relationship_to_member: relationship, case_type: caseType }));
  };

  const canContinue = reportStep === 1
    ? Boolean(formData.relationship_to_member)
    : reportStep === 2
      ? Boolean(formData.deceased_first_name.trim() && formData.deceased_last_name.trim() && formData.date_of_death)
      : Boolean(formData.claimant_name.trim() && formData.claimant_phone.trim());

  if (isLoading) return <div className="mx-auto max-w-6xl space-y-6 p-6"><div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" /><div className="h-36 animate-pulse rounded-2xl bg-slate-100" /><div className="h-64 animate-pulse rounded-2xl bg-slate-100" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"><HeartHandshake size={14} /> Welfare support</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Burial cases</h1>
          <p className="mt-1 text-sm text-slate-500">Report a bereavement and follow the support process from review to resolution.</p>
        </div>
        <Button onClick={() => setIsAddFormOpen(true)} className="inline-flex items-center gap-2 self-start sm:self-auto">
          <Plus size={17} />Report a case
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Case overview">
        <Card className="flex items-center gap-4 p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileHeart size={21} /></div><div><p className="text-sm text-slate-500">All cases</p><p className="text-2xl font-bold text-slate-900">{cases.length}</p></div></Card>
        <Card className="flex items-center gap-4 p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><Clock3 size={21} /></div><div><p className="text-sm text-slate-500">In progress</p><p className="text-2xl font-bold text-slate-900">{activeCount}</p></div></Card>
        <Card className="flex items-center gap-4 p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 size={21} /></div><div><p className="text-sm text-slate-500">Approved / resolved</p><p className="text-2xl font-bold text-slate-900">{approvedCount}</p></div></Card>
      </section>

      <Dialog open={isAddFormOpen} onClose={() => { setIsAddFormOpen(false); setReportStep(1); }} title="Report a bereavement" description="A few details to get support started. You can add supporting documents later. Reporting opens a leadership review; cover eligibility is checked separately before benefits are approved." icon={FileHeart} size="lg">
        <div className="mb-6 flex items-center gap-3" aria-label={`Step ${reportStep} of 3`}>
            {[['1', 'Who'], ['2', 'Details'], ['3', 'Contact']].map(([step, label], index) => <div key={step} className="flex flex-1 items-center gap-3">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${reportStep >= Number(step) ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>{reportStep > Number(step) ? <CheckCircle2 size={15} /> : step}</div>
              <span className={`text-xs font-semibold ${reportStep >= Number(step) ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
              {index < 2 && <div className={`h-px flex-1 ${reportStep > Number(step) ? 'bg-blue-300' : 'bg-slate-200'}`} />}
            </div>)}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="min-h-[310px] py-2 sm:py-3">
            {reportStep === 1 && <section className="animate-in fade-in space-y-5">
              <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Step 1 of 3</p><h3 className="mt-2 text-xl font-semibold text-slate-950">Who has passed away?</h3><p className="mt-1 text-sm text-slate-500">Choose their relationship to the member.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['self', 'The member', 'Report the loss of a chama member', UserRound],
                  ['spouse', 'Spouse', 'A member’s spouse', Heart],
                  ['child', 'Child', 'A member’s child', Users],
                  ['parent', 'Parent', 'A member’s parent or in-law', HeartHandshake],
                  ['dependant', 'Other dependant', 'Another covered family member', Users],
                ].map(([value, title, subtitle, Icon]) => <button key={value} type="button" onClick={() => selectRelationship(value)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md ${formData.relationship_to_member === value ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${formData.relationship_to_member === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span></span><span className={`h-4 w-4 rounded-full border ${formData.relationship_to_member === value ? 'border-[5px] border-blue-600' : 'border-slate-300'}`} />
                </button>)}
              </div>
            </section>}
            {reportStep === 2 && <section className="space-y-5">
              <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Step 2 of 3</p><h3 className="mt-2 text-xl font-semibold text-slate-950">Tell us the essentials</h3><p className="mt-1 text-sm text-slate-500">We’ll use these details to open the case for review.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="First name" autoComplete="given-name" placeholder="Deceased’s first name" value={formData.deceased_first_name} onChange={(e) => setFormData({ ...formData, deceased_first_name: e.target.value })} required maxLength={100} />
                <Input label="Last name" autoComplete="family-name" placeholder="Deceased’s last name" value={formData.deceased_last_name} onChange={(e) => setFormData({ ...formData, deceased_last_name: e.target.value })} required maxLength={100} />
                <Input label="Date of death" type="date" max={new Date().toISOString().slice(0, 10)} value={formData.date_of_death} onChange={(e) => setFormData({ ...formData, date_of_death: e.target.value })} required />
                <Field label="Relationship"><div className="relative"><select value={formData.relationship_to_member} onChange={(e) => selectRelationship(e.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pr-10 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="self">Member</option><option value="spouse">Spouse</option><option value="child">Child</option><option value="parent">Parent</option><option value="sibling">Sibling</option><option value="dependant">Other dependant</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-400" size={18} /></div></Field>
                <div className="sm:col-span-2 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Keep it simple:</strong> an official can request supporting documents after your report is received.</div>
              </div>
            </section>}
            {reportStep === 3 && <section className="space-y-5">
              <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Step 3 of 3</p><h3 className="mt-2 text-xl font-semibold text-slate-950">How can we reach you?</h3><p className="mt-1 text-sm text-slate-500">An official may call to guide you through the next steps.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><Input label="Your name" autoComplete="name" placeholder="Full name" value={formData.claimant_name} onChange={(e) => setFormData({ ...formData, claimant_name: e.target.value })} required maxLength={200} /><Input label="Phone number" type="tel" autoComplete="tel" placeholder="e.g. 0712 345 678" value={formData.claimant_phone} onChange={(e) => setFormData({ ...formData, claimant_phone: e.target.value })} required /><Field label="Relationship to deceased"><div className="relative"><select value={formData.claimant_relationship} onChange={(e) => setFormData({ ...formData, claimant_relationship: e.target.value })} className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pr-10 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="spouse">Spouse</option><option value="child">Child</option><option value="parent">Parent</option><option value="sibling">Sibling</option><option value="other">Other</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-400" size={18} /></div></Field></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><HeartHandshake size={17} className="text-rose-600" />Review your report</div><p className="mt-2 text-sm text-slate-700">{formData.deceased_first_name} {formData.deceased_last_name} · {formData.relationship_to_member.replace(/_/g, ' ')} · {formData.date_of_death ? new Date(`${formData.date_of_death}T00:00:00`).toLocaleDateString() : 'Date not selected'}</p><p className="mt-1 text-xs text-slate-500">Contact: {formData.claimant_name} · {formData.claimant_phone}</p></div>
            </section>}
          </div>
          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-obsidian-border">
            <p className="text-xs leading-5 text-slate-500">Your report is shared only with authorized chama officials.</p>
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => reportStep === 1 ? setIsAddFormOpen(false) : setReportStep((step) => step - 1)}>{reportStep === 1 ? 'Cancel' : <><ArrowLeft size={15} /> Back</>}</Button>{reportStep < 3 ? <Button type="button" disabled={!canContinue} onClick={() => setReportStep((step) => step + 1)} className="inline-flex items-center gap-2">Continue <ArrowRight size={16} /></Button> : <Button type="submit" disabled={!canContinue} loading={createCaseMutation.isPending} loadingLabel="Submitting…" className="inline-flex items-center gap-2"><HeartHandshake size={16} />Submit report</Button>}</div>
          </div>
        </form>
      </Dialog>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-slate-900">Case register</h2><p className="mt-1 text-sm text-slate-500">{cases.length} {cases.length === 1 ? 'case' : 'cases'} recorded</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cases" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-56" /></div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter cases by status" className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="all">All statuses</option>{Object.entries(STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
          </div>
        </div>

        {isError ? <div className="p-12 text-center"><AlertCircle className="mx-auto mb-3 text-rose-500" /><h3 className="font-semibold text-slate-900">Couldn’t load cases</h3><p className="mt-1 text-sm text-slate-500">Check your connection and try again.</p><Button className="mt-4" variant="secondary" onClick={() => refetch()}>Try again</Button></div>
          : filteredCases.length === 0 ? <div className="px-6 py-14 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">{cases.length ? <Search size={23} /> : <FileHeart size={23} />}</div><h3 className="font-semibold text-slate-900">{cases.length ? 'No matching cases' : 'No cases yet'}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{cases.length ? 'Try a different search or status filter.' : 'When a bereavement occurs, report it here to start the support process.'}</p>{!cases.length && <Button onClick={() => setIsAddFormOpen(true)} className="mt-5 inline-flex items-center gap-2"><Plus size={16} />Report a case</Button>}</div>
          : <div className="divide-y divide-slate-100">{filteredCases.map((caseItem) => <article key={caseItem._id} className="flex flex-col gap-4 p-5 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700"><HeartHandshake size={20} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{caseItem.deceased?.full_name || 'Unnamed case'}</h3><StatusBadge status={caseItem.status} /></div><p className="mt-1 text-sm text-slate-500">{caseItem.case_number} <span className="px-1 text-slate-300">·</span> {(caseItem.case_type || '').replace(/_/g, ' ')}</p><p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Users size={13} />{caseItem.claimant?.name || 'Claimant not listed'}</span><span className="inline-flex items-center gap-1"><CalendarDays size={13} />{caseItem.deceased?.date_of_death ? new Date(caseItem.deceased.date_of_death).toLocaleDateString() : 'Date not listed'}</span></p></div></div>
            <div className="flex items-center justify-between gap-5 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0"><div className="sm:text-right"><p className="text-xs text-slate-500">Benefit amount</p><p className="mt-1 text-sm font-semibold text-slate-900">{caseItem.benefit?.approved_amount ? `KES ${caseItem.benefit.approved_amount}` : 'To be assessed'}</p></div><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">{caseItem.deceased?.relationship_to_member?.replace(/_/g, ' ') || '—'}</span></div>
          </article>)}</div>}
      </Card>
    </div>
  );
}
