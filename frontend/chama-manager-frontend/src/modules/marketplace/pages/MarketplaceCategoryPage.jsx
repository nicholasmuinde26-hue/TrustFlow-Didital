import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  Filter,
  SlidersHorizontal,
  X,
  Search,
  Store,
  ChevronRight,
  ArrowUpDown,
  Building2,
  Home,
  Bed,
  Palmtree,
  LandPlot,
  Map,
  Grid,
  Columns,
  MapPin,
  Sparkles,
  ShieldCheck,
  Eye,
} from "lucide-react";
import MarketplaceNavbar from "../components/MarketplaceNavbar";
import MarketplaceCartDrawer from "../components/MarketplaceCartDrawer";
import MarketplaceListingCard from "../components/MarketplaceListingCard";
import RentalMapSplitView from "../components/RentalMapSplitView";
import marketplaceService from "../services/marketplace.service";
import Spinner from "@/shared/components/ui/Spinner";

export default function MarketplaceCategoryPage() {
  const { categorySlug = "retail" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [categoryData, setCategoryData] = useState(null);
  const [listings, setListings] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  // Search & Filter State
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedSubcat, setSelectedSubcat] = useState(searchParams.get("subcategory") || "All");
  const [propertyType, setPropertyType] = useState(searchParams.get("propertyType") || "All");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [inStock, setInStock] = useState(searchParams.get("inStock") === "true");
  const [bedrooms, setBedrooms] = useState(searchParams.get("bedrooms") || "");
  const [rentPeriod, setRentPeriod] = useState(searchParams.get("rentPeriod") || "");
  const [petsAllowed, setPetsAllowed] = useState(searchParams.get("petsAllowed") === "true");
  const [furnished, setFurnished] = useState(searchParams.get("furnished") === "true");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "featured");
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));

  // View Mode: 'grid' | 'split_map' | 'full_map'
  const isRental = categorySlug === "rentals";
  const [viewMode, setViewMode] = useState(isRental ? "grid" : "grid");
  const [selectedListingId, setSelectedListingId] = useState(null);

  // Load category details
  useEffect(() => {
    async function loadCategory() {
      try {
        const cat = await marketplaceService.getCategory(categorySlug);
        setCategoryData(cat);
      } catch (err) {
        console.error("Error loading category", err);
      }
    }
    loadCategory();
  }, [categorySlug]);

  // Load listings whenever filters change
  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      try {
        const params = {
          category: categorySlug,
          search: search.trim() || undefined,
          subcategory: selectedSubcat !== "All" ? selectedSubcat : undefined,
          propertyType: propertyType !== "All" ? propertyType : undefined,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
          inStock: inStock || undefined,
          bedrooms: bedrooms || undefined,
          rentPeriod: rentPeriod || undefined,
          petsAllowed: petsAllowed || undefined,
          furnished: furnished || undefined,
          sortBy,
          page,
          limit: 18,
        };

        const result = await marketplaceService.searchListings(params);
        setListings(result.listings || []);
        setPagination(result.pagination || {});
      } catch (err) {
        console.error("Failed to load listings", err);
      } finally {
        setLoading(false);
      }
    }
    fetchListings();
  }, [
    categorySlug,
    search,
    selectedSubcat,
    propertyType,
    minPrice,
    maxPrice,
    inStock,
    bedrooms,
    rentPeriod,
    petsAllowed,
    furnished,
    sortBy,
    page,
  ]);

  const clearFilters = () => {
    setSearch("");
    setSelectedSubcat("All");
    setPropertyType("All");
    setMinPrice("");
    setMaxPrice("");
    setInStock(false);
    setBedrooms("");
    setRentPeriod("");
    setPetsAllowed(false);
    setFurnished(false);
    setSortBy("featured");
    setPage(1);
  };

  const handleHeroSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <MarketplaceNavbar onSearch={(q) => setSearch(q)} categorySlug={categorySlug} />
      <MarketplaceCartDrawer />

      {/* ========================================================================= */}
      {/* RENTALS & PROPERTY SPECIFIC HEADER (Matching Image 1) */}
      {/* ========================================================================= */}
      {isRental ? (
        <>
          {/* Emerald/Teal Solid Hero Banner */}
          <section className="relative overflow-hidden bg-[#0d5c52] py-16 px-4 text-white shadow-lg sm:px-8">
            <div className="mx-auto max-w-5xl text-center space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-md">
                <Building2 size={13} className="text-teal-300" />
                <span>Verified Rentals & Real Estate</span>
              </div>

              <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl drop-shadow-xs">
                Find The Perfect Rental
              </h1>
              <p className="mx-auto max-w-xl text-sm sm:text-base text-teal-100 font-medium leading-relaxed">
                Discover the perfect property that suits your needs. Transparent pricing, zero broker inflation, and direct landlord contact.
              </p>

              {/* Inline Search Bar (Image 1) */}
              <form
                onSubmit={handleHeroSearch}
                className="mx-auto mt-8 max-w-3xl rounded-2xl bg-white p-2.5 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center gap-2"
              >
                <div className="relative flex-1 w-full">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Enter Location or Keyword (e.g. Kilimani, Studio, Karen)..."
                    className="w-full rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Property Type Dropdown */}
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full sm:w-44 rounded-xl border-l-0 sm:border-l sm:border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-hidden"
                >
                  <option value="All">All Property Types</option>
                  <option value="Apartment">Apartments</option>
                  <option value="Villa">Villas & Mansions</option>
                  <option value="Bedsitter">Bedsitter / Studio</option>
                  <option value="Penthouse">Penthouses</option>
                  <option value="Commercial">Commercial Offices</option>
                  <option value="Townhouse">Townhouses</option>
                </select>

                <button
                  type="submit"
                  className="w-full sm:w-auto rounded-xl bg-[#14b8a6] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-md hover:bg-[#2dd4bf] transition"
                >
                  Search
                </button>
              </form>
            </div>
          </section>

          {/* Airbnb-style Subcategories Icons Bar (Image 2) */}
          <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-8 w-full">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setSelectedSubcat("All");
                  setPropertyType("All");
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  selectedSubcat === "All" && propertyType === "All"
                    ? "bg-[#0d5c52] text-white shadow-md"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <Building2 size={15} /> All Properties
              </button>

              <button
                onClick={() => {
                  setSelectedSubcat("apartments");
                  setPropertyType("Apartment");
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  selectedSubcat === "apartments"
                    ? "bg-[#0d5c52] text-white shadow-md"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <Building2 size={15} /> Apartments
              </button>

              <button
                onClick={() => {
                  setSelectedSubcat("houses");
                  setPropertyType("Villa");
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  selectedSubcat === "houses"
                    ? "bg-[#0d5c52] text-white shadow-md"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <Home size={15} /> Mansions & Villas
              </button>

              <button
                onClick={() => {
                  setSelectedSubcat("rooms");
                  setPropertyType("Bedsitter");
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  selectedSubcat === "rooms"
                    ? "bg-[#0d5c52] text-white shadow-md"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <Bed size={15} /> Bedsitters & Studios
              </button>

              <button
                onClick={() => {
                  setSelectedSubcat("commercial");
                  setPropertyType("Commercial");
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  selectedSubcat === "commercial"
                    ? "bg-[#0d5c52] text-white shadow-md"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <Store size={15} /> Commercial Spaces
              </button>

              <button
                onClick={() => {
                  setSelectedSubcat("beachfront");
                  setPropertyType("Beachfront");
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  selectedSubcat === "beachfront"
                    ? "bg-[#0d5c52] text-white shadow-md"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <Palmtree size={15} /> Beachfront
              </button>

              <button
                onClick={() => {
                  setSelectedSubcat("plots");
                  setPropertyType("Plots");
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  selectedSubcat === "plots"
                    ? "bg-[#0d5c52] text-white shadow-md"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <LandPlot size={15} /> Land & Plots
              </button>
            </div>
          </section>
        </>
      ) : (
        /* Retail / Food / Services Hero Banner */
        <section
          className={`relative overflow-hidden py-10 px-4 sm:px-8 text-white shadow-md bg-gradient-to-r ${
            categoryData?.theme_gradient || "from-slate-950 to-indigo-950"
          }`}
          style={{ backgroundColor: categoryData?.theme_color }}
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-xs">
                Independent Category Marketplace
              </span>
              <span className="text-white/40">•</span>
              <span className="text-white font-bold capitalize">
                {categoryData?.name || `${categorySlug} Marketplace`}
              </span>
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {categoryData?.hero_title || categoryData?.name || `${categorySlug.toUpperCase()} Marketplace`}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
              {categoryData?.hero_subtitle || categoryData?.tagline || categoryData?.description}
            </p>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MAIN LISTINGS & VIEW CONTENT */}
      {/* ========================================================================= */}
      <main id="property-listings-section" className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-8 w-full">
        {/* Top Control Bar: Total Count + View Switcher + Sort */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileFilter(!showMobileFilter)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs md:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <Filter size={14} /> Filters
            </button>
            <span className="text-xs font-bold text-slate-500">
              <strong className="text-slate-900 dark:text-white font-black">
                {pagination.total ?? listings.length}
              </strong>{" "}
              {isRental ? "properties available" : "items found"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Switcher for Rentals (Image 2 & Image 4) */}
            {isRental && (
              <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === "grid"
                      ? "bg-teal-700 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
                  }`}
                  title="Rentoria Grid View"
                >
                  <Grid size={13} />
                  <span className="hidden sm:inline">Grid</span>
                </button>

                <button
                  onClick={() => setViewMode("split_map")}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === "split_map"
                      ? "bg-teal-700 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
                  }`}
                  title="Split Map & Listings View"
                >
                  <Columns size={13} />
                  <span className="hidden sm:inline">Split Map</span>
                </button>

                <button
                  onClick={() => setViewMode("full_map")}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === "full_map"
                      ? "bg-teal-700 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
                  }`}
                  title="Full Interactive Map"
                >
                  <Map size={13} />
                  <span className="hidden sm:inline">Map Only</span>
                </button>
              </div>
            )}

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
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="newest">Newest Arrivals</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Chips Row with Quick Dismiss (Image 4) */}
        {(selectedSubcat !== "All" ||
          propertyType !== "All" ||
          bedrooms ||
          petsAllowed ||
          furnished ||
          search ||
          minPrice ||
          maxPrice) && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Active Filters:
            </span>

            {search && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                "{search}"
                <button onClick={() => setSearch("")} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}

            {propertyType !== "All" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                Type: {propertyType}
                <button onClick={() => setPropertyType("All")} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}

            {bedrooms && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                {bedrooms === "0" ? "Studio / Bedsitter" : `${bedrooms} Bedrooms`}
                <button onClick={() => setBedrooms("")} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}

            {petsAllowed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                🐾 Pets Allowed
                <button onClick={() => setPetsAllowed(false)} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}

            {furnished && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                🛋️ Furnished
                <button onClick={() => setFurnished(false)} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              onClick={clearFilters}
              className="text-xs font-bold text-rose-600 hover:underline ml-1"
            >
              Clear All
            </button>
          </div>
        )}

        {/* FULL MAP VIEW */}
        {isRental && viewMode === "full_map" ? (
          <div className="w-full">
            <RentalMapSplitView
              listings={listings}
              selectedListingId={selectedListingId}
              onSelectListing={(id) => setSelectedListingId(id)}
            />
          </div>
        ) : (
          /* GRID OR SPLIT MAP VIEW */
          <div className="flex gap-8 items-start">
            {/* Desktop Filter Sidebar (Only in Grid Mode to save space) */}
            {viewMode === "grid" && (
              <aside
                className={`w-64 shrink-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 ${
                  showMobileFilter
                    ? "fixed inset-x-4 top-20 z-50 max-h-[85vh] overflow-y-auto block md:relative md:inset-auto md:max-h-none md:block"
                    : "hidden md:block"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <SlidersHorizontal size={14} /> Filter Listings
                  </span>
                  <button onClick={clearFilters} className="text-[11px] font-bold text-teal-600 hover:underline">
                    Reset
                  </button>
                </div>

                <div className="mt-4 space-y-5 text-xs">
                  {/* Price Range */}
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Monthly Price (KES)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={minPrice}
                        onChange={(e) => {
                          setMinPrice(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Min"
                        className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <span className="text-slate-400">-</span>
                      <input
                        type="number"
                        value={maxPrice}
                        onChange={(e) => {
                          setMaxPrice(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Max"
                        className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Rental specific: Bedrooms */}
                  {isRental && (
                    <>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                          Bedrooms
                        </label>
                        <select
                          value={bedrooms}
                          onChange={(e) => {
                            setBedrooms(e.target.value);
                            setPage(1);
                          }}
                          className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="">Any Bedrooms</option>
                          <option value="0">Bedsitter / Studio</option>
                          <option value="1">1 Bedroom</option>
                          <option value="2">2 Bedrooms</option>
                          <option value="3">3 Bedrooms</option>
                          <option value="4">4+ Bedrooms</option>
                        </select>
                      </div>

                      {/* Amenities Checkboxes */}
                      <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Preferences
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="petsAllowedCheck"
                            checked={petsAllowed}
                            onChange={(e) => {
                              setPetsAllowed(e.target.checked);
                              setPage(1);
                            }}
                            className="rounded-sm text-teal-600 focus:ring-teal-500"
                          />
                          <label htmlFor="petsAllowedCheck" className="cursor-pointer text-slate-700 dark:text-slate-300">
                            Pets Allowed
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="furnishedCheck"
                            checked={furnished}
                            onChange={(e) => {
                              setFurnished(e.target.checked);
                              setPage(1);
                            }}
                            className="rounded-sm text-teal-600 focus:ring-teal-500"
                          />
                          <label htmlFor="furnishedCheck" className="cursor-pointer text-slate-700 dark:text-slate-300">
                            Furnished Interior
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {showMobileFilter && (
                  <button
                    onClick={() => setShowMobileFilter(false)}
                    className="mt-6 w-full rounded-xl bg-teal-700 py-2 text-xs font-bold text-white md:hidden"
                  >
                    Apply Filters
                  </button>
                )}
              </aside>
            )}

            {/* Content Column: either Rentoria Grid or Split Map (Image 4) */}
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="py-20 flex justify-center">
                  <Spinner />
                </div>
              ) : listings.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <Store size={44} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    No listings found
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Try clearing some filters or searching for something else in this marketplace hub.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : viewMode === "split_map" && isRental ? (
                /* SPLIT MAP + LISTINGS VIEW (Image 4) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Map Column */}
                  <div className="lg:col-span-6 sticky top-20">
                    <RentalMapSplitView
                      listings={listings}
                      selectedListingId={selectedListingId}
                      onSelectListing={(id) => setSelectedListingId(id)}
                    />
                  </div>

                  {/* Listings Column */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {listings.map((item) => (
                        <div
                          key={item._id}
                          className={selectedListingId === item._id ? "ring-2 ring-teal-500 rounded-3xl" : ""}
                        >
                          <MarketplaceListingCard listing={item} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD GRID VIEW (Image 3) */
                <>
                  <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {listings.map((item) => (
                      <MarketplaceListingCard key={item._id} listing={item} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="mt-10 flex items-center justify-center gap-2">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-bold text-slate-500">
                        Page {page} of {pagination.totalPages}
                      </span>
                      <button
                        disabled={page >= pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
