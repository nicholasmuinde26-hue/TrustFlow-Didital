import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import payoutService from "../services/payout.service";
import mgrApi from "@/modules/chama/api/mgr.api";
import Button from "@/shared/components/ui/Button";
import { X, ShieldCheck, ArrowRight, RotateCw } from "lucide-react";

export default function CreatePayoutPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mgrOverview, setMgrOverview] = useState(null);
  const [checkingMgr, setCheckingMgr] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    mgrApi.getOverview(workspaceId)
      .then(res => setMgrOverview(res.data?.data))
      .catch(() => {})
      .finally(() => setCheckingMgr(false));
  }, [workspaceId]);

  async function startPayout() {
    setLoading(true); setError("");
    try {
      await payoutService.start(workspaceId);
      navigate(`/workspace/${workspaceId}/finance/payouts`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to start the payout.");
    } finally { setLoading(false); }
  }

  if (mgrOverview?.hasPolicy) {
    return (
      <div className="space-y-6 max-w-xl mx-auto py-8 font-sans">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8 text-slate-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-white space-y-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2 className="text-xl font-black">Governed MGR Policy Active</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              This Chama uses an active Merry-Go-Round rotation policy. All rotational payouts are strictly governed through the MGR Command Center with rotation ordering, approval signoffs, and automatic double-entry accounting.
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 p-4 border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1">
            <p className="font-bold text-slate-800 dark:text-slate-200">Current Round #{mgrOverview.currentRound?.round_number || 1}</p>
            <p className="text-slate-500">Recipient: <b className="text-slate-800 dark:text-slate-200">{mgrOverview.currentRound?.recipient_id?.user_id?.name || "Recipient"}</b></p>
            <p className="text-slate-500">Target Pool: <b className="text-slate-800 dark:text-slate-200">KES {Number(mgrOverview.currentRound?.expected_amount || 0).toLocaleString()}</b></p>
          </div>
          <div className="flex gap-3 pt-2">
            <Link
              to={`/workspace/${workspaceId}/mgr`}
              className="flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-xs font-black text-white shadow-md hover:bg-amber-700 transition"
            >
              <RotateCw size={15} /> Open MGR Command Center <ArrowRight size={15} />
            </Link>
            <button
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Create General Payout
          </h1>
          <p className="text-slate-500 text-xs mt-1">Start the next rotational payout. The finance engine selects the eligible member and creates a pending payout.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200">{error}</p>}
      <Button onClick={startPayout} disabled={loading || checkingMgr}>{loading ? "Starting..." : "Start Next Payout"}</Button>
    </div>
  );
}
