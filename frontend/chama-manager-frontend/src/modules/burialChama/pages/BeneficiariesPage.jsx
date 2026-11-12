import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Card from '@/shared/components/ui/Card/Card';
import CardContent from '@/shared/components/ui/Card/CardContent';
import CardHeader from '@/shared/components/ui/Card/CardHeader';
import Button from '@/shared/components/ui/Button/Button';
import Input from '@/shared/components/ui/Input/Input';
import { toast } from 'react-hot-toast';

function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium mb-1">
      {children}
    </label>
  );
}

function CardDescription({ children }) {
  return <p className="text-sm text-gray-600">{children}</p>;
}

function CardTitle({ children }) {
  return <h3 className="text-lg font-semibold">{children}</h3>;
}
import { Plus, Edit, Trash2, UserPlus, Phone, Calendar, MapPin, X, ChevronLeft, ChevronRight, Check, Heart, Baby, Users, UserRound } from 'lucide-react';
import api from '@/app/services/api';
import { useWorkspace } from '@/app/hooks/useWorkspace';

const emptyBeneficiaryForm = () => ({
  first_name: '', last_name: '', other_names: '', relationship: 'spouse', custom_relationship: '',
  date_of_birth: '', education_status: 'not_applicable', gender: '', phone: '', national_id: '', residence: ''
});

