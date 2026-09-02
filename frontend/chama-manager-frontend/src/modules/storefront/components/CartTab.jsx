import React from "react";
import { PlusIcon, MinusIcon, TrashIcon, ChevronLeft } from "./icons";
import { getItemId, formatMoney } from "../utils/storefront.utils";

export default function CartTab({
  step,
  cartLines,
  subtotal,
  currency,
  primaryColor,
  onChangeQty,
  onRemove,
  onGoToCheckout,
  onBackToCart,
  onBrowse,
  form,
  onFormChange,
  onPlaceOrder,
  isPlacing,
  error,
}) {
  if (cartLines.length === 0 && step === "cart") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-24 text-center">
        <p className="text-4xl">🛒</p>
        <p className="text-sm font-semibold text-gray-500">Your cart is empty.</p>
        <button onClick={onBrowse} className="text-xs font-bold" style={{ color: primaryColor }}>
          Start shopping
        </button>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 sm:px-8">
        {step === "checkout" && (
          <button onClick={onBackToCart} className="text-gray-400 hover:text-gray-700" aria-label="Back to cart">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <h1 className="text-sm font-extrabold text-gray-900">
          {step === "checkout" ? "Delivery details" : `Your cart (${cartLines.length})`}
        </h1>
      </div>

      <div className="px-4 py-4 sm:px-8">
        {step === "cart" ? (
          <div className="space-y-4">
            {cartLines.map((line) => {
              const itemId = getItemId(line.item);
              return (
                <div key={itemId} className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-2xl">
                    {line.item.image_url ? (
                      <img
                        src={line.item.image_url}
                        alt={line.item.name}
                        className="h-full w-full rounded-xl object-cover"
                      />
                    ) : (
                      line.item.icon || "📦"
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold leading-tight text-gray-900">{line.item.name}</p>
                      <button
                        onClick={() => onRemove(itemId)}
                        className="text-gray-300 hover:text-red-500"
                        aria-label={`Remove ${line.item.name}`}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-1.5 py-1">
                        <button
                          onClick={() => onChangeQty(itemId, -1)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-gray-500 hover:bg-white"
                          aria-label="Decrease quantity"
                        >
                          <MinusIcon className="h-3 w-3" />
                        </button>
                        <span className="min-w-[1ch] text-center text-xs font-bold">{line.qty}</span>
                        <button
                          onClick={() => onChangeQty(itemId, 1)}
                          disabled={line.qty >= line.item.quantity}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-gray-500 hover:bg-white disabled:opacity-30"
                          aria-label="Increase quantity"
                        >
                          <PlusIcon className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-xs font-extrabold text-gray-900">
                        {formatMoney(line.lineTotal, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              placeholder="Your name"
              value={form.customer_name}
              onChange={(e) => onFormChange("customer_name", e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none"
            />
            <input
              placeholder="Phone number"
              value={form.customer_phone}
              onChange={(e) => onFormChange("customer_phone", e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none"
            />
            <div className="flex gap-2">
              {["delivery", "pickup"].map((type) => (
                <button
                  key={type}
                  onClick={() => onFormChange("fulfillment_type", type)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold capitalize ${
                    form.fulfillment_type === type ? "bg-gray-900 text-white" : "border border-gray-200 text-gray-600"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            {form.fulfillment_type === "delivery" && (
              <input
                placeholder="Delivery address"
                value={form.delivery_address}
                onChange={(e) => onFormChange("delivery_address", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none"
              />
            )}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Payment method
              </p>
              <div className="flex gap-2">
                {[
                  { value: "mpesa", label: "M-Pesa" },
                  { value: "card", label: "Card" },
                  { value: "cash_on_delivery", label: "Cash" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onFormChange("payment_method", opt.value)}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                      form.payment_method === opt.value
                        ? "bg-gray-900 text-white"
                        : "border border-gray-200 text-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          </div>
        )}
      </div>

      <div className="sticky bottom-14 space-y-3 border-t border-gray-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-8 lg:bottom-0 lg:rounded-b-2xl lg:border lg:border-t-0">
        <div className="flex items-center justify-between text-sm font-extrabold text-gray-900">
          <span>Total</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </div>
        {step === "cart" ? (
          <button
            onClick={onGoToCheckout}
            className="w-full rounded-xl py-3 text-sm font-extrabold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Checkout
          </button>
        ) : (
          <>
            <button
              onClick={onPlaceOrder}
              disabled={isPlacing}
              className="w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-60"
              style={{ backgroundColor: primaryColor }}
            >
              {isPlacing ? "Placing order…" : `Place order — ${formatMoney(subtotal, currency)}`}
            </button>
            <p className="text-center text-[11px] text-gray-400">No account required to order.</p>
          </>
        )}
      </div>
    </div>
  );
}
