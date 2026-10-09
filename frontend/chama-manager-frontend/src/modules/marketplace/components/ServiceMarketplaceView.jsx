import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Bug,
  Camera,
  Car,
  CheckCircle2,
  Clock3,
  Flower2,
  Hammer,
  Laptop,
  MapPin,
  Paintbrush,
  Search,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Users,
  Utensils,
  Wrench,
  Zap,
} from "lucide-react";

const SERVICE_CATEGORIES = [
  { slug: "All", label: "All services", icon: Users },
  { slug: "plumbing", label: "Plumbing", icon: Wrench },
  { slug: "electrical", label: "Electrical", icon: Zap },
  { slug: "home-cleaning", label: "Home cleaning", icon: Sparkles },
  { slug: "painting", label: "Painting", icon: Paintbrush },
  { slug: "carpentry", label: "Carpentry", icon: Hammer },
  { slug: "appliance-repair", label: "Appliance repair", icon: Wrench },
  { slug: "tailoring", label: "Tailoring", icon: Scissors },
  { slug: "photography", label: "Photography", icon: Camera },
  { slug: "beauty-grooming", label: "Beauty & grooming", icon: Sparkles },
  { slug: "moving", label: "Moving", icon: Truck },
  { slug: "gardening", label: "Gardening", icon: Flower2 },
  { slug: "tech-support", label: "Tech support", icon: Laptop },
  { slug: "tutoring", label: "Tutoring", icon: BookOpen },
  { slug: "catering", label: "Catering", icon: Utensils },
  { slug: "pest-control", label: "Pest control", icon: Bug },
  { slug: "auto-repair", label: "Auto repair", icon: Car },
];

function ProviderCard({ listing }) {
  const business = listing.business_id || {};
  const attributes = listing.service_attributes || {};
  const photo = listing.thumbnail || listing.images?.[0];
  const serviceMode = attributes.service_mode === "remote" ? "Remote" : attributes.service_mode === "at_provider" ? "At provider" : "At your location";

  return (
    <article className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-lg">
      <Link to={`/marketplace/services/products/${listing.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-slate-100">
        {photo ? <img src={photo} alt={business.name || "Service professional"} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-slate-400"><Users size={36} /></div>}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-sm bg-white px-2 py-1 text-[10px] font-bold text-emerald-800 shadow-sm"><ShieldCheck size={12} /> Verified</span>
        {listing.is_featured && <span className="absolute right-3 top-3 rounded-sm bg-amber-400 px-2 py-1 text-[10px] font-bold text-slate-950">Top rated</span>}
      </Link>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-extrabold text-slate-900">{business.name || "Local professional"}</h3>
            <p className="mt-1 truncate text-xs font-medium text-emerald-800">{listing.subcategory?.replaceAll("-", " ") || "Professional service"}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-slate-700"><Star size={13} className="fill-amber-400 text-amber-400" />{listing.rating?.toFixed?.(1) || "4.8"}</span>
        </div>
        <p className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-800">{listing.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><MapPin size={12} />{attributes.service_area || business.location || "Nairobi"}</span>
          <span className="inline-flex items-center gap-1"><Clock3 size={12} />{serviceMode}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <div><span className="text-[10px] text-slate-500">From</span><p className="text-sm font-extrabold text-slate-950">KES {Number(listing.price || 0).toLocaleString()}</p></div>
          <Link to={`/marketplace/services/products/${listing.slug}`} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">View details <ArrowRight size={13} /></Link>
        </div>
      </div>
    </article>
  );
}

export default function ServiceMarketplaceView({ listings, pagination, loading, search, setSearch, selectedSubcat, setSelectedSubcat, page, setPage }) {
  return (
    <div className="flex-1 bg-white text-slate-900">
      <section className="relative isolate overflow-hidden bg-[#0b3f34] text-white">
        <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=2000&q=85" alt="A professional providing home services" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#062b24]/95 via-[#0b3f34]/80 to-[#0b3f34]/20" />
        <div className="mx-auto grid min-h-[330px] max-w-7xl items-center gap-8 px-4 py-12 sm:min-h-[390px] sm:px-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-200"><CheckCircle2 size={15} /> Vetted local professionals</div>
            <h1 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-5xl">Find the right person for the job.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/80 sm:text-base">Compare nearby professionals, see their experience, and contact them directly about your task.</p>
            <form onSubmit={(event) => event.preventDefault()} className="mt-6 flex max-w-2xl items-center rounded-md bg-white p-1.5 text-slate-700 shadow-lg">
              <Search size={18} className="ml-2 shrink-0 text-slate-400" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="What service do you need?" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400" />
              <button type="submit" className="rounded bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800">Find a pro</button>
            </form>
          </div>
          <div className="hidden w-64 border-l border-white/25 pl-7 lg:block">
            <div className="flex items-center gap-2 text-sm font-bold"><Users size={17} className="text-emerald-200" />Local service directory</div>
            <p className="mt-2 text-xs leading-5 text-white/70">Compare ratings, service areas, and starting rates before reaching out.</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 pb-14 sm:px-8">
        <section className="border-b border-slate-200 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Browse by service</h2>
            <span className="text-xs text-slate-500">{SERVICE_CATEGORIES.length - 1} categories</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {SERVICE_CATEGORIES.map(({ slug, label, icon: Icon }) => (
              <button key={slug} onClick={() => { setSelectedSubcat(slug); setPage(1); }} className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-md border px-2 py-3 text-center text-[11px] font-semibold transition ${selectedSubcat === slug ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"}`}><Icon size={19} />{label}</button>
            ))}
          </div>
        </section>

        <section className="py-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Available near Nairobi</p>
              <h2 className="mt-1 text-xl font-extrabold">{SERVICE_CATEGORIES.find((item) => item.slug === selectedSubcat)?.label === "All services" ? "Service professionals" : SERVICE_CATEGORIES.find((item) => item.slug === selectedSubcat)?.label || "Service professionals"}</h2>
              <p className="mt-1 text-xs text-slate-500">{pagination.total ?? listings.length} providers and services</p>
            </div>
            <Link to="/marketplace/services" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-800">All services <ArrowRight size={14} /></Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : listings.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {listings.map((listing) => <ProviderCard key={listing._id} listing={listing} />)}
            </div>
          ) : (
            <div className="border-y border-slate-200 py-14 text-center">
              <Users size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No service providers found</p>
              <p className="mt-1 text-xs text-slate-500">Try another service category or search term.</p>
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
