import { Building2, Star, Landmark, Users2 } from "lucide-react";
import { Link } from "react-router-dom";
import useWorkspace from "../../../app/hooks/useWorkspace";
import useBankAccounts from "../hooks/useBankAccounts";
import Spinner from "../../../shared/components/ui/Spinner";

// ========================================
// BANK ACCOUNTS — READ-ONLY OUTSIDE THE LEADERSHIP DESK
// ========================================
//
// This page used to let the treasurer add/edit/deactivate accounts
// right here, reachable by any logged-in member who opened the URL.
// Registering or changing where the group's money sits is a
// leadership mutation, so that capability now lives only inside the
// Leadership Desk's Treasury Oversight tab, behind the leadership PIN
// (see modules/leadership/tabs/TreasuryOversightTab.jsx). Every
// member can still see which accounts exist — just not touch them
// from here.
// ========================================

export default function BankAccountsPage() {
  const workspace = useWorkspace();
  const { workspaceId } = workspace;
  const { bankAccounts, loading } = useBankAccounts(workspaceId);

  const role = String(
    workspace?.role ||
      workspace?.membership?.role ||
      workspace?.currentWorkspace?.role ||
      workspace?.activeWorkspace?.role ||
      ""
  ).toLowerCase();
  const isTreasurer = role === "treasurer";
  const isChairperson = role === "chairperson";

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-mist">Bank Accounts</h1>
          <p className="text-slate-500 dark:text-mist-muted">
            Real-world bank accounts this chama deposits cash into.
          </p>
        </div>

        {(isTreasurer || isChairperson) && (
          <Link
            to={`/workspace/${workspaceId}/leadership?tab=treasury`}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Users2 size={16} />
            Manage in Leadership Desk
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : bankAccounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Landmark className="mx-auto mb-3 text-slate-400" size={32} />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            No bank account registered yet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {isTreasurer || isChairperson
              ? "Register one from the Leadership Desk so the treasurer can deposit cash-in-hand into it."
              : "Ask the treasurer to register one."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {bankAccounts.map((acc) => (
            <div
              key={acc._id}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                    <Building2 size={18} />
                  </span>
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{acc.bank_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{acc.account_name}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {acc.masked_account_number || acc.account_number}
                    </p>
                  </div>
                </div>
                {acc.is_primary && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    <Star size={11} />
                    Primary
                  </span>
                )}
              </div>

              {(acc.branch || acc.paybill_or_till) && (
                <div className="mt-3 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {acc.branch && <p>Branch: {acc.branch}</p>}
                  {acc.paybill_or_till && <p>Paybill/Till: {acc.paybill_or_till}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}