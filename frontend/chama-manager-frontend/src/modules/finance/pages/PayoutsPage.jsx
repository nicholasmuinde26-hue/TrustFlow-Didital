import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import payoutService from "../services/payout.service";
import Button from "@/shared/components/ui/Button";
import useWorkspace from "@/app/hooks/useWorkspace";

export default function PayoutsPage() {
  const { workspaceId } = useParams();
  const { currentWorkspace } = useWorkspace();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const role = (currentWorkspace?.role || currentWorkspace?.membership?.role || "").toLowerCase();
  const canSettlePayout = ["treasurer", "admin", "owner"].includes(role);

  async function loadPayouts() {
    try {
      setLoading(true);
      const response = await payoutService.getAll(workspaceId);
      setPayouts(response?.payouts || []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || "Unable to load payouts."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (workspaceId) {
      loadPayouts();
    }
  }, [workspaceId]);

  async function markPaid(payoutId) {
    const external_reference =
      window.prompt("M-Pesa or bank reference (optional):") || undefined;
    try {
      await payoutService.pay(workspaceId, payoutId, {
        disbursement_method: "mpesa",
        external_reference,
      });
      await loadPayouts();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || "Unable to mark payout as paid."
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payouts</h1>
          <p className="mt-2 text-slate-500">
            Manage all payouts processed by the Finance Engine.
          </p>
        </div>

        {canSettlePayout && <Link
          to={`/workspace/${workspaceId}/finance/payouts/new`}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700"
        >
          <Plus size={18} />
          New Payout
        </Link>}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading payouts...</p>
      ) : payouts.length ? (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <div
              key={payout._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div>
                <p className="text-lg font-bold text-slate-900">
                  KES {Number(payout.amount || 0).toLocaleString()}
                </p>
                <p className="text-sm text-slate-500">
                  {payout.member_id?.user_id?.name || "Member"} ·{" "}
                  <span className="capitalize font-medium text-slate-700">
                    {payout.status}
                  </span>
                </p>
              </div>

              {canSettlePayout && payout.status === "pending" && (
                <Button onClick={() => markPaid(payout._id)}>Mark paid</Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800">
            No payouts yet
          </h2>
          <p className="mt-2 text-slate-500">
            Start a payout when the Chama is ready to disburse.
          </p>
        </div>
      )}
    </div>
  );
}
