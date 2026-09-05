import React from "react";
import { TagPriceIcon, ShieldIcon, TruckIcon, RefreshIcon } from "./icons";
import { StoreIcon } from "./icons";

const ITEMS = [
  { Icon: TagPriceIcon, title: "Great Prices", desc: "Straight from the seller" },
  { Icon: StoreIcon, title: "Trusted Seller", desc: "Verified & independently run" },
  { Icon: ShieldIcon, title: "Secure Payments", desc: "M-Pesa, card & cash" },
  { Icon: TruckIcon, title: "Reliable Delivery", desc: "Or pick up in store" },
  { Icon: RefreshIcon, title: "Direct From Seller", desc: "No middlemen, ever" },
];

export default function TrustStrip() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-6 sm:px-8">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {ITEMS.map(({ Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-extrabold text-gray-800">{title}</p>
              <p className="text-[11px] text-gray-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
