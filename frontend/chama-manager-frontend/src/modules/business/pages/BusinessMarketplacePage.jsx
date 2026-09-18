import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Store,
  ShoppingBag,
  Building,
  Briefcase,
  UtensilsCrossed,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  Truck,
  ExternalLink,
  DollarSign,
  Package,
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  Home,
  Key,
  MapPin,
  Bed,
  Bath,
  Check,
} from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import marketplaceService from "../../marketplace/services/marketplace.service";
import businessApi from "../api/business.api";
import Spinner from "@/shared/components/ui/Spinner";
import toast from "react-hot-toast";

const HUBS = [
  { slug: "retail", name: "Retail Hub", icon: ShoppingBag, color: "text-emerald-500", desc: "Physical products, apparel, electronics, groceries" },
  { slug: "rentals", name: "Rentals Hub", icon: Building, color: "text-blue-500", desc: "Houses, apartments, single rooms, commercial plots" },
  { slug: "services", name: "Services Hub", icon: Briefcase, color: "text-purple-500", desc: "Plumbing, electrical, consulting, event bookings" },
  { slug: "food", name: "Food & Menus", icon: UtensilsCrossed, color: "text-orange-500", desc: "Dishes, restaurant meals, takeout and catering" },
];

function getHubSlugForBusinessCategory(businessCategory) {
  if (!businessCategory) return "retail";
  const b = String(businessCategory).toLowerCase().trim();
  switch (b) {
    case "retail":
      return "retail";
    case "rental":
    case "rentals":
      return "rentals";
    case "service":
    case "services":
      return "services";
    case "restaurant":
    case "food":
      return "food";
    default:
      return "retail";
  }
}

function isBusinessEligibleForHub(businessCategory, hubSlug) {
  if (!businessCategory || !hubSlug) return false;
  const b = String(businessCategory).toLowerCase().trim();
  const h = String(hubSlug).toLowerCase().trim();

  if (b === h) return true;
  if (b === "retail" && h === "retail") return true;
  if ((b === "rental" || b === "rentals") && (h === "rentals" || h === "rental")) return true;
  if ((b === "service" || b === "services") && (h === "services" || h === "service")) return true;
  if ((b === "restaurant" || b === "food") && (h === "food" || h === "restaurant")) return true;
  if (b === "other" && h === "retail") return true;

  return false;
}

