import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark, Plus } from "lucide-react";
import useWorkspace from "../../../app/hooks/useWorkspace";
import useReconciliationSessions from "../hooks/useReconciliationSessions";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import CreateReconciliationSessionModal from "../components/CreateReconciliationSessionModal";
import { Card, SectionHeading, StatusPill, EmptyState, formatDate, money } from "../components/FinanceUi";
import Spinner from "../../../shared/components/ui/Spinner";

export default function ReconciliationPage() {
  const workspace = useWorkspace();
  const { workspaceId } = workspace;
  const navigate = useNavigate();
  const { sessions, loading, refetch } = useReconciliationSessions(workspaceId);
  const { role } = useWorkspacePermissions(workspaceId);
  const [isModalOpen, setModalOpen] = useState(false);

  const isTreasurer = role === "treasurer";

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-mist">Bank Reconciliation</h1>
          <p className="text-slate-500 dark:text-mist-muted">
            Match the bank statement against posted ledger entries, one period at a time.
          </p>
        </div>

        {isTreasurer && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus size={16} />
            Start Session
          </button>
        )}
      </div>

      <Card className="p-5">
        <SectionHeading title="Sessions" subtitle={`${sessions.length} total`} />

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No reconciliation sessions yet"
            description={
              isTreasurer
                ? "Start one for the latest bank statement period."
                : "The treasurer can start one for the latest bank statement period."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:border-obsidian-border">
                  <th className="py-2 pr-3">Bank account</th>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3">Opening</th>
                  <th className="py-2 pr-3">Closing</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s._id}
                    onClick={() => navigate(`/workspace/${workspaceId}/finance/reconciliation/${s._id}`)}
                    className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/60 dark:border-obsidian-border/60 dark:hover:bg-obsidian-raised/40"
                  >
                    <td className="py-3 pr-3 font-semibold text-slate-800 dark:text-mist">
                      {s.bank_account_id?.bank_name
                        ? `${s.bank_account_id.bank_name} — ${s.bank_account_id.account_name}`
                        : "Bank account"}
                    </td>
                    <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">
                      {formatDate(s.period_start)} – {formatDate(s.period_end)}
                    </td>
                    <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">{money(s.opening_balance)}</td>
                    <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">{money(s.closing_balance)}</td>
                    <td className="py-3 pr-3">
                      <StatusPill status={s.status === "completed" ? "completed" : "pending"}>
                        {s.status === "completed" ? "Completed" : "In progress"}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateReconciliationSessionModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        workspaceId={workspaceId}
        onCreated={(session) => {
          setModalOpen(false);
          refetch();
          if (session?._id) {
            navigate(`/workspace/${workspaceId}/finance/reconciliation/${session._id}`);
          }
        }}
      />
    </div>
  );
}
