import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import payoutService from "../services/payout.service";
import Button from "@/shared/components/ui/Button";

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
      <h1 className="text-3xl font-bold">
        Create Payout
      </h1>

      <p className="text-slate-500">Start the next rotational payout. The finance engine selects the eligible member and creates a pending payout.</p>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button onClick={startPayout} disabled={loading}>{loading ? "Starting..." : "Start Next Payout"}</Button>
    </div>
  );
}
