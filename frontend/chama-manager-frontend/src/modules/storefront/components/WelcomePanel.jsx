import React from "react";
import { ShieldIcon, TruckIcon, StoreIcon, HeadsetIcon } from "./icons";

const DEFAULT_PERKS = [
  { Icon: ShieldIcon, title: "Buyer Protection", desc: "Shop with confidence" },
  { Icon: TruckIcon, title: "Fast Delivery", desc: "Straight to your door" },
  { Icon: StoreIcon, title: "Verified Seller", desc: "Run directly by the store" },
  { Icon: HeadsetIcon, title: "Real Support", desc: "Reach us anytime" },
];

export default function WelcomePanel({ storefront, primaryColor, onSignIn, onTrackOrder }) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 lg:flex">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-extrabold text-gray-900">Welcome to {storefront.name} 👋</p>
        <p className="mt-1 text-xs text-gray-500">Sign in for a faster checkout experience</p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-lg py-2.5 text-sm font-extrabold text-white transition"
            style={{ backgroundColor: primaryColor }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onTrackOrder}
            className="rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:border-gray-300"
          >
            Track an Order
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
        {DEFAULT_PERKS.map(({ Icon, title, desc }) => (
          <div key={title} className="flex items-center gap-3 px-4 py-3">
            <Icon className="h-4 w-4 shrink-0 text-gray-400" style={{ color: primaryColor }} />
            <div>
              <p className="text-xs font-bold text-gray-800">{title}</p>
              <p className="text-[11px] text-gray-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
