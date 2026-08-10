const formatKES = (value) => {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

export default function BalanceCard({ title, value, amount }) {
  const val = amount ?? value; // support both prop names
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <h2 className="mt-3 text-3xl font-bold">{formatKES(val)}</h2>
    </div>
  );
}