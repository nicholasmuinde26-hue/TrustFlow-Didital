import React, { useState } from "react";
import { Home } from "lucide-react";
import HeroBanner from "./HeroBanner";
import RentalListingCard from "./RentalListingCard";
import RentalListingDetail from "./RentalListingDetail";

export default function RentalStorefrontView({ slug, storefront, business, listings }) {
  const [activeListing, setActiveListing] = useState(null);
  const primaryColor = storefront?.theme?.primary_color || "#1F7A5C";
  const currency = business?.currency || "KES";

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-100 bg-white/95 px-4 backdrop-blur sm:px-8">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {storefront.theme?.logo_text || storefront.name?.slice(0, 2)?.toUpperCase()}
        </div>
        <p className="flex-1 truncate text-sm font-extrabold text-gray-900">{storefront.name}</p>
      </div>

      <HeroBanner storefront={storefront} primaryColor={primaryColor} />

      <div className="px-4 py-5 sm:px-8">
        <h2 className="mb-3 text-sm font-extrabold text-gray-900">
          {listings.length} {listings.length === 1 ? "listing" : "listings"} available
        </h2>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
            <Home size={28} />
            <p className="text-sm">No vacant rooms or plots listed right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <RentalListingCard
                key={listing._id || listing.id}
                listing={listing}
                currency={currency}
                primaryColor={primaryColor}
                onOpenDetail={setActiveListing}
              />
            ))}
          </div>
        )}
      </div>

      {activeListing && (
        <RentalListingDetail
          listing={activeListing}
          slug={slug}
          currency={currency}
          primaryColor={primaryColor}
          onClose={() => setActiveListing(null)}
        />
      )}
    </div>
  );
}
