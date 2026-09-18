import React, { useEffect, useState } from "react";
import {
  Store,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  BarChart3,
  Layers,
  Palette,
  Eye,
  Sliders,
  DollarSign,
  ChevronRight,
  TrendingUp,
  Share2,
  Copy,
  Check,
  ExternalLink,
  ShoppingBag,
  Building,
  Briefcase,
  UtensilsCrossed,
  Send,
  Link2,
} from "lucide-react";
import marketplaceService from "../../marketplace/services/marketplace.service";
import Spinner from "@/shared/components/ui/Spinner";
import toast from "react-hot-toast";

const DEFAULT_CATEGORY_FALLBACKS = [
  {
    slug: "retail",
    name: "Retail Marketplace",
    tagline: "Quality goods from verified independent shops",
    description: "Browse electronics, fashion, groceries, home living, hardware, and everyday essentials.",
    theme_color: "#059669",
  },
  {
    slug: "rentals",
    name: "Rentals & Real Estate",
    tagline: "Apartments, rooms, and commercial plots from verified landlords",
    description: "Direct listings for residential rentals, bedsitters, family apartments, and commercial spaces.",
    theme_color: "#2563eb",
  },
  {
    slug: "services",
    name: "Services & Skilled Pros",
    tagline: "Book verified professionals, artisans, and service providers",
    description: "Find trusted plumbers, electricians, consultants, beauty technicians, and maintenance experts.",
    theme_color: "#7c3aed",
  },
  {
    slug: "food",
    name: "Restaurants & Menus",
    tagline: "Fresh meals, menus, and takeout from local kitchens",
    description: "Discover local eateries, order lunch for your team, or arrange food delivery directly from kitchens.",
    theme_color: "#ea580c",
  },
];

