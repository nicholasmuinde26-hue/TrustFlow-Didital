import React from "react";
import { HomeIcon, GridIcon, TagIcon, UserIcon } from "./nav-icons";
import { CartIcon } from "./icons";

const TABS = [
  { key: "home", label: "Home", Icon: HomeIcon },
  { key: "shop", label: "Shop", Icon: GridIcon },
  { key: "track", label: "Track", Icon: TagIcon },
  { key: "cart", label: "Cart", Icon: CartIcon },
  { key: "account", label: "Store", Icon: UserIcon },
];

export default function BottomNav({ activeTab, onChangeTab, cartCount, primaryColor }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-3xl items-stretch justify-between px-2">
        {TABS.map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChangeTab(key)}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5"
            >
              <span className="relative">
                <Icon
                  className="h-5 w-5"
                  style={{ color: active ? primaryColor : "#9CA3AF" }}
                  strokeWidth={active ? 2.4 : 2}
                />
                {key === "cart" && cartCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </span>
              <span
                className="text-[10px] font-semibold"
                style={{ color: active ? primaryColor : "#9CA3AF" }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
