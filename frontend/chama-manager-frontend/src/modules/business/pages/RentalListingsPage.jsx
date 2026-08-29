import React, { useState } from "react";
import { Plus, Pencil, Trash2, X, Home, MapPin, BedDouble, Bath, Ruler, ImagePlus } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useRentalListings } from "../hooks/useBusiness";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";
import { readImageAsDataUri } from "../../../shared/utils/readImageAsDataUri";

const MAX_IMAGES = 8;

const EMPTY_FORM = {
  listing_type: "room",
  title: "",
  description: "",
  location_text: "",
  bedrooms: "",
  bathrooms: "",
  size_text: "",
  rent_amount: "",
  rent_period: "month",
  deposit_amount: "",
  amenities: "",
  images: [],
  status: "vacant",
  visible_online: true,
};

const RENT_PERIOD_LABEL = { month: "/ month", year: "/ year", one_time: "one-time" };

function formatMoney(amount, currency = "KES") {
  const n = Number(amount || 0);
  return `${currency} ${n.toLocaleString()}`;
}

export default function RentalListingsPage() {
  const { workspaceId, currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.currency || "KES";

  const {
    listings,
    isLoading,
    addListing,
    isAdding,
    updateListing,
    isUpdating,
    setListingStatus,
    deleteListing,
  } = useRentalListings(workspaceId);
  const listingList = Array.isArray(listings) ? listings : [];

  const [modalMode, setModalMode] = useState(null); // "add" | "edit" | null
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setModalMode("add");
  };

  const openEdit = (listing) => {
    setForm({
      listing_type: listing.listing_type || "room",
      title: listing.title || "",
      description: listing.description || "",
      location_text: listing.location_text || "",
      bedrooms: listing.bedrooms ?? "",
      bathrooms: listing.bathrooms ?? "",
      size_text: listing.size_text || "",
      rent_amount: listing.rent_amount ?? "",
      rent_period: listing.rent_period || "month",
      deposit_amount: listing.deposit_amount ?? "",
      amenities: Array.isArray(listing.amenities) ? listing.amenities.join(", ") : "",
      images: Array.isArray(listing.images) ? listing.images : [],
      status: listing.status || "vacant",
      visible_online: listing.visible_online !== false,
    });
    setEditingId(listing._id || listing.id);
    setError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
  };

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError("");
    try {
      const room = MAX_IMAGES - form.images.length;
      const toRead = files.slice(0, Math.max(room, 0));
      const dataUris = await Promise.all(toRead.map((f) => readImageAsDataUri(f)));
      setForm((f) => ({ ...f, images: [...f.images, ...dataUris].slice(0, MAX_IMAGES) }));
    } catch (err) {
      setError(err.message);
    }
    e.target.value = "";
  };

  const removePhoto = (idx) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("A title is required, e.g. 'Bedsitter — Kilimani, Block C'");
      return;
    }
    if (!form.rent_amount || Number(form.rent_amount) <= 0) {
      setError("A positive rent amount is required");
      return;
    }

    const payload = {
      listing_type: form.listing_type,
      title: form.title,
      description: form.description,
      location_text: form.location_text,
      bedrooms: form.bedrooms === "" ? null : Number(form.bedrooms),
      bathrooms: form.bathrooms === "" ? null : Number(form.bathrooms),
      size_text: form.size_text,
      rent_amount: Number(form.rent_amount),
      rent_period: form.rent_period,
      deposit_amount: Number(form.deposit_amount || 0),
      amenities: form.amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      images: form.images,
      status: form.status,
      visible_online: form.visible_online,
    };

    try {
      if (modalMode === "edit" && editingId) {
        await updateListing({ listingId: editingId, ...payload });
      } else {
        await addListing(payload);
      }
      closeModal();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Something went wrong");
    }
  };

  const handleDelete = async (listing) => {
    if (!window.confirm(`Remove "${listing.title}"? This can't be undone.`)) return;
    await deleteListing(listing._id || listing.id);
  };

  const toggleStatus = async (listing) => {
    const next = listing.status === "vacant" ? "occupied" : "vacant";
    await setListingStatus({ listingId: listing._id || listing.id, status: next });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Rooms & Plots"
        subtitle="Post vacant rooms, apartments, or plots with photos for tenants to browse on your storefront."
        action={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition"
          >
            <Plus size={16} /> Add Listing
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listingList.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No listings yet. Click "Add Listing" to post your first room or plot.
          </div>
        ) : (
          listingList.map((listing) => {
            const id = listing._id || listing.id;
            const vacant = listing.status !== "occupied";
            return (
              <div
                key={id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="relative h-36 w-full bg-gray-100 dark:bg-gray-900">
                  {listing.images?.[0] ? (
                    <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <Home size={32} />
                    </div>
                  )}
                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      vacant ? "bg-emerald-500 text-white" : "bg-gray-700 text-white"
                    }`}
                  >
                    {vacant ? "Vacant" : "Occupied"}
                  </span>
                  {!listing.visible_online && (
                    <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                      Hidden
                    </span>
                  )}
                </div>

                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{listing.title}</h3>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold capitalize text-primary">
                      {listing.listing_type}
                    </span>
                  </div>

                  {listing.location_text && (
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin size={12} /> {listing.location_text}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {listing.bedrooms != null && (
                      <span className="flex items-center gap-1">
                        <BedDouble size={12} /> {listing.bedrooms}
                      </span>
                    )}
                    {listing.bathrooms != null && (
                      <span className="flex items-center gap-1">
                        <Bath size={12} /> {listing.bathrooms}
                      </span>
                    )}
                    {listing.size_text && (
                      <span className="flex items-center gap-1">
                        <Ruler size={12} /> {listing.size_text}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                    {formatMoney(listing.rent_amount, currency)}{" "}
                    <span className="text-xs font-medium text-gray-400">
                      {RENT_PERIOD_LABEL[listing.rent_period] || ""}
                    </span>
                  </p>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => toggleStatus(listing)}
                      className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
                        vacant
                          ? "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      Mark {vacant ? "Occupied" : "Vacant"}
                    </button>
                    <button
                      onClick={() => openEdit(listing)}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(listing)}
                      className="rounded-lg border border-red-100 p-1.5 text-red-500 hover:bg-red-50 dark:border-red-900"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {modalMode === "edit" ? "Edit Listing" : "Add Room / Plot"}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Photos ({form.images.length}/{MAX_IMAGES})</label>
                <div className="flex flex-wrap gap-2">
                  {form.images.map((src, idx) => (
                    <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-lg">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {form.images.length < MAX_IMAGES && (
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-primary hover:text-primary">
                      <ImagePlus size={16} />
                      <span className="text-[9px] font-bold">Add</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        className="hidden"
                        onChange={handlePhotos}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Type</label>
                  <select
                    value={form.listing_type}
                    onChange={(e) => setForm((f) => ({ ...f, listing_type: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="room">Room / Apartment</option>
                    <option value="plot">Plot / Land</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="vacant">Vacant</option>
                    <option value="occupied">Occupied</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Bedsitter — Kilimani, Block C"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Location</label>
                <input
                  value={form.location_text}
                  onChange={(e) => setForm((f) => ({ ...f, location_text: e.target.value }))}
                  placeholder="e.g. Kilimani, Nairobi"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              {form.listing_type === "room" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Bedrooms</label>
                    <input
                      type="number"
                      min="0"
                      value={form.bedrooms}
                      onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Bathrooms</label>
                    <input
                      type="number"
                      min="0"
                      value={form.bathrooms}
                      onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Size (optional)</label>
                <input
                  value={form.size_text}
                  onChange={(e) => setForm((f) => ({ ...f, size_text: e.target.value }))}
                  placeholder={form.listing_type === "plot" ? "e.g. 50x100 ft" : "e.g. 400 sq ft"}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Rent amount</label>
                  <input
                    type="number"
                    min="0"
                    value={form.rent_amount}
                    onChange={(e) => setForm((f) => ({ ...f, rent_amount: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Rent period</label>
                  <select
                    value={form.rent_period}
                    onChange={(e) => setForm((f) => ({ ...f, rent_period: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="month">Per month</option>
                    <option value="year">Per year</option>
                    <option value="one_time">One-time (sale)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Deposit (optional)</label>
                <input
                  type="number"
                  min="0"
                  value={form.deposit_amount}
                  onChange={(e) => setForm((f) => ({ ...f, deposit_amount: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Amenities (comma-separated)</label>
                <input
                  value={form.amenities}
                  onChange={(e) => setForm((f) => ({ ...f, amenities: e.target.value }))}
                  placeholder="Parking, Water included, Gated compound"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.visible_online}
                  onChange={(e) => setForm((f) => ({ ...f, visible_online: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Show on online storefront
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding || isUpdating}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isAdding || isUpdating ? "Saving…" : modalMode === "edit" ? "Save changes" : "Post Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