export default function MarketplaceAdminConsole() {
  const [activeTab, setActiveTab] = useState("links"); // "links" | "queue" | "enrollments" | "design" | "analytics"
  const [selectedHub, setSelectedHub] = useState("retail");
  const [categories, setCategories] = useState([]);
  const [copiedHubSlug, setCopiedHubSlug] = useState(null);
  const [shareModalHub, setShareModalHub] = useState(null);

  // Queue state
  const [queue, setQueue] = useState([]);
  const [queueStatus, setQueueStatus] = useState("pending");
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Enrollments state
  const [enrollments, setEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Active review item
  const [reviewingItem, setReviewingItem] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState("");

  // Design form state
  const [designForm, setDesignForm] = useState({
    hero_title: "",
    hero_subtitle: "",
    theme_color: "#059669",
    announcement_banner: { text: "", link: "", is_active: false },
  });

  // Load Categories on mount
  useEffect(() => {
    async function loadHubs() {
      try {
        const cats = await marketplaceService.getCategories();
        setCategories(cats);
        if (cats.length && !selectedHub) setSelectedHub(cats[0].slug);
      } catch (err) {
        console.error("Failed to load hubs", err);
      }
    }
    loadHubs();
  }, []);

  // Load active tab data
  useEffect(() => {
    if (activeTab === "queue") {
      fetchQueue();
    } else if (activeTab === "enrollments") {
      fetchEnrollments();
    } else if (activeTab === "analytics") {
      fetchAnalytics();
    } else if (activeTab === "design" && selectedHub) {
      loadCategoryDesign();
    }
  }, [activeTab, selectedHub, queueStatus]);

  const fetchQueue = async () => {
    setLoadingQueue(true);
    try {
      const data = await marketplaceService.getModerationQueue({
        category: selectedHub,
        status: queueStatus,
      });
      setQueue(data.listings || []);
    } catch (err) {
      toast.error("Failed to load moderation queue");
    } finally {
      setLoadingQueue(false);
    }
  };

  const fetchEnrollments = async () => {
    setLoadingEnrollments(true);
    try {
      const data = await marketplaceService.getEnrollments();
      setEnrollments(data || []);
    } catch (err) {
      toast.error("Failed to load enrollments");
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const data = await marketplaceService.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      toast.error("Failed to load analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadCategoryDesign = async () => {
    try {
      const cat = await marketplaceService.getCategory(selectedHub);
      if (cat) {
        setDesignForm({
          hero_title: cat.hero_title || "",
          hero_subtitle: cat.hero_subtitle || "",
          theme_color: cat.theme_color || "#059669",
          announcement_banner: cat.announcement_banner || { text: "", link: "", is_active: false },
        });
      }
    } catch (err) {
      console.warn("Could not load design details", err);
    }
  };

  const handleListingDecision = async (listingId, decision) => {
    try {
      await marketplaceService.reviewListing(listingId, {
        decision,
        notes: reviewNotes,
      });
      toast.success(`Listing marked as ${decision}`);
      setReviewingItem(null);
      setReviewNotes("");
      fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update listing status");
    }
  };

  const handleEnrollmentDecision = async (enrollmentId, decision, customCommissionRate = null) => {
    try {
      await marketplaceService.reviewEnrollment(enrollmentId, {
        decision,
        customCommissionRate,
      });
      toast.success(`Enrollment marked as ${decision}`);
      fetchEnrollments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update enrollment status");
    }
  };

  const handleSaveDesign = async (e) => {
    e.preventDefault();
    try {
      await marketplaceService.updateCategoryDesign(selectedHub, designForm);
      toast.success("Category hub design updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save category design");
    }
  };

  const displayCategories = categories.length > 0 ? categories : DEFAULT_CATEGORY_FALLBACKS;

  const getCategoryIcon = (slug) => {
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

  const copyShareableLink = (slug) => {
    const url = `${window.location.origin}/marketplace/${slug}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
    setCopiedHubSlug(slug);
    toast.success(`Copied ${slug.toUpperCase()} Marketplace shareable link!`);
    setTimeout(() => setCopiedHubSlug(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Console Header Banner */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-400">
              Marketplace Business Admin Console
            </p>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-black tracking-tight">
              Category Hubs & Moderation
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-indigo-100 max-w-2xl">
              Govern merchant enrollments, approve incoming product listings, curate homepage hero campaigns, and monitor GMV settlements.
            </p>
          </div>

          {/* Hub Selector & Quick Copy */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 p-1.5 backdrop-blur-md border border-white/10">
              <span className="text-xs font-bold text-slate-300 ml-2">Active Hub:</span>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white border-0 focus:ring-1 focus:ring-emerald-500"
              >
                {displayCategories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => copyShareableLink(selectedHub)}
              className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-md"
              title="Copy shareable link for active hub"
            >
              {copiedHubSlug === selectedHub ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedHubSlug === selectedHub ? "Copied Link!" : "Copy Hub Link"}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex gap-2 border-t border-white/10 pt-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("links")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition whitespace-nowrap ${
              activeTab === "links"
                ? "bg-white text-slate-950 shadow-md"
                : "text-indigo-200 hover:bg-white/10"
            }`}
          >
            <Share2 size={14} /> Shareable Hub Links
          </button>
          <button
            onClick={() => setActiveTab("queue")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition whitespace-nowrap ${
              activeTab === "queue"
                ? "bg-white text-slate-950 shadow-md"
                : "text-indigo-200 hover:bg-white/10"
            }`}
          >
            <Clock size={14} /> Moderation Queue
          </button>
          <button
            onClick={() => setActiveTab("enrollments")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition whitespace-nowrap ${
              activeTab === "enrollments"
                ? "bg-white text-slate-950 shadow-md"
                : "text-indigo-200 hover:bg-white/10"
            }`}
          >
            <ShieldCheck size={14} /> Merchant Enrollments
          </button>
          <button
            onClick={() => setActiveTab("design")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition whitespace-nowrap ${
              activeTab === "design"
                ? "bg-white text-slate-950 shadow-md"
                : "text-indigo-200 hover:bg-white/10"
            }`}
          >
            <Palette size={14} /> Hub Design & Banners
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition whitespace-nowrap ${
              activeTab === "analytics"
                ? "bg-white text-slate-950 shadow-md"
                : "text-indigo-200 hover:bg-white/10"
            }`}
          >
            <BarChart3 size={14} /> Marketplace Analytics
          </button>
        </div>
      </section>

      {/* TAB 0: SHAREABLE HUB LINKS */}
      {activeTab === "links" && (
        <div className="space-y-6">
          {/* Admin Authority Banner */}
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-50/60 p-5 dark:border-emerald-900/30 dark:bg-emerald-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
                <Share2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Admin-Exclusive Independent Category Marketplace Links
                </h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                  Every business category operates as an independent, standalone marketplace with its own separate page and route.
                  These shareable links are issued and managed exclusively from this Admin Console. Merchants are restricted to their matching category and cannot access or publish to other hubs.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-600/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 border border-emerald-600/20">
              Admin Dispatched
            </span>
          </div>

          {/* Cards Grid for Each Independent Hub */}
          <div className="grid gap-5 sm:grid-cols-2">
            {displayCategories.map((cat) => {
              const Icon = getCategoryIcon(cat.slug);
              const hubUrl = `${window.location.origin}/marketplace/${cat.slug}`;
              const isCopied = copiedHubSlug === cat.slug;
              const merchantCount = enrollments.filter(
                (e) => e.category_slug === cat.slug && e.status === "approved"
              ).length;

              return (
                <div
                  key={cat.slug}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md"
                          style={{ backgroundColor: cat.theme_color || "#059669" }}
                        >
                          <Icon size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                              {cat.name}
                            </h4>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300">
                              /{cat.slug}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{cat.tagline || cat.description}</p>
                        </div>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 whitespace-nowrap">
                        Independent Page
                      </span>
                    </div>

                    {/* Description */}
                    <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {cat.description || `Specialized multi-vendor marketplace dedicated exclusively to ${cat.name.toLowerCase()}.`}
                    </p>

                    {/* Stats pills */}
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-bold">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {merchantCount} Active Merchants
                      </span>
                      <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Dedicated Route
                      </span>
                    </div>
                  </div>

                  {/* Shareable Link Input & Actions */}
                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Separate Shareable Public Link
                      </label>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800">
                        <Link2 size={15} className="ml-2 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          readOnly
                          value={hubUrl}
                          className="flex-1 bg-transparent text-xs font-mono text-slate-800 focus:outline-hidden dark:text-slate-200 truncate"
                        />
                        <button
                          onClick={() => copyShareableLink(cat.slug)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition shrink-0 ${
                            isCopied
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600"
                          }`}
                        >
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                          <span>{isCopied ? "Copied!" : "Copy"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => setShareModalHub({ ...cat, url: hubUrl })}
                        className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <Share2 size={13} /> Share Options
                      </button>

                      <a
                        href={hubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <ExternalLink size={13} /> Open Marketplace Page
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: MODERATION QUEUE */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filter by status:</span>
              <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
                {["pending", "approved", "changes_requested", "rejected"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setQueueStatus(st)}
                    className={`rounded-lg px-3 py-1 font-bold capitalize transition ${
                      queueStatus === st
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {st.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs font-bold text-slate-400">
              {queue.length} items in queue
            </span>
          </div>

          {loadingQueue ? (
            <div className="py-12">
              <Spinner />
            </div>
          ) : queue.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-slate-400 bg-white dark:border-slate-800 dark:bg-slate-900">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Queue is clear
              </p>
              <p className="text-xs text-slate-400 mt-1">
                No items currently marked as "{queueStatus}" in the {selectedHub} hub.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-4">Item & Merchant</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Submitted</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {queue.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="h-12 w-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                              <Store size={18} />
                            </div>
                          )}
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white block">
                              {item.title}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              Seller: {item.business_id?.name || "Merchant"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-slate-600 dark:text-slate-400 capitalize">
                        {item.subcategory || item.category_slug}
                      </td>
                      <td className="p-4 font-extrabold text-slate-900 dark:text-white">
                        {item.currency || "KES"} {item.price?.toLocaleString()}
                      </td>
                      <td className="p-4 font-bold text-slate-600 dark:text-slate-400">
                        {item.track_stock ? `${item.stock} units` : "Untracked"}
                      </td>
                      <td className="p-4 text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setReviewingItem(item);
                              setReviewNotes(item.moderation_notes || "");
                            }}
                            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick Review Modal */}
          {reviewingItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
              <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Review Listing: {reviewingItem.title}
                  </h3>
                  <button
                    onClick={() => setReviewingItem(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/60 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Seller:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{reviewingItem.business_id?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">KES {reviewingItem.price?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Description:</span>
                    <p className="text-slate-700 dark:text-slate-300 line-clamp-3">{reviewingItem.description || "No description."}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Moderator Feedback / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Provide feedback for merchant (e.g., 'Please upload clear photos' or 'Approved for launch')..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => handleListingDecision(reviewingItem._id, "rejected")}
                    className="rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleListingDecision(reviewingItem._id, "changes_requested")}
                    className="rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                  >
                    Request Changes
                  </button>
                  <button
                    onClick={() => handleListingDecision(reviewingItem._id, "approved")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md"
                  >
                    Approve & Publish
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MERCHANT ENROLLMENTS */}
      {activeTab === "enrollments" && (
        <div className="space-y-4">
          {loadingEnrollments ? (
            <div className="py-12">
              <Spinner />
            </div>
          ) : enrollments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-slate-400 bg-white dark:border-slate-800 dark:bg-slate-900">
              <Store size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No enrollment applications</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-4">Business Name</th>
                    <th className="p-4">Category Hub</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Applied</th>
                    <th className="p-4 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {enrollments.map((enr) => (
                    <tr key={enr._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {enr.business_id?.name || "Business"}
                      </td>
                      <td className="p-4 font-semibold text-slate-600 dark:text-slate-300 capitalize">
                        {enr.category_slug}
                      </td>
                      <td className="p-4 text-slate-500">
                        {enr.merchant_profile?.physical_location || enr.business_id?.location || "N/A"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            enr.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : enr.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {enr.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">
                        {new Date(enr.applied_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {enr.status === "pending" ? (
                            <>
                              <button
                                onClick={() => handleEnrollmentDecision(enr._id, "approved")}
                                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleEnrollmentDecision(enr._id, "rejected")}
                                className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleEnrollmentDecision(enr._id, enr.status === "approved" ? "suspended" : "approved")}
                              className="text-xs font-bold text-slate-500 hover:underline"
                            >
                              {enr.status === "approved" ? "Suspend" : "Reinstate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HUB DESIGN & BANNERS */}
      {activeTab === "design" && (
        <form onSubmit={handleSaveDesign} className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            Customizing {selectedHub.toUpperCase()} Hub Hero & Banners
          </h3>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Hero Headline Title
            </label>
            <input
              type="text"
              value={designForm.hero_title}
              onChange={(e) => setDesignForm({ ...designForm, hero_title: e.target.value })}
              placeholder="e.g. Shop Local Merchants, All in One Place"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Hero Subtitle
            </label>
            <textarea
              rows={2}
              value={designForm.hero_subtitle}
              onChange={(e) => setDesignForm({ ...designForm, hero_subtitle: e.target.value })}
              placeholder="e.g. Order directly from verified businesses across Kenya..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Brand Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={designForm.theme_color}
                onChange={(e) => setDesignForm({ ...designForm, theme_color: e.target.value })}
                className="h-10 w-12 rounded-xl cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{designForm.theme_color}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md"
            >
              Save Hub Design Changes
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: MARKETPLACE ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {loadingAnalytics || !analytics ? (
            <div className="py-12">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-bold text-slate-400">Total Marketplace GMV</span>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                    KES {analytics.overview.totalGMV?.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-bold text-slate-400">Total Orders Placed</span>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                    {analytics.overview.totalOrders ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-bold text-slate-400">Platform Commission Earned</span>
                  <p className="mt-2 text-2xl font-black text-emerald-600">
                    KES {analytics.overview.totalCommissionCollected?.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-bold text-slate-400">Active Merchants Enrolled</span>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                    {analytics.overview.activeMerchants ?? 0}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Share Options Modal */}
      {shareModalHub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-xs"
                  style={{ backgroundColor: shareModalHub.theme_color || "#059669" }}
                >
                  <Share2 size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Share {shareModalHub.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">Only platform admins dispatch this separate marketplace link</p>
                </div>
              </div>
              <button
                onClick={() => setShareModalHub(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/60 space-y-2">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block">Shareable URL</span>
              <p className="font-mono text-slate-800 dark:text-slate-200 break-all select-all font-semibold">
                {shareModalHub.url}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Recommended Message to Share
              </label>
              <textarea
                rows={3}
                readOnly
                value={`Explore the ${shareModalHub.name} on ChamaManager! Discover verified independent merchants, transparent pricing, and direct ordering: ${shareModalHub.url}`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 select-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Explore the ${shareModalHub.name} on ChamaManager! Discover verified merchants and shop directly: ${shareModalHub.url}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm text-center"
              >
                <Send size={13} /> Share on WhatsApp
              </a>

              <button
                onClick={() => copyShareableLink(shareModalHub.slug)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 shadow-sm"
              >
                <Copy size={13} /> Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
