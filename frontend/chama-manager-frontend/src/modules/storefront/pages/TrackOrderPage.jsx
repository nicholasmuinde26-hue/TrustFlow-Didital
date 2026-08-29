import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useTrackStorefrontOrder } from "../../business/hooks/useBusiness";

const STATUS_LABEL = {
  pending: "Order received",
  processing: "Being prepared",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export default function TrackOrderPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const trackMutation = useTrackStorefrontOrder();

  const [orderCode, setOrderCode] = useState(searchParams.get("code") || "");
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const lookup = async (code, ph) => {
    setError("");
    if (!code.trim()) {
      setError("Enter your order code.");
      return;
    }
    try {
      const data = await trackMutation.mutateAsync({ orderCode: code.trim(), phone: ph.trim() });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err?.response?.data?.message || err?.message || "Order not found.");
    }
  };

  useEffect(() => {
    if (searchParams.get("code")) {
      lookup(searchParams.get("code"), searchParams.get("phone") || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-5 py-10">
      {slug && (
        <Link to={`/store/${slug}`} className="mb-6 text-xs font-semibold text-gray-500 hover:text-gray-900">
          ← Back to store
        </Link>
      )}

      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6">
        <h1 className="mb-1 text-lg font-extrabold text-gray-900">Track your order</h1>
        <p className="mb-5 text-xs text-gray-500">No account needed — just your order code.</p>

        <div className="space-y-3">
          <input
            placeholder="Order code e.g. ORD-4821"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none"
          />
          <input
            placeholder="Phone number (optional, confirms identity)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none"
          />
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <button
            onClick={() => lookup(orderCode, phone)}
            disabled={trackMutation.isPending}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-extrabold text-white"
          >
            {trackMutation.isPending ? "Looking up…" : "Track order"}
          </button>
        </div>

        {result && (
          <div className="mt-6 border-t border-gray-100 pt-5">
            <p className="text-xs font-semibold text-gray-500">{result.storefront?.name}</p>
            <p className="mb-3 font-mono text-sm font-bold text-gray-900">{result.order?.order_code}</p>

            <span className="mb-4 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
              {STATUS_LABEL[result.order?.fulfillment_status] || result.order?.fulfillment_status}
            </span>

            <div className="space-y-2">
              {(result.order?.items || []).map((line, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {line.qty}x {line.name}
                  </span>
                  <span className="font-semibold text-gray-900">{Number(line.total).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm font-extrabold text-gray-900">
              <span>Total</span>
              <span>{Number(result.order?.total_amount || 0).toLocaleString()}</span>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              {result.order?.fulfillment_type === "pickup" ? "Store pickup" : result.order?.delivery_address}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
