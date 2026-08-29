import React from "react";
import { CloseIcon, PlusIcon, MinusIcon } from "./icons";
import {
  getItemId,
  getSellingPrice,
  getWasPrice,
  getDiscountPercent,
  getStockState,
  formatMoney,
} from "../utils/storefront.utils";

export default function ProductQuickView({
  item,
  qtyInCart,
  currency,
  primaryColor,
  onClose,
  onAdd,
  onChangeQty,
  onViewCart,
}) {
  if (!item) return null;

  const itemId = getItemId(item);
  const stock = getStockState(item);
  const outOfStock = stock === "out";
  const price = getSellingPrice(item);
  const was = getWasPrice(item);
  const discount = getDiscountPercent(item);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Product</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex aspect-[4/3] items-center justify-center bg-gray-50 text-6xl">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>{item.icon || "📦"}</span>
          )}
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {item.category || "General"}
              </p>
              <h2 className="text-base font-extrabold text-gray-900">{item.name}</h2>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                outOfStock
                  ? "bg-red-100 text-red-600"
                  : stock === "low"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {outOfStock ? "Sold out" : stock === "low" ? `Only ${item.quantity} left` : "In stock"}
            </span>
          </div>

          {item.description && (
            <p className="text-sm leading-relaxed text-gray-600">{item.description}</p>
          )}

          <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
            <span className="text-xl font-extrabold text-gray-900">{formatMoney(price, currency)}</span>
            {was && (
              <span className="text-sm font-medium text-gray-400 line-through">
                {formatMoney(was, currency)}
              </span>
            )}
            {discount && (
              <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-extrabold text-rose-600">
                -{discount}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            {qtyInCart > 0 ? (
              <div className="flex flex-1 items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                <button
                  onClick={() => onChangeQty(itemId, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm"
                  aria-label="Decrease quantity"
                >
                  <MinusIcon className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-extrabold text-gray-900">{qtyInCart} in cart</span>
                <button
                  onClick={() => onChangeQty(itemId, 1)}
                  disabled={qtyInCart >= item.quantity}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm disabled:opacity-30"
                  aria-label="Increase quantity"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                disabled={outOfStock}
                onClick={() => onAdd(item)}
                className="flex-1 rounded-xl py-3 text-sm font-extrabold text-white disabled:bg-gray-300"
                style={{ backgroundColor: outOfStock ? undefined : primaryColor }}
              >
                {outOfStock ? "Notify when back" : "Add to cart"}
              </button>
            )}
            {qtyInCart > 0 && (
              <button
                onClick={onViewCart}
                className="shrink-0 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700"
              >
                View cart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
