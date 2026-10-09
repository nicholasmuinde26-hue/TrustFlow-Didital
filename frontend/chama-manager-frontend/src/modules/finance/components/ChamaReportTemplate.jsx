import React from "react";
import { UserCheck, Coins, CheckCircle2 } from "lucide-react";
import ReportWarnings from "./ReportWarnings";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function ChamaReportTemplate({
  reportType, // 'TRIAL_BALANCE' | 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW'
  data = {},
  asAtDate = new Date().toISOString().slice(0, 10),
  workspaceName = "TAWAKAL CHAMA",
}) {
  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 print:text-black font-sans">
      <ReportWarnings warnings={data.warnings} />
      {/* Dynamic Report Content based on reportType */}
      {reportType === "TRIAL_BALANCE" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6 print:border-none print:bg-white print:p-0">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
                TRIAL BALANCE — {workspaceName}
              </h2>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Focus: Wanachama Contributions, Payouts, Fines & Social Fund
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">As at {asAtDate}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold print:border-black print:text-black">
                <tr>
                  <th className="py-3 px-4">Account (Akaunti ya Chama)</th>
                  <th className="py-3 px-4 text-right">Debit (Ksh)</th>
                  <th className="py-3 px-4 text-right">Credit (Ksh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-black">
                {(data.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                      {item.account || item.name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 print:text-black">
                      {item.debit > 0 ? money(item.debit) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sky-600 dark:text-sky-400 print:text-black">
                      {item.credit > 0 ? money(item.credit) : "—"}
                    </td>
                  </tr>
                ))}
                {(!data.items || data.items.length === 0) && (
                  <tr>
                    <td colSpan="3" className="py-6 text-center text-xs text-slate-400">
                      No trial balance records found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 font-black text-base print:border-black print:bg-white">
                <tr>
                  <td className="py-4 px-4 uppercase text-slate-900 dark:text-white print:text-black">TOTAL (JUMLA)</td>
                  <td className="py-4 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 print:text-black">
                    {money(data.totalDebit || 0)}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-sky-600 dark:text-sky-400 print:text-black">
                    {money(data.totalCredit || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {reportType === "INCOME_STATEMENT" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6 print:border-none print:bg-white print:p-0">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
              STATEMENT OF INCOME & EXPENDITURE — MAPATO NA MATUMIZI
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Non-accountant summary for all group members.</p>
          </div>

          <div className="space-y-6">
            {/* Mapato Section */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50 space-y-3 print:border-black">
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider print:text-black">
                Mapato (Income Received)
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300">Mchango ya Wanachama</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.contributions || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300">Faini na Penalties</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.fines || 0)}</span>
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3 font-bold text-sm text-emerald-700 dark:text-emerald-400">
                <span>JUMLA MAPATO (Total Income)</span>
                <span className="font-mono">{money(data.totalIncome || (Number(data.contributions || 0) + Number(data.fines || 0)))}</span>
              </div>
            </div>

            {/* Matumizi Section */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50 space-y-3 print:border-black">
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider print:text-black">
                Matumizi (Group Expenses)
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300">MGR Payouts</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.mgrPayouts || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300">Admin & Mkutano Costs</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.adminCosts || 0)}</span>
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3 font-bold text-sm text-rose-600 dark:text-rose-400">
                <span>JUMLA MATUMIZI (Total Expenses)</span>
                <span className="font-mono">{money(data.totalExpenses || (Number(data.mgrPayouts || 0) + Number(data.adminCosts || 0)))}</span>
              </div>
            </div>

            {/* Surplus / Zilizosalia */}
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40 flex justify-between items-center print:border-black print:bg-white">
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block print:text-black">
                  ZILIZOSALIA / NET SURPLUS
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Available reserve balance for members.</p>
              </div>
              <strong className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 print:text-black">
                {money(data.surplus || 0)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {reportType === "BALANCE_SHEET" && (() => {
        const cashBank = Number(data.cashBank || 0);
        const loansReceivable = Number(data.loansReceivable || 0);
        const otherAssets = Number(data.otherAssets || 0);
        const totalAssets = Number(data.totalAssets ?? cashBank + loansReceivable + otherAssets);

        const payoutsDue = Number(data.payoutsDue || 0);
        const totalLiabilities = Number(data.totalLiabilities ?? payoutsDue);

        const membersFunds = Number(data.membersFunds || 0);
        const totalLiabilitiesAndEquity = totalLiabilities + membersFunds;
        const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

        const Line = ({ label, value, indent }) => (
          <div className={`flex justify-between py-1 text-sm ${indent ? "pl-4" : ""}`}>
            <span className="text-slate-700 dark:text-slate-300">{label}</span>
            <span className="font-mono text-slate-900 dark:text-white">{money(value)}</span>
          </div>
        );

        const Subtotal = ({ label, value, color }) => (
          <div
            className={`flex justify-between border-t border-slate-300 dark:border-slate-700 mt-1 pt-2 text-sm font-bold ${color} print:text-black`}
          >
            <span>{label}</span>
            <span className="font-mono">{money(value)}</span>
          </div>
        );

        return (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6 print:border-none print:bg-white print:p-0">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 text-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
                {workspaceName}
              </h2>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                Balance Sheet — Taarifa ya Fedha
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">As at {asAtDate}</p>
            </div>

            <div className="max-w-xl mx-auto w-full space-y-8 print:max-w-none">
              {/* MALI / ASSETS */}
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b-2 border-slate-900 dark:border-white pb-1.5 mb-2 print:text-black print:border-black">
                  Mali / Assets
                </h3>
                <Line label="Fedha Benki + M-Pesa (Cash at Bank & M-Pesa)" value={cashBank} indent />
                <Line label="Madeni ya Mikopo (Loans Receivable)" value={loansReceivable} indent />
                {otherAssets !== 0 && <Line label="Mali Nyingine (Other Assets)" value={otherAssets} indent />}
                <Subtotal label="Jumla ya Mali / Total Assets" value={totalAssets} color="text-slate-900 dark:text-white" />
              </div>

              {/* MADENI / LIABILITIES */}
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b-2 border-slate-900 dark:border-white pb-1.5 mb-2 print:text-black print:border-black">
                  Madeni / Liabilities
                </h3>
                <Line label="MGR Inayokuja (Payouts Due to Members)" value={payoutsDue} indent />
                <Subtotal label="Jumla ya Madeni / Total Liabilities" value={totalLiabilities} color="text-slate-900 dark:text-white" />
              </div>

              {/* MTAJI / MEMBERS FUNDS */}
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b-2 border-slate-900 dark:border-white pb-1.5 mb-2 print:text-black print:border-black">
                  Mtaji / Members Funds
                </h3>
                <Line label="Mchango + Akiba Iliyobaki (Contributions + Retained Surplus)" value={membersFunds} indent />
                <Subtotal label="Jumla ya Mtaji / Total Members Funds" value={membersFunds} color="text-slate-900 dark:text-white" />
              </div>

              {/* GRAND TOTAL */}
              <div className="border-t-2 border-slate-900 dark:border-white pt-3 flex justify-between text-base font-black text-slate-900 dark:text-white print:text-black print:border-black">
                <span>Jumla ya Madeni na Mtaji / Total Liabilities &amp; Members Funds</span>
                <span className="font-mono">{money(totalLiabilitiesAndEquity)}</span>
              </div>

              {/* Balance check */}
              <div
                className={`rounded-xl border px-4 py-2 text-xs font-semibold text-center ${
                  isBalanced
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                } print:border-black print:bg-white print:text-black`}
              >
                {isBalanced
                  ? "✓ Mali = Madeni + Mtaji (Statement is balanced)"
                  : `⚠ Out of balance by ${money(Math.abs(totalAssets - totalLiabilitiesAndEquity))}`}
              </div>
            </div>
          </div>
        );
      })()}

      {reportType === "CASH_FLOW" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6 print:border-none print:bg-white print:p-0">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
              CASH FLOW — HARAKATI ZA FEDHA
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Clear member cash movements in M-Pesa & Bank.</p>
          </div>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Cash In (Mchango)</span>
                <strong className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">{money(data.cashIn || 0)}</strong>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Cash Out (MGR + Admin)</span>
                <strong className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">{money(data.cashOut || 0)}</strong>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Net Cash Movement</span>
                <strong className="text-xl font-black font-mono text-sky-600 dark:text-sky-400">
                  {Number(data.netCashMovement || 0) >= 0 ? `+ KES ${Number(data.netCashMovement || 0).toLocaleString()}` : `- KES ${Math.abs(Number(data.netCashMovement || 0)).toLocaleString()}`}
                </strong>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/80 flex justify-between text-sm">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Opening Balance: {money(data.openingBalance || 0)}</span>
              <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">Closing Balance: {money(data.closingBalance || 0)}</strong>
            </div>
          </div>
        </div>
      )}


      {/* Official Signatures Stamp */}
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-6 print:border-black print:bg-white">
        <div className="flex items-center gap-3">
          <UserCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block uppercase print:text-black">
              Chama Executive Governance Approval
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Verified by Treasurer & Chairperson</p>
          </div>
        </div>
        <div className="flex items-center gap-8 text-xs font-mono">
          <div className="text-center border-t border-slate-300 dark:border-slate-700 pt-2 px-4 print:border-black">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">CHAIRPERSON SIGNATURE</span>
            <strong className="text-slate-900 dark:text-white print:text-black">Signed & Sealed</strong>
          </div>
          <div className="text-center border-t border-slate-300 dark:border-slate-700 pt-2 px-4 print:border-black">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">TREASURER SIGNATURE</span>
            <strong className="text-slate-900 dark:text-white print:text-black">Verified Official</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

const defaultChamaTrialBalance = [
  { account: "Mchango ya Wanachama", debit: 0, credit: 120000 },
  { account: "MGR Payouts", debit: 30000, credit: 0 },
  { account: "Mfuko wa Dharura", debit: 0, credit: 15000 },
  { account: "Mpesa Till & Cash", debit: 75000, credit: 0 },
  { account: "Bank Equity / Reserves", debit: 0, credit: 60000 },
];