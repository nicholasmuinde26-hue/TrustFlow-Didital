import React from "react";
import { MapPinIcon } from "./nav-icons";

export default function TopUtilityBar({ storefront, currency, onGoToTrack }) {
  return (
    <div className="hidden bg-gray-900 text-gray-300 lg:block">
      <div className="mx-auto flex h-9 max-w-[1400px] items-center gap-6 px-6 text-[12px]">
        <span className="flex shrink-0 items-center gap-1.5 font-medium">
          <MapPinIcon className="h-3.5 w-3.5 text-gray-400" />
          Deliver to <span className="font-semibold text-white">{storefront.location_text}</span>
        </span>

        <span className="flex-1 truncate text-center text-gray-400">
          {storefront.badges?.[0] || "Fast, reliable service from a store you can trust"}
        </span>

        <div className="flex shrink-0 items-center gap-5">
          <button
            type="button"
            onClick={onGoToTrack}
            className="font-medium text-gray-300 transition hover:text-white"
          >
            Track Order
          </button>
          <span className="font-medium text-gray-300">{currency}</span>
        </div>
      </div>
    </div>
  );
}
