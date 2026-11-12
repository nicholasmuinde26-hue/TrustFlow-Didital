import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '@/shared/components/ui/Card/Card';
import CardContent from '@/shared/components/ui/Card/CardContent';
import CardHeader from '@/shared/components/ui/Card/CardHeader';
import Button from '@/shared/components/ui/Button/Button';
import Input from '@/shared/components/ui/Input/Input';
import StatCard from '@/shared/components/ui/StatCard/StatCard';
import Dialog from '@/shared/components/ui/Dialog';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Tent,
  Wallet,
  PackageCheck,
  PackageX,
  Phone,
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

const STATUS_STYLES = {
  confirmed: 'bg-blue-100 text-blue-700',
  returned: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function EquipmentHirePage() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();
  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['burial-equipment', workspaceId],
    queryFn: async () => (await api.get(`/burial-chama/chama/${workspaceId}/equipment`)).data.data,
    enabled: !!workspaceId,
  });
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['burial-equipment-bookings', workspaceId],
    queryFn: async () => (await api.get(`/burial-chama/chama/${workspaceId}/equipment-bookings`)).data.data,
    enabled: !!workspaceId,
  });
  const refreshEquipment = () => {
    queryClient.invalidateQueries({ queryKey: ['burial-equipment', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['burial-equipment-bookings', workspaceId] });
  };
  const createEquipment = useMutation({ mutationFn: (payload) => api.post(`/burial-chama/chama/${workspaceId}/equipment`, payload), onSuccess: refreshEquipment, onError: (error) => toast.error(error.response?.data?.message || 'Could not save equipment') });
  const createBooking = useMutation({ mutationFn: (payload) => api.post(`/burial-chama/chama/${workspaceId}/equipment-bookings`, payload), onSuccess: refreshEquipment, onError: (error) => toast.error(error.response?.data?.message || 'Could not save booking') });
  const returnBooking = useMutation({ mutationFn: (bookingId) => api.post(`/burial-chama/equipment-bookings/${bookingId}/return`, {}), onSuccess: refreshEquipment, onError: (error) => toast.error(error.response?.data?.message || 'Could not record equipment return') });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ name: '', quantity: 1, daily_rate: '', deposit_amount: 0, description: '' });
  const [formData, setFormData] = useState({
    equipment_id: '',
    hirer: '',
    phone: '',
    eventDate: '',
    days: 1,
    amount: '',
    payment_method: 'unpaid',
    payment_reference: '',
  });

  const totalAssets = assets.reduce((sum, a) => sum + Number(a.quantity || 0), 0);
  const onHireCount = assets.reduce((sum, a) => sum + Number(a.on_hire || 0), 0);
  const monthKey = new Date().toISOString().slice(0, 7);
  const incomeThisMonth = bookings.filter((b) => String(b.createdAt || '').slice(0, 7) === monthKey && b.payment_method !== 'unpaid').reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.hirer || !formData.eventDate || !formData.amount) {
      toast.error('Please fill in hirer, event date and amount');
      return;
    }
    createBooking.mutate({ ...formData, amount: Number(formData.amount), days: Number(formData.days) || 1 }, { onSuccess: () => { toast.success('Hire booking saved'); setIsFormOpen(false); setFormData({ equipment_id: '', hirer: '', phone: '', eventDate: '', days: 1, amount: '', payment_method: 'unpaid', payment_reference: '' }); } });
  };

  const markReturned = (id) => returnBooking.mutate(id, { onSuccess: () => toast.success('Equipment return recorded') });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tent className="w-6 h-6 text-primary" />
            Equipment & Tent Hire
          </h1>
          <p className="text-gray-600">
            Turn chama assets into income — hire out tents, chairs, cooking gear and PA
            systems for funerals and community events.
          </p>
        </div>
        <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setIsAssetFormOpen(true)}><Plus className="mr-2 h-4 w-4" />Add equipment</Button>
        <Button onClick={() => setIsFormOpen(true)} disabled={!assets.length}>
          <Plus className="w-4 h-4 mr-2" />
          Record Hire
        </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Hireable Assets" value={totalAssets} icon={PackageCheck} color="primary" />
        <StatCard title="Currently On Hire" value={onHireCount} icon={PackageX} color="warning" />
        <StatCard
          title="Income (This Month)"
          value={`KES ${incomeThisMonth.toLocaleString()}`}
          icon={Wallet}
          color="success"
        />
      </div>

      <Dialog open={isAssetFormOpen} onClose={() => setIsAssetFormOpen(false)} title="Add hireable equipment" description="Add an item to the burial chama’s hire inventory and set the quantity and daily charge." icon={PackageCheck}>
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); createEquipment.mutate({ ...assetForm, quantity: Number(assetForm.quantity), daily_rate: Number(assetForm.daily_rate), deposit_amount: Number(assetForm.deposit_amount) }, { onSuccess: () => { toast.success('Equipment saved'); setIsAssetFormOpen(false); setAssetForm({ name: '', quantity: 1, daily_rate: '', deposit_amount: 0, description: '' }); } }); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="equipmentName">Equipment name</Label><Input id="equipmentName" placeholder="e.g. 40-seater tent" required value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} /></div>
            <div><Label htmlFor="equipmentQuantity">Quantity owned</Label><Input id="equipmentQuantity" type="number" min="1" step="1" required value={assetForm.quantity} onChange={(event) => setAssetForm({ ...assetForm, quantity: event.target.value })} /></div>
            <div><Label htmlFor="equipmentRate">Daily hire rate (KES)</Label><Input id="equipmentRate" type="number" min="0" step="0.01" required value={assetForm.daily_rate} onChange={(event) => setAssetForm({ ...assetForm, daily_rate: event.target.value })} /></div>
            <div><Label htmlFor="equipmentDeposit">Refundable deposit (KES)</Label><Input id="equipmentDeposit" type="number" min="0" step="0.01" value={assetForm.deposit_amount} onChange={(event) => setAssetForm({ ...assetForm, deposit_amount: event.target.value })} /></div>
            <div><Label htmlFor="equipmentDescription">Description</Label><Input id="equipmentDescription" placeholder="Condition, size or notes" value={assetForm.description} onChange={(event) => setAssetForm({ ...assetForm, description: event.target.value })} /></div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-obsidian-border"><Button type="button" variant="secondary" onClick={() => setIsAssetFormOpen(false)}>Cancel</Button><Button type="submit" disabled={createEquipment.isPending}>{createEquipment.isPending ? 'Saving…' : 'Save equipment'}</Button></div>
        </form>
      </Dialog>

      <Dialog open={isFormOpen} onClose={() => setIsFormOpen(false)} title="Record a hire booking" description="Choose equipment and dates. Availability is checked against other bookings before saving." icon={Tent} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="asset">Asset</Label>
                <select
                  id="asset"
                  required
                  value={formData.equipment_id}
                  onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                >
                  <option value="">Select equipment</option>
                  {assets.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} · {a.available_quantity} available
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="hirer">Hirer Name</Label>
                  <Input
                    id="hirer"
                    value={formData.hirer}
                    onChange={(e) => setFormData({ ...formData, hirer: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="07xx xxx xxx"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="eventDate">Event Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="days">Days</Label>
                  <Input
                    id="days"
                    type="number"
                    min="1"
                    value={formData.days}
                    onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount (KES)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <select
                  id="paymentMethod"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                >
                  <option value="unpaid">Not yet paid</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div>
                <Label htmlFor="paymentReference">Payment Reference</Label>
                <Input id="paymentReference" value={formData.payment_reference} onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })} placeholder="M-Pesa receipt or bank reference" />
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-obsidian-border">
                <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createBooking.isPending}>{createBooking.isPending ? 'Saving…' : 'Save Booking'}</Button>
              </div>
            </form>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>What the chama owns and can hire out</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Qty</th>
                <th className="py-2 pr-4">On Hire</th>
                <th className="py-2 pr-4">Daily Rate</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a._id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{a.name}</td>
                  <td className="py-2 pr-4">{a.quantity}</td>
                  <td className="py-2 pr-4">{a.on_hire || 0}</td>
                  <td className="py-2 pr-4">KES {Number(a.daily_rate || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
          <CardDescription>Hires recorded for members and the community</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Asset</th>
                <th className="py-2 pr-4">Hirer</th>
                <th className="py-2 pr-4">Event Date</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{b.equipment_id?.name || 'Equipment'}</td>
                  <td className="py-2 pr-4">
                    <div>{b.hirer_name}</div>
                    {b.hirer_phone && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {b.hirer_phone}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">{new Date(b.event_date).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">KES {Number(b.amount).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_STYLES[b.status] || STATUS_STYLES.confirmed
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {b.status !== 'returned' && (
                      <button
                        onClick={() => markReturned(b._id)}
                        className="text-xs text-primary hover:underline"
                      >
                        Mark returned
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No bookings yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
