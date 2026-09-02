import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { PackageSearch, ChevronLeft, MapPin, CheckCircle2 } from "lucide-react";
import { useTrackStorefrontOrder } from "../../business/hooks/useBusiness";
import { formatMoney } from "../utils/storefront.utils";

const STEPS = [
  { key: "pending", label: "Received" },
  { key: "processing", label: "Preparing" },
  { key: "fulfilled", label: "Fulfilled" },
];

const DEFAULT_COLOR = "#1F7A5C";

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

  const primaryColor = result?.storefront?.theme?.primary_color || DEFAULT_COLOR;
  const status = result?.order?.fulfillment_status;
  const isCancelled = status === "cancelled";
  const activeStepIndex = STEPS.findIndex((s) => s.key === status);
  const backHref = slug ? `/store/${slug}` : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Branded sticky header — consistent with the rest of the storefront shell */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-100 bg-white/95 px-4 backdrop-blur sm:px-8">
        {backHref ? (
          <Link
            to={backHref}
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to store
          </Link>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: primaryColor }}>
            <PackageSearch className="h-4 w-4" />
          </span>
        )}
        <p className="flex-1 truncate text-center text-sm font-extrabold text-gray-900 sm:text-left">
          {result?.storefront?.name || "Track your order"}
        </p>
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8 sm:px-0">
        {/* Lookup form */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <PackageSearch className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-extrabold text-gray-900">Track your order</h1>
              <p className="text-xs text-gray-500">No account needed — just your order code.</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              placeholder="Order code e.g. ORD-4821"
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium outline-none transition focus:border-gray-300 focus:bg-white"
            />
            <input
              placeholder="Phone number (optional, confirms identity)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium outline-none transition focus:border-gray-300 focus:bg-white"
            />
            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            <button
              onClick={() => lookup(orderCode, phone)}
              disabled={trackMutation.isPending}
              className="w-full rounded-xl py-3 text-sm font-extrabold text-white transition disabled:opacity-60"
              style={{ backgroundColor: primaryColor }}
            >
              {trackMutation.isPending ? "Looking up…" : "Track order"}
            </button>
          </div>
        </div>

        {/* Result — receipt-style card matching the rest of the storefront */}
        {result && (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="px-6 pt-5">
              <p className="text-xs font-semibold text-gray-400">{result.storefront?.name}</p>
              <p className="mb-4 font-mono text-sm font-bold text-gray-900">{result.order?.order_code}</p>
            </div>

            {/* Status stepper */}
            <div className="px-6">
              {isCancelled ? (
                <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                  Cancelled
                </span>
              ) : (
                <div className="mb-1 flex items-center">
                  {STEPS.map((step, idx) => {
                    const reached = idx <= activeStepIndex;
                    const isLast = idx === STEPS.length - 1;
                    return (
                      <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center gap-1.5">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full text-white transition"
                            style={{ backgroundColor: reached ? primaryColor : "#E5E7EB" }}
                          >
                            {reached ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span
                            className="w-16 text-center text-[10px] font-bold leading-tight"
                            style={{ color: reached ? primaryColor : "#9CA3AF" }}
                          >
                            {step.label}
                          </span>
                        </div>
                        {!isLast && (
                          <span
                            className="mb-4 h-0.5 flex-1"
                            style={{ backgroundColor: idx < activeStepIndex ? primaryColor : "#E5E7EB" }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2 border-t border-gray-100 px-6 py-4">
              {(result.order?.items || []).map((line, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {line.qty}x {line.name}
                  </span>
                  <span className="font-semibold text-gray-900">{Number(line.total).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-sm font-extrabold text-gray-900">
              <span>Total</span>
              <span>{formatMoney(result.order?.total_amount || 0, result.business?.currency)}</span>
            </div>

            <div className="flex items-start gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 text-xs text-gray-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span>
                {result.order?.fulfillment_type === "pickup" ? "Store pickup" : result.order?.delivery_address}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
