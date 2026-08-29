import React from "react";
import { Link } from "react-router-dom";

export default function OrderSuccess({ orderResult, slug, phone, primaryColor, onContinueShopping }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
      <h1 className="text-xl font-extrabold text-gray-900">Order placed!</h1>
      <p className="max-w-sm text-sm text-gray-500">
        Your order code is <span className="font-mono font-bold text-gray-900">{orderResult.order_code}</span>.
        Save it to track your order status — no account needed.
      </p>
      <div className="flex gap-3">
        <Link
          to={`/store/${slug}/track?code=${orderResult.order_code}&phone=${phone}`}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Track my order
        </Link>
        <button
          onClick={onContinueShopping}
          className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700"
        >
          Continue shopping
        </button>
      </div>
    </div>
  );
}
