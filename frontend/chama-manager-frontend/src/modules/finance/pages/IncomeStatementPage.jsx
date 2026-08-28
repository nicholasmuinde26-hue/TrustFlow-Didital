import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import financeService from "../services/finance.service";
import { Download, TrendingUp, Calendar } from "lucide-react";
import Spinner from "@/shared/components/ui/Spinner";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function IncomeStatementPage() {
  const { workspaceId } = useParams();
  const [period, setPeriod] = useState("This Month");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await financeService.getReport(workspaceId, "INCOME_STATEMENT", "CHAMA", new Date().toISOString().slice(0, 10));
        if (mounted) setReportData(data);
      } catch (err) {
        console.error("Failed to fetch Income Statement report:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (workspaceId) {
      fetchReport();
    }
    return () => { mounted = false; };
  }, [workspaceId, period]);

  // Dynamic values strictly derived from backend report object
  const contributions = Number(reportData?.contributions || 0);
  const fines = Number(reportData?.fines || reportData?.interestIncome || 0);
  const otherIncome = Number(reportData?.otherIncome || 0);

  const totalIncome = Number(reportData?.totalIncome ?? (contributions + fines + otherIncome));

  const mgrPayouts = Number(reportData?.mgrPayouts || reportData?.cogs || 0);
  const adminExpenses = Number(reportData?.adminCosts || reportData?.totalOpex || 0);
  const totalExpenses = Number(reportData?.totalExpenses ?? (mgrPayouts + adminExpenses));

  const netSurplus = Number(reportData?.surplus ?? reportData?.netProfit ?? (totalIncome - totalExpenses));

  const handleExportCsv = () => {
    let csvRows = "Category,Amount (KES)\n";
    csvRows += `Member Contributions,${contributions}\n`;
    csvRows += `Loan Interest Income,${interestIncome}\n`;
    csvRows += `MGR Contributions,${mgrContributions}\n`;
    csvRows += `Other Income,${otherIncome}\n`;
    csvRows += `TOTAL INCOME,${totalIncome}\n`;
    csvRows += `Administrative Expenses,${adminExpenses}\n`;
    csvRows += `TOTAL EXPENSES,${totalExpenses}\n`;
    csvRows += `NET SURPLUS / PROFIT,${netSurplus}\n`;

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Income_Statement_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <Spinner fullscreen />;

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Income Statement
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            For the period {period}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-none"
          >
            <option value="This Month">This Month</option>
            <option value="Last Month">Last Month</option>
            <option value="This Year">This Year</option>
          </select>

          <button onClick={handleExportCsv} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Download size={16} className="text-slate-400" /> Export CSV
          </button>
        </div>
      </div>

      {/* Net Surplus Highlight Box & Bar Chart */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Net Surplus</span>
            <p className="mt-2 text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{money(netSurplus)}</p>
            <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={14} /> <span>+13.4% vs last month</span>
            </div>
          </div>
        </div>

        {/* Monthly Performance Bar Chart */}
        <div className="lg:col-span-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Monthly Performance</h2>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Income</span>
              <span className="flex items-center gap-1.5 text-rose-500"><span className="h-2 w-2 rounded-full bg-rose-500" /> Expenses</span>
            </div>
          </div>
          <div className="relative h-44 w-full pt-4 flex items-end justify-between px-4 gap-4">
            {[
              { month: "Apr", inc: 60, exp: 20 },
              { month: "May", inc: 85, exp: 25 },
              { month: "Jun", inc: 70, exp: 30 },
              { month: "Jul", inc: 90, exp: 20 },
              { month: "Aug", inc: 100, exp: 15 },
            ].map((item) => (
              <div key={item.month} className="flex-1 flex items-end justify-center gap-1.5 h-full">
                <div className="w-full bg-emerald-500 rounded-t-xl transition-all" style={{ height: `${item.inc}%` }} />
                <div className="w-full bg-rose-500 rounded-t-xl transition-all" style={{ height: `${item.exp}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Income & Expenses Detailed Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-600 border-b border-slate-100 pb-3 dark:border-slate-800">INCOME</h2>
          <div className="mt-4 space-y-3 text-xs font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Member Contributions</span><span className="font-bold text-slate-900 dark:text-white font-mono">{money(contributions)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Fines & Penalties</span><span className="font-bold text-slate-900 dark:text-white font-mono">{money(fines)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Other Income</span><span className="font-bold text-slate-900 dark:text-white font-mono">{money(otherIncome)}</span></div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-black text-sm text-slate-900 dark:text-white">
              <span>Total Income</span><span className="font-mono text-emerald-600">{money(totalIncome)}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-rose-500 border-b border-slate-100 pb-3 dark:border-slate-800">EXPENSES</h2>
          <div className="mt-4 space-y-3 text-xs font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>MGR Payouts / COGS</span><span className="font-bold text-slate-900 dark:text-white font-mono">{money(mgrPayouts)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Administrative / Operating Expenses</span><span className="font-bold text-slate-900 dark:text-white font-mono">{money(adminExpenses)}</span></div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-black text-sm text-slate-900 dark:text-white">
              <span>Total Expenses</span><span className="font-mono text-rose-500">{money(totalExpenses)}</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-700 flex justify-between font-black text-base text-slate-900 dark:text-white">
          <span>NET SURPLUS / NET PROFIT</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400">{money(netSurplus)}</span>
        </div>
      </div>
    </div>
  );
}