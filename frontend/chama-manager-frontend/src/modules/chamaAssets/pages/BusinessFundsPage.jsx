import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Building2, Info, Wallet } from "lucide-react";

import financeService from "@/modules/finance/services/finance.service";
import ReportWarnings from "@/modules/finance/components/ReportWarnings";
import BusinessFundsSeparationNotice from "@/modules/finance/components/BusinessFundsSeparationNotice";
import Spinner from "@/shared/components/ui/Spinner";
import { PERIOD_OPTIONS, periodRange } from "@/modules/finance/utils.reportPeriods";

const money = (v) => `KES ${Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const card = "rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900";

function Stat({ label, value, tone = "text-slate-900 dark:text-white", hint }) {
  return (
    <div className={card}>
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-black ${tone}`}>{money(value)}</p>
      {hint ? <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value, strong = false, tone }) {
  return (
    <div className={`flex justify-between text-xs ${strong ? "border-t border-slate-100 pt-2 text-sm font-black dark:border-slate-800" : "font-semibold text-slate-600 dark:text-slate-400"}`}>
      <span>{label}</span>
      <span className={`font-mono font-bold ${tone || "text-slate-900 dark:text-white"}`}>{money(value)}</span>
    </div>
  );
}

export default function BusinessFundsPage() {
  const { workspaceId } = useParams();
  const [period, setPeriod] = useState("This Month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    financeService
      .getBusinessFunds(workspaceId, periodRange(period))
      .then((result) => mounted && setData(result))
      .catch((err) => mounted && setError(err?.response?.data?.message || "Could not load business and property income."))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [workspaceId, period]);

  const assets = data?.assets || [];
  const holdings = data?.holdings || [];

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Business &amp; Property Income</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Money earned by chama-owned businesses and properties. Kept separate from member savings, contributions and the chama balance.
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          {PERIOD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : data ? (
        <>
          <BusinessFundsSeparationNotice workspaceId={workspaceId} pending={data.separationPending} />
          <ReportWarnings warnings={data.warnings} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Business fund balance" value={data.balance} tone={data.overdrawn ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"} hint="Cash, bank and M-Pesa held from business and property income" />
            <Stat label={`Income · ${period}`} value={data.income} />
            <Stat label={`Expenses · ${period}`} value={data.expenses} tone="text-rose-500" />
            <Stat label={`Net profit · ${period}`} value={data.netProfit} tone={data.netProfit < 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={`${card} space-y-3`}>
              <h2 className="border-b border-slate-100 pb-3 text-sm font-extrabold uppercase tracking-wider text-emerald-600 dark:border-slate-800">Income statement · {period}</h2>
              <Row label="Revenue (sales, rent, lease income)" value={data.income} />
              <Row label="Less: expenses" value={data.expenses} />
              <Row label="Net profit" value={data.netProfit} strong tone={data.netProfit < 0 ? "text-rose-600" : "text-emerald-600"} />
              <Row label="Profit paid or credited to members" value={data.distributed} />
              <Row label="Profit kept in the business" value={data.retained} strong />
            </div>

            <div className={`${card} space-y-3`}>
              <h2 className="border-b border-slate-100 pb-3 text-sm font-extrabold uppercase tracking-wider text-indigo-600 dark:border-slate-800">Balance · as at today</h2>
              {holdings.length === 0 ? (
                <p className="text-xs font-medium text-slate-500">No business money held yet.</p>
              ) : holdings.map((h) => <Row key={h.account_code} label={h.account} value={h.balance} />)}
              <Row label="Total business fund" value={data.balance} strong tone={data.overdrawn ? "text-rose-600" : undefined} />
              <Row label="Owed to members (profit not yet withdrawn)" value={data.owedToMembers} />
              <Row label="Retained profit" value={data.retainedProfit} />
            </div>
          </div>

          <div className={card}>
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-slate-400" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider">By business and property · {period}</h2>
            </div>
            {assets.length === 0 ? (
              <p className="text-xs font-medium text-slate-500">No business or property income recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                      <th className="py-2 pr-4">Business / property</th>
                      <th className="py-2 pr-4 text-right">Income</th>
                      <th className="py-2 pr-4 text-right">Expenses</th>
                      <th className="py-2 pr-4 text-right">Net profit</th>
                      <th className="py-2 pr-4 text-right">Paid to members</th>
                      <th className="py-2 text-right">Holds now</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono font-semibold">
                    {assets.map((a) => (
                      <tr key={a.assetId || a.name} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                        <td className="py-2.5 pr-4 font-sans font-bold">{a.name}</td>
                        <td className="py-2.5 pr-4 text-right">{money(a.income)}</td>
                        <td className="py-2.5 pr-4 text-right">{money(a.expenses)}</td>
                        <td className={`py-2.5 pr-4 text-right ${a.netProfit < 0 ? "text-rose-600" : ""}`}>{money(a.netProfit)}</td>
                        <td className="py-2.5 pr-4 text-right">{money(a.distributed)}</td>
                        <td className="py-2.5 text-right">{money(a.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              These figures are not included in the chama's cash balance, member savings or contributions. To pay profit to members, use a profit distribution on the business or property.
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
