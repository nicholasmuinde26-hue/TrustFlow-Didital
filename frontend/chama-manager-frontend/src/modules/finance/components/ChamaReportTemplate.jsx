import React from "react";
import { UserCheck, Coins, CheckCircle2 } from "lucide-react";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function ChamaReportTemplate({
  reportType, // 'TRIAL_BALANCE' | 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW'
  data = {},
  asAtDate = new Date().toISOString().slice(0, 10),
  workspaceName = "TAWAKAL CHAMA",
}) {
  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 print:text-black font-sans">
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
                {(data.items || defaultChamaTrialBalance).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                      {item.account}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 print:text-black">
                      {item.debit > 0 ? money(item.debit) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sky-600 dark:text-sky-400 print:text-black">
                      {item.credit > 0 ? money(item.credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 font-black text-base print:border-black print:bg-white">
                <tr>
                  <td className="py-4 px-4 uppercase text-slate-900 dark:text-white print:text-black">TOTAL (JUMLA)</td>
                  <td className="py-4 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 print:text-black">
                    {money(data.totalDebit || 105000)}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-sky-600 dark:text-sky-400 print:text-black">
                    {money(data.totalCredit || 105000)}
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
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.contributions ?? 120000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300">Faini na Penalties</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.fines ?? 5000)}</span>
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3 font-bold text-sm text-emerald-700 dark:text-emerald-400">
                <span>JUMLA MAPATO (Total Income)</span>
                <span className="font-mono">{money(data.totalIncome ?? ((data.contributions ?? 120000) + (data.fines ?? 5000)))}</span>
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
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.mgrPayouts ?? 90000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300">Admin & Mkutano Costs</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.adminCosts ?? 3000)}</span>
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3 font-bold text-sm text-rose-600 dark:text-rose-400">
                <span>JUMLA MATUMIZI (Total Expenses)</span>
                <span className="font-mono">{money(data.totalExpenses ?? ((data.mgrPayouts ?? 90000) + (data.adminCosts ?? 3000)))}</span>
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
                {money(data.surplus ?? 32000)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {reportType === "BALANCE SHEET" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6 print:border-none print:bg-white print:p-0">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
              BALANCE SHEET — TAARIFA YA FEDHA
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">What the Chama owns vs what is owed to members.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Mali / ASSETS */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50 space-y-3 print:border-black">
              <h3 className="text-sm font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">Mali / ASSETS</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Bank + M-Pesa Till</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.cashBank ?? 75000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Madeni ya Mikopo (Loans)</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.loansReceivable ?? 20000)}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between font-bold text-sm text-sky-700 dark:text-sky-400">
                <span>JUMLA MALI</span>
                <span className="font-mono">{money(data.totalAssets ?? 95000)}</span>
              </div>
            </div>

            {/* Madeni / LIABILITIES */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50 space-y-3 print:border-black">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Madeni / LIABILITIES</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">MGR Inayokuja (Payouts Due)</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.payoutsDue ?? 30000)}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between font-bold text-sm text-amber-700 dark:text-amber-400">
                <span>JUMLA MADENI</span>
                <span className="font-mono">{money(data.totalLiabilities ?? 30000)}</span>
              </div>
            </div>

            {/* Mtaji / MEMBERS FUNDS */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50 space-y-3 print:border-black">
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Mtaji / MEMBERS FUNDS
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Mchango + Cumulative Surplus</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.membersFunds ?? 65000)}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between font-bold text-sm text-emerald-700 dark:text-emerald-400">
                <span>JUMLA MTAJI</span>
                <span className="font-mono">{money(data.membersFunds ?? 65000)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <strong className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">{money(data.cashIn ?? 120000)}</strong>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Cash Out (MGR + Admin)</span>
                <strong className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">{money(data.cashOut ?? 93000)}</strong>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Net Cash Movement</span>
                <strong className="text-xl font-black font-mono text-sky-600 dark:text-sky-400">
                  {data.netCashMovement >= 0 ? `+ KES ${Number(data.netCashMovement ?? 27000).toLocaleString()}` : `- KES ${Math.abs(data.netCashMovement).toLocaleString()}`}
                </strong>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/80 flex justify-between text-sm">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Opening Balance: {money(data.openingBalance ?? 48000)}</span>
              <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">Closing Balance: {money(data.closingBalance ?? 75000)}</strong>
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
