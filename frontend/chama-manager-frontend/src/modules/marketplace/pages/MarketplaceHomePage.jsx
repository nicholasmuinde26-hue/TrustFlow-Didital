import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  Building,
  Briefcase,
  UtensilsCrossed,
  Search,
  Store,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import MarketplaceNavbar from "../components/MarketplaceNavbar";
import MarketplaceCartDrawer from "../components/MarketplaceCartDrawer";
import MarketplaceListingCard from "../components/MarketplaceListingCard";
import marketplaceService from "../services/marketplace.service";
import Spinner from "@/shared/components/ui/Spinner";

export default function MarketplaceHomePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [featuredListings, setFeaturedListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [cats, searchRes] = await Promise.all([
          marketplaceService.getCategories(),
          marketplaceService.searchListings({ limit: 8, sortBy: "featured" }),
        ]);
        setCategories(cats);
        setFeaturedListings(searchRes.listings || []);
      } catch (err) {
        console.error("Failed to load marketplace home data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getHubIcon = (slug) => {
    switch (slug) {
      case "retail":
        return ShoppingBag;
      case "rentals":
        return Building;
      case "services":
        return Briefcase;
      case "food":
        return UtensilsCrossed;
      default:
        return Store;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <MarketplaceNavbar />
      <MarketplaceCartDrawer />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 py-16 text-white sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-400">
              <Sparkles size={14} /> Unified Kenya Multi-Vendor Commerce
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl leading-tight">
              One Public Marketplace. <br />
              <span className="text-emerald-400">Dedicated Category Hubs.</span>
            </h1>
            <p className="text-base text-slate-300 sm:text-lg">
              Buy retail products from top shops, discover verified rental properties, book skilled experts, and order from local restaurants — all tied directly to owning businesses with secure M-Pesa routing.
            </p>

            {/* Quick Search */}
            <div className="pt-2 max-w-xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = e.target.elements.search.value;
                  if (q) navigate(`/marketplace/retail?search=${encodeURIComponent(q)}`);
                }}
                className="flex items-center rounded-2xl bg-white p-1.5 shadow-xl dark:bg-slate-900 border border-slate-700"
              >
                <Search className="ml-3 text-slate-400" size={20} />
                <input
                  name="search"
                  type="text"
                  placeholder="What are you looking for today? (e.g. Shoes, 2 Bedroom, Electrician)"
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden dark:text-white"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700 transition"
                >
                  Explore
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl flex-1 px-4 py-12 sm:px-8 space-y-16">
        {/* Category Hubs Grid */}
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Explore Category Hubs
              </h2>
              <p className="text-xs text-slate-500">
                Browse businesses curated by specialized industry marketplaces
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat) => {
              const Icon = getHubIcon(cat.slug);
              return (
                <Link
                  key={cat.slug}
                  to={`/marketplace/${cat.slug}`}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div
                      className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md transition group-hover:scale-110"
                      style={{ backgroundColor: cat.theme_color || "#059669" }}
                    >
                      <Icon size={24} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-600">
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-2">
                      {cat.tagline || cat.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-slate-400 group-hover:text-emerald-600 dark:border-slate-800">
                    <span>{cat.subcategories?.length || 4} Categories</span>
                    <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Featured Products / Listings */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950">
                  <TrendingUp size={14} />
                </span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Featured Marketplace Listings
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Curated items from verified merchant catalogs across Kenya
              </p>
            </div>
            <Link
              to="/marketplace/retail"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              Browse All <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="py-12">
              <Spinner />
            </div>
          ) : featuredListings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-slate-400 dark:border-slate-800">
              <Store size={36} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm">No featured listings published yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {featuredListings.map((item) => (
                <MarketplaceListingCard key={item._id} listing={item} />
              ))}
            </div>
          )}
        </section>

        {/* Trust & Architecture Banner */}
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950">
                <Store size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white">Owning Business Attribution</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Every product link directly identifies the merchant owner, inventory stock, and contact info.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white">Verified Moderation</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Category admins inspect enrollments and product listings to ensure quality, compliance, and accurate stock.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-950">
                <CheckCircle size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white">Split Ledger Settlements</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  M-Pesa payments are reconciled per order item, routing commissions and net settlements straight to each seller.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} ChamaManager Multi-Vendor Marketplace. All rights reserved.</p>
          <div className="flex gap-4 font-bold">
            <Link to="/marketplace/retail" className="hover:text-emerald-600">Retail</Link>
            <Link to="/marketplace/rentals" className="hover:text-emerald-600">Rentals</Link>
            <Link to="/marketplace/services" className="hover:text-emerald-600">Services</Link>
            <Link to="/marketplace/food" className="hover:text-emerald-600">Food</Link>
            <Link to="/marketplace/track" className="hover:text-emerald-600">Track Order</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
