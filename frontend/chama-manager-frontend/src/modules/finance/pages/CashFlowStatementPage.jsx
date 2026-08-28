import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import financeService from "../services/finance.service";
import { Download, TrendingUp } from "lucide-react";
import Spinner from "@/shared/components/ui/Spinner";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function CashFlowStatementPage() {
  const { workspaceId } = useParams();
  const [period, setPeriod] = useState("This Month");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await financeService.getReport(workspaceId, "CASH_FLOW", "CHAMA", new Date().toISOString().slice(0, 10));
        if (mounted) setReportData(data);
      } catch (err) {
        console.error("Failed to fetch Cash Flow report:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (workspaceId) {
      fetchReport();
    }
    return () => { mounted = false; };
  }, [workspaceId, period]);

  // Dynamic values strictly computed from backend API response
  const cashIn = Number(reportData?.cashIn || reportData?.operatingReceipts || 0);
  const cashOut = Number(reportData?.cashOut || reportData?.operatingPayments || 0);
  const operatingCash = Number(reportData?.netOperating ?? (cashIn - cashOut));
  const investingCash = Number(reportData?.netInvesting || (reportData?.investingOut ? -Number(reportData.investingOut) : 0));
  const financingCash = Number(reportData?.netFinancing || reportData?.financingIn || 0);
  const netCashFlow = Number(reportData?.netCashMovement ?? reportData?.netCashChange ?? (operatingCash + investingCash + financingCash));

  const openingBalance = Number(reportData?.openingBalance || 0);
  const closingBalance = Number(reportData?.closingBalance || 0);

  const handleExportCsv = () => {
    let csvRows = "Cash Flow Activity,Amount (KES)\n";
    csvRows += `Cash In / Receipts,${cashIn}\n`;
    csvRows += `Cash Out / Payments,${cashOut}\n`;
    csvRows += `Net Operating Activities,${operatingCash}\n`;
    csvRows += `Net Investing Activities,${investingCash}\n`;
    csvRows += `Net Financing Activities,${financingCash}\n`;
    csvRows += `NET CASH FLOW,${netCashFlow}\n`;

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Cash_Flow_${period}.csv`);
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
            Cash Flow Statement
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Track cash flow activities for the selected period
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

      {/* Top 4 Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Net Cash Flow</span>
          <p className="mt-2 text-2xl font-black text-emerald-600 font-mono">{money(netCashFlow)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Operating Activities</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono">{money(operatingCash)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Investing Activities</span>
          <p className="mt-2 text-2xl font-black text-rose-500 font-mono">{money(investingCash)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Financing Activities</span>
          <p className="mt-2 text-2xl font-black text-indigo-600 font-mono">{money(financingCash)}</p>
        </div>
      </div>

      {/* Cash Flows Breakdown Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
            CASH FLOWS FROM OPERATING ACTIVITIES
          </h2>
          <div className="mt-4 space-y-3 text-xs font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Cash Inflow / Contributions</span><span className="font-bold text-slate-900 dark:text-white font-mono">{money(cashIn)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Less: Cash Outflow / Operating Expenses</span><span className="font-bold text-rose-500 font-mono">({money(cashOut)})</span></div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-black text-sm text-slate-900 dark:text-white">
              <span>Net Cash from Operating Activities</span><span className="font-mono text-emerald-600">{money(operatingCash)}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
            CASH FLOWS FROM INVESTING ACTIVITIES
          </h2>
          <div className="mt-4 space-y-3 text-xs font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Capital / Equipment Investments</span><span className="font-bold text-rose-500 font-mono">({money(Math.abs(investingCash))})</span></div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-black text-sm text-slate-900 dark:text-white">
              <span>Net Cash from Investing Activities</span><span className="font-mono text-rose-500">{money(investingCash)}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
            CASH FLOWS FROM FINANCING ACTIVITIES
          </h2>
          <div className="mt-4 space-y-3 text-xs font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Financing & MGR Movements</span><span className="font-bold text-slate-900 dark:text-white font-mono">{money(financingCash)}</span></div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-black text-sm text-slate-900 dark:text-white">
              <span>Net Cash from Financing Activities</span><span className="font-mono text-indigo-600">{money(financingCash)}</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-700 flex justify-between items-center font-black text-base text-slate-900 dark:text-white">
          <div>
            <span>NET INCREASE IN CASH & CASH EQUIVALENTS</span>
            <span className="block text-xs font-normal text-slate-400 mt-0.5">Opening: {money(openingBalance)} → Closing: {money(closingBalance)}</span>
          </div>
          <span className="font-mono text-emerald-600 dark:text-emerald-400">{money(netCashFlow)}</span>
        </div>
      </div>
    </div>
  );
}