import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  Package,
  Clock,
  CheckCircle2,
  Store,
  MapPin,
  Phone,
  AlertCircle,
  Truck,
  ArrowRight,
} from "lucide-react";
import MarketplaceNavbar from "../components/MarketplaceNavbar";
import MarketplaceCartDrawer from "../components/MarketplaceCartDrawer";
import marketplaceService from "../services/marketplace.service";
import Spinner from "@/shared/components/ui/Spinner";
import toast from "react-hot-toast";

export default function MarketplaceOrderTrackPage() {
  const [searchParams] = useSearchParams();
  const initialOrder = searchParams.get("order") || "";

  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (initialOrder) {
      handleTrack(initialOrder);
    }
  }, [initialOrder]);

  const handleTrack = async (targetOrderNumber = orderNumber) => {
    if (!targetOrderNumber.trim()) {
      toast.error("Please enter a valid order number");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const data = await marketplaceService.trackOrder(targetOrderNumber, phone);
      setOrder(data);
    } catch (err) {
      setOrder(null);
      toast.error(err.response?.data?.message || "Order not found. Check your order number.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "fulfilled":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      case "cancelled":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
      default:
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <MarketplaceNavbar />
      <MarketplaceCartDrawer />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-8 w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Track Marketplace Order
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Check live fulfillment, dispatch progress, and merchant packages for your marketplace order.
          </p>
        </div>

        {/* Tracking Lookup Box */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTrack();
            }}
            className="grid gap-4 sm:grid-cols-12 items-end"
          >
            <div className="sm:col-span-6">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Order Number
              </label>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. MKT-849201"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0712345678"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 shadow-md"
              >
                <Search size={14} /> Track
              </button>
            </div>
          </form>
        </div>

        {loading && (
          <div className="py-12">
            <Spinner />
          </div>
        )}

        {hasSearched && !loading && !order && (
          <div className="rounded-3xl border border-dashed border-slate-200 py-12 text-center text-slate-400 dark:border-slate-800">
            <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Order not found</p>
            <p className="text-xs text-slate-400 mt-1">Please double-check the order number received upon checkout.</p>
          </div>
        )}

        {order && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                  Order Details
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  #{order.order_number}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block font-semibold">Total Amount</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  KES {order.total_amount?.toLocaleString()}
                </span>
                <span
                  className={`inline-block ml-2 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    order.payment_status === "paid"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  Payment: {order.payment_status}
                </span>
              </div>
            </div>

            {/* Merchant Allocations & Items */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Packages by Merchant
              </h3>

              {order.merchant_allocations?.map((alloc, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store size={15} className="text-emerald-600" />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {alloc.business_name || "Merchant"}
                      </span>
                    </div>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold capitalize ${getStatusBadge(
                        alloc.fulfillment_status
                      )}`}
                    >
                      {alloc.fulfillment_status || "Pending"}
                    </span>
                  </div>

                  {/* Items for this allocation */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {order.items
                      ?.filter((item) => String(item.business_id) === String(alloc.business_id))
                      .map((item, itemIdx) => (
                        <div key={itemIdx} className="flex justify-between py-2 text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.qty}x {item.name}
                          </span>
                          <span className="font-bold text-slate-600 dark:text-slate-400">
                            KES {item.line_total?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Delivery Details */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/20 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="font-bold text-slate-400 block mb-1">Fulfillment Address</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {order.delivery_address || "Store Pickup"}
                </p>
                <span className="text-[11px] text-slate-400 capitalize mt-0.5 block">
                  Method: {order.fulfillment_type}
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-400 block mb-1">Customer Recipient</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{order.customer_name}</p>
                <p className="text-slate-500">{order.customer_phone}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
