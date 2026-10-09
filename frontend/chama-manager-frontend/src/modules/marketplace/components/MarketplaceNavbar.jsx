import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingBag,
  Building,
  Briefcase,
  UtensilsCrossed,
  Search,
  ShoppingCart,
  Compass,
} from "lucide-react";
import { isCartCategory, useMarketplaceCart } from "../context/MarketplaceCartContext";

const HUBS = [
  { slug: "retail", name: "Retail Hub", icon: ShoppingBag, color: "text-emerald-500" },
  { slug: "rentals", name: "Rentals Hub", icon: Building, color: "text-blue-500" },
  { slug: "services", name: "Services Hub", icon: Briefcase, color: "text-purple-500" },
  { slug: "food", name: "Food & Menus", icon: UtensilsCrossed, color: "text-orange-500" },
];

export default function MarketplaceNavbar({ onSearch, categorySlug }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const pathParts = location.pathname.split("/").filter(Boolean);
  const cartCategory = categorySlug || (pathParts[0] === "marketplace" && HUBS.some((hub) => hub.slug === pathParts[1]) ? pathParts[1] : null);
  const detectedCategory = cartCategory || "retail";
  const { itemCount, openCart } = useMarketplaceCart(cartCategory);

  const activeHub = HUBS.find((h) => h.slug === detectedCategory) || HUBS[0];
  const ActiveIcon = activeHub?.icon || ShoppingBag;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      navigate(`/marketplace/${detectedCategory}?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const getGradientForHub = (slug) => {
    switch (slug) {
      case "rentals":
        return "from-blue-600 to-indigo-600 shadow-blue-500/20";
      case "services":
        return "from-purple-600 to-violet-600 shadow-purple-500/20";
      case "food":
        return "from-orange-600 to-amber-600 shadow-orange-500/20";
      default:
        return "from-emerald-600 to-teal-500 shadow-emerald-500/20";
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs dark:border-slate-800 dark:bg-slate-900/95">
      {/* Top microbar */}
      <div className="hidden bg-slate-900 px-4 py-1.5 text-xs text-slate-300 sm:block sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Compass size={14} /> {activeHub.name} Marketplace
            </span>
            <span className="text-slate-500">|</span>
            <span>
              Dedicated Category URL: <code className="text-emerald-300 font-mono">/marketplace/{detectedCategory}</code> — 100% Isolated Category Businesses
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/marketplace/track" className="hover:text-white">
              Track Order
            </Link>
            <Link to="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Merchant Login
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        {/* Brand logo */}
        <Link
          to={`/marketplace/${detectedCategory}`}
          className="flex items-center gap-2.5 shrink-0"
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr ${getGradientForHub(
              detectedCategory
            )} text-white shadow-md`}
          >
            <ActiveIcon size={22} className="font-black" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {activeHub.name}
              </span>
            </div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Dedicated URL: /marketplace/{detectedCategory}
            </span>
          </div>
        </Link>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="hidden flex-1 max-w-lg md:flex">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${activeHub.name} (strictly ${detectedCategory} only)...`}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-24 text-sm font-medium text-slate-800 transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Search
            </button>
          </div>
        </form>

        {/* Action icons */}
        <div className="flex items-center gap-3">
          {isCartCategory(cartCategory) && (
          <button
            onClick={openCart}
            className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-xs hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">Cart</span>
            {itemCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-extrabold text-white">
                {itemCount}
              </span>
            )}
          </button>
          )}
        </div>
      </div>

    </header>
  );
}
