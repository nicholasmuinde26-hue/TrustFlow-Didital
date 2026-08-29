import React from "react";
import { MapPinIcon } from "./nav-icons";

export default function AccountTab({ storefront, business, primaryColor, onGoToTrack }) {
  return (
    <div className="px-4 py-5 sm:px-8">
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #111827 130%)` }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-base font-extrabold">
            {storefront.theme?.logo_text || storefront.name?.slice(0, 2)?.toUpperCase()}
          </div>
          <div>
            <p className="text-base font-extrabold">{storefront.name}</p>
            <p className="flex items-center gap-1 text-[11px] opacity-85">
              <MapPinIcon className="h-3 w-3" />
              {storefront.location_text}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed opacity-90">{storefront.subtitle}</p>
      </div>

      {storefront.badges?.length > 0 && (
        <div className="mt-4 space-y-2">
          {storefront.badges.map((badge) => (
            <div
              key={badge}
              className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-xs font-semibold text-gray-700"
            >
              {badge}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onGoToTrack}
        className="mt-4 w-full rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-700"
      >
        Track an order
      </button>

      <p className="mt-6 text-center text-[11px] text-gray-400">
        Prices shown in {business?.currency || "KES"}. This storefront is independently run by{" "}
        {storefront.name} — orders and stock are managed directly by the seller.
      </p>
    </div>
  );
}
