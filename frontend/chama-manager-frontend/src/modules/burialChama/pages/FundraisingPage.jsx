import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '@/shared/components/ui/Card/Card';
import CardContent from '@/shared/components/ui/Card/CardContent';
import Button from '@/shared/components/ui/Button/Button';
import Input from '@/shared/components/ui/Input/Input';
import StatCard from '@/shared/components/ui/StatCard/StatCard';
import Dialog from '@/shared/components/ui/Dialog';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Megaphone,
  Coins,
  Target,
  Share2,
} from 'lucide-react';
import api from '@/app/services/api';

function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium mb-1">
      {children}
    </label>
  );
}

export default function FundraisingPage() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading, isError } = useQuery({
    queryKey: ['burial-fundraising-campaigns', workspaceId],
    queryFn: async () => (await api.get(`/burial-chama/chama/${workspaceId}/fundraising-campaigns`)).data.data,
    enabled: !!workspaceId,
  });
  const createCampaign = useMutation({
    mutationFn: (payload) => api.post(`/burial-chama/chama/${workspaceId}/fundraising-campaigns`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['burial-fundraising-campaigns', workspaceId] }),
    onError: (error) => toast.error(error.response?.data?.message || 'Could not save the campaign'),
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [receiptFor, setReceiptFor] = useState('');
  const [receipt, setReceipt] = useState({ amount: '', donor_name: '', method: 'cash', reference: '', anonymous: false });
  const recordReceipt = useMutation({
    mutationFn: ({ campaignId, payload }) => api.post(`/burial-chama/fundraising-campaigns/${campaignId}/contributions`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['burial-fundraising-campaigns', workspaceId] });
      setReceiptFor('');
      setReceipt({ amount: '', donor_name: '', method: 'cash', reference: '', anonymous: false });
      toast.success('Harambee contribution recorded');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not record the contribution'),
  });
  const [formData, setFormData] = useState({
    title: '',
    linkedCaseId: '',
    target: '',
    deadline: '',
    description: '',
  });

  // Pull real burial cases so a harambee can be linked to an actual
  // case on file, instead of free text.
  const { data: cases } = useQuery({
    queryKey: ['burial-cases', workspaceId],
    queryFn: async () => {
      const response = await api.get(`/burial-chama/chama/${workspaceId}/cases`);
      return response.data.data;
    },
    enabled: !!workspaceId,
    retry: false,
  });

  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const totalRaised = campaigns.reduce((sum, c) => sum + Number(c.raised_amount || 0), 0);
  const totalOutstanding = campaigns.reduce(
    (sum, c) => sum + Math.max(Number(c.target_amount || 0) - Number(c.raised_amount || 0), 0),
    0
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.target) {
      toast.error('Please give the harambee a title and a target amount');
      return;
    }
    createCampaign.mutate({
      title: formData.title,
      case_id: formData.linkedCaseId || undefined,
      target_amount: Number(formData.target),
      deadline: formData.deadline || undefined,
      description: formData.description,
    }, {
      onSuccess: () => {
        toast.success('Harambee saved');
        setIsFormOpen(false);
        setFormData({ title: '', linkedCaseId: '', target: '', deadline: '', description: '' });
      },
    });
  };

  const shareOnWhatsApp = (campaign) => {
    const remaining = Math.max(campaign.target_amount - campaign.raised_amount, 0);
    const message = `🤝 Harambee: ${campaign.title}\nTarget: KES ${campaign.target_amount.toLocaleString()}\nRaised so far: KES ${campaign.raised_amount.toLocaleString()}\nStill needed: KES ${remaining.toLocaleString()}${
      campaign.deadline ? `\nDeadline: ${campaign.deadline}` : ''
    }\n\nPlease contribute what you can — every bit helps 🙏`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Harambee & Fundraising
          </h1>
          <p className="text-gray-600">
            Organize contribution drives for cases beyond the standard payout — top-ups for
            funeral costs, hospital bills or other emergencies.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Start Harambee
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Harambees" value={activeCampaigns} icon={Megaphone} color="primary" />
        <StatCard
          title="Total Raised"
          value={`KES ${totalRaised.toLocaleString()}`}
          icon={Coins}
          color="success"
        />
        <StatCard
          title="Still Outstanding"
          value={`KES ${totalOutstanding.toLocaleString()}`}
          icon={Target}
          color="warning"
        />
      </div>

      <Dialog open={isFormOpen} onClose={() => setIsFormOpen(false)} title="Start a Harambee" description="Set a clear target and link the drive to a burial case so every receipt has context." icon={Megaphone}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Top-up for the Otieno Family Funeral"
                  required
                />
              </div>
              {cases?.length > 0 && (
                <div>
                  <Label htmlFor="linkedCaseId">Link to a Burial Case (optional)</Label>
                  <select
                    id="linkedCaseId"
                    value={formData.linkedCaseId}
                    onChange={(e) => setFormData({ ...formData, linkedCaseId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                  >
                    <option value="">— None —</option>
                    {cases.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.case_type} — {c.deceased?.first_name} {c.deceased?.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="target">Target Amount (KES)</Label>
                  <Input
                    id="target"
                    type="number"
                    min="1"
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Notes</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Any extra context for members"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-obsidian-border">
                <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createCampaign.isPending}>{createCampaign.isPending ? 'Saving…' : 'Create Harambee'}</Button>
              </div>
            </form>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((c) => {
          const raised = Number(c.raised_amount || 0);
          const target = Number(c.target_amount || 0);
          const pct = target ? Math.min(Math.round((raised / target) * 100), 100) : 0;
          return (
            <Card key={c._id}>
              <CardContent className="space-y-3">
                <div>
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="text-xs text-gray-500">{cases?.find((item) => String(item._id) === String(c.case_id))?.case_number || c.description || 'General welfare campaign'}</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">KES {raised.toLocaleString()}</span>
                    <span className="text-gray-500">of KES {target.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{c.deadline ? `Deadline: ${new Date(c.deadline).toLocaleDateString()}` : 'No deadline set'}</span>
                  <button
                    onClick={() => shareOnWhatsApp(c)}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Share2 className="w-3 h-3" /> Share on WhatsApp
                  </button>
                </div>
                <div className="flex items-center gap-3 border-t pt-3">
                  <Button variant="secondary" onClick={() => setReceiptFor(c._id)}>Record contribution</Button>
                  <span className="text-xs capitalize text-gray-500">{c.status}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {isLoading && <p className="col-span-2 py-8 text-center text-gray-400">Loading campaigns…</p>}
        {isError && <p className="col-span-2 py-8 text-center text-rose-600">Campaigns could not be loaded.</p>}
        {!isLoading && !isError && campaigns.length === 0 && (
          <p className="text-gray-400 col-span-2 text-center py-8">No harambees yet</p>
        )}
      </div>
      <Dialog open={Boolean(receiptFor)} onClose={() => setReceiptFor('')} title="Record Harambee receipt" description={`Record money received for ${campaigns.find((item) => item._id === receiptFor)?.title || 'this campaign'}. This posts the receipt to the chama books.`} icon={Coins}>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); recordReceipt.mutate({ campaignId: receiptFor, payload: { ...receipt, amount: Number(receipt.amount) } }); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="donor_name">Donor name</Label><Input id="donor_name" placeholder="Name or leave blank" value={receipt.donor_name} onChange={(event) => setReceipt({ ...receipt, donor_name: event.target.value })} disabled={receipt.anonymous} /></div>
            <div><Label htmlFor="receipt_amount">Amount (KES)</Label><Input id="receipt_amount" placeholder="0.00" type="number" min="1" required value={receipt.amount} onChange={(event) => setReceipt({ ...receipt, amount: event.target.value })} /></div>
            <div><Label htmlFor="receipt_method">Payment method</Label><select id="receipt_method" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist" value={receipt.method} onChange={(event) => setReceipt({ ...receipt, method: event.target.value })}><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option></select></div>
            <div><Label htmlFor="receipt_reference">Receipt / payment reference</Label><Input id="receipt_reference" placeholder="e.g. M-Pesa code" value={receipt.reference} onChange={(event) => setReceipt({ ...receipt, reference: event.target.value })} /></div>
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-xs text-slate-600 dark:border-obsidian-border dark:text-mist-muted"><input className="mt-0.5" type="checkbox" checked={receipt.anonymous} onChange={(event) => setReceipt({ ...receipt, anonymous: event.target.checked, donor_name: '' })} /><span><span className="block font-semibold text-slate-800 dark:text-mist">Record as anonymous</span><span>The donor’s name will not appear in the campaign record.</span></span></label>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-obsidian-border"><Button type="button" variant="secondary" onClick={() => setReceiptFor('')}>Cancel</Button><Button type="submit" disabled={recordReceipt.isPending}>{recordReceipt.isPending ? 'Saving…' : 'Save receipt'}</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
