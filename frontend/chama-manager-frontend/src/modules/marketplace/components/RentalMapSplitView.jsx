import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Star,
  Plus,
  Minus,
  Navigation,
  Compass,
  Building,
  Dumbbell,
  GraduationCap,
  Trees,
  ShoppingBag,
  Bus,
  X,
  ExternalLink,
} from "lucide-react";

// Geographic bounding box for Nairobi & surrounds
const NAIROBI_BOUNDS = {
  minLat: -1.355,
  maxLat: -1.195,
  minLng: 36.64,
  maxLng: 36.87,
};

const MOMBASA_BOUNDS = {
  minLat: -4.08,
  maxLat: -4.00,
  minLng: 39.64,
  maxLng: 39.75,
};

// Points of interest in Nairobi
const POIS = [
  { name: "Sarit Centre & Westgate", type: "mall", lat: -1.261, lng: 36.804, icon: ShoppingBag },
  { name: "Yaya Centre Mall", type: "mall", lat: -1.291, lng: 36.788, icon: ShoppingBag },
  { name: "Karura Forest Nature Reserve", type: "park", lat: -1.242, lng: 36.828, icon: Trees },
  { name: "Junction Mall & Gym Hub", type: "gym", lat: -1.298, lng: 36.761, icon: Dumbbell },
  { name: "University of Nairobi Campus", type: "school", lat: -1.280, lng: 36.816, icon: GraduationCap },
  { name: "Nairobi Central Railway & Bus", type: "transit", lat: -1.289, lng: 36.828, icon: Bus },
];

