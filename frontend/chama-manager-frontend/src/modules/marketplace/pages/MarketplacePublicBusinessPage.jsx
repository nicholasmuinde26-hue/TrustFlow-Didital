import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Store,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import MarketplaceNavbar from "../components/MarketplaceNavbar";
import MarketplaceCartDrawer from "../components/MarketplaceCartDrawer";
import MarketplaceListingCard from "../components/MarketplaceListingCard";
import marketplaceService from "../services/marketplace.service";
import Spinner from "@/shared/components/ui/Spinner";

export default function MarketplacePublicBusinessPage() {
  const { businessSlug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedHub, setSelectedHub] = useState("all");

  useEffect(() => {
    async function fetchMerchant() {
      setLoading(true);
      try {
        const res = await marketplaceService.getBusinessProfile(businessSlug);
        setData(res);
      } catch (err) {
        console.error("Failed to load business profile", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMerchant();
  }, [businessSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <MarketplaceNavbar />
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!data?.business) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <MarketplaceNavbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <Store size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Merchant Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">This business storefront does not exist or has been paused.</p>
          <Link
            to="/marketplace"
            className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            Explore Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const { business, hubs, listings } = data;

  const filteredListings =
    selectedHub === "all"
      ? listings
      : listings.filter((l) => l.category_slug === selectedHub);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <MarketplaceNavbar />
      <MarketplaceCartDrawer />

      {/* Branded Merchant Hero Banner */}
      <section className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 py-12 px-4 sm:px-8 text-white">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Logo */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-emerald-600 text-white font-black text-2xl shadow-xl border-2 border-white/20">
              {business.logo_url ? (
                <img src={business.logo_url} alt={business.name} className="h-full w-full rounded-3xl object-cover" />
              ) : (
                business.name?.slice(0, 2)?.toUpperCase() || "ST"
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{business.display_name || business.name}</h1>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck size={12} /> Verified Merchant
                </span>
              </div>
              {business.tagline && (
                <p className="mt-1 text-xs text-slate-300 italic">{business.tagline}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                {business.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-emerald-400" /> {business.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <ShoppingBag size={13} className="text-emerald-400" /> {listings.length} Active Listings
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              to={`/store/${business.slug}`}
              className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition backdrop-blur-xs"
            >
              <ExternalLink size={13} /> Branded Store View
            </Link>
          </div>
        </div>
      </section>

      {/* Main Catalog Area */}
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-8 w-full space-y-8">
        {/* Hub Tabs Filter */}
        {hubs?.length > 1 && (
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 mr-2">Marketplace Hubs:</span>
            <button
              onClick={() => setSelectedHub("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                selectedHub === "all"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              All Hubs ({listings.length})
            </button>
            {hubs.map((hub) => (
              <button
                key={hub}
                onClick={() => setSelectedHub(hub)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                  selectedHub === hub
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {hub}
              </button>
            ))}
          </div>
        )}

        {/* Listings Grid */}
        <div>
          {filteredListings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Store size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-semibold">No approved listings in this category yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {filteredListings.map((item) => (
                <MarketplaceListingCard key={item._id} listing={item} />
              ))}
            </div>
          )}
        </div>

        {/* Merchant Trust Info */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 grid gap-6 sm:grid-cols-3 text-xs">
          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
              <Truck size={15} className="text-emerald-600" /> Delivery Information
            </h4>
            <p className="text-slate-500">
              {business.delivery_info || "Dispatches quickly. Same-day or next-day delivery available across major centers."}
            </p>
          </div>

          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
              <RotateCcw size={15} className="text-emerald-600" /> Return Policy
            </h4>
            <p className="text-slate-500">
              {business.return_policy || "7-day return policy for defective or misrepresented items with receipt."}
            </p>
          </div>

          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
              <ShieldCheck size={15} className="text-emerald-600" /> Verified Settlement
            </h4>
            <p className="text-slate-500">
              All transactions are processed through ChamaCommerce escrow and settled directly to the merchant.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
