import React from "react";
import { Home, MapPin, BedDouble, Bath, Ruler } from "lucide-react";
import { formatMoney } from "../utils/storefront.utils";

const RENT_PERIOD_LABEL = { month: "/ month", year: "/ year", one_time: "one-time" };

export default function RentalListingCard({ listing, currency, primaryColor, onOpenDetail }) {
  const vacant = listing.status !== "occupied";
  return (
    <button
      type="button"
      onClick={() => onOpenDetail(listing)}
      className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition hover:shadow-md"
    >
      <div className="relative h-36 w-full bg-gray-100">
        {listing.images?.[0] ? (
          <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <Home size={28} />
          </div>
        )}
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: vacant ? "#059669" : "#6B7280" }}
        >
          {vacant ? "Vacant" : "Occupied"}
        </span>
      </div>

      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-1 text-xs font-bold text-gray-900">{listing.title}</h3>
        {listing.location_text && (
          <p className="flex items-center gap-1 text-[11px] text-gray-500">
            <MapPin size={11} /> {listing.location_text}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          {listing.bedrooms != null && (
            <span className="flex items-center gap-0.5">
              <BedDouble size={11} /> {listing.bedrooms}
            </span>
          )}
          {listing.bathrooms != null && (
            <span className="flex items-center gap-0.5">
              <Bath size={11} /> {listing.bathrooms}
            </span>
          )}
          {listing.size_text && (
            <span className="flex items-center gap-0.5">
              <Ruler size={11} /> {listing.size_text}
            </span>
          )}
        </div>
        <p className="text-sm font-extrabold" style={{ color: primaryColor }}>
          {formatMoney(listing.rent_amount, currency)}{" "}
          <span className="text-[10px] font-medium text-gray-400">
            {RENT_PERIOD_LABEL[listing.rent_period] || ""}
          </span>
        </p>
      </div>
    </button>
  );
}