export default function BeneficiariesPage() {
  const { membershipId } = useWorkspace();
  const queryClient = useQueryClient();
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState(emptyBeneficiaryForm);

  // Fetch beneficiaries
  const { data: beneficiaries = [], isLoading, isError, error } = useQuery({
    queryKey: ['beneficiaries', membershipId],
    enabled: Boolean(membershipId),
    queryFn: async () => {
      const response = await api.get(`/burial-chama/membership/${membershipId}/beneficiaries`);
      return response.data.data;
    }
  });

  // Add beneficiary mutation
  const addBeneficiaryMutation = useMutation({
    mutationFn: async (data) => {
      if (!membershipId) throw new Error('Your membership is still loading. Refresh and try again.');
      const response = await api.post(
        `/burial-chama/membership/${membershipId}/beneficiaries`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Beneficiary added successfully');
      setIsAddFormOpen(false);
      setFormData(emptyBeneficiaryForm());
      queryClient.invalidateQueries({ queryKey: ['beneficiaries', membershipId] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add beneficiary');
    }
  });

  // Update beneficiary mutation
  const updateBeneficiaryMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(
        `/burial-chama/beneficiaries/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Beneficiary updated successfully');
      setSelectedBeneficiary(null);
      setIsAddFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['beneficiaries', membershipId] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update beneficiary');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedBeneficiary) {
      updateBeneficiaryMutation.mutate({ id: selectedBeneficiary._id, data: formData });
    } else {
      addBeneficiaryMutation.mutate(formData);
    }
  };

  const handleEdit = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setFormData({
      first_name: beneficiary.first_name,
      last_name: beneficiary.last_name,
      other_names: beneficiary.other_names || '',
      relationship: beneficiary.relationship,
      custom_relationship: beneficiary.custom_relationship || '',
      date_of_birth: beneficiary.date_of_birth?.split('T')[0] || '',
      education_status: beneficiary.education_status || 'not_applicable',
      gender: beneficiary.gender || '',
      phone: beneficiary.phone || '',
      national_id: beneficiary.national_id || '',
      residence: beneficiary.residence || ''
    });
    setFormStep(2);
    setIsAddFormOpen(true);
  };

  const openAddForm = () => {
    setSelectedBeneficiary(null);
    setFormData(emptyBeneficiaryForm());
    setFormStep(1);
    setIsAddFormOpen(true);
  };

  const closeForm = () => {
    setIsAddFormOpen(false);
    setSelectedBeneficiary(null);
    setFormData(emptyBeneficiaryForm());
    setFormStep(1);
  };

  const handleDelete = () => toast.error('Beneficiary removal is not available yet.');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (isError) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error.response?.data?.message || 'Could not load beneficiaries.'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Beneficiaries</h1>
          <p className="text-gray-600">Manage beneficiaries for burial benefits</p>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          Add Beneficiary
        </Button>
      </div>

      <BeneficiaryFormModal
        open={isAddFormOpen}
        editing={Boolean(selectedBeneficiary)}
        step={formStep}
        setStep={setFormStep}
        data={formData}
        setData={setFormData}
        saving={addBeneficiaryMutation.isPending || updateBeneficiaryMutation.isPending}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      {beneficiaries?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No beneficiaries yet</h3>
            <p className="text-gray-600 mb-4">Add beneficiaries to ensure they're covered under your burial chama</p>
            <Button onClick={() => setIsAddFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Beneficiary
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {beneficiaries?.map((beneficiary) => (
            <Card key={beneficiary._id}>
              <CardHeader>
                <CardTitle className="text-lg">{beneficiary.full_name}</CardTitle>
                <CardDescription className="capitalize">{beneficiary.relationship}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Age: {beneficiary.age} years</span>
                  </div>
                  {beneficiary.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{beneficiary.phone}</span>
                    </div>
                  )}
                  {beneficiary.residence && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{beneficiary.residence}</span>
                    </div>
                  )}
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                    beneficiary.eligibility_status === 'eligible' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {beneficiary.eligibility_status}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEdit(beneficiary)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(beneficiary._id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BeneficiaryFormModal({ open, editing, step, setStep, data, setData, saving, onClose, onSubmit }) {
  const [showExtra, setShowExtra] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;

  const relationships = [
    { value: 'spouse', label: 'Spouse', Icon: Heart, hint: 'Your husband or wife' },
    { value: 'child', label: 'Child', Icon: Baby, hint: 'Biological child' },
    { value: 'adopted_child', label: 'Adopted child', Icon: Baby, hint: 'Legally adopted child' },
    { value: 'parent', label: 'Parent', Icon: UserRound, hint: 'Your mother or father' },
    { value: 'parent_in_law', label: 'Parent-in-law', Icon: Users, hint: 'Your spouse’s parent' },
    { value: 'dependant', label: 'Other dependant', Icon: Users, hint: 'Someone else you support' },
    { value: 'sibling', label: 'Sibling', Icon: Users, hint: 'Brother or sister' },
    { value: 'guardian', label: 'Guardian', Icon: UserRound, hint: 'A legal guardian' },
    { value: 'grandparent', label: 'Grandparent', Icon: UserRound, hint: 'Grandmother or grandfather' },
    { value: 'custom', label: 'Other', Icon: UserRound, hint: 'Another relationship' },
  ];
  const update = (field, value) => setData((current) => ({ ...current, [field]: value }));
  const continueFromDetails = () => {
    if (!data.first_name.trim() || !data.last_name.trim() || !data.date_of_birth || !data.gender) {
      setError('Add their name, date of birth and gender to continue.');
      return;
    }
    if (data.relationship === 'custom' && !data.custom_relationship.trim()) {
      setError('Add the relationship description to continue.');
      return;
    }
    setError('');
    setStep(3);
  };
  const relationName = relationships.find((item) => item.value === data.relationship)?.label || data.relationship;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="beneficiary-modal-title">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Burial cover · {editing ? 'Update person' : 'Add someone'}</p>
            <h2 id="beneficiary-modal-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{step === 1 ? 'Who are you covering?' : step === 2 ? 'A few details' : 'Review details'}</h2>
            <p className="mt-1 text-sm text-slate-500">{step === 1 ? 'Choose how they are related to you.' : step === 2 ? 'This helps us confirm their cover eligibility.' : 'Check everything before adding them to your household.'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-5 pt-4 sm:px-8">
          <div className="flex items-center gap-2" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((item) => <div key={item} className={`h-1.5 flex-1 rounded-full transition ${item <= step ? 'bg-emerald-500' : 'bg-slate-100'}`} />)}
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400"><span>Relationship</span><span>Details</span><span>Review</span></div>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
            {step === 1 && <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {relationships.map(({ value, label, Icon, hint }) => {
                const active = data.relationship === value;
                return <button type="button" key={value} onClick={() => { update('relationship', value); setError(''); }} className={`group rounded-2xl border p-3 text-left transition sm:p-4 ${active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50'}`}>
                  <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700'}`}><Icon className="h-4 w-4" /></span>
                  <span className="block text-sm font-semibold text-slate-900">{label}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-slate-500">{hint}</span>
                </button>;
              })}
            </div>}

            {step === 2 && <div className="mx-auto max-w-xl space-y-5">
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white"><Heart className="h-5 w-5" /></span><div><p className="text-xs font-medium text-emerald-700">Relationship</p><p className="font-semibold">{data.relationship === 'custom' ? data.custom_relationship || 'Other' : relationName}</p></div><button type="button" onClick={() => setStep(1)} className="ml-auto text-sm font-semibold text-emerald-700 hover:text-emerald-900">Change</button></div>
              {data.relationship === 'custom' && <div><Label htmlFor="custom_relationship">Describe the relationship</Label><Input id="custom_relationship" value={data.custom_relationship} onChange={(e) => update('custom_relationship', e.target.value)} placeholder="e.g. foster child" /></div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label htmlFor="first_name">First name</Label><Input autoFocus id="first_name" value={data.first_name} onChange={(e) => update('first_name', e.target.value)} placeholder="First name" /></div>
                <div><Label htmlFor="last_name">Last name</Label><Input id="last_name" value={data.last_name} onChange={(e) => update('last_name', e.target.value)} placeholder="Last name" /></div>
                <div><Label htmlFor="other_names">Other names <span className="font-normal text-slate-400">· optional</span></Label><Input id="other_names" value={data.other_names} onChange={(e) => update('other_names', e.target.value)} placeholder="Middle or other names" /></div>
                <div><Label htmlFor="date_of_birth">Date of birth</Label><Input id="date_of_birth" type="date" value={data.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} /></div>
                <div><Label htmlFor="gender">Gender</Label><select id="gender" value={data.gender} onChange={(e) => update('gender', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"><option value="">Choose one</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></div>
                {['child', 'adopted_child'].includes(data.relationship) && <div><Label htmlFor="education_status">Education</Label><select id="education_status" value={data.education_status} onChange={(e) => update('education_status', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"><option value="not_applicable">Not in college</option><option value="in_school">In school</option><option value="college">In college</option></select><p className="mt-1 text-xs text-slate-500">College cover may continue to age 24.</p></div>}
              </div>
              <details open={showExtra} onToggle={(e) => setShowExtra(e.currentTarget.open)} className="rounded-2xl border border-slate-200 px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">Add contact and ID details <span className="font-normal text-slate-400">· optional</span></summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div><Label htmlFor="phone">Phone number</Label><Input id="phone" value={data.phone} onChange={(e) => update('phone', e.target.value)} placeholder="0712 345 678" /></div>
                  <div><Label htmlFor="national_id">National ID</Label><Input id="national_id" value={data.national_id} onChange={(e) => update('national_id', e.target.value)} placeholder="ID number" /></div>
                  <div className="sm:col-span-2"><Label htmlFor="residence">Residence</Label><Input id="residence" value={data.residence} onChange={(e) => update('residence', e.target.value)} placeholder="Village, estate or town" /></div>
                </div>
              </details>
            </div>}

            {step === 3 && <div className="mx-auto max-w-xl">
              <div className="rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-900 p-5 text-white sm:p-7"><p className="text-sm text-emerald-100">Covered household member</p><h3 className="mt-1 text-2xl font-bold">{[data.first_name, data.other_names, data.last_name].filter(Boolean).join(' ')}</h3><p className="mt-1 text-emerald-100">{data.relationship === 'custom' ? data.custom_relationship : relationName}</p><div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-4 text-sm"><div><p className="text-xs text-emerald-200">Date of birth</p><p className="mt-1 font-medium">{data.date_of_birth || 'Not provided'}</p></div><div><p className="text-xs text-emerald-200">Gender</p><p className="mt-1 font-medium capitalize">{data.gender || 'Not provided'}</p></div>{data.phone && <div><p className="text-xs text-emerald-200">Phone</p><p className="mt-1 font-medium">{data.phone}</p></div>}{data.national_id && <div><p className="text-xs text-emerald-200">National ID</p><p className="mt-1 font-medium">{data.national_id}</p></div>}</div></div>
              <p className="mt-4 text-center text-sm text-slate-500">You can update these details later from your household list.</p>
            </div>}
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-8">
            <Button type="button" variant="secondary" onClick={() => step === 1 ? onClose() : setStep(step - 1)}><ChevronLeft className="mr-1 h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}</Button>
            {step < 3 ? <Button type="button" onClick={() => { if (step === 1) { setError(''); setStep(2); } else continueFromDetails(); }}>Continue<ChevronRight className="ml-1 h-4 w-4" /></Button> : <Button type="submit" disabled={saving}>{saving ? 'Saving…' : <><Check className="mr-1 h-4 w-4" />{editing ? 'Save changes' : 'Add to household'}</>}</Button>}
          </div>
        </form>
      </div>
    </div>
  );
}
