import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import financeService from "../services/finance.service";
import { Download, CheckCircle2, AlertTriangle, Calendar } from "lucide-react";
import Spinner from "@/shared/components/ui/Spinner";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function TrialBalancePage() {
  const { workspaceId } = useParams();
  const [asAtDate, setAsAtDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await financeService.getReport(workspaceId, "TRIAL_BALANCE", "CHAMA", asAtDate);
        if (mounted) setReportData(data);
      } catch (err) {
        console.error("Failed to fetch Trial Balance report:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (workspaceId) {
      fetchReport();
    }
    return () => { mounted = false; };
  }, [workspaceId, asAtDate]);

  const items = reportData?.items || reportData?.accounts || [];
  const totalDebit = Number(reportData?.totalDebit || reportData?.total_debit || items.reduce((a, b) => a + Number(b.debit || 0), 0));
  const totalCredit = Number(reportData?.totalCredit || reportData?.total_credit || items.reduce((a, b) => a + Number(b.credit || 0), 0));
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01;

  const handleExportCsv = () => {
    let csvRows = "Account Code,Account Name,Debit (KES),Credit (KES)\n";
    items.forEach((item) => {
      csvRows += `"${item.code || ''}","${item.account || item.name}",${item.debit || 0},${item.credit || 0}\n`;
    });
    csvRows += `TOTAL,TOTAL,${totalDebit},${totalCredit}\n`;

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Trial_Balance_${asAtDate}.csv`);
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
            Trial Balance
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Unadjusted trial balance as at {asAtDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={asAtDate}
              onChange={(e) => setAsAtDate(e.target.value)}
              className="bg-transparent focus:outline-none"
            />
          </div>
          <button onClick={handleExportCsv} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Download size={16} className="text-slate-400" /> Export CSV
          </button>
        </div>
      </div>

      {/* Audit Parity Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Debits Total</span>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white font-mono">{money(totalDebit)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Credits Total</span>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white font-mono">{money(totalCredit)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Ledger Status</span>
          <div className="mt-2 flex items-center gap-2">
            {isBalanced ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 size={16} /> Balanced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-4 py-1.5 text-xs font-black text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                <AlertTriangle size={16} /> Imbalanced ({money(difference)})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trial Balance Detailed Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-6 py-4">ACCOUNT CODE</th>
                <th className="px-6 py-4">ACCOUNT NAME</th>
                <th className="px-6 py-4 text-right">DEBIT (KES)</th>
                <th className="px-6 py-4 text-right">CREDIT (KES)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
              {items.length > 0 ? (
                items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-mono font-bold">{row.code || `100${idx + 1}`}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{row.account || row.name}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">{row.debit > 0 ? money(row.debit) : "-"}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">{row.credit > 0 ? money(row.credit) : "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-400 font-medium">
                    No trial balance items calculated for this period.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50/80 font-black text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <tr>
                <td colSpan="2" className="px-6 py-4 uppercase tracking-wider">Total Audit Balance</td>
                <td className="px-6 py-4 text-right font-mono text-indigo-600 dark:text-indigo-400">{money(totalDebit)}</td>
                <td className="px-6 py-4 text-right font-mono text-indigo-600 dark:text-indigo-400">{money(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}