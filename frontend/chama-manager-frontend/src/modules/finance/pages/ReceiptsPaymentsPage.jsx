import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import financeService from "../services/finance.service";
import Spinner from "@/shared/components/ui/Spinner";
import ReportWarnings from "../components/ReportWarnings";
import { periodRange, PERIOD_OPTIONS } from "../utils.reportPeriods";

const money = (val) => `KES ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function Side({ title, tone, groups, total, totalLabel }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:border-black print:shadow-none">
      <h2 className={`border-b border-slate-100 pb-3 text-sm font-extrabold uppercase tracking-wider dark:border-slate-800 ${tone}`}>{title}</h2>
      <div className="mt-4 space-y-5 text-xs font-semibold">
        {groups.length === 0 && <p className="text-slate-400">Nothing recorded in this period.</p>}
        {groups.map((g) => (
          <div key={g.group}>
            <div className="flex justify-between font-black text-slate-900 dark:text-white">
              <span>{g.group}</span>
              <span className="font-mono">{money(g.total)}</span>
            </div>
            {g.lines.length > 1 && (
              <div className="mt-1.5 space-y-1 pl-4 text-slate-500 dark:text-slate-400">
                {g.lines.map((l) => (
                  <div key={l.label} className="flex justify-between">
                    <span>{l.label}</span>
                    <span className="font-mono">{money(l.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="flex justify-between border-t-2 border-slate-200 pt-3 text-sm font-black text-slate-900 dark:border-slate-700 dark:text-white">
          <span>{totalLabel}</span>
          <span className="font-mono">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ReceiptsPaymentsPage() {
  const { workspaceId } = useParams();
  const [period, setPeriod] = useState("This Month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const range = period === "Custom" ? custom : periodRange(period);
  const ready = Boolean(range.from && range.to);

  useEffect(() => {
    if (!workspaceId || !ready) return undefined;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await financeService.getReport(workspaceId, "RECEIPTS_PAYMENTS", "CHAMA", { from: range.from, to: range.to });
        if (mounted) setReport(data);
      } catch (err) {
        console.error("Failed to fetch Receipts & Payments:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, period, custom.from, custom.to]);

  const receipts = report?.receipts || [];
  const payments = report?.payments || [];

  const exportCsv = () => {
    const rows = [["Section", "Item", "Amount (KES)"]];
    rows.push(["Opening balance", "Cash at start of period", report?.openingBalance ?? 0]);
    receipts.forEach((g) => g.lines.forEach((l) => rows.push(["Receipts", `${g.group}: ${l.label}`, l.amount])));
    rows.push(["Receipts", "TOTAL RECEIPTS", report?.totalReceipts ?? 0]);
    payments.forEach((g) => g.lines.forEach((l) => rows.push(["Payments", `${g.group}: ${l.label}`, l.amount])));
    rows.push(["Payments", "TOTAL PAYMENTS", report?.totalPayments ?? 0]);
    rows.push(["Closing balance", "Cash at end of period", report?.closingBalance ?? 0]);
    (report?.holdings || []).forEach((h) => rows.push(["Cash held", h.account, h.closing]));

    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `Receipts_and_Payments_${range.from}_to_${range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Receipts &amp; Payments
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Mapato na Matumizi{ready ? `, ${range.from} to ${range.to}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            {PERIOD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="Custom">Custom range</option>
          </select>
          {period === "Custom" && (
            <>
              <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900" />
              <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900" />
            </>
          )}
          <button onClick={exportCsv} disabled={!report} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <Download size={16} className="text-slate-400" /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <Printer size={16} className="text-slate-400" /> Print
          </button>
        </div>
      </div>

      {!ready && <p className="text-xs font-semibold text-slate-500">Choose a start and end date.</p>}
      {loading && <Spinner fullscreen />}

      {ready && !loading && report && (
        <>
          <ReportWarnings warnings={report.warnings} />

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Cash at start", report.openingBalance],
              ["Net movement", report.netMovement],
              ["Cash at end", report.closingBalance],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:border-black print:shadow-none">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{label}</span>
                <p className="mt-2 font-mono text-2xl font-black">{money(value)}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Side title="Receipts / Mapato" tone="text-emerald-600" groups={receipts} total={report.totalReceipts} totalLabel="Total receipts" />
            <Side title="Payments / Matumizi" tone="text-rose-500" groups={payments} total={report.totalPayments} totalLabel="Total payments" />
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:border-black print:shadow-none">
            <h2 className="border-b border-slate-100 pb-3 text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:text-slate-200">
              Where the cash is
            </h2>
            <div className="mt-4 space-y-2 text-xs font-semibold">
              <div className="grid grid-cols-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <span>Account</span><span className="text-right">Start</span><span className="text-right">End</span>
              </div>
              {(report.holdings || []).length === 0 && <p className="text-slate-400">No cash, bank or M-Pesa balances.</p>}
              {(report.holdings || []).map((h) => (
                <div key={h.account_code || h.account} className="grid grid-cols-3 text-slate-600 dark:text-slate-300">
                  <span>{h.account}</span>
                  <span className="text-right font-mono">{money(h.opening)}</span>
                  <span className="text-right font-mono">{money(h.closing)}</span>
                </div>
              ))}
              <div className="grid grid-cols-3 border-t-2 border-slate-200 pt-3 text-sm font-black dark:border-slate-700">
                <span>Total</span>
                <span className="text-right font-mono">{money(report.openingBalance)}</span>
                <span className="text-right font-mono">{money(report.closingBalance)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
