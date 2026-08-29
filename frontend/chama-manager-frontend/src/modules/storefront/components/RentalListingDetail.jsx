import React, { useState } from "react";
import { X, MapPin, BedDouble, Bath, Ruler, CheckCircle2 } from "lucide-react";
import { formatMoney } from "../utils/storefront.utils";
import { useSubmitRentalInquiry } from "../../business/hooks/useBusiness";

const RENT_PERIOD_LABEL = { month: "/ month", year: "/ year", one_time: "one-time" };

export default function RentalListingDetail({ listing, slug, currency, primaryColor, onClose }) {
  const [activeImage, setActiveImage] = useState(0);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const inquiryMutation = useSubmitRentalInquiry(slug);

  if (!listing) return null;
  const vacant = listing.status !== "occupied";
  const images = listing.images?.length ? listing.images : [null];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Please share your name and phone number.");
      return;
    }
    try {
      await inquiryMutation.mutateAsync({
        listingId: listing._id || listing.id,
        name: form.name,
        phone: form.phone,
        message: form.message,
      });
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not send your inquiry.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white sm:rounded-2xl">
        <div className="relative h-56 w-full bg-gray-100">
          {images[activeImage] ? (
            <img src={images[activeImage]} alt={listing.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">No photo</div>
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <X size={16} />
          </button>
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: vacant ? "#059669" : "#6B7280" }}
          >
            {vacant ? "Vacant" : "Occupied"}
          </span>
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-2">
            {images.map((src, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImage(idx)}
                className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${
                  idx === activeImage ? "border-gray-900" : "border-transparent"
                }`}
              >
                {src && <img src={src} alt="" className="h-full w-full object-cover" />}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 p-4">
          <h2 className="text-base font-extrabold text-gray-900">{listing.title}</h2>
          {listing.location_text && (
            <p className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={13} /> {listing.location_text}
            </p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            {listing.bedrooms != null && (
              <span className="flex items-center gap-1">
                <BedDouble size={13} /> {listing.bedrooms} bed
              </span>
            )}
            {listing.bathrooms != null && (
              <span className="flex items-center gap-1">
                <Bath size={13} /> {listing.bathrooms} bath
              </span>
            )}
            {listing.size_text && (
              <span className="flex items-center gap-1">
                <Ruler size={13} /> {listing.size_text}
              </span>
            )}
          </div>

          <p className="text-xl font-extrabold" style={{ color: primaryColor }}>
            {formatMoney(listing.rent_amount, currency)}{" "}
            <span className="text-xs font-medium text-gray-400">
              {RENT_PERIOD_LABEL[listing.rent_period] || ""}
            </span>
          </p>
          {listing.deposit_amount > 0 && (
            <p className="text-xs text-gray-500">Deposit: {formatMoney(listing.deposit_amount, currency)}</p>
          )}

          {listing.description && <p className="text-xs leading-relaxed text-gray-600">{listing.description}</p>}

          {listing.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {listing.amenities.map((a) => (
                <span key={a} className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">
                  {a}
                </span>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            {sent ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CheckCircle2 size={28} style={{ color: primaryColor }} />
                <p className="text-sm font-bold text-gray-900">Inquiry sent!</p>
                <p className="text-xs text-gray-500">The landlord will reach out to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2.5">
                <p className="text-xs font-bold text-gray-700">Interested? Send an inquiry</p>
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">{error}</p>}
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-gray-400"
                />
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-gray-400"
                />
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Message (optional)"
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-gray-400"
                />
                <button
                  type="submit"
                  disabled={inquiryMutation.isPending}
                  className="w-full rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {inquiryMutation.isPending ? "Sending…" : "Send Inquiry"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
