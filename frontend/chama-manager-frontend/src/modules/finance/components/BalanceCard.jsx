const formatKES = (value) => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safe);
};

export default function BalanceCard({ title, value, amount }) {
  const val = amount ?? value; // support both prop names
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-obsidian-border dark:bg-obsidian-card">
      <p className="text-sm text-slate-500 dark:text-mist-muted">{title}</p>
      <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-mist">{formatKES(val)}</h2>
    </div>
  );
}