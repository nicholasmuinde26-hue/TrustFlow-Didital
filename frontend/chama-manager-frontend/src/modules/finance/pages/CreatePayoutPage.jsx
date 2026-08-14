import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import payoutService from "../services/payout.service";
import Button from "@/shared/components/ui/Button";
import { X } from "lucide-react";

export default function CreatePayoutPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startPayout() {
    setLoading(true); setError("");
    try {
      await payoutService.start(workspaceId);
      navigate(`/workspace/${workspaceId}/finance/payouts`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to start the payout.");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Create Payout
          </h1>
          <p className="text-slate-500 mt-1">Start the next rotational payout. The finance engine selects the eligible member and creates a pending payout.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            border
            border-slate-200
            bg-white
            text-slate-500
            hover:bg-slate-50
            hover:text-slate-700
            transition
            dark:border-slate-700
            dark:bg-slate-800
            dark:text-slate-400
            dark:hover:bg-slate-700
            dark:hover:text-slate-200
          "
          aria-label="Close"
          title="Close form"
        >
          <X size={20} />
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button onClick={startPayout} disabled={loading}>{loading ? "Starting..." : "Start Next Payout"}</Button>
    </div>
  );
}
