import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Store,
  ShoppingCart,
  ShieldCheck,
  Truck,
  RotateCcw,
  MapPin,
  Phone,
  ChevronRight,
  ChevronLeft,
  Bed,
  Bath,
  Maximize2,
  Layers,
  Calendar,
  Eye,
  Star,
  Heart,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Compass,
} from "lucide-react";
import MarketplaceNavbar from "../components/MarketplaceNavbar";
import MarketplaceCartDrawer from "../components/MarketplaceCartDrawer";
import MarketplaceListingCard from "../components/MarketplaceListingCard";
import RentalTourBookingModal from "../components/RentalTourBookingModal";
import { useMarketplaceCart } from "../context/MarketplaceCartContext";
import marketplaceService from "../services/marketplace.service";
import Spinner from "@/shared/components/ui/Spinner";
import toast from "react-hot-toast";

export default function MarketplaceListingDetailPage() {
  const { category = "retail", slug } = useParams();
  const { addToCart } = useMarketplaceCart();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    async function loadItem() {
      setLoading(true);
      try {
        const res = await marketplaceService.getListing(slug, category);
        setData(res);
        setActiveImageIdx(0);
      } catch (err) {
        console.error("Failed to load listing detail", err);
      } finally {
        setLoading(false);
      }
    }
    loadItem();
  }, [category, slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <MarketplaceNavbar categorySlug={category} />
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!data?.listing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <MarketplaceNavbar categorySlug={category} />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <Store size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Listing Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">This property or item may have been unlisted or rented out.</p>
          <Link
            to={`/marketplace/${category}`}
            className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800"
          >
            Back to {category.toUpperCase()} Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const { listing, merchant, relatedListings } = data;
  const isRental = listing.category_slug === "rentals";
  const isOutOfStock = listing.track_stock && listing.stock <= 0;

  const images = listing.images?.length
    ? listing.images
    : listing.thumbnail
    ? [listing.thumbnail]
    : [];

  const rentAttr = listing.rental_attributes || {};
  const agent = rentAttr.agent || {
    name: merchant?.display_name || "Alaya Saunders",
    role: "Senior Leasing Director",
    phone: merchant?.phone || "+254712345678",
    whatsapp: merchant?.phone || "+254712345678",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80",
    verified: true,
    rating: 4.9,
    reviews_count: 112,
    experience_years: 6,
    active_ads_count: 14,
  };

  const nextGalleryImage = () => {
    setActiveImageIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevGalleryImage = () => {
    setActiveImageIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const openWhatsAppContact = () => {
    const cleanPhone = (agent.whatsapp || agent.phone || "+254712345678").replace(/[^\d]/g, "");
    const text = encodeURIComponent(
      `Hello ${agent.name}, I am interested in viewing your rental property:\n*${listing.title}* (${rentAttr.location_text || "Nairobi"})\nRent: KES ${listing.price?.toLocaleString()} / ${rentAttr.rent_period || "mo"}.\nIs it still available?`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <MarketplaceNavbar categorySlug={listing.category_slug || category} />
      <MarketplaceCartDrawer />

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-8 w-full space-y-8">
        {/* Breadcrumb Bar */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link
            to={`/marketplace/${listing.category_slug || category}`}
            className="font-bold text-teal-700 hover:underline capitalize dark:text-teal-400"
          >
            {isRental ? "Rentals & Real Estate" : `${listing.category_slug.toUpperCase()} Marketplace`}
          </Link>
          <ChevronRight size={13} />
          {rentAttr.city && (
            <>
              <span className="text-slate-400">{rentAttr.city}</span>
              <ChevronRight size={13} />
            </>
          )}
          <span className="truncate max-w-md text-slate-900 font-bold dark:text-white">
            {listing.title}
          </span>
        </div>

        {/* ========================================================================= */}
        {/* RENTALS HIGH-FIDELITY PROPERTY DETAIL VIEW (Matching Image 5) */}
        {/* ========================================================================= */}
        {isRental ? (
          <div className="space-y-8">
            {/* 1. WIDE HERO IMAGE GALLERY CAROUSEL (Image 5) */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="relative aspect-16/9 sm:aspect-21/9 w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                {images.length > 0 ? (
                  <img
                    src={images[activeImageIdx]}
                    alt={listing.title}
                    className="h-full w-full object-cover transition duration-300"
                  />
                ) : (
                  <Store size={64} className="text-slate-300 dark:text-slate-700" />
                )}

                {/* Left & Right Chevrons */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevGalleryImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/50 text-white backdrop-blur-md hover:bg-slate-950/80 transition"
                      title="Previous Image"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={nextGalleryImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/50 text-white backdrop-blur-md hover:bg-slate-950/80 transition"
                      title="Next Image"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}

                {/* Badges on Gallery */}
                <div className="absolute left-4 top-4 flex gap-2">
                  <span className="rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-black uppercase tracking-wider text-white backdrop-blur-md shadow-md">
                    Verified 100%
                  </span>
                  {rentAttr.furnished && (
                    <span className="rounded-full bg-teal-800/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-md shadow-md">
                      Furnished
                    </span>
                  )}
                  {rentAttr.pets_allowed && (
                    <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-bold text-white backdrop-blur-md shadow-md">
                      Allowed with pets
                    </span>
                  )}
                </div>
              </div>

              {/* Thumbnail Strip */}
              {images.length > 1 && (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`relative h-18 w-28 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                        activeImageIdx === idx
                          ? "border-teal-600 ring-2 ring-teal-500 shadow-md"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt="Thumb" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. HEADER STRIP: Title + Price + Specs Strip + Verified Realtor Card (Image 5) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Details Section (8 cols) */}
              <div className="lg:col-span-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
                {/* Title & Price Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-snug">
                      {listing.title}
                    </h1>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <MapPin size={14} className="text-teal-600 shrink-0" />
                      <span>{rentAttr.address || rentAttr.location_text || "Nairobi, Kenya"}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div>
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                        KES {listing.price?.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {" "}
                        / {rentAttr.rent_period || "mo"}
                      </span>
                    </div>

                    <button
                      onClick={() => setIsFavorited(!isFavorited)}
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                        isFavorited
                          ? "border-rose-500 bg-rose-50 text-rose-500 dark:bg-rose-950/40"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"
                      }`}
                      title="Favorite"
                    >
                      <Heart size={18} className={isFavorited ? "fill-rose-500" : ""} />
                    </button>
                  </div>
                </div>

                {/* Specs Strip with Icons (Image 5) */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-800/50">
                  <div className="space-y-1">
                    <Bed size={18} className="mx-auto text-teal-600" />
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      {rentAttr.bedrooms === 0 ? "Studio" : `${rentAttr.bedrooms || 1} room`}
                    </span>
                    <span className="text-[10px] text-slate-400">Bedrooms</span>
                  </div>

                  <div className="space-y-1">
                    <Bath size={18} className="mx-auto text-teal-600" />
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      {rentAttr.bathrooms || 1} bathroom
                    </span>
                    <span className="text-[10px] text-slate-400">Bathrooms</span>
                  </div>

                  <div className="space-y-1">
                    <Maximize2 size={18} className="mx-auto text-teal-600" />
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      {rentAttr.area_sqm ? `${rentAttr.area_sqm} M²` : "N/A"}
                    </span>
                    <span className="text-[10px] text-slate-400">Total Area</span>
                  </div>

                  <div className="space-y-1">
                    <Layers size={18} className="mx-auto text-teal-600" />
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      {rentAttr.floor || "Floor 3"}
                    </span>
                    <span className="text-[10px] text-slate-400">Floor Level</span>
                  </div>

                  <div className="space-y-1">
                    <Calendar size={18} className="mx-auto text-teal-600" />
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      {rentAttr.year_built || "2022"} Year
                    </span>
                    <span className="text-[10px] text-slate-400">Year Built</span>
                  </div>

                  <div className="space-y-1">
                    <Eye size={18} className="mx-auto text-teal-600" />
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      {listing.view_count || 128} Views
                    </span>
                    <span className="text-[10px] text-slate-400">Total Views</span>
                  </div>
                </div>

                {/* Description & Overview */}
                <div className="space-y-3">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Property Description
                  </h3>
                  <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                    {listing.description || listing.short_description}
                  </div>
                </div>

                {/* Room Breakdown Cards (Matching Image 5: /Planning, /Kitchen-living room, etc.) */}
                {rentAttr.room_breakdown?.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Room & Layout Spaces
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {rentAttr.room_breakdown.map((room, idx) => (
                        <div
                          key={idx}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60"
                        >
                          <div className="aspect-4/3 w-full overflow-hidden bg-slate-200">
                            <img
                              src={room.image_url}
                              alt={room.room_name}
                              className="h-full w-full object-cover transition hover:scale-105"
                            />
                          </div>
                          <div className="p-2.5">
                            <span className="block font-black text-xs text-slate-900 dark:text-white truncate">
                              {room.room_name}
                            </span>
                            {room.area_sqm && (
                              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 block mt-0.5">
                                {room.area_sqm} m²
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amenities & Features Checklist */}
                {rentAttr.amenities?.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Amenities & Facilities
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {rentAttr.amenities.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          <CheckCircle2 size={14} className="text-teal-600 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Verified Realtor Card (Image 5) + Quick Actions */}
              <div className="lg:col-span-4 space-y-6">
                {/* Landlord / Realtor Card (Image 5) */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-5">
                  <div className="flex items-center gap-3">
                    <img
                      src={agent.avatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80"}
                      alt={agent.name}
                      className="h-16 w-16 rounded-2xl object-cover shadow-sm ring-2 ring-teal-500/30"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          {agent.name}
                        </h3>
                        {agent.verified && (
                          <ShieldCheck size={16} className="text-teal-600" title="Verified Landlord" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{agent.role || "Realtor"}</p>
                    </div>
                  </div>

                  {/* Agent Stats Strip (Image 5) */}
                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
                    <div>
                      <div className="flex items-center justify-center gap-0.5 text-xs font-black text-slate-900 dark:text-white">
                        <Star size={11} className="fill-amber-400 text-amber-400" />
                        <span>{agent.rating || 4.9}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">({agent.reviews_count || 112})</span>
                    </div>

                    <div>
                      <span className="block text-xs font-black text-slate-900 dark:text-white">
                        {agent.experience_years || 4} Yrs
                      </span>
                      <span className="text-[10px] text-slate-400">Experience</span>
                    </div>

                    <div>
                      <span className="block text-xs font-black text-slate-900 dark:text-white">
                        {agent.active_ads_count || 10} Ads
                      </span>
                      <span className="text-[10px] text-slate-400">Active Listings</span>
                    </div>
                  </div>

                  {/* Dual Primary Buttons (Image 5: "Book a preview" & "Contact with realtor") */}
                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={() => setShowBookingModal(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 transition dark:bg-teal-700 dark:hover:bg-teal-800"
                    >
                      <Calendar size={15} />
                      Book a Preview Tour
                    </button>

                    <button
                      onClick={openWhatsAppContact}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-800 hover:bg-slate-50 transition dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <MessageSquare size={15} className="text-teal-600" />
                      Contact Landlord (WhatsApp)
                    </button>

                    <a
                      href={`tel:${agent.phone || ""}`}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Phone size={14} />
                      Call Agent ({agent.phone || "+254 712 345 678"})
                    </a>
                  </div>
                </div>

                {/* Mini Address / Neighborhood Map Preview (Image 5) */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Compass size={14} className="text-teal-600" /> Location & Address
                    </h4>
                    <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400">
                      {rentAttr.city || "Nairobi"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {rentAttr.address || rentAttr.location_text || "Nairobi, Kenya"}
                  </p>

                  <div className="relative aspect-16/10 w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 dark:border-slate-800 dark:bg-slate-800 flex items-center justify-center">
                    <svg className="h-full w-full opacity-40" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="minimap" width="30" height="30" patternUnits="userSpaceOnUse">
                          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-slate-400" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#minimap)" />
                      <path d="M 0 50 Q 80 70, 160 120 T 320 180" fill="none" stroke="#14b8a6" strokeWidth="3" />
                      <path d="M 120 0 Q 140 100, 160 200" fill="none" stroke="#94a3b8" strokeWidth="2" />
                    </svg>
                    {/* Pulsing Pin */}
                    <div className="absolute flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-white shadow-xl ring-4 ring-teal-500/30">
                        <MapPin size={16} />
                      </div>
                      <span className="mt-1 rounded-md bg-slate-950 px-2 py-0.5 text-[9px] font-black text-white shadow-md">
                        {rentAttr.neighborhood || "Exact Spot"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SIMILAR & RECENTLY VIEWED PROPERTIES (Image 5 Bottom) */}
            {relatedListings?.length > 0 && (
              <div className="border-t border-slate-200 pt-10 dark:border-slate-800">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      Similar Properties in this Neighborhood
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Explore more verified vacancies with comparable pricing and specifications
                    </p>
                  </div>
                  <Link
                    to="/marketplace/rentals"
                    className="text-xs font-bold text-teal-700 hover:underline dark:text-teal-400"
                  >
                    View All Rentals &rarr;
                  </Link>
                </div>

                <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedListings.map((rel) => (
                    <MarketplaceListingCard key={rel._id} listing={rel} />
                  ))}
                </div>
              </div>
            )}

            {/* Tour Booking Modal */}
            <RentalTourBookingModal
              isOpen={showBookingModal}
              onClose={() => setShowBookingModal(false)}
              listing={listing}
              agent={agent}
            />
          </div>
        ) : (
          /* STANDARD RETAIL / SERVICE / FOOD DETAIL VIEW */
          <div className="grid gap-10 lg:grid-cols-12 items-start">
            <div className="lg:col-span-6 space-y-3">
              <div className="aspect-4/3 w-full overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm flex items-center justify-center">
                {images.length > 0 ? (
                  <img
                    src={images[activeImageIdx]}
                    alt={listing.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Store size={64} className="text-slate-300 dark:text-slate-700" />
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                        activeImageIdx === idx
                          ? "border-emerald-600 shadow-md"
                          : "border-slate-200 opacity-60 hover:opacity-100 dark:border-slate-700"
                      }`}
                    >
                      <img src={img} alt="Thumbnail" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 space-y-6">
              <div>
                {listing.subcategory && (
                  <span className="inline-block rounded-lg bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {listing.subcategory}
                  </span>
                )}
                <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl leading-snug">
                  {listing.title}
                </h1>

                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    {listing.currency || "KES"} {listing.price?.toLocaleString()}
                  </span>
                  {listing.compare_price && (
                    <span className="text-sm font-semibold text-slate-400 line-through">
                      KES {listing.compare_price?.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  {isOutOfStock ? (
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md dark:bg-rose-950">
                      Out of Stock
                    </span>
                  ) : listing.track_stock ? (
                    <span className="text-xs font-bold text-emerald-600">
                      In Stock ({listing.stock} units available)
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600">Available on Order</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-1">
                  <button
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="px-2.5 py-1 text-sm font-bold text-slate-600 hover:text-emerald-600 disabled:opacity-30"
                  >
                    -
                  </button>
                  <span className="px-3 text-xs font-black text-slate-900 dark:text-white">
                    {qty}
                  </span>
                  <button
                    disabled={listing.track_stock && qty >= listing.stock}
                    onClick={() => setQty((q) => q + 1)}
                    className="px-2.5 py-1 text-sm font-bold text-slate-600 hover:text-emerald-600 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                <button
                  disabled={isOutOfStock}
                  onClick={() => addToCart(listing, qty)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-40 transition"
                >
                  <ShoppingCart size={16} />
                  Add to Marketplace Cart
                </button>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      <Store size={22} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                        Sold & Fulfilled by
                      </span>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {merchant.display_name}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={12} /> {merchant.location || "Nairobi, Kenya"}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/businesses/${merchant.slug}`}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    View Storefront
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>Verified Merchant</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Truck size={14} className="text-emerald-600" />
                    <span>Fast Local Delivery</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">Product Description</h4>
                <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                  {listing.description || "No description provided for this listing."}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