export default function BusinessMarketplacePage() {
  const { workspaceId } = useParams();
  const { currentWorkspace } = useWorkspace();
  const businessId = currentWorkspace?._id || currentWorkspace?.id || workspaceId;
  const businessCategory = currentWorkspace?.category || "retail";
  const isRentalBusiness =
    businessCategory === "rental" ||
    businessCategory === "rentals" ||
    getHubSlugForBusinessCategory(businessCategory) === "rentals";
  const allowedHubSlug = getHubSlugForBusinessCategory(businessCategory);
  const visibleHubs = HUBS.filter((h) => isBusinessEligibleForHub(businessCategory, h.slug));

  const [enrollments, setEnrollments] = useState([]);
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settlementsData, setSettlementsData] = useState({ summary: {}, settlements: [] });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [rentalListings, setRentalListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active section
  const [activeSection, setActiveSection] = useState("listings"); // "listings" | "orders" | "settlements" | "hubs"

  // Modals
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedHubToEnroll, setSelectedHubToEnroll] = useState(allowedHubSlug);
  const [enrollForm, setEnrollForm] = useState({
    display_name: "",
    tagline: "",
    delivery_info: "",
    return_policy: "",
  });

  const getInitialSubmitForm = () => ({
    category_slug: allowedHubSlug,
    source_type: isRentalBusiness ? "RentalListing" : "BusinessItem",
    source_id: "",
    title: "",
    price: "",
    stock: isRentalBusiness ? 1 : 10,
    description: "",
    thumbnail: "",
    // Rental attributes
    subcategory: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    deposit: "",
    floor_level: "",
    area_sqm: "",
    is_furnished: false,
    pets_allowed: false,
    location_neighborhood: "",
    rent_period: "monthly",
    is_occupied: false,
    visibility: "public",
  });

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitForm, setSubmitForm] = useState(getInitialSubmitForm);
  const [editingListing, setEditingListing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setSelectedHubToEnroll(allowedHubSlug);
    setSubmitForm((prev) => ({ ...prev, category_slug: allowedHubSlug }));
  }, [allowedHubSlug]);

  useEffect(() => {
    if (!businessId) return;
    loadAllData();
  }, [businessId]);

  const safeArray = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (res.data && Array.isArray(res.data.data)) return res.data.data;
    if (res.data && Array.isArray(res.data.items)) return res.data.items;
    if (res.data && Array.isArray(res.data.listings)) return res.data.listings;
    if (res.data && Array.isArray(res.data.inventory)) return res.data.inventory;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.listings)) return res.listings;
    return [];
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [enrRes, listRes, ordRes, setRes, invRes, rentRes] = await Promise.all([
        marketplaceService.getMerchantStatus(businessId).catch(() => []),
        marketplaceService.getMerchantListings(businessId).catch(() => []),
        marketplaceService.getMerchantOrders(businessId).catch(() => ({ orders: [] })),
        marketplaceService.getSettlements(businessId).catch(() => ({ summary: {}, settlements: [] })),
        businessApi.getInventory(businessId).catch(() => ({ data: [] })),
        businessApi.getRentalListings(businessId).catch(() => ({ data: [] })),
      ]);

      setEnrollments(safeArray(enrRes));
      setListings(safeArray(listRes));
      setOrders(Array.isArray(ordRes?.orders) ? ordRes.orders : safeArray(ordRes));
      setSettlementsData(setRes && typeof setRes === "object" ? setRes : { summary: {}, settlements: [] });
      setInventoryItems(safeArray(invRes));
      setRentalListings(safeArray(rentRes));
    } catch (err) {
      console.error("Error loading merchant marketplace data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    try {
      await marketplaceService.enrollInHub(businessId, {
        category_slug: selectedHubToEnroll,
        merchant_profile: enrollForm,
      });
      toast.success(`Opt-in submitted for ${selectedHubToEnroll.toUpperCase()} Marketplace!`);
      setShowEnrollModal(false);
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit enrollment");
    }
  };

  const handleSubmitListing = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const isRental = submitForm.category_slug === "rentals" || isRentalBusiness;
      const payload = {
        category_slug: submitForm.category_slug || allowedHubSlug,
        source_type: isRental ? "RentalListing" : (submitForm.source_id ? submitForm.source_type : "BusinessItem"),
        source_id: submitForm.source_id || undefined,
        title: submitForm.title.trim(),
        price: Number(submitForm.price),
        stock: submitForm.is_occupied ? 0 : (isRental ? 1 : Number(submitForm.stock) || 1),
        description: submitForm.description.trim(),
        thumbnail: submitForm.thumbnail,
        subcategory: submitForm.subcategory,
        visibility: submitForm.visibility || "public",
      };

      if (isRental) {
        payload.rental_attributes = {
          property_type: submitForm.subcategory || "Apartment",
          bedrooms: Number(submitForm.bedrooms) || 1,
          bathrooms: Number(submitForm.bathrooms) || 1,
          deposit: submitForm.deposit ? Number(submitForm.deposit) : 0,
          floor_level: submitForm.floor_level ? Number(submitForm.floor_level) : undefined,
          area_sqm: submitForm.area_sqm ? Number(submitForm.area_sqm) : undefined,
          is_furnished: Boolean(submitForm.is_furnished),
          pets_allowed: Boolean(submitForm.pets_allowed),
          location_neighborhood: submitForm.location_neighborhood || "",
          rent_period: submitForm.rent_period || "monthly",
          is_occupied: Boolean(submitForm.is_occupied),
        };
      }

      await marketplaceService.submitListing(businessId, payload);
      toast.success(
        isRental
          ? "Property listing submitted to marketplace moderation queue!"
          : "Item submitted to marketplace moderation queue!"
      );
      setShowSubmitModal(false);
      setSubmitForm(getInitialSubmitForm());
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit listing");
    } finally {
      setActionLoading(false);
    }
  };

  const startEditListing = (item) => {
    setEditingListing(item);
    setEditForm({
      title: item.title || "",
      price: item.price || "",
      description: item.description || "",
      thumbnail: item.thumbnail || (item.images && item.images[0]) || "",
      subcategory: item.subcategory || item.rental_attributes?.property_type || "Apartment",
      stock: item.stock !== undefined ? item.stock : 1,
      visibility: item.visibility || "public",
      // Rental attributes
      bedrooms: item.rental_attributes?.bedrooms ?? 1,
      bathrooms: item.rental_attributes?.bathrooms ?? 1,
      deposit: item.rental_attributes?.deposit ?? "",
      floor_level: item.rental_attributes?.floor_level ?? "",
      area_sqm: item.rental_attributes?.area_sqm ?? "",
      is_furnished: Boolean(item.rental_attributes?.is_furnished),
      pets_allowed: Boolean(item.rental_attributes?.pets_allowed),
      location_neighborhood: item.rental_attributes?.location_neighborhood ?? "",
      rent_period: item.rental_attributes?.rent_period || "monthly",
      is_occupied: Boolean(item.rental_attributes?.is_occupied),
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingListing) return;
    setActionLoading(true);
    try {
      const isRental = editingListing.category_slug === "rentals" || isRentalBusiness;
      const payload = {
        title: editForm.title.trim(),
        price: Number(editForm.price),
        description: editForm.description.trim(),
        thumbnail: editForm.thumbnail,
        subcategory: editForm.subcategory,
        visibility: editForm.visibility || "public",
        stock: editForm.is_occupied ? 0 : (isRental ? 1 : Number(editForm.stock) || 1),
      };

      if (isRental) {
        payload.rental_attributes = {
          property_type: editForm.subcategory || "Apartment",
          bedrooms: Number(editForm.bedrooms) || 1,
          bathrooms: Number(editForm.bathrooms) || 1,
          deposit: editForm.deposit ? Number(editForm.deposit) : 0,
          floor_level: editForm.floor_level ? Number(editForm.floor_level) : undefined,
          area_sqm: editForm.area_sqm ? Number(editForm.area_sqm) : undefined,
          is_furnished: Boolean(editForm.is_furnished),
          pets_allowed: Boolean(editForm.pets_allowed),
          location_neighborhood: editForm.location_neighborhood || "",
          rent_period: editForm.rent_period || "monthly",
          is_occupied: Boolean(editForm.is_occupied),
        };
      }

      await marketplaceService.updateMerchantListing(businessId, editingListing._id, payload);
      toast.success("Listing updated successfully!");
      setEditingListing(null);
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update listing");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleOccupancy = async (listing) => {
    try {
      const currentOccupied = Boolean(listing.rental_attributes?.is_occupied);
      const nextOccupied = !currentOccupied;
      await marketplaceService.toggleListingOccupancy(businessId, listing._id, nextOccupied);
      toast.success(
        nextOccupied
          ? `"${listing.title}" marked as Occupied / Sold (now hidden from public vacancy searches)`
          : `"${listing.title}" marked as Available & Vacant (now visible for rent)`
      );
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update occupancy status");
    }
  };

  const handleToggleVisibility = async (listing) => {
    try {
      const currentVis = listing.visibility || "public";
      const nextVis = currentVis === "public" ? "unlisted" : "public";
      await marketplaceService.toggleListingVisibility(businessId, listing._id, nextVis);
      toast.success(
        nextVis === "public"
          ? `"${listing.title}" is now Public on the Marketplace`
          : `"${listing.title}" unselected — hidden from public marketplace`
      );
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update listing visibility");
    }
  };

  const handleDeleteListing = async (listing) => {
    if (!window.confirm(`Are you sure you want to permanently remove "${listing.title}" from your marketplace listings?`)) {
      return;
    }
    try {
      await marketplaceService.deleteMerchantListing(businessId, listing._id);
      toast.success(`Listing "${listing.title}" deleted successfully`);
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete listing");
    }
  };

  const handleFulfillmentChange = async (orderId, newStatus) => {
    try {
      await marketplaceService.updateFulfillment(businessId, orderId, newStatus);
      toast.success(`Order fulfillment updated to ${newStatus}`);
      loadAllData();
    } catch (err) {
      toast.error("Failed to update fulfillment status");
    }
  };

  const isEnrolledIn = (slug) => {
    const enr = enrollments.find((e) => e.category_slug === slug);
    return enr?.status || "unregistered";
  };

  const totalUnits = listings.length;
  const vacantUnits = listings.filter((l) => !l.rental_attributes?.is_occupied).length;
  const occupiedUnits = listings.filter((l) => l.rental_attributes?.is_occupied).length;
  const publicUnits = listings.filter((l) => l.visibility !== "unlisted").length;
  const hiddenUnits = listings.filter((l) => l.visibility === "unlisted").length;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Merchant Dashboard
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Online Products & Sales
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage your online category marketplace products, process customer orders, and track sales settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isEnrolledIn(allowedHubSlug) === "approved" && (
            <Link
              to={`/marketplace/${allowedHubSlug}`}
              target="_blank"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shadow-2xs"
            >
              <ExternalLink size={13} /> View {visibleHubs[0]?.name || "Marketplace"}
            </Link>
          )}
          <button
            onClick={() => {
              setSubmitForm(getInitialSubmitForm());
              setShowSubmitModal(true);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer ${
              isRentalBusiness ? "bg-teal-700 hover:bg-teal-800" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <Plus size={15} /> {isRentalBusiness ? "Add Property Listing" : "Publish to Marketplace"}
          </button>
        </div>
      </div>

      {/* Category Independence & Scoped Opt-In Banner */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-black shadow-xs">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-white">
                Business Sector: {String(businessCategory).toUpperCase()}
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                Designated Hub Only
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
              In accordance with marketplace separation rules, your business can only opt in to and publish listings within the {visibleHubs[0]?.name || `${allowedHubSlug.toUpperCase()} Marketplace`}. Other category marketplaces are isolated and managed exclusively via admin-dispatched links.
            </p>
          </div>
        </div>
      </div>

      {/* Hub Enrollment Cards Row - STRICTLY SCOPED TO THIS BUSINESS CATEGORY */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleHubs.map((hub) => {
          const Icon = hub.icon;
          const status = isEnrolledIn(hub.slug);
          return (
            <div
              key={hub.slug}
              className="rounded-2xl border-2 border-emerald-500/30 bg-white p-5 shadow-xs dark:border-emerald-500/20 dark:bg-slate-900 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800">
                      <Icon size={20} className={hub.color} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{hub.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">/marketplace/{hub.slug}</span>
                    </div>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                      status === "approved"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : status === "pending"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{hub.desc}</p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800">
                {status === "approved" ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 size={15} /> Active & Publishing
                    </span>
                    <Link
                      to={`/marketplace/${hub.slug}`}
                      target="_blank"
                      className="text-xs font-bold text-slate-600 hover:text-emerald-600 dark:text-slate-300 flex items-center gap-1"
                    >
                      Visit Hub <ExternalLink size={11} />
                    </Link>
                  </div>
                ) : status === "pending" ? (
                  <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                    <Clock size={15} /> Application Pending Admin Review
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedHubToEnroll(hub.slug);
                      setShowEnrollModal(true);
                    }}
                    className="w-full rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 transition shadow-sm"
                  >
                    Opt In to {hub.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <button
          onClick={() => setActiveSection("listings")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
            activeSection === "listings"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300"
          }`}
        >
          Online Products & Listings ({listings.length})
        </button>
        <button
          onClick={() => setActiveSection("orders")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
            activeSection === "orders"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300"
          }`}
        >
          Orders & Sales ({orders.length})
        </button>
        <button
          onClick={() => setActiveSection("settlements")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
            activeSection === "settlements"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300"
          }`}
        >
          Net Settlements & Payouts
        </button>
      </div>

      {/* SECTION 1: LISTINGS */}
      {activeSection === "listings" && (
        <div className="space-y-5">
          {/* For Property Owners Banner (Moved from Public Category Page to Business Merchant Workspace) */}
          {isRentalBusiness && (
            <div className="rounded-3xl border border-teal-200/80 bg-gradient-to-r from-teal-950 via-[#0d5c52] to-teal-950 p-6 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-teal-800/80 px-3 py-1 text-xs font-bold text-teal-200 mb-2.5 border border-teal-700/60">
                    <Building size={14} className="text-teal-300" />
                    <span>Property Owner & Landlord Portal</span>
                  </div>
                  <h3 className="text-xl font-black text-white">For Property Owners & Landlords</h3>
                  <p className="mt-1 text-xs text-teal-100/85 max-w-2xl leading-relaxed">
                    Manage your rental units, apartments, and commercial spaces directly from your business workspace. Add new listings, mark properties as occupied or bought when rented out, or unselect properties so they don't appear in the public rental marketplace.
                  </p>

                  {/* Summary Metric Counters */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-4 pt-3 border-t border-teal-800/60 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-teal-200 font-medium">Total Properties:</span>
                      <span className="rounded-md bg-teal-800/60 px-2 py-0.5 font-black text-white">{totalUnits}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-teal-200 font-medium">Available Vacancies:</span>
                      <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-black text-emerald-300">{vacantUnits}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-teal-200 font-medium">Occupied / Bought:</span>
                      <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-black text-amber-300">{occupiedUnits}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-teal-200 font-medium">Public on Marketplace:</span>
                      <span className="rounded-md bg-blue-500/20 px-2 py-0.5 font-black text-blue-300">{publicUnits}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-teal-200 font-medium">Hidden / Unlisted:</span>
                      <span className="rounded-md bg-slate-500/20 px-2 py-0.5 font-black text-slate-300">{hiddenUnits}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSubmitForm(getInitialSubmitForm());
                    setShowSubmitModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase tracking-wider text-teal-950 shadow-lg hover:bg-teal-50 transition shrink-0 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Add Property Listing</span>
                </button>
              </div>
            </div>
          )}

          {listings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-slate-400 bg-white dark:border-slate-800 dark:bg-slate-900">
              <Store size={36} className="mx-auto text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {isRentalBusiness ? "No property listings added yet" : "No marketplace listings yet"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isRentalBusiness
                  ? "Add your first property listing to showcase vacancies on the verified rental marketplace."
                  : "Opt in to a hub and publish products or items for discovery."}
              </p>
              <button
                onClick={() => {
                  setSubmitForm(getInitialSubmitForm());
                  setShowSubmitModal(true);
                }}
                className="mt-4 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 cursor-pointer shadow-sm"
              >
                {isRentalBusiness ? "Add First Property" : "Submit First Item"}
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      <th className="p-4">{isRentalBusiness ? "Property" : "Item"}</th>
                      <th className="p-4">{isRentalBusiness ? "Type & Location" : "Hub"}</th>
                      <th className="p-4">{isRentalBusiness ? "Rent / Period" : "Price"}</th>
                      {isRentalBusiness ? (
                        <th className="p-4">Occupancy Status</th>
                      ) : (
                        <th className="p-4">Stock</th>
                      )}
                      <th className="p-4">Marketplace Visibility</th>
                      <th className="p-4">Review Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {listings.map((item) => {
                      const isRentalItem =
                        item.category_slug === "rentals" ||
                        item.rental_attributes != null ||
                        isRentalBusiness;
                      const isOccupied = Boolean(item.rental_attributes?.is_occupied);
                      const isPublic = item.visibility !== "unlisted";

                      return (
                        <tr key={item._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="p-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-3">
                              {item.thumbnail ? (
                                <img
                                  src={item.thumbnail}
                                  alt=""
                                  className="h-12 w-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                  {isRentalItem ? <Home size={18} /> : <Store size={18} />}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-extrabold text-sm text-slate-900 dark:text-white block truncate max-w-xs">
                                  {item.title}
                                </span>
                                {isRentalItem ? (
                                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                    <span className="flex items-center gap-1">
                                      <Bed size={12} className="text-teal-600" /> {item.rental_attributes?.bedrooms ?? 1} Bed
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Bath size={12} className="text-teal-600" /> {item.rental_attributes?.bathrooms ?? 1} Bath
                                    </span>
                                    {item.rental_attributes?.area_sqm && (
                                      <>
                                        <span>•</span>
                                        <span>{item.rental_attributes.area_sqm} m²</span>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  item.moderation_notes && (
                                    <span className="block text-[10px] text-amber-600 font-normal">
                                      Note: {item.moderation_notes}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="p-4 text-slate-600 dark:text-slate-300">
                            {isRentalItem ? (
                              <div>
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                                  {item.rental_attributes?.property_type || item.subcategory || "Apartment"}
                                </span>
                                <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <MapPin size={11} className="shrink-0 text-teal-600" />
                                  {item.rental_attributes?.location_neighborhood || "Kenya"}
                                </span>
                              </div>
                            ) : (
                              <span className="capitalize font-semibold">{item.category_slug}</span>
                            )}
                          </td>

                          <td className="p-4">
                            <span className="font-black text-slate-900 dark:text-white text-xs">
                              {item.currency} {item.price?.toLocaleString()}
                            </span>
                            {isRentalItem && (
                              <span className="block text-[10px] text-slate-400 font-medium">
                                / {item.rental_attributes?.rent_period || "month"}
                              </span>
                            )}
                          </td>

                          {isRentalBusiness ? (
                            <td className="p-4">
                              {isOccupied ? (
                                <div className="flex flex-col gap-1.5 items-start">
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider dark:bg-rose-950/60 dark:text-rose-300">
                                    <Home size={11} /> Occupied / Bought
                                  </span>
                                  <button
                                    onClick={() => handleToggleOccupancy(item)}
                                    className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 underline cursor-pointer"
                                    title="Mark as Vacant so public tenants can discover and rent it"
                                  >
                                    Mark Available
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5 items-start">
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider dark:bg-emerald-950/60 dark:text-emerald-300">
                                    <Key size={11} /> Vacant / Available
                                  </span>
                                  <button
                                    onClick={() => handleToggleOccupancy(item)}
                                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 underline cursor-pointer"
                                    title="Mark as Occupied or Bought to hide from public vacancy searches"
                                  >
                                    Mark Occupied / Sold
                                  </button>
                                </div>
                              )}
                            </td>
                          ) : (
                            <td className="p-4 font-bold text-slate-600 dark:text-slate-300">
                              {item.track_stock ? `${item.stock} in stock` : "Untracked"}
                            </td>
                          )}

                          <td className="p-4">
                            {isPublic ? (
                              <div className="flex flex-col gap-1.5 items-start">
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[10px] font-bold dark:bg-blue-950/60 dark:text-blue-300">
                                  <Eye size={11} /> Public (Visible)
                                </span>
                                <button
                                  onClick={() => handleToggleVisibility(item)}
                                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white underline cursor-pointer"
                                  title="Unselect this property so it does not appear on the public marketplace"
                                >
                                  Unselect / Hide
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5 items-start">
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 text-slate-700 px-2.5 py-0.5 text-[10px] font-bold dark:bg-slate-800 dark:text-slate-400">
                                  <EyeOff size={11} /> Unlisted (Hidden)
                                </span>
                                <button
                                  onClick={() => handleToggleVisibility(item)}
                                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline cursor-pointer"
                                  title="Publish this listing to appear on the public marketplace"
                                >
                                  Publish Publicly
                                </button>
                              </div>
                            )}
                          </td>

                          <td className="p-4">
                            <span
                              className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${
                                item.moderation_status === "approved"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : item.moderation_status === "pending"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                  : item.moderation_status === "changes_requested"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              }`}
                            >
                              {item.moderation_status?.replace("_", " ")}
                            </span>
                          </td>

                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.moderation_status === "approved" && isPublic && !isOccupied && (
                                <Link
                                  to={
                                    item.category_slug === "rentals"
                                      ? `/marketplace/rentals/listings/${item.slug}`
                                      : `/marketplace/${item.category_slug}/products/${item.slug}`
                                  }
                                  target="_blank"
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                                  title="View live listing on marketplace"
                                >
                                  Live <ArrowUpRight size={12} />
                                </Link>
                              )}
                              <button
                                onClick={() => startEditListing(item)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white transition cursor-pointer"
                                title="Edit Listing"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteListing(item)}
                                className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                title="Delete Listing"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: ORDERS */}
      {activeSection === "orders" && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center text-slate-400 bg-white dark:border-slate-800 dark:bg-slate-900">
              <Package size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No marketplace orders received yet</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-4">Order Code</th>
                    <th className="p-4">Buyer Info</th>
                    <th className="p-4">My Items</th>
                    <th className="p-4">My Net Settlement</th>
                    <th className="p-4">Fulfillment Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orders.map((ord) => (
                    <tr key={ord._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-black text-slate-900 dark:text-white">
                        {ord.order_number}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {new Date(ord.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-900 dark:text-white block">{ord.customer_name}</span>
                        <span className="text-slate-500">{ord.customer_phone}</span>
                      </td>
                      <td className="p-4">
                        {ord.items?.map((it, idx) => (
                          <div key={idx} className="font-semibold text-slate-700 dark:text-slate-300">
                            {it.qty}x {it.name} (KES {it.line_total?.toLocaleString()})
                          </div>
                        ))}
                      </td>
                      <td className="p-4 font-black text-emerald-600">
                        KES {ord.allocation?.net_amount?.toLocaleString() || "—"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold capitalize ${
                            ord.allocation?.fulfillment_status === "fulfilled"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {ord.allocation?.fulfillment_status || "Pending"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {ord.allocation?.fulfillment_status !== "fulfilled" && (
                          <button
                            onClick={() => handleFulfillmentChange(ord._id, "fulfilled")}
                            className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Mark Fulfilled
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: SETTLEMENTS */}
      {activeSection === "settlements" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-bold text-slate-400">Total Net Settlement Balance</span>
              <p className="mt-2 text-2xl font-black text-emerald-600">
                KES {settlementsData.summary?.totalNet?.toLocaleString() || 0}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">After platform commission</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-bold text-slate-400">Cleared & Ready for Payout</span>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                KES {settlementsData.summary?.clearedSettlement?.toLocaleString() || 0}
              </p>
              <span className="text-[11px] text-emerald-600 mt-1 block">Fulfilled orders</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-bold text-slate-400">Pending Fulfillment</span>
              <p className="mt-2 text-2xl font-black text-amber-600">
                KES {settlementsData.summary?.pendingSettlement?.toLocaleString() || 0}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">Orders awaiting delivery</span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="p-4">Order</th>
                  <th className="p-4">Gross Amount</th>
                  <th className="p-4">Commission Fee</th>
                  <th className="p-4">Net Payout Amount</th>
                  <th className="p-4">Settlement Status</th>
                  <th className="p-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {settlementsData.settlements?.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">
                      #{s.order_number}
                    </td>
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                      KES {s.gross_amount?.toLocaleString()}
                    </td>
                    <td className="p-4 text-slate-500">
                      - KES {s.platform_commission?.toLocaleString()}
                    </td>
                    <td className="p-4 font-black text-emerald-600">
                      KES {s.net_settlement_amount?.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${
                          s.status === "cleared"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4 text-right text-slate-400">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ENROLLMENT MODAL */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <form onSubmit={handleEnrollSubmit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Opt in to {visibleHubs[0]?.name || selectedHubToEnroll.toUpperCase() + " Marketplace"}
              </h3>
              <button type="button" onClick={() => setShowEnrollModal(false)} className="text-slate-400">
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Merchant Public Display Name
              </label>
              <input
                type="text"
                required
                value={enrollForm.display_name}
                onChange={(e) => setEnrollForm({ ...enrollForm, display_name: e.target.value })}
                placeholder="e.g. Acme Electronics Kenya"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Shop Headline / Tagline
              </label>
              <input
                type="text"
                value={enrollForm.tagline}
                onChange={(e) => setEnrollForm({ ...enrollForm, tagline: e.target.value })}
                placeholder="e.g. Best quality electronics with 1-year warranty"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Return & Inspection Policy
              </label>
              <textarea
                rows={2}
                value={enrollForm.return_policy}
                onChange={(e) => setEnrollForm({ ...enrollForm, return_policy: e.target.value })}
                placeholder="e.g. 7-day returns for defective items."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md"
              >
                Submit Opt-In Application
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBMIT / ADD LISTING MODAL */}
      {/* ========================================================================= */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitListing}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isRentalBusiness ? "Add New Property Listing" : `Publish Item to ${visibleHubs[0]?.name || "Marketplace"}`}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isRentalBusiness
                    ? "List your property for discovery on the verified public rentals marketplace."
                    : "Publish products or services to your designated marketplace hub."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Hub + Source Import */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Designated Hub
                </label>
                <input
                  type="text"
                  readOnly
                  value={visibleHubs[0]?.name || `${allowedHubSlug.toUpperCase()} Marketplace`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Import from Workspace {isRentalBusiness ? "Rental Units" : "Inventory"}
                </label>
                <select
                  value={submitForm.source_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const pool = isRentalBusiness ? rentalListings : inventoryItems;
                    const item = pool.find((i) => (i._id || i.id) === id);
                    if (item) {
                      if (isRentalBusiness) {
                        setSubmitForm((prev) => ({
                          ...prev,
                          source_type: "RentalListing",
                          source_id: id,
                          title: item.title || item.name || "",
                          price: item.rent_amount || item.price || "",
                          deposit: item.deposit || "",
                          subcategory: item.property_type || item.subcategory || "Apartment",
                          bedrooms: item.bedrooms || 1,
                          bathrooms: item.bathrooms || 1,
                          floor_level: item.floor_level || "",
                          area_sqm: item.area_sqm || "",
                          is_furnished: Boolean(item.is_furnished),
                          pets_allowed: Boolean(item.pets_allowed),
                          location_neighborhood: item.location || item.neighborhood || "",
                          description: item.description || "",
                          thumbnail: item.thumbnail || (Array.isArray(item.images) ? item.images[0] : "") || item.image_url || "",
                        }));
                      } else {
                        setSubmitForm((prev) => ({
                          ...prev,
                          source_type: "BusinessItem",
                          source_id: id,
                          title: item.name || item.title || "",
                          price: item.online_price || item.price || "",
                          stock: item.quantity !== undefined ? item.quantity : 10,
                          description: item.description || "",
                          thumbnail: item.image_url || item.thumbnail || "",
                        }));
                      }
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- Create Fresh / Select Unit --</option>
                  {(isRentalBusiness ? rentalListings : inventoryItems).map((inv) => (
                    <option key={inv._id || inv.id} value={inv._id || inv.id}>
                      {inv.title || inv.name} (KES {(inv.rent_amount || inv.price || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isRentalBusiness ? "Property Title" : "Listing Title"} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={submitForm.title}
                onChange={(e) => setSubmitForm({ ...submitForm, title: e.target.value })}
                placeholder={
                  isRentalBusiness
                    ? "e.g. Executive 2-Bedroom Apartment with Balcony & Generator"
                    : "e.g. Wireless Bluetooth Noise-Cancelling Headphones"
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* RENTAL SPECIFIC FIELDS */}
            {isRentalBusiness ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Property Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={submitForm.subcategory}
                      onChange={(e) => setSubmitForm({ ...submitForm, subcategory: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa / Mansion</option>
                      <option value="Bedsitter">Bedsitter / Studio</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Commercial">Commercial Office</option>
                      <option value="Townhouse">Townhouse</option>
                      <option value="Land / Plot">Land / Plot</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Monthly Rent (KES) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={submitForm.price}
                      onChange={(e) => setSubmitForm({ ...submitForm, price: e.target.value })}
                      placeholder="e.g. 65000"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Security Deposit (KES)
                    </label>
                    <input
                      type="number"
                      value={submitForm.deposit}
                      onChange={(e) => setSubmitForm({ ...submitForm, deposit: e.target.value })}
                      placeholder="e.g. 65000"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bedrooms
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={submitForm.bedrooms}
                      onChange={(e) => setSubmitForm({ ...submitForm, bedrooms: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bathrooms
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={submitForm.bathrooms}
                      onChange={(e) => setSubmitForm({ ...submitForm, bathrooms: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Floor Level
                    </label>
                    <input
                      type="number"
                      value={submitForm.floor_level}
                      onChange={(e) => setSubmitForm({ ...submitForm, floor_level: e.target.value })}
                      placeholder="e.g. 4"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Area (m²)
                    </label>
                    <input
                      type="number"
                      value={submitForm.area_sqm}
                      onChange={(e) => setSubmitForm({ ...submitForm, area_sqm: e.target.value })}
                      placeholder="e.g. 110"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Location / Neighborhood <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={submitForm.location_neighborhood}
                      onChange={(e) => setSubmitForm({ ...submitForm, location_neighborhood: e.target.value })}
                      placeholder="e.g. Kilimani, Wood Avenue, Nairobi"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Rent Period Frequency
                    </label>
                    <select
                      value={submitForm.rent_period}
                      onChange={(e) => setSubmitForm({ ...submitForm, rent_period: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily / Short Stay</option>
                    </select>
                  </div>
                </div>

                {/* Toggles: Occupancy, Visibility, Furnished, Pets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold cursor-pointer dark:border-slate-700 dark:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={submitForm.is_furnished}
                      onChange={(e) => setSubmitForm({ ...submitForm, is_furnished: e.target.checked })}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Furnished</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold cursor-pointer dark:border-slate-700 dark:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={submitForm.pets_allowed}
                      onChange={(e) => setSubmitForm({ ...submitForm, pets_allowed: e.target.checked })}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Pets Allowed</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold cursor-pointer dark:border-slate-700 dark:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={submitForm.is_occupied}
                      onChange={(e) => setSubmitForm({ ...submitForm, is_occupied: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Occupied / Sold</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold cursor-pointer dark:border-slate-700 dark:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={submitForm.visibility === "public"}
                      onChange={(e) =>
                        setSubmitForm({
                          ...submitForm,
                          visibility: e.target.checked ? "public" : "unlisted",
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Public on Hub</span>
                  </label>
                </div>
              </>
            ) : (
              /* NON-RENTAL FIELDS */
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Selling Price (KES) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={submitForm.price}
                      onChange={(e) => setSubmitForm({ ...submitForm, price: e.target.value })}
                      placeholder="e.g. 2500"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Available Stock Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={submitForm.stock}
                      onChange={(e) => setSubmitForm({ ...submitForm, stock: e.target.value })}
                      placeholder="e.g. 10"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Marketplace Visibility
                  </label>
                  <select
                    value={submitForm.visibility}
                    onChange={(e) => setSubmitForm({ ...submitForm, visibility: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="public">Public (Show on Marketplace)</option>
                    <option value="unlisted">Unlisted (Hidden from Public Marketplace)</option>
                  </select>
                </div>
              </>
            )}

            {/* Thumbnail */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Primary Photo / Thumbnail URL
              </label>
              <input
                type="url"
                value={submitForm.thumbnail}
                onChange={(e) => setSubmitForm({ ...submitForm, thumbnail: e.target.value })}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {submitForm.thumbnail && (
                <div className="mt-2">
                  <img
                    src={submitForm.thumbnail}
                    alt="Preview"
                    className="h-20 w-32 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isRentalBusiness ? "Property Description & Key Amenities" : "Description & Specifications"}
              </label>
              <textarea
                rows={3}
                value={submitForm.description}
                onChange={(e) => setSubmitForm({ ...submitForm, description: e.target.value })}
                placeholder={
                  isRentalBusiness
                    ? "Highlight borehole water, standby generator, 24/7 security, high-speed lift, modern fitted kitchen, balcony views..."
                    : "Provide details, dimensions, warranty, or item condition..."
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-md cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? "Submitting..." : isRentalBusiness ? "Submit Property Listing" : "Submit to Review Queue"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT LISTING MODAL */}
      {/* ========================================================================= */}
      {editingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Edit {isRentalBusiness ? "Property Listing" : "Marketplace Item"}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Listing ID: {editingListing._id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isRentalBusiness ? "Property Title" : "Listing Title"} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* RENTAL SPECIFIC EDIT FIELDS */}
            {isRentalBusiness ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Property Type
                    </label>
                    <select
                      value={editForm.subcategory}
                      onChange={(e) => setEditForm({ ...editForm, subcategory: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa / Mansion</option>
                      <option value="Bedsitter">Bedsitter / Studio</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Commercial">Commercial Office</option>
                      <option value="Townhouse">Townhouse</option>
                      <option value="Land / Plot">Land / Plot</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Monthly Rent (KES) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Security Deposit (KES)
                    </label>
                    <input
                      type="number"
                      value={editForm.deposit}
                      onChange={(e) => setEditForm({ ...editForm, deposit: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bedrooms
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.bedrooms}
                      onChange={(e) => setEditForm({ ...editForm, bedrooms: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bathrooms
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.bathrooms}
                      onChange={(e) => setEditForm({ ...editForm, bathrooms: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Floor Level
                    </label>
                    <input
                      type="number"
                      value={editForm.floor_level}
                      onChange={(e) => setEditForm({ ...editForm, floor_level: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Area (m²)
                    </label>
                    <input
                      type="number"
                      value={editForm.area_sqm}
                      onChange={(e) => setEditForm({ ...editForm, area_sqm: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Location / Neighborhood
                    </label>
                    <input
                      type="text"
                      value={editForm.location_neighborhood}
                      onChange={(e) => setEditForm({ ...editForm, location_neighborhood: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Rent Period
                    </label>
                    <select
                      value={editForm.rent_period}
                      onChange={(e) => setEditForm({ ...editForm, rent_period: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily / Short Stay</option>
                    </select>
                  </div>
                </div>

                {/* Status Toggles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold cursor-pointer dark:border-slate-700 dark:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={editForm.is_furnished}
                      onChange={(e) => setEditForm({ ...editForm, is_furnished: e.target.checked })}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Furnished</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold cursor-pointer dark:border-slate-700 dark:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={editForm.pets_allowed}
                      onChange={(e) => setEditForm({ ...editForm, pets_allowed: e.target.checked })}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Pets Allowed</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold cursor-pointer dark:border-slate-700 dark:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={editForm.is_occupied}
                      onChange={(e) => setEditForm({ ...editForm, is_occupied: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Occupied / Sold</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold cursor-pointer dark:border-slate-700 dark:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={editForm.visibility === "public"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          visibility: e.target.checked ? "public" : "unlisted",
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Public on Hub</span>
                  </label>
                </div>
              </>
            ) : (
              /* NON-RENTAL EDIT FIELDS */
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Selling Price (KES) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Available Stock Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={editForm.stock}
                      onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Marketplace Visibility
                  </label>
                  <select
                    value={editForm.visibility}
                    onChange={(e) => setEditForm({ ...editForm, visibility: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="public">Public (Show on Marketplace)</option>
                    <option value="unlisted">Unlisted (Hidden from Public Marketplace)</option>
                  </select>
                </div>
              </>
            )}

            {/* Thumbnail */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Photo / Thumbnail URL
              </label>
              <input
                type="url"
                value={editForm.thumbnail}
                onChange={(e) => setEditForm({ ...editForm, thumbnail: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isRentalBusiness ? "Description & Key Amenities" : "Description & Specifications"}
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-md cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? "Saving Changes..." : "Save Listing Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
