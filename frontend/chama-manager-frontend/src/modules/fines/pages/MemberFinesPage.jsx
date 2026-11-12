import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, HandCoins, Loader2 } from "lucide-react";
import finesApi from "../api/fines.api";
import MpesaStkModal from "@/modules/finance/components/MpesaStkModal";
import { money, formatDate } from "@/modules/finance/components/FinanceUi";

export default function MemberFinesPage() {
  const { workspaceId } = useParams();
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fineToPay, setFineToPay] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await finesApi.list(workspaceId);
      setFines(result?.data?.data?.fines || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load your fines.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const outstanding = fines.filter((fine) => fine.status === "outstanding");
  const totalDue = outstanding.reduce((sum, fine) => sum + Number(fine.outstanding ?? fine.amount ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      <header className="rounded-3xl bg-emerald-800 p-6 text-white">
        <div className="flex items-center gap-3"><HandCoins size={22} /><div><h1 className="text-2xl font-black">My fines</h1><p className="mt-1 text-sm text-emerald-100">Review your fine history and pay outstanding balances through Money.</p></div></div>
        <p className="mt-5 text-sm font-semibold">Outstanding balance <span className="ml-2 text-xl font-black">{money(totalDue)}</span></p>
      </header>

      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-700" /></div> : fines.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-obsidian-border dark:bg-obsidian-card"><CheckCircle2 className="mx-auto mb-3 text-emerald-600" /><h2 className="font-bold">No fines recorded</h2><p className="mt-1 text-sm text-slate-500">Any fines issued to you will appear here.</p></div>
      ) : (
        <div className="space-y-3">{fines.map((fine) => {
          const balance = Number(fine.outstanding ?? fine.amount ?? 0);
          return <article key={fine.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-obsidian-border dark:bg-obsidian-card">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${fine.status === "outstanding" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}><AlertCircle size={18} /></span>
            <div className="min-w-0 flex-1"><h2 className="font-bold">{fine.reason}</h2><p className="mt-1 text-xs text-slate-500">{fine.dueDate ? `Due ${formatDate(fine.dueDate)}` : "No due date"}{fine.paidAmount > 0 ? ` · ${money(fine.paidAmount)} paid` : ""}</p></div>
            <div className="text-right"><p className="font-bold">{money(balance)}</p><p className="text-xs capitalize text-slate-500">{fine.status}</p></div>
            {fine.status === "outstanding" && fine.obligationId && <button type="button" onClick={() => setFineToPay(fine)} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">Pay fine</button>}
          </article>;
        })}</div>
      )}

      {fineToPay && <MpesaStkModal isOpen onClose={() => setFineToPay(null)} chamaId={workspaceId} obligationId={fineToPay.obligationId} initialAmount={fineToPay.outstanding ?? fineToPay.amount} title={`Fine payment: ${fineToPay.reason}`} onSuccess={async () => { setFineToPay(null); await load(); }} />}
    </div>
  );
}
