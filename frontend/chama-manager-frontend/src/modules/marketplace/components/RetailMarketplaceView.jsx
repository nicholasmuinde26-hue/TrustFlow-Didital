import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Filter,
  SlidersHorizontal,
  X,
  Search,
  Store,
  ArrowUpDown,
  Grid,
  List,
  Sparkles,
  ShieldCheck,
  Star,
  Phone,
  Truck,
  RotateCcw,
  BadgePercent,
  Layers,
  ChevronDown,
  Check,
  ShoppingBag,
  ExternalLink,
  Laptop,
  Tv,
  Smartphone,
  Shirt,
  Footprints,
  Armchair,
  Apple,
  Eye,
  Mail,
  Flame,
  Award,
} from "lucide-react";
import MarketplaceListingCard from "./MarketplaceListingCard";
import Spinner from "@/shared/components/ui/Spinner";
import marketplaceService from "../services/marketplace.service";
import toast from "react-hot-toast";

// Brands list matching Image 1 & Image 4
const RETAIL_BRANDS = [
  { name: "HP", logo: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=150&q=80" },
  { name: "Samsung", logo: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=150&q=80" },
  { name: "Sony", logo: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=150&q=80" },
  { name: "Apple", logo: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=150&q=80" },
  { name: "BenQ", logo: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=150&q=80" },
  { name: "Philips", logo: "https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=150&q=80" },
  { name: "BeatXP", logo: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=150&q=80" },
  { name: "Levi's", logo: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=150&q=80" },
  { name: "Puma", logo: "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=150&q=80" },
  { name: "Acer", logo: "https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=150&q=80" },
  { name: "Nikon", logo: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=150&q=80" },
  { name: "Master Chef", logo: "https://images.unsplash.com/photo-1584990347449-397a61d15582?auto=format&fit=crop&w=150&q=80" },
  { name: "Babyganics", logo: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=150&q=80" },
];

const CATEGORY_ITEMS = [
  { slug: "All", name: "All Categories", icon: Layers },
  { slug: "electronics", name: "Electronics & Computers", icon: Laptop },
  { slug: "appliances", name: "Appliances & Kitchen", icon: Tv },
  { slug: "mobiles", name: "Mobiles & Smartwatches", icon: Smartphone },
  { slug: "clothing", name: "Clothing & Fashion", icon: Shirt },
  { slug: "footwear", name: "Footwear & Shoes", icon: Footprints },
  { slug: "furniture", name: "Furniture & Office", icon: Armchair },
  { slug: "beauty", name: "Beauty & Personal Care", icon: Sparkles },
  { slug: "groceries", name: "Groceries & Supermarket", icon: Apple },
];

export default function RetailMarketplaceView({
  listings,
  pagination,
  loading,
  search,
  setSearch,
  selectedSubcat,
  setSelectedSubcat: setSelectedSubcatProp,
  selectedBrand,
  setSelectedBrand: setSelectedBrandProp,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  minRating,
  setMinRating,
  inStock,
  setInStock,
  sortBy,
  setSortBy,
  page,
  setPage,
  clearFilters: clearFiltersProp,
  categoryData,
}) {
  const [stores, setStores] = useState([]);
  // Products come first. The verified store directory stays collapsed until
  // the shopper opens it from the "Verified Stores" link.
  const [showStores, setShowStores] = useState(false);
  const storesSectionRef = useRef(null);
  const mainRef = useRef(null);
  const categoryMenuRef = useRef(null);

  const scrollToProducts = () =>
    setTimeout(() => mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

  // Anything that navigates to products (a department, Home, a brand, clear
  // filters) closes the store directory and brings the products into view.
  const leaveStores = () => {
    if (!showStores) return;
    setShowStores(false);
    scrollToProducts();
  };
  const setSelectedSubcat = (value) => {
    leaveStores();
    setSelectedSubcatProp(value);
  };
  const setSelectedBrand = (value) => {
    leaveStores();
    setSelectedBrandProp(value);
  };
  const clearFilters = () => {
    leaveStores();
    clearFiltersProp();
  };

  const toggleStores = () => {
    setIsCategoryMenuOpen(false);
    if (showStores) {
      setShowStores(false);
      return;
    }
    setShowStores(true);
    // wait for the section to render, then bring it into view
    setTimeout(() => storesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'compact'
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  // Local price input state for user editing before applying
  const [tempMinPrice, setTempMinPrice] = useState(minPrice);
  const [tempMaxPrice, setTempMaxPrice] = useState(maxPrice);

  useEffect(() => {
    setTempMinPrice(minPrice);
  }, [minPrice]);

  useEffect(() => {
    setTempMaxPrice(maxPrice);
  }, [maxPrice]);

  // Typing a search means the shopper wants products, not the store directory.
  useEffect(() => {
    if (search) setShowStores(false);
  }, [search]);

  // Close the department menu on outside click or Escape.
  useEffect(() => {
    if (!isCategoryMenuOpen) return undefined;
    const onDown = (e) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target)) setIsCategoryMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setIsCategoryMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isCategoryMenuOpen]);

  // Load verified retail stores
  useEffect(() => {
    async function loadStores() {
      try {
        const data = await marketplaceService.getRetailStores();
        setStores(data || []);
      } catch (err) {
        console.warn("Could not load retail stores", err);
      }
    }
    loadStores();
  }, []);

  // Compute category counts from current listings
  const categoryCounts = useMemo(() => {
    const counts = { All: listings.length };
    listings.forEach((item) => {
      const sub = item.subcategory?.toLowerCase() || "other";
      counts[sub] = (counts[sub] || 0) + 1;
    });
    return counts;
  }, [listings]);

  // Top 3 featured new products for sidebar widget (matching Image 1)
  const sidebarNewProducts = useMemo(() => {
    return listings.slice(0, 3);
  }, [listings]);

  const handleApplyPriceFilter = (e) => {
    e.preventDefault();
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setPage(1);
  };

  const handlePresetPrice = (min, max) => {
    setMinPrice(min);
    setMaxPrice(max);
    setTempMinPrice(min);
    setTempMaxPrice(max);
    setPage(1);
  };

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    setNewsletterSubscribed(true);
    toast.success("Thank you for subscribing to our retail deals!");
    setNewsletterEmail("");
  };

  // One definition of the quick links, used by the desktop bar and the phone row.
  // While the store directory is open, only "Verified Stores" looks selected.
  const departmentActive = (slug) => !showStores && selectedSubcat === slug;
  const navLinks = [
    {
      key: "home",
      label: "Home",
      active: !showStores && selectedSubcat === "All" && selectedBrand === "All",
      onClick: () => {
        setIsCategoryMenuOpen(false);
        clearFilters();
        setPage(1);
      },
    },
    ...[
      ["appliances", "Appliances"],
      ["clothing", "Clothing"],
      ["electronics", "Electronics"],
      ["mobiles", "Mobiles & Tech"],
    ].map(([slug, label]) => ({
      key: slug,
      label,
      active: departmentActive(slug),
      onClick: () => {
        setIsCategoryMenuOpen(false);
        setSelectedSubcat(slug);
        setPage(1);
      },
    })),
  ];

  const navButton = (link, mobile = false) => (
    <button
      key={link.key}
      onClick={link.onClick}
      aria-current={link.active ? "page" : undefined}
      className={`transition hover:text-emerald-600 ${mobile ? "shrink-0 whitespace-nowrap" : ""} ${
        link.active ? "text-emerald-600 font-black" : ""
      }`}
    >
      {link.label}
    </button>
  );

  const storesButton = (
    <button
      key="stores"
      onClick={toggleStores}
      aria-expanded={showStores}
      className={`flex items-center gap-1 text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-400 ${
        showStores ? "font-black underline underline-offset-4" : ""
      } shrink-0 whitespace-nowrap`}
    >
      <Store size={13} />
      <span>Verified Stores</span>
    </button>
  );

  return (
    <div className="w-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* ========================================================================= */}
      {/* 1. TOP ANNOUNCEMENT MICROBAR (Matching Image 1) */}
      {/* ========================================================================= */}
      <div className="border-b border-emerald-900/10 bg-emerald-50/60 px-4 py-2 text-[11px] font-bold text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-300 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-2 truncate">
            <span className="flex h-5 items-center rounded-full bg-emerald-600 px-2 text-[10px] font-black text-white">
              HOT
            </span>
            <span className="truncate">
              100% Secure delivery without contacting courier • Fast M-Pesa Checkout
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-5 text-slate-600 dark:text-slate-400 font-semibold">
            <a href="tel:1223456789" className="flex items-center gap-1 hover:text-emerald-600">
              <Phone size={12} className="text-emerald-600" />
              <span>Need help? Call Us: <strong>1223456789</strong></span>
            </a>
            <span>•</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">English (KES)</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-NAVIGATION BAR (Matching Image 1: All Categories dropdown + links) */}
      {/* ========================================================================= */}
      <nav className="border-b border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-8">
          <div className="flex items-center gap-4">
            {/* All Categories Button with Dropdown */}
            <div className="relative" ref={categoryMenuRef}>
              <button
                onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                aria-expanded={isCategoryMenuOpen}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:bg-emerald-700 transition"
              >
                <Layers size={15} />
                <span>All Categories</span>
                <ChevronDown size={14} className={isCategoryMenuOpen ? "rotate-180 transition" : "transition"} />
              </button>

              {isCategoryMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Select Retail Department
                  </div>
                  {CATEGORY_ITEMS.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = selectedSubcat === cat.slug;
                    return (
                      <button
                        key={cat.slug}
                        onClick={() => {
                          setSelectedSubcat(cat.slug);
                          setIsCategoryMenuOpen(false);
                          setPage(1);
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition text-left ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={14} className={isActive ? "text-emerald-600" : "text-slate-400"} />
                          <span>{cat.name}</span>
                        </span>
                        {categoryCounts[cat.slug.toLowerCase()] ? (
                          <span className="text-[10px] rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {categoryCounts[cat.slug.toLowerCase()]}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Horizontal Quick Links (desktop) */}
            <div className="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-700 dark:text-slate-200">
              {navLinks.map((link) => navButton(link))}
              {storesButton}
            </div>
          </div>

          {/* Hotline Right Badge */}
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            <Phone size={14} className="text-emerald-600" />
            <span className="font-mono font-bold">1223456789</span>
            <span className="hidden sm:inline text-[10px] text-slate-400 uppercase font-semibold">
              24/7 Support
            </span>
          </div>
        </div>

        {/* Quick links (phones & tablets): same links, scrollable row */}
        <div className="lg:hidden border-t border-slate-100 dark:border-slate-800">
          <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 sm:px-8 [scrollbar-width:none]">
            {navLinks.map((link) => navButton(link, true))}
            {storesButton}
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 3. "SHOP BRANDS YOU KNOW AND LOVE" CAROUSEL STRIP (Matching Image 4) */}
      {/* ========================================================================= */}
      <section className="border-b border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-emerald-600" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Shop Brands You Know and Love
              </h2>
            </div>
            {selectedBrand !== "All" && (
              <button
                onClick={() => setSelectedBrand("All")}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                Clear Brand Filter
              </button>
            )}
          </div>

          {/* Horizontal Brand Pills */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
            <button
              onClick={() => {
                setSelectedBrand("All");
                setPage(1);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-bold transition ${
                selectedBrand === "All"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <Sparkles size={13} />
              <span>All Brands</span>
            </button>

            {RETAIL_BRANDS.map((b) => {
              const isSelected = selectedBrand.toLowerCase() === b.name.toLowerCase();
              return (
                <button
                  key={b.name}
                  onClick={() => {
                    setSelectedBrand(isSelected ? "All" : b.name);
                    setPage(1);
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-bold transition ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-300"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  <img
                    src={b.logo}
                    alt={b.name}
                    className="h-5 w-5 rounded-full object-cover shadow-xs"
                  />
                  <span>{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. "VERIFIED STORES / ALL SELLERS" SHOWCASE (Matching Image 3 & Image 5) */}
      {/* ========================================================================= */}
      {showStores && stores.length > 0 && (
        <section ref={storesSectionRef} className="scroll-mt-24 border-b border-slate-200 bg-gradient-to-b from-slate-100/60 to-white py-6 dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck size={14} /> Verified Store Directory
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Featured Retailers & Certified Sellers
                </h2>
              </div>
              <button
                onClick={() => setShowStores(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Hide Stores
              </button>
            </div>

            {/* Store Cards Grid (Matching Image 5 & Image 3) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {stores.map((store) => (
                <div
                  key={store._id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Banner & Floating Avatar (Image 5) */}
                  <div className="relative h-20 w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                    <img
                      src={store.banner}
                      alt={store.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute -bottom-3 left-3 h-10 w-10 overflow-hidden rounded-xl border-2 border-white bg-white shadow-md dark:border-slate-900">
                      <img
                        src={store.avatar}
                        alt={store.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Store Info */}
                  <div className="flex flex-1 flex-col p-3 pt-5">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <ShieldCheck size={12} />
                      <span>Verified Store</span>
                    </div>

                    <h3 className="font-bold text-slate-900 dark:text-white text-xs leading-tight line-clamp-1 mt-0.5">
                      {store.name}
                    </h3>

                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {store.location}
                    </p>

                    {/* Star Rating & Review Count */}
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      <span>{store.rating || 4.8}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({store.review_count || 120})
                      </span>
                    </div>

                    {/* Tag Badges */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {store.badges?.slice(0, 2).map((b, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          {b}
                        </span>
                      ))}
                    </div>

                    {/* Link */}
                    <Link
                      to={`/businesses/${store.slug}`}
                      className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-emerald-600 hover:text-white transition dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <span>Visit Store</span>
                      <ExternalLink size={10} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. MAIN CATALOG & SIDEBAR LAYOUT (Matching Image 1 & Image 2) */}
      {/* ========================================================================= */}
      <main ref={mainRef} className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-8 w-full scroll-mt-24">
        {/* Top Control Bar: "We found X items for you!" (Exact Image 1 Header) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileFilter(!showMobileFilter)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs md:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <Filter size={14} /> Filters
            </button>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
              We found{" "}
              <span className="text-emerald-600 font-black">
                {pagination.total ?? listings.length}
              </span>{" "}
              items for you!
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle (Grid vs Compact) */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === "grid"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
                }`}
                title="Grid View"
              >
                <Grid size={13} />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode("compact")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === "compact"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
                }`}
                title="Compact List View"
              >
                <List size={13} />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} className="text-slate-400 hidden sm:block" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="featured">Featured First</option>
                <option value="popular">Most Popular</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Customer Rating</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {(selectedSubcat !== "All" ||
          selectedBrand !== "All" ||
          minRating ||
          search ||
          minPrice ||
          maxPrice) && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Active Filters:
            </span>

            {search && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                "{search}"
                <button onClick={() => setSearch("")} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedSubcat !== "All" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Category: {selectedSubcat}
                <button onClick={() => setSelectedSubcat("All")} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedBrand !== "All" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Brand: {selectedBrand}
                <button onClick={() => setSelectedBrand("All")} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}

            {minRating && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                ★ {minRating} Stars & Up
                <button onClick={() => setMinRating("")} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}

            {(minPrice || maxPrice) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                KES {minPrice || 0} - {maxPrice || "Any"}
                <button
                  onClick={() => {
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                  className="hover:text-rose-500"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              onClick={clearFilters}
              className="text-xs font-bold text-rose-600 hover:underline ml-2"
            >
              Clear All
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SIDEBAR & PRODUCT CATALOG GRID */}
        {/* ========================================================================= */}
        <div className="flex gap-8 items-start">
          {/* Left Filter Sidebar (Image 1 & Image 2) */}
          <aside
            className={`w-72 shrink-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6 ${
              showMobileFilter
                ? "fixed inset-x-4 top-16 z-50 max-h-[85vh] overflow-y-auto block md:relative md:inset-auto md:max-h-none md:block"
                : "hidden md:block"
            }`}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <SlidersHorizontal size={14} className="text-emerald-600" /> Filters
              </span>
              <button
                onClick={clearFilters}
                className="text-[11px] font-bold text-emerald-600 hover:underline"
              >
                Reset All
              </button>
            </div>

            {/* 1. Fill by Price (Image 1 & Image 2) */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Fill By Price
              </h3>
              <form onSubmit={handleApplyPriceFilter} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      KES
                    </span>
                    <input
                      type="number"
                      value={tempMinPrice}
                      onChange={(e) => setTempMinPrice(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 pl-9 pr-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <span className="text-slate-400">-</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      KES
                    </span>
                    <input
                      type="number"
                      value={tempMaxPrice}
                      onChange={(e) => setTempMaxPrice(e.target.value)}
                      placeholder="150,000"
                      className="w-full rounded-xl border border-slate-200 pl-9 pr-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 py-1.5 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 transition"
                >
                  Apply Price Filter
                </button>
              </form>

              {/* Quick price tier pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  onClick={() => handlePresetPrice("", 5000)}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-slate-800 dark:text-slate-300"
                >
                  &lt; 5K
                </button>
                <button
                  onClick={() => handlePresetPrice(5000, 25000)}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-slate-800 dark:text-slate-300"
                >
                  5K - 25K
                </button>
                <button
                  onClick={() => handlePresetPrice(25000, 60000)}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-slate-800 dark:text-slate-300"
                >
                  25K - 60K
                </button>
                <button
                  onClick={() => handlePresetPrice(60000, "")}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-slate-800 dark:text-slate-300"
                >
                  60K+
                </button>
              </div>
            </div>

            {/* 2. Product Categories (Image 1 & Image 2) */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Category
              </h3>
              <div className="space-y-1.5">
                {CATEGORY_ITEMS.map((cat) => {
                  const isChecked = selectedSubcat === cat.slug;
                  const count = categoryCounts[cat.slug.toLowerCase()] || 0;
                  return (
                    <label
                      key={cat.slug}
                      onClick={() => {
                        setSelectedSubcat(cat.slug);
                        setPage(1);
                      }}
                      className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className={isChecked ? "font-black text-emerald-700 dark:text-emerald-400 truncate" : "text-slate-700 dark:text-slate-300 truncate"}>
                          {cat.name}
                        </span>
                      </div>
                      {count > 0 && (
                        <span className="text-[10px] font-bold text-slate-400">
                          ({count})
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. Brand Filter Checklist (Image 1) */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Brand
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {RETAIL_BRANDS.map((b) => {
                  const isChecked = selectedBrand.toLowerCase() === b.name.toLowerCase();
                  return (
                    <label
                      key={b.name}
                      onClick={() => {
                        setSelectedBrand(isChecked ? "All" : b.name);
                        setPage(1);
                      }}
                      className="flex items-center justify-between gap-2 rounded-xl px-2 py-1 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className={isChecked ? "font-black text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}>
                          {b.name}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. Products by Rating (Image 2) */}
            <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Products by Rating
              </h3>
              <div className="space-y-1">
                {[5, 4, 3].map((r) => {
                  const isChecked = Number(minRating) === r;
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        setMinRating(isChecked ? "" : String(r));
                        setPage(1);
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-2 py-1.5 text-xs transition ${
                        isChecked
                          ? "bg-amber-50 text-amber-900 font-bold dark:bg-amber-950/40 dark:text-amber-300"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="flex text-amber-400">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={11}
                              className={i < r ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-700"}
                            />
                          ))}
                        </div>
                        <span>& Up</span>
                      </div>
                      {isChecked && <Check size={12} className="text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. "New Products" Sidebar Widget (Matching Image 1) */}
            {sidebarNewProducts.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Flame size={13} className="text-rose-500" /> New Products
                </h3>
                <div className="space-y-3">
                  {sidebarNewProducts.map((p) => (
                    <Link
                      key={p._id}
                      to={`/marketplace/retail/products/${p.slug}`}
                      className="group flex items-center gap-3 rounded-2xl p-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800 flex items-center justify-center">
                        <img
                          src={p.thumbnail}
                          alt={p.title}
                          className="h-full w-full object-contain p-1 group-hover:scale-105 transition"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-emerald-600 transition">
                          {p.title}
                        </h4>
                        <div className="flex items-center gap-0.5 text-amber-400 my-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={10}
                              className={i < Math.floor(p.rating || 5) ? "fill-amber-400 text-amber-400" : "text-slate-200"}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          KES {p.price?.toLocaleString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {showMobileFilter && (
              <button
                onClick={() => setShowMobileFilter(false)}
                className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white md:hidden"
              >
                Close & View Results
              </button>
            )}
          </aside>

          {/* Product Grid Area */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="py-24 flex justify-center">
                <Spinner />
              </div>
            ) : listings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900">
                <ShoppingBag size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No products found
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Try clearing your brand or price filters to browse all available retail items.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`grid gap-5 ${
                    viewMode === "compact"
                      ? "grid-cols-1"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
                  }`}
                >
                  {listings.map((item) => (
                    <MarketplaceListingCard key={item._id} listing={item} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="mt-12 flex items-center justify-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      &larr; Previous
                    </button>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 px-3">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <button
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      Next &rarr;
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 6. NEWSLETTER / PROMO BANNER (Matching Image 1: "Stay home & get your daily needs") */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 w-full mt-10 mb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-100 via-teal-50 to-emerald-100 p-8 sm:p-12 dark:from-emerald-950/80 dark:via-slate-900 dark:to-teal-950/80 border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
          <div className="relative z-10 max-w-xl space-y-3">
            <span className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
              Daily Convenience
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight">
              Stay home & get your daily needs from our shop
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
              Start your daily shopping with verified local stores across Kenya. Enjoy express door delivery and secure escrow.
            </p>

            <form onSubmit={handleNewsletterSubmit} className="mt-6 flex max-w-md items-center gap-2">
              <div className="relative flex-1">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Your email address..."
                  className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-emerald-500 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 transition"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. VALUE PROPOSITIONS BAR (Matching Image 1: 5 Trust Badges) */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 w-full py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950">
              <BadgePercent size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Best Prices & Offers</h4>
              <p className="text-[10px] text-slate-400">Orders KES 5,000 or more</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950">
              <Truck size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Free Delivery</h4>
              <p className="text-[10px] text-slate-400">24/7 fast reliable dispatch</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950">
              <Sparkles size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Great Daily Deal</h4>
              <p className="text-[10px] text-slate-400">Special discounts verified</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Wide Assortment</h4>
              <p className="text-[10px] text-slate-400">Mega discounts & choice</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 col-span-2 lg:col-span-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950">
              <RotateCcw size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Easy Returns</h4>
              <p className="text-[10px] text-slate-400">Within 30 days hassle-free</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. RETAIL FOOTER (Matching Image 1) */}
      {/* ========================================================================= */}
      <footer className="mt-12 border-t border-slate-200 bg-white pt-12 pb-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
            {/* Brand column */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
                  <ShoppingBag size={20} />
                </div>
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Chama<span className="text-emerald-600">Retail</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                Kenya's verified community multi-vendor retail marketplace. Connect with certified independent retailers, order with confidence, and settle instantly with M-Pesa.
              </p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-1 font-medium">
                <p>📍 Address: Westlands Commercial Center, Nairobi</p>
                <p>📞 Call Us: 1223456789 / +254 700 000 000</p>
                <p>✉️ Email: support@chamacommerce.ke</p>
                <p>⏰ Hours: 08:00 - 20:00, Mon - Sat</p>
              </div>
            </div>

            {/* Column 1: Company */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3">
                Company
              </h4>
              <ul className="space-y-2 text-xs text-slate-500 font-semibold">
                <li><Link to="/marketplace" className="hover:text-emerald-600">About Us</Link></li>
                <li><Link to="/marketplace/track" className="hover:text-emerald-600">Delivery Information</Link></li>
                <li><a href="#privacy" className="hover:text-emerald-600">Privacy Policy</a></li>
                <li><a href="#terms" className="hover:text-emerald-600">Terms & Conditions</a></li>
                <li><a href="#support" className="hover:text-emerald-600">Support Center</a></li>
              </ul>
            </div>

            {/* Column 2: Account */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3">
                Account
              </h4>
              <ul className="space-y-2 text-xs text-slate-500 font-semibold">
                <li><Link to="/login" className="hover:text-emerald-600">Sign In</Link></li>
                <li><Link to="/marketplace/track" className="hover:text-emerald-600">Track My Order</Link></li>
                <li><a href="#wishlist" className="hover:text-emerald-600">My Wishlist</a></li>
                <li><a href="#compare" className="hover:text-emerald-600">Compare Products</a></li>
              </ul>
            </div>

            {/* Column 3: Corporate */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3">
                Corporate
              </h4>
              <ul className="space-y-2 text-xs text-slate-500 font-semibold">
                <li><Link to="/register" className="hover:text-emerald-600">Become a Vendor</Link></li>
                <li><a href="#suppliers" className="hover:text-emerald-600">Our Suppliers</a></li>
                <li><a href="#promotions" className="hover:text-emerald-600">Promotions & Deals</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:border-slate-800">
            <p>© 2026 Chama Retail Marketplace. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                100% Secure M-Pesa Escrow
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Visa & Mastercard
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
