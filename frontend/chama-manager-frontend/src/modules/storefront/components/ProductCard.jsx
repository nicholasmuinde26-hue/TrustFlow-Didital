import React from "react";
import { PlusIcon, MinusIcon } from "./icons";
import {
  getItemId,
  getSellingPrice,
  getWasPrice,
  getDiscountPercent,
  getStockState,
  formatMoney,
} from "../utils/storefront.utils";

export default function ProductCard({
  item,
  qtyInCart,
  currency,
  primaryColor,
  onAdd,
  onChangeQty,
  onOpenDetail,
}) {
  const itemId = getItemId(item);
  const stock = getStockState(item);
  const outOfStock = stock === "out";
  const price = getSellingPrice(item);
  const was = getWasPrice(item);
  const discount = getDiscountPercent(item);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]">
      <button
        type="button"
        onClick={() => onOpenDetail(item)}
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-gray-50 text-4xl"
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span aria-hidden>{item.icon || "📦"}</span>
        )}

        {discount ? (
          <span className="absolute left-2 top-2 rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
            -{discount}%
          </span>
        ) : null}

        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold ${
            outOfStock
              ? "bg-red-100 text-red-600"
              : stock === "low"
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {outOfStock ? "Sold out" : stock === "low" ? `${item.quantity} left` : "In stock"}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <button type="button" onClick={() => onOpenDetail(item)} className="text-left">
          <p className="line-clamp-2 min-h-[2.2em] text-xs font-semibold leading-tight text-gray-800">
            {item.name}
          </p>
        </button>

        <p className="truncate text-[10px] uppercase tracking-wide text-gray-400">
          {item.category || "General"}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex flex-col">
            <span className="text-sm font-extrabold text-gray-900">
              {formatMoney(price, currency)}
            </span>
            {was ? (
              <span className="text-[11px] font-medium text-gray-400 line-through">
                {formatMoney(was, currency)}
              </span>
            ) : null}
          </div>

          {qtyInCart > 0 ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-1.5 py-1">
              <button
                type="button"
                onClick={() => onChangeQty(itemId, -1)}
                className="flex h-5 w-5 items-center justify-center rounded-md text-gray-500 hover:bg-white"
                aria-label="Decrease quantity"
              >
                <MinusIcon className="h-3 w-3" />
              </button>
              <span className="min-w-[1ch] text-center text-xs font-bold text-gray-900">{qtyInCart}</span>
              <button
                type="button"
                onClick={() => onChangeQty(itemId, 1)}
                disabled={qtyInCart >= item.quantity}
                className="flex h-5 w-5 items-center justify-center rounded-md text-gray-500 hover:bg-white disabled:opacity-30"
                aria-label="Increase quantity"
                style={{ color: primaryColor }}
              >
                <PlusIcon className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAdd(item)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white disabled:bg-gray-300"
              style={{ backgroundColor: outOfStock ? undefined : primaryColor }}
              aria-label={`Add ${item.name} to cart`}
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
