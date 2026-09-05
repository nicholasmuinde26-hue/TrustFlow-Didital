import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Card from '@/shared/components/ui/Card/Card';
import CardContent from '@/shared/components/ui/Card/CardContent';
import CardHeader from '@/shared/components/ui/Card/CardHeader';
import Button from '@/shared/components/ui/Button/Button';
import Input from '@/shared/components/ui/Input/Input';
import StatCard from '@/shared/components/ui/StatCard/StatCard';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Megaphone,
  Coins,
  Target,
  Share2,
  Sparkles,
} from 'lucide-react';
import api from '@/app/services/api';

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

// Seed campaigns — harambees a burial chama typically runs on top of
// its standard benefit payout, e.g. topping up for a case whose cost
// exceeds the fixed benefit amount.
const SEED_CAMPAIGNS = [
  {
    id: 'h1',
    title: 'Top-up for the Otieno Family Funeral',
    linkedCase: 'Member Death — J. Otieno',
    target: 80000,
    raised: 52000,
    deadline: '2026-09-15',
  },
  {
    id: 'h2',
    title: 'Hospital Bill Support — Mama Njoki',
    linkedCase: 'Emergency Welfare',
    target: 40000,
    raised: 40000,
    deadline: '2026-08-30',
  },
];

export default function FundraisingPage() {
  const { workspaceId } = useParams();
  const [campaigns, setCampaigns] = useState(SEED_CAMPAIGNS);
  const [isFormOpen, setIsFormOpen] = useState(false);
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
      const response = await api.get(`/api/v1/burial-chama/chama/${workspaceId}/cases`);
      return response.data.data;
    },
    enabled: !!workspaceId,
    retry: false,
  });

  const activeCampaigns = campaigns.filter((c) => c.raised < c.target).length;
  const totalRaised = campaigns.reduce((sum, c) => sum + c.raised, 0);
  const totalOutstanding = campaigns.reduce(
    (sum, c) => sum + Math.max(c.target - c.raised, 0),
    0
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.target) {
      toast.error('Please give the harambee a title and a target amount');
      return;
    }
    const linkedCase = cases?.find((c) => c._id === formData.linkedCaseId);
    setCampaigns((prev) => [
      {
        id: `h${prev.length + 1}`,
        title: formData.title,
        linkedCase: linkedCase
          ? `${linkedCase.case_type || 'Case'} — ${linkedCase.deceased?.first_name || ''} ${
              linkedCase.deceased?.last_name || ''
            }`.trim()
          : formData.description || 'Not linked to a case',
        target: Number(formData.target),
        raised: 0,
        deadline: formData.deadline,
      },
      ...prev,
    ]);
    toast.success('Harambee created (demo only — not yet saved to the server)');
    setIsFormOpen(false);
    setFormData({ title: '', linkedCaseId: '', target: '', deadline: '', description: '' });
  };

  const shareOnWhatsApp = (campaign) => {
    const remaining = Math.max(campaign.target - campaign.raised, 0);
    const message = `🤝 Harambee: ${campaign.title}\nTarget: KES ${campaign.target.toLocaleString()}\nRaised so far: KES ${campaign.raised.toLocaleString()}\nStill needed: KES ${remaining.toLocaleString()}${
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

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Early preview — campaigns you create here stay on this screen until pledges and
          M-Pesa contributions are wired up to the finance module.
        </p>
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

      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Start a Harambee</CardTitle>
            <CardDescription>Optionally link it to an existing burial case</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full px-3 py-2 border rounded-md"
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target">Target Amount (KES)</Label>
                  <Input
                    id="target"
                    type="number"
                    min="0"
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Harambee</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((c) => {
          const pct = Math.min(Math.round((c.raised / c.target) * 100), 100);
          return (
            <Card key={c.id}>
              <CardContent className="space-y-3">
                <div>
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="text-xs text-gray-500">{c.linkedCase}</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">KES {c.raised.toLocaleString()}</span>
                    <span className="text-gray-500">of KES {c.target.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{c.deadline ? `Deadline: ${c.deadline}` : 'No deadline set'}</span>
                  <button
                    onClick={() => shareOnWhatsApp(c)}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Share2 className="w-3 h-3" /> Share on WhatsApp
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {campaigns.length === 0 && (
          <p className="text-gray-400 col-span-2 text-center py-8">No harambees yet</p>
        )}
      </div>
    </div>
  );
}