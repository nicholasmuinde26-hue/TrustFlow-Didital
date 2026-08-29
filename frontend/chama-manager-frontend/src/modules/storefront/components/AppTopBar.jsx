import React from "react";
import { CartIcon } from "./icons";
import { formatMoney } from "../utils/storefront.utils";

export default function AppTopBar({
  storefront,
  primaryColor,
  cartCount,
  cartSubtotal,
  currency,
  onOpenCart,
}) {
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-100 bg-white/95 px-4 backdrop-blur sm:px-8">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white"
        style={{ backgroundColor: primaryColor }}
      >
        {storefront.theme?.logo_text || storefront.name?.slice(0, 2)?.toUpperCase()}
      </div>
      <p className="flex-1 truncate text-sm font-extrabold text-gray-900">{storefront.name}</p>

      <button
        type="button"
        onClick={onOpenCart}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-900 py-1.5 pl-2.5 pr-3 text-white"
      >
        <span className="relative">
          <CartIcon className="h-3.5 w-3.5" />
          {cartCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold">
              {cartCount}
            </span>
          )}
        </span>
        {cartCount > 0 && (
          <span className="text-[10px] font-bold">{formatMoney(cartSubtotal, currency)}</span>
        )}
      </button>
    </div>
  );
}
