import React from "react";
import { Building2, Award } from "lucide-react";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function BusinessReportTemplate({
  reportType, // 'TRIAL_BALANCE' | 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW'
  data = {},
  asAtDate = new Date().toISOString().slice(0, 10),
  workspaceName = "TRUSTFLOW LTD",
}) {
  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 print:text-black font-sans">
      {reportType === "TRIAL_BALANCE" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6 print:border-none print:bg-white print:p-0">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
                TRIAL BALANCE — {workspaceName}
              </h2>
              <p className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                Standard Chart of Accounts (IFRS for SMEs / GAAP)
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">As at {asAtDate}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold print:border-black print:text-black">
                <tr>
                  <th className="py-3 px-4">Account Title</th>
                  <th className="py-3 px-4 text-right">Debit (KES)</th>
                  <th className="py-3 px-4 text-right">Credit (KES)</th>
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
                      No trial balance items found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 font-black text-base print:border-black print:bg-white">
                <tr>
                  <td className="py-4 px-4 uppercase text-slate-900 dark:text-white print:text-black">TOTAL BALANCES</td>
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
              INCOME STATEMENT (PROFIT & LOSS)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Statement of Comprehensive Income (IFRS Standard)</p>
          </div>

          <div className="space-y-4 text-sm">
            {/* Revenue */}
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-bold text-slate-900 dark:text-white">Gross Revenue / Sales</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{money(data.revenue || 0)}</span>
            </div>

            {/* COGS */}
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2 text-slate-600 dark:text-slate-300">
              <span>Cost of Goods Sold (COGS)</span>
              <span className="font-mono text-rose-600 dark:text-rose-400">({money(data.cogs || 0)})</span>
            </div>

            {/* Gross Profit */}
            <div className="flex justify-between bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl font-black text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700">
              <span>GROSS PROFIT</span>
              <span className="font-mono">{money(data.grossProfit || (Number(data.revenue || 0) - Number(data.cogs || 0)))}</span>
            </div>

            {/* Operating Expenses */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Operating Expenses (OpEx)
              </span>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 pl-4">
                <span>Salaries & Wages</span>
                <span className="font-mono">{money(data.salaries || 0)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 pl-4">
                <span>Software Licensing & Hosting</span>
                <span className="font-mono">{money(data.licensing || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-semibold text-rose-600 dark:text-rose-400">
                <span>Total Operating Expenses</span>
                <span className="font-mono">({money(data.totalOpex || 0)})</span>
              </div>
            </div>

            {/* Net Profit */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-800 dark:bg-sky-950/40 flex justify-between items-center print:border-black print:bg-white">
              <div>
                <span className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider block print:text-black">
                  NET PROFIT BEFORE TAX
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Net operating margin performance.</p>
              </div>
              <strong className="text-2xl font-black font-mono text-sky-700 dark:text-sky-400 print:text-black">
                {money(data.netProfit || 0)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {reportType === "BALANCE SHEET" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6 print:border-none print:bg-white print:p-0">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
              STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Assets = Liabilities + Shareholders' Equity</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50 space-y-3 print:border-black">
              <h3 className="text-sm font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">ASSETS</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Cash & Cash Equivalents</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.cashEquivalents || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Accounts Receivable</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.accountsReceivable || 0)}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between font-bold text-sm text-sky-700 dark:text-sky-400">
                <span>TOTAL ASSETS</span>
                <span className="font-mono">{money(data.totalAssets || 0)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50 space-y-3 print:border-black">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">LIABILITIES</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Accounts Payable</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.accountsPayable || 0)}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between font-bold text-sm text-amber-700 dark:text-amber-400">
                <span>TOTAL LIABILITIES</span>
                <span className="font-mono">{money(data.totalLiabilities || 0)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50 space-y-3 print:border-black">
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">SHAREHOLDERS' EQUITY</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Share Capital</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.shareCapital || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Retained Earnings</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{money(data.retainedEarnings || 0)}</span>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between font-bold text-sm text-emerald-700 dark:text-emerald-400">
                <span>TOTAL EQUITY</span>
                <span className="font-mono">{money(data.totalEquity || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === "CASH_FLOW" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6 print:border-none print:bg-white print:p-0">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
              STATEMENT OF CASH FLOWS (IFRS 3-TIER)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Operating, Investing, and Financing Cash Flows</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-2">
              <h3 className="font-bold text-emerald-700 dark:text-emerald-400 uppercase">1. Cash Flow from Operating Activities</h3>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Cash Receipts from Customers</span>
                <span className="font-mono">{money(data.operatingReceipts || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Cash Payments to Suppliers & Employees</span>
                <span className="font-mono">({money(data.operatingPayments || 0)})</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-white">
                <span>Net Cash from Operating Activities</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">{money(data.netOperating || 0)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-2">
              <h3 className="font-bold text-sky-700 dark:text-sky-400 uppercase">2. Cash Flow from Investing Activities</h3>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Purchase of Equipment</span>
                <span className="font-mono">({money(data.investingOut || 0)})</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-white">
                <span>Net Cash Used in Investing Activities</span>
                <span className="font-mono text-rose-600 dark:text-rose-400">({money(data.netInvesting ? Math.abs(data.netInvesting) : 0)})</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-2">
              <h3 className="font-bold text-purple-700 dark:text-purple-400 uppercase">3. Cash Flow from Financing Activities</h3>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Issuance of Share Capital</span>
                <span className="font-mono">{money(data.financingIn || 0)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-white">
                <span>Net Cash from Financing Activities</span>
                <span className="font-mono text-purple-700 dark:text-purple-400">{money(data.netFinancing || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Corporate Audit Seals */}
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-6 print:border-black print:bg-white">
        <div className="flex items-center gap-3">
          <Award className="h-6 w-6 text-sky-600 dark:text-sky-400" />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block uppercase print:text-black">
              IFRS & KRA Compliance Sign-off
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Verified by Chief Executive Officer & Corporate Accountant</p>
          </div>
        </div>
        <div className="flex items-center gap-8 text-xs font-mono">
          <div className="text-center border-t border-slate-300 dark:border-slate-700 pt-2 px-4 print:border-black">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">CEO SIGNATURE</span>
            <strong className="text-slate-900 dark:text-white print:text-black">Approved Director</strong>
          </div>
          <div className="text-center border-t border-slate-300 dark:border-slate-700 pt-2 px-4 print:border-black">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">ACCOUNTANT SIGNATURE</span>
            <strong className="text-slate-900 dark:text-white print:text-black">Certified CPA(K)</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

const defaultBusinessTrialBalance = [
  { account: "Subscription & Sales Revenue", debit: 0, credit: 500000 },
  { account: "Salaries & Wages Expense", debit: 200000, credit: 0 },
  { account: "Software License & Hosting", debit: 50000, credit: 0 },
  { account: "Accounts Receivable", debit: 100000, credit: 0 },
  { account: "Share Capital & Reserves", debit: 0, credit: 1000000 },
  { account: "Cash & Bank Balance", debit: 1150000, credit: 0 },
];
