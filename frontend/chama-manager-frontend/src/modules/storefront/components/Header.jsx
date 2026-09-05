import React, { useState } from "react";
import { SearchIcon, CartIcon } from "./icons";
import { UserIcon } from "./nav-icons";
import { formatMoney } from "../utils/storefront.utils";

export default function Header({
  storefront,
  primaryColor,
  cartCount,
  cartSubtotal,
  currency,
  searchValue,
  onSearchSubmit,
  onOpenCart,
  onOpenAccount,
}) {
  const [query, setQuery] = useState(searchValue || "");

  const submit = (e) => {
    e.preventDefault();
    onSearchSubmit(query);
  };

  return (
    <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6 lg:gap-6 lg:py-4">
        {/* Wordmark */}
        <button
          type="button"
          onClick={() => onSearchSubmit("")}
          className="flex shrink-0 items-center gap-2"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-extrabold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {storefront.theme?.logo_text || storefront.name?.slice(0, 2)?.toUpperCase()}
          </span>
          <span className="hidden flex-col items-start leading-none sm:flex">
            <span className="text-lg font-extrabold tracking-tight text-gray-900">
              {storefront.name}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">
              Store
            </span>
          </span>
        </button>

        {/* Search */}
        <form onSubmit={submit} className="min-w-0 flex-1">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${storefront.name}…`}
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-11 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-300 focus:bg-white"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: primaryColor }}
              aria-label="Search"
            >
              <SearchIcon className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Account */}
        <button
          type="button"
          onClick={onOpenAccount}
          className="hidden shrink-0 items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900 lg:flex"
        >
          <UserIcon className="h-6 w-6 text-gray-400" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-medium text-gray-400">Account</span>
            <span>My Store</span>
          </span>
        </button>

        {/* Cart */}
        <button
          type="button"
          onClick={onOpenCart}
          className="flex shrink-0 items-center gap-2 rounded-full bg-gray-900 py-2 pl-3 pr-4 text-white transition hover:bg-gray-800"
        >
          <span className="relative">
            <CartIcon className="h-4 w-4" />
            {cartCount > 0 && (
              <span
                className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {cartCount}
              </span>
            )}
          </span>
          <span className="hidden text-xs font-bold sm:inline">
            {cartCount > 0 ? formatMoney(cartSubtotal, currency) : "Cart"}
          </span>
        </button>
      </div>
    </div>
  );
}
