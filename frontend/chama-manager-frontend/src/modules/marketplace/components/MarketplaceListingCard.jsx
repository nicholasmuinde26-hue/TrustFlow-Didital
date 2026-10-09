import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Store,
  ShoppingCart,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Layers,
  Heart,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  ArrowRight,
  Star,
  Plus,
  Check,
} from "lucide-react";
import { useMarketplaceCart } from "../context/MarketplaceCartContext";
import RentalTourBookingModal from "./RentalTourBookingModal";

const toSlug = (text) =>
  String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function MarketplaceListingCard({ listing }) {
  const { addToCart } = useMarketplaceCart();

  const business = listing.business_id || {};
  const businessName = business.name || "Verified Merchant";
  const businessSlug = toSlug(businessName);
  const categorySlug = listing.category_slug || "retail";

  const isRental = categorySlug === "rentals";
  const isService = categorySlug === "services";
  const itemUrl = isRental
    ? `/marketplace/rentals/listings/${listing.slug}`
    : `/marketplace/${categorySlug}/products/${listing.slug}`;

  // State for image carousel & favorites
  const images = listing.images?.length ? listing.images : listing.thumbnail ? [listing.thumbnail] : [];
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const prevImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveImgIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const nextImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveImgIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const toggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorited(!isFavorited);
  };

  // ==========================================================================
  // RENTORIA REAL ESTATE STYLE CARD (Image 3)
  // ==========================================================================
  if (isRental) {
    const rentAttr = listing.rental_attributes || {};
    const bedroomsLabel =
      rentAttr.bedrooms === 0
        ? "Studio"
        : rentAttr.bedrooms !== null && rentAttr.bedrooms !== undefined
        ? `${rentAttr.bedrooms} Bed${rentAttr.bedrooms > 1 ? "s" : ""}`
        : null;

    const bathroomsLabel =
      rentAttr.bathrooms !== null && rentAttr.bathrooms !== undefined
        ? `${rentAttr.bathrooms} Bath${rentAttr.bathrooms > 1 ? "s" : ""}`
        : null;

    return (
      <>
        <div className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs transition duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {/* Photo Gallery Header */}
          <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            <Link to={itemUrl} className="block h-full w-full">
              {images.length > 0 ? (
                <img
                  src={images[activeImgIdx]}
                  alt={listing.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-103"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-700">
                  <Store size={40} />
                </div>
              )}
            </Link>

            {/* Badges on Image */}
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 z-10">
              <span className="flex items-center gap-1 rounded-full bg-emerald-600/95 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md backdrop-blur-xs">
                <ShieldCheck size={11} /> Verified
              </span>
              {listing.is_featured && (
                <span className="rounded-full bg-amber-500/95 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md backdrop-blur-xs">
                  Featured
                </span>
              )}
              {rentAttr.property_type && (
                <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white shadow-md backdrop-blur-xs">
                  {rentAttr.property_type}
                </span>
              )}
            </div>

            {/* Favorite Heart Button */}
            <button
              onClick={toggleFavorite}
              className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition shadow-md ${
                isFavorited
                  ? "bg-rose-500 text-white shadow-rose-500/30"
                  : "bg-white/80 text-slate-700 hover:bg-white dark:bg-slate-900/80 dark:text-slate-200"
              }`}
              title="Save to favorites"
            >
              <Heart size={15} className={isFavorited ? "fill-white" : ""} />
            </button>

            {/* Carousel Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/40 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-slate-950/70"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/40 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-slate-950/70"
                >
                  <ChevronRight size={16} />
                </button>

                {/* Dot indicators */}
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
                  {images.slice(0, 5).map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-1.5 rounded-full transition-all ${
                        activeImgIdx === idx ? "w-4 bg-white" : "w-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Card Body */}
          <div className="flex flex-1 flex-col p-4">
            {/* Price Header (Matching Image 3) */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  KES {listing.price?.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  / {rentAttr.rent_period || "mo"}
                </span>
              </div>
              {listing.compare_price && (
                <span className="text-xs text-slate-400 line-through">
                  KES {listing.compare_price?.toLocaleString()}
                </span>
              )}
            </div>

            {/* Title */}
            <Link
              to={itemUrl}
              className="mt-1.5 font-bold text-slate-900 dark:text-white line-clamp-1 text-sm leading-snug hover:text-teal-700 dark:hover:text-teal-400"
            >
              {listing.title}
            </Link>

            {/* Address / Location Line */}
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 truncate">
              <MapPin size={12} className="text-teal-600 shrink-0" />
              <span className="truncate">{rentAttr.location_text || rentAttr.address || "Nairobi, Kenya"}</span>
            </p>

            {/* Tag Pills Row (Image 3: Pets allowed, Balcony, etc.) */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {rentAttr.pets_allowed && (
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  🐾 Pets allowed
                </span>
              )}
              {rentAttr.furnished && (
                <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                  🛋️ Furnished
                </span>
              )}
              {listing.tags?.slice(0, 2).map((t, idx) => (
                <span
                  key={idx}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Spec Badges Strip (Image 3: Beds, Baths, Floor, Area) */}
            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-50 p-2 text-center text-[11px] font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {bedroomsLabel && (
                <div className="flex items-center justify-center gap-1">
                  <Bed size={12} className="text-teal-600" />
                  <span className="truncate">{bedroomsLabel}</span>
                </div>
              )}
              {rentAttr.floor ? (
                <div className="flex items-center justify-center gap-1">
                  <Layers size={12} className="text-teal-600" />
                  <span className="truncate">Floor {rentAttr.floor}</span>
                </div>
              ) : bathroomsLabel ? (
                <div className="flex items-center justify-center gap-1">
                  <Bath size={12} className="text-teal-600" />
                  <span className="truncate">{bathroomsLabel}</span>
                </div>
              ) : null}
              {rentAttr.area_sqm && (
                <div className="flex items-center justify-center gap-1">
                  <Maximize2 size={12} className="text-teal-600" />
                  <span>{rentAttr.area_sqm} m²</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-2 dark:border-slate-800">
              <button
                onClick={() => setShowBookingModal(true)}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-teal-700 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-800 transition"
              >
                <Calendar size={13} />
                <span>Book Tour</span>
              </button>

              <Link
                to={itemUrl}
                className="flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
              >
                Details
              </Link>
            </div>
          </div>
        </div>

        {/* Viewing Tour Modal */}
        <RentalTourBookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          listing={listing}
          agent={listing.rental_attributes?.agent}
        />
      </>
    );
  }

  // ==========================================================================
  // STANDARD RETAIL / SERVICE / FOOD CARD (Matching Image 1 & Image 2)
  // ==========================================================================
  const discountPct =
    listing.discount_pct ||
    (listing.compare_price && listing.compare_price > listing.price
      ? Math.round(((listing.compare_price - listing.price) / listing.compare_price) * 100)
      : null);

  const ratingValue = listing.rating || 4.8;
  const reviewCount = listing.review_count || 12;
  const brandName = listing.brand || listing.tags?.[0] || "";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
      {/* Product Image & Badges */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-50 dark:bg-slate-800/60">
        <Link to={itemUrl} className="block h-full w-full">
          {listing.thumbnail ? (
            <img
              src={listing.thumbnail}
              alt={listing.title}
              className="h-full w-full object-contain p-2.5 transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-700">
              <Store size={40} />
            </div>
          )}
        </Link>

        {/* Discount Badge (Matching Image 1: Pink/Rose -21%, -41%) */}
        {discountPct ? (
          <span className="absolute left-2.5 top-2.5 rounded-lg bg-pink-600 px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
            {discountPct}% OFF
          </span>
        ) : listing.is_featured ? (
          <span className="absolute left-2.5 top-2.5 rounded-lg bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
            Featured
          </span>
        ) : null}

        {/* Favorite Heart Button */}
        <button
          onClick={toggleFavorite}
          className={`absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition shadow-xs ${
            isFavorited
              ? "bg-rose-500 text-white"
              : "bg-white/80 text-slate-400 hover:text-rose-500 dark:bg-slate-900/80"
          }`}
          title="Save to wishlist"
        >
          <Heart size={14} className={isFavorited ? "fill-white" : ""} />
        </button>

        {/* Out of stock overlay */}
        {listing.stock <= 0 && listing.track_stock && !isRental && (
          <span className="absolute bottom-2 left-2 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
            Sold Out
          </span>
        )}
      </div>

      {/* Card Details Body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category / Brand Tag */}
        <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 font-bold mb-1">
          <span className="uppercase tracking-wider truncate">
            {brandName ? `${brandName} • ` : ""}{listing.subcategory || "Retail"}
          </span>
        </div>

        {/* Product Title */}
        <Link
          to={itemUrl}
          className="font-bold text-slate-900 dark:text-white line-clamp-2 text-xs sm:text-sm leading-snug hover:text-emerald-600 transition"
          title={listing.title}
        >
          {listing.title}
        </Link>

        {/* Star Rating Strip (Matching Image 1: Gold stars + reviews) */}
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex items-center text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={12}
                className={i < Math.floor(ratingValue) ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"}
              />
            ))}
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            ({reviewCount})
          </span>
        </div>

        {/* Merchant Attribution */}
        <div className="mt-1.5 text-xs text-slate-500">
          <span className="text-slate-400">By </span>
          <Link
            to={`/businesses/${businessSlug}`}
            className="font-bold text-slate-700 hover:text-emerald-600 hover:underline dark:text-slate-300"
          >
            {businessName}
          </Link>
        </div>

        {/* Pricing & Cart Action Button (Image 1: Bold current price + strikethrough compare + + Add button) */}
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2 dark:border-slate-800">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                KES {listing.price?.toLocaleString()}
              </span>
            </div>
            {listing.compare_price && (
              <span className="text-[11px] text-slate-400 line-through">
                KES {listing.compare_price?.toLocaleString()}
              </span>
            )}
          </div>

          {isService ? (
            <Link
              to={itemUrl}
              className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              Details <ArrowRight size={13} />
            </Link>
          ) : (
            <button
              onClick={() => addToCart(listing)}
              disabled={listing.track_stock && listing.stock <= 0}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 disabled:opacity-40 transition"
              title="Add to Cart"
            >
              <ShoppingCart size={13} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
