import React from "react";
import { MenuIcon } from "./icons";

// "Track Order" already lives in TopUtilityBar (directly above this bar on
// desktop) and in BottomNav on mobile — repeating it here would just be a
// third entry point to the same action, so this bar sticks to browsing links.
export default function NavBar({ activeTab, onChangeTab, primaryColor }) {
  const LINKS = [
    { key: "home", label: "Home" },
    { key: "shop", label: "Shop All" },
  ];

  return (
    <div className="hidden border-b border-gray-100 bg-white lg:block">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6">
        <button
          type="button"
          onClick={() => onChangeTab("shop")}
          className="flex shrink-0 items-center gap-2 border-b-2 border-transparent py-3 text-[13px] font-bold text-gray-700"
        >
          <MenuIcon className="h-4 w-4" />
          All Categories
        </button>

        {LINKS.map((link) => (
          <button
            key={link.key}
            type="button"
            onClick={() => onChangeTab(link.key)}
            className="border-b-2 py-3 text-[13px] font-semibold transition"
            style={
              activeTab === link.key
                ? { borderColor: primaryColor, color: primaryColor }
                : { borderColor: "transparent", color: "#4B5563" }
            }
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
