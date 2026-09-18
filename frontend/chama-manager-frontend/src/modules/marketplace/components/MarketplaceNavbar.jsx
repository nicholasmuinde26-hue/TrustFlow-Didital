import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingBag,
  Building,
  Briefcase,
  UtensilsCrossed,
  Search,
  ShoppingCart,
  MapPin,
  Store,
  Compass,
  ArrowRight,
} from "lucide-react";
import { useMarketplaceCart } from "../context/MarketplaceCartContext";

const HUBS = [
  { slug: "retail", name: "Retail Hub", icon: ShoppingBag, color: "text-emerald-500" },
  { slug: "rentals", name: "Rentals Hub", icon: Building, color: "text-blue-500" },
  { slug: "services", name: "Services Hub", icon: Briefcase, color: "text-purple-500" },
  { slug: "food", name: "Food & Menus", icon: UtensilsCrossed, color: "text-orange-500" },
];

export default function MarketplaceNavbar({ onSearch, categorySlug }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount, openCart } = useMarketplaceCart();
  const [searchQuery, setSearchQuery] = useState("");

  const pathParts = location.pathname.split("/").filter(Boolean);
  let detectedCategory = categorySlug;
  if (!detectedCategory && pathParts[0] === "marketplace" && pathParts[1] && pathParts[1] !== "track") {
    detectedCategory = pathParts[1];
  }

  const activeHub = detectedCategory ? HUBS.find((h) => h.slug === detectedCategory) : null;
  const isIndependentCategory = Boolean(detectedCategory);
  const ActiveIcon = activeHub?.icon || Store;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    } else if (detectedCategory) {
      navigate(`/marketplace/${detectedCategory}?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate(`/marketplace/retail?search=${encodeURIComponent(searchQuery)}`);
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
              <Compass size={14} /> {isIndependentCategory ? `${activeHub?.name || detectedCategory.toUpperCase() + ' Marketplace'}` : "Multi-Vendor Marketplace Hubs"}
            </span>
            <span className="text-slate-500">|</span>
            <span>
              {isIndependentCategory
                ? "Dedicated Standalone Category Marketplace — ChamaCommerce"
                : "Buy directly from verified independent Kenyan merchants"}
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
          to={isIndependentCategory ? `/marketplace/${detectedCategory}` : "/marketplace"}
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
                {isIndependentCategory ? activeHub?.name || `${detectedCategory.toUpperCase()} Hub` : (
                  <>Market<span className="text-emerald-600">Hub</span></>
                )}
              </span>
            </div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isIndependentCategory ? "Independent Marketplace" : "ChamaCommerce"}
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
              placeholder={
                isIndependentCategory
                  ? `Search in ${activeHub?.name || detectedCategory}...`
                  : "Search products, rentals, services or shops..."
              }
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
        </div>
      </div>

      {/* Category Hubs Strip - ONLY RENDERED ON MULTI-HUB ROOT, HIDDEN ON INDEPENDENT CATEGORY PAGES */}
      {!isIndependentCategory && (
        <nav className="border-t border-slate-100 bg-slate-50/50 px-4 sm:px-8 dark:border-slate-800/60 dark:bg-slate-900/40">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto py-2 no-scrollbar">
            <Link
              to="/marketplace"
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                location.pathname === "/marketplace"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300"
              }`}
            >
              All Hubs
            </Link>
            {HUBS.map((hub) => {
              const Icon = hub.icon;
              const isActive = location.pathname.includes(`/marketplace/${hub.slug}`);
              return (
                <Link
                  key={hub.slug}
                  to={`/marketplace/${hub.slug}`}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-white" : hub.color} />
                  {hub.name}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
