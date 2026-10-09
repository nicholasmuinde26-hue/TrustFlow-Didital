import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bike,
  Clock3,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Utensils,
} from "lucide-react";
import { useMarketplaceCart } from "../context/MarketplaceCartContext";

const CUISINES = [
  { slug: "All", label: "Everything" },
  { slug: "local-dishes", label: "Kenyan plates" },
  { slug: "burgers", label: "Burgers" },
  { slug: "pizza", label: "Pizza" },
  { slug: "grills", label: "Grills" },
  { slug: "pasta", label: "Pasta" },
  { slug: "salads", label: "Fresh bowls" },
  { slug: "sides", label: "Sides" },
  { slug: "drinks", label: "Drinks" },
  { slug: "desserts", label: "Desserts" },
  { slug: "bakery", label: "Bakery" },
];

const HERO_IMAGE = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=2000&q=90";

function MenuItemCard({ listing }) {
  const { addToCart } = useMarketplaceCart("food");
  const image = listing.thumbnail || listing.images?.[0];
  const restaurant = listing.business_id?.name || "Verified kitchen";
  const prepTime = listing.food_attributes?.preparation_time_minutes || 20;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-lg">
      <Link to={`/marketplace/food/products/${listing.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-slate-100">
        {image ? <img src={image} alt={listing.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-slate-400"><Utensils size={32} /></div>}
        {listing.is_featured && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-sm bg-white px-2 py-1 text-[10px] font-bold text-rose-700 shadow-sm"><Sparkles size={11} /> Popular</span>}
        {listing.food_attributes?.is_vegetarian && <span className="absolute right-3 top-3 rounded-sm bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white">Vegetarian</span>}
      </Link>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="truncate">{restaurant}</span>
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-slate-700"><Star size={12} className="fill-amber-400 text-amber-400" /> {listing.rating?.toFixed?.(1) || "4.8"}</span>
        </div>
        <Link to={`/marketplace/food/products/${listing.slug}`} className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 hover:text-rose-700">{listing.title}</Link>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500"><Clock3 size={12} /> {prepTime} min <span className="px-1 text-slate-300">·</span>{listing.food_attributes?.cuisine_type || "Kitchen favourite"}</div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 mt-3">
          <span className="text-sm font-extrabold text-slate-950">KES {Number(listing.price || 0).toLocaleString()}</span>
          <button onClick={() => addToCart(listing)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-700 px-2.5 text-xs font-bold text-white transition hover:bg-rose-800" aria-label={`Add ${listing.title} to cart`}><Plus size={14} /> Add</button>
        </div>
      </div>
    </article>
  );
}

export default function RestaurantMarketplaceView({
  listings,
  pagination,
  loading,
  search,
  setSearch,
  selectedSubcat,
  setSelectedSubcat,
  page,
  setPage,
}) {
  const { fulfillmentType: fulfillment, setFulfillmentType: setFulfillment } = useMarketplaceCart("food");
  const restaurants = useMemo(() => {
    const found = new Map();
    listings.forEach((item) => {
      const business = item.business_id;
      if (business?._id && !found.has(business._id)) found.set(business._id, business);
    });
    return [...found.values()];
  }, [listings]);

  return (
    <div className="flex-1 bg-white text-slate-900">
      <section className="relative isolate min-h-[330px] overflow-hidden bg-slate-950 text-white sm:min-h-[390px]">
        <img src={HERO_IMAGE} alt="Freshly grilled dishes served at a local restaurant" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-slate-950/15" />
        <div className="mx-auto flex min-h-[330px] max-w-7xl items-center px-4 py-12 sm:min-h-[390px] sm:px-8">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-white/25 bg-black/20 px-2.5 py-1.5 text-xs font-semibold"><MapPin size={14} className="text-rose-300" /> Fresh from kitchens around Nairobi</div>
            <h1 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-5xl">Good food, close to home.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/80 sm:text-base">Browse local kitchens, find a new favourite, and order what you’re craving.</p>

            <div className="mt-6 flex w-fit rounded-md bg-white/15 p-1 backdrop-blur-sm" role="group" aria-label="Order fulfillment">
              <button onClick={() => setFulfillment("delivery")} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-xs font-bold ${fulfillment === "delivery" ? "bg-white text-slate-900" : "text-white/80 hover:bg-white/10"}`}><Bike size={15} /> Delivery</button>
              <button onClick={() => setFulfillment("pickup")} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-xs font-bold ${fulfillment === "pickup" ? "bg-white text-slate-900" : "text-white/80 hover:bg-white/10"}`}><Store size={14} /> Pickup</button>
              <span className="hidden items-center gap-1 px-3 text-xs text-white/75 sm:inline-flex"><Clock3 size={13} /> {fulfillment === "delivery" ? "25–40 min" : "Ready in 15–25 min"}</span>
            </div>

            <form onSubmit={(event) => event.preventDefault()} className="mt-4 flex max-w-xl items-center rounded-md bg-white p-1.5 text-slate-700 shadow-lg">
              <Search size={18} className="ml-2 shrink-0 text-slate-400" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search dishes, restaurants, or cuisines" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400" />
              <button type="submit" className="rounded bg-rose-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-800">Search</button>
            </form>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 pb-14 sm:px-8">
        <section className="border-b border-slate-200 py-5" aria-label="Browse by food category">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {CUISINES.map((cuisine) => (
              <button key={cuisine.slug} onClick={() => { setSelectedSubcat(cuisine.slug); setPage(1); }} className={`shrink-0 rounded-md px-3.5 py-2 text-xs font-semibold transition ${selectedSubcat === cuisine.slug ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-700"}`}>{cuisine.label}</button>
            ))}
          </div>
        </section>

        {restaurants.length > 0 && (
          <section className="border-b border-slate-200 py-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Kitchens near you</h2>
              <span className="text-xs text-slate-500">{restaurants.length} on this page</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {restaurants.map((business) => {
                const slug = business.slug || business.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                return <Link key={business._id} to={`/businesses/${slug}`} className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-rose-300 hover:text-rose-700"><Store size={14} className="text-rose-700" />{business.name}<ArrowRight size={13} className="text-slate-400" /></Link>;
              })}
            </div>
          </section>
        )}

        <section className="py-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Made to order</p>
              <h2 className="mt-1 text-xl font-extrabold">{CUISINES.find((item) => item.slug === selectedSubcat)?.label || "Menu"}</h2>
              <p className="mt-1 text-xs text-slate-500">{pagination.total ?? listings.length} dishes from verified local kitchens</p>
            </div>
            <Link to="/marketplace/food" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-rose-700">Browse all kitchens <ArrowRight size={14} /></Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : listings.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {listings.map((listing) => <MenuItemCard key={listing._id} listing={listing} />)}
            </div>
          ) : (
            <div className="border-y border-slate-200 py-14 text-center">
              <ShoppingBag size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No dishes found</p>
              <p className="mt-1 text-xs text-slate-500">Try another category or search term.</p>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="mt-7 flex items-center justify-center gap-3">
              <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button>
              <span className="text-xs text-slate-500">Page {pagination.page || page} of {pagination.totalPages}</span>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