export default function RentalMapSplitView({
  listings = [],
  selectedListingId = null,
  onSelectListing = () => {},
}) {
  const [activeRegion, setActiveRegion] = useState("nairobi");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredPinId, setHoveredPinId] = useState(null);
  const [activePopoverListing, setActivePopoverListing] = useState(null);

  const bounds = activeRegion === "nairobi" ? NAIROBI_BOUNDS : MOMBASA_BOUNDS;

  // Transform lat/lng to percentage coordinates within map frame
  const getCoordinatesPct = (lat, lng) => {
    if (!lat || !lng) return { x: 50, y: 50 };
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    // Invert Y because latitude increases northward (upward)
    const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 100;
    return {
      x: Math.min(Math.max(x, 4), 94),
      y: Math.min(Math.max(y, 6), 94),
    };
  };

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      const city = (l.rental_attributes?.city || "Nairobi").toLowerCase();
      return activeRegion === "nairobi" ? city !== "mombasa" : city === "mombasa";
    });
  }, [listings, activeRegion]);

  const formatPriceShort = (price) => {
    if (!price) return "KES 0";
    if (price >= 1000) {
      return `KES ${(price / 1000).toFixed(0)}k`;
    }
    return `KES ${price}`;
  };

  const handlePinClick = (listing) => {
    onSelectListing(listing._id);
    setActivePopoverListing(listing);
  };

  return (
    <div className="relative h-[650px] w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-inner dark:border-slate-800 dark:bg-slate-900 select-none">
      {/* Top Map Toolbar */}
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        <div className="flex items-center rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
          <button
            onClick={() => {
              setActiveRegion("nairobi");
              setActivePopoverListing(null);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeRegion === "nairobi"
                ? "bg-teal-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            Nairobi Hub
          </button>
          <button
            onClick={() => {
              setActiveRegion("mombasa");
              setActivePopoverListing(null);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeRegion === "mombasa"
                ? "bg-teal-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            Mombasa Coast
          </button>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300">
          <Building size={13} className="text-teal-600" />
          {filteredListings.length} Map Pins
        </span>
      </div>

      {/* Floating Zoom & Compass Controls */}
      <div className="absolute right-4 bottom-6 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.4))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          title="Zoom In"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.85))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          title="Zoom Out"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => {
            setZoomLevel(1);
            setActivePopoverListing(null);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-teal-700 shadow-md hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-teal-400"
          title="Recenter Map"
        >
          <Compass size={16} />
        </button>
      </div>

      {/* Map Canvas Background with Styled Streets & Topography */}
      <div
        className="relative h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
      >
        {/* SVG Street Matrix & Geo Features */}
        <svg className="absolute inset-0 h-full w-full opacity-40 dark:opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-slate-300 dark:text-slate-700" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Major Arteries / Expressways (Nairobi Expressway & Ring Roads) */}
          <path
            d="M 50 150 Q 250 220, 480 320 T 900 480"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="3.5"
            strokeDasharray="6 4"
            className="opacity-70"
          />
          <path
            d="M 120 50 Q 300 280, 520 420 T 780 620"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.5"
          />
          <path
            d="M 400 30 Q 420 300, 450 640"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="2"
          />

          {/* Green zones (Karura, Arboretum, National Park) */}
          <circle cx="280" cy="180" r="70" fill="#10b981" fillOpacity="0.08" />
          <circle cx="720" cy="520" r="110" fill="#10b981" fillOpacity="0.06" />
        </svg>

        {/* Region Labels */}
        <div className="pointer-events-none absolute inset-0 text-slate-400/60 font-black tracking-widest uppercase text-xs">
          {activeRegion === "nairobi" ? (
            <>
              <span className="absolute top-[20%] left-[22%]">Westlands</span>
              <span className="absolute top-[38%] left-[26%]">Kilimani</span>
              <span className="absolute top-[32%] left-[16%]">Lavington</span>
              <span className="absolute top-[48%] left-[14%]">Karen</span>
              <span className="absolute top-[34%] left-[48%] font-bold text-slate-500/80">Nairobi CBD</span>
              <span className="absolute top-[52%] left-[54%]">South B</span>
              <span className="absolute top-[14%] left-[34%]">Parklands</span>
              <span className="absolute top-[10%] left-[18%]">Ruaka</span>
            </>
          ) : (
            <>
              <span className="absolute top-[24%] left-[45%]">Nyali Beach</span>
              <span className="absolute top-[48%] left-[32%]">Mombasa Island</span>
              <span className="absolute top-[36%] left-[62%] text-blue-400/50">Indian Ocean</span>
            </>
          )}
        </div>

        {/* POI Markers (Gym, Schools, Malls, Transit) */}
        {activeRegion === "nairobi" &&
          POIS.map((poi, idx) => {
            const { x, y } = getCoordinatesPct(poi.lat, poi.lng);
            const IconComponent = poi.icon;
            return (
              <div
                key={idx}
                className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-white shadow-md transition group-hover:scale-125 dark:bg-slate-700">
                  <IconComponent size={12} />
                </div>
                {/* Tooltip */}
                <div className="pointer-events-none absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-md transition group-hover:opacity-100 z-30">
                  {poi.name}
                </div>
              </div>
            );
          })}

        {/* Rental Property Price Bubble Pins (Image 4 & Image 2) */}
        {filteredListings.map((listing) => {
          const lat = listing.rental_attributes?.coordinates?.lat;
          const lng = listing.rental_attributes?.coordinates?.lng;
          const { x, y } = getCoordinatesPct(lat, lng);
          const isSelected = selectedListingId === listing._id;
          const isHovered = hoveredPinId === listing._id;
          const isPopoverOpen = activePopoverListing?._id === listing._id;

          return (
            <div
              key={listing._id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-15"
              style={{ left: `${x}%`, top: `${y}%` }}
              onMouseEnter={() => setHoveredPinId(listing._id)}
              onMouseLeave={() => setHoveredPinId(null)}
            >
              {/* Price Badge Bubble */}
              <button
                onClick={() => handlePinClick(listing)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black shadow-lg transition duration-200 transform ${
                  isSelected || isPopoverOpen
                    ? "bg-slate-950 text-white scale-115 ring-3 ring-teal-500 z-30 dark:bg-white dark:text-slate-950"
                    : isHovered
                    ? "bg-teal-700 text-white scale-110 z-25"
                    : "bg-white text-slate-900 hover:bg-teal-50 hover:text-teal-900 dark:bg-slate-800 dark:text-white"
                }`}
              >
                <MapPin size={11} className={isSelected || isPopoverOpen ? "text-teal-400" : "text-teal-600"} />
                <span>{formatPriceShort(listing.price)}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Interactive Popover Listing Preview Card (Matching Image 4) */}
      {activePopoverListing && (
        <div className="absolute left-6 bottom-6 z-30 w-72 sm:w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-in slide-in-from-bottom-3 duration-200 dark:border-slate-800 dark:bg-slate-900">
          <div className="relative aspect-16/10 w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            <img
              src={activePopoverListing.thumbnail || activePopoverListing.images?.[0]}
              alt={activePopoverListing.title}
              className="h-full w-full object-cover"
            />
            <button
              onClick={() => setActivePopoverListing(null)}
              className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1 text-white hover:bg-slate-900 transition"
            >
              <X size={14} />
            </button>
            {activePopoverListing.rental_attributes?.property_type && (
              <span className="absolute left-2 top-2 rounded-md bg-teal-700/90 px-2 py-0.5 text-[10px] font-black uppercase text-white backdrop-blur-xs">
                {activePopoverListing.rental_attributes.property_type}
              </span>
            )}
          </div>

          <div className="pt-2.5">
            <h4 className="line-clamp-1 text-xs font-black text-slate-900 dark:text-white">
              {activePopoverListing.title}
            </h4>
            <p className="flex items-center gap-1 text-[11px] text-slate-500 truncate mt-0.5">
              <MapPin size={11} className="text-teal-600 shrink-0" />
              {activePopoverListing.rental_attributes?.location_text || "Nairobi"}
            </p>

            {/* Spec Badges Strip */}
            <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {activePopoverListing.rental_attributes?.area_sqm && (
                <span className="flex items-center gap-0.5">
                  <Maximize2 size={11} className="text-teal-600" />
                  {activePopoverListing.rental_attributes.area_sqm} m²
                </span>
              )}
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-0.5">
                <Bed size={11} className="text-teal-600" />
                {activePopoverListing.rental_attributes?.bedrooms === 0
                  ? "Studio"
                  : `${activePopoverListing.rental_attributes?.bedrooms || 1} Bed`}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-0.5">
                <Bath size={11} className="text-teal-600" />
                {activePopoverListing.rental_attributes?.bathrooms || 1} Bath
              </span>
            </div>

            {/* Price & View Details Action */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
              <div>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  KES {activePopoverListing.price?.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400"> / mo</span>
              </div>

              <Link
                to={`/marketplace/rentals/listings/${activePopoverListing.slug}`}
                className="flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-teal-800 transition shadow-xs"
              >
                <span>View Details</span>
                <ExternalLink size={11} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
