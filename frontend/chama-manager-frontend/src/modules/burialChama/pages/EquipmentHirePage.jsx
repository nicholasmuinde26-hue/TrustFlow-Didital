import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Card from '@/shared/components/ui/Card/Card';
import CardContent from '@/shared/components/ui/Card/CardContent';
import CardHeader from '@/shared/components/ui/Card/CardHeader';
import Button from '@/shared/components/ui/Button/Button';
import Input from '@/shared/components/ui/Input/Input';
import StatCard from '@/shared/components/ui/StatCard/StatCard';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Tent,
  Wallet,
  PackageCheck,
  PackageX,
  Phone,
  Sparkles,
} from 'lucide-react';

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

// Seed inventory — a typical burial chama's hireable assets in the
// Kenyan context: tents, chairs, cooking gear, and PA systems are the
// classic income-generating "side hustle" for welfare/burial groups.
const SEED_ASSETS = [
  { id: 'a1', name: 'Canvas Tent (40-seater)', quantity: 3, dailyRate: 3000, onHire: 1 },
  { id: 'a2', name: 'Plastic Chairs', quantity: 200, dailyRate: 20, onHire: 60 },
  { id: 'a3', name: 'Cooking Sufurias (Large)', quantity: 10, dailyRate: 300, onHire: 0 },
  { id: 'a4', name: 'PA System & Speakers', quantity: 2, dailyRate: 2500, onHire: 0 },
  { id: 'a5', name: 'Plastic Water Tank (1000L)', quantity: 4, dailyRate: 800, onHire: 1 },
];

const SEED_BOOKINGS = [
  {
    id: 'b1',
    asset: 'Canvas Tent (40-seater)',
    hirer: 'Peter Kamau',
    phone: '0722 000 111',
    eventDate: '2026-09-12',
    days: 2,
    amount: 6000,
    paymentMethod: 'mpesa',
    status: 'confirmed',
  },
  {
    id: 'b2',
    asset: 'Plastic Chairs (60)',
    hirer: 'Grace Wanjiru',
    phone: '0733 222 444',
    eventDate: '2026-09-05',
    days: 1,
    amount: 1200,
    paymentMethod: 'cash',
    status: 'returned',
  },
];

const STATUS_STYLES = {
  confirmed: 'bg-blue-100 text-blue-700',
  returned: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function EquipmentHirePage() {
  const { workspaceId } = useParams(); // eslint-disable-line no-unused-vars
  const [assets] = useState(SEED_ASSETS);
  const [bookings, setBookings] = useState(SEED_BOOKINGS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    asset: assets[0]?.name || '',
    hirer: '',
    phone: '',
    eventDate: '',
    days: 1,
    amount: '',
    paymentMethod: 'mpesa',
  });

  const totalAssets = assets.reduce((sum, a) => sum + a.quantity, 0);
  const onHireCount = assets.reduce((sum, a) => sum + a.onHire, 0);
  const incomeThisMonth = bookings.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.hirer || !formData.eventDate || !formData.amount) {
      toast.error('Please fill in hirer, event date and amount');
      return;
    }
    setBookings((prev) => [
      {
        id: `b${prev.length + 1}`,
        asset: formData.asset,
        hirer: formData.hirer,
        phone: formData.phone,
        eventDate: formData.eventDate,
        days: Number(formData.days) || 1,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod,
        status: 'confirmed',
      },
      ...prev,
    ]);
    toast.success('Booking recorded (demo only — not yet saved to the server)');
    setIsFormOpen(false);
    setFormData({
      asset: assets[0]?.name || '',
      hirer: '',
      phone: '',
      eventDate: '',
      days: 1,
      amount: '',
      paymentMethod: 'mpesa',
    });
  };

  const markReturned = (id) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'returned' } : b)));
  };

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
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Record Hire
        </Button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          This is an early preview of the income-generating module. The figures below are
          sample data — bookings you add here stay on this screen until it's wired up to the
          backend.
        </p>
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

      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Record a Hire Booking</CardTitle>
            <CardDescription>Log who's hiring what, and when it's due back</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="asset">Asset</Label>
                <select
                  id="asset"
                  value={formData.asset}
                  onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-3 gap-4">
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
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="mpesa">M-Pesa</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Booking</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{a.name}</td>
                  <td className="py-2 pr-4">{a.quantity}</td>
                  <td className="py-2 pr-4">{a.onHire}</td>
                  <td className="py-2 pr-4">KES {a.dailyRate.toLocaleString()}</td>
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
                <tr key={b.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{b.asset}</td>
                  <td className="py-2 pr-4">
                    <div>{b.hirer}</div>
                    {b.phone && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {b.phone}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">{b.eventDate}</td>
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
                        onClick={() => markReturned(b.id)}
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