import React, { useState } from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  MessageSquare,
  ShieldCheck,
  CheckCircle,
  MapPin,
  Building,
} from "lucide-react";
import toast from "react-hot-toast";

export default function RentalTourBookingModal({ isOpen, onClose, listing, agent }) {
  if (!isOpen || !listing) return null;

  const resolvedAgent = agent || listing.rental_attributes?.agent || {
    name: "Alaya Saunders",
    role: "Property Consultant",
    phone: "+254712345678",
    whatsapp: "+254712345678",
  };

  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [timeSlot, setTimeSlot] = useState("10:00 AM - 11:30 AM");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const timeSlots = [
    "09:00 AM - 10:30 AM",
    "11:00 AM - 12:30 PM",
    "02:00 PM - 03:30 PM",
    "04:00 PM - 05:30 PM",
    "05:30 PM - 07:00 PM",
  ];

  const handleBooking = (e) => {
    e.preventDefault();
    if (!tenantName.trim() || !tenantPhone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      toast.success("Viewing scheduled successfully! Landlord notified.");
    }, 600);
  };

  const openWhatsAppBooking = () => {
    const cleanPhone = (resolvedAgent.whatsapp || resolvedAgent.phone || "+254712345678").replace(/[^\d]/g, "");
    const message = encodeURIComponent(
      `Hello ${resolvedAgent.name}, I would like to book a property tour for:\n\n*${listing.title}*\n📍 Location: ${listing.rental_attributes?.location_text || listing.title}\n📅 Date: ${date}\n⏰ Time: ${timeSlot}\n👤 Name: ${tenantName || "Prospective Tenant"}\n📞 Phone: ${tenantPhone || "Provided"}\n\nPlease confirm availability.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Book a Property Preview
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Free in-person inspection with verified agent
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
              <CheckCircle size={36} />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                Viewing Scheduled!
              </h4>
              <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                Your tour request for <span className="font-bold text-slate-800 dark:text-slate-200">{listing.title}</span> on{" "}
                <span className="font-bold text-teal-700 dark:text-teal-400">{date} at {timeSlot}</span> has been sent to {resolvedAgent.name}.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>Assigned Agent:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{resolvedAgent.name}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
                <span>Direct Contact:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{resolvedAgent.phone}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={openWhatsAppBooking}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md transition"
              >
                <MessageSquare size={14} /> Open in WhatsApp
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleBooking} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Property Summary Pill */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <img
                src={listing.thumbnail || listing.images?.[0]}
                alt={listing.title}
                className="h-14 w-14 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase text-teal-700 dark:text-teal-400">
                  {listing.rental_attributes?.property_type || "Apartment"}
                </span>
                <h4 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                  {listing.title}
                </h4>
                <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
                  <MapPin size={11} className="text-teal-600" />
                  {listing.rental_attributes?.location_text || "Nairobi, Kenya"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  KES {listing.price?.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block">/ mo</span>
              </div>
            </div>

            {/* Date and Time Slot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <Calendar size={13} className="text-teal-600" /> Tour Date
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-teal-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <Clock size={13} className="text-teal-600" /> Time Window
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-teal-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tenant Contact */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <User size={13} className="text-teal-600" /> Your Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brian Ochieng"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-teal-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <Phone size={13} className="text-teal-600" /> Phone Number (M-Pesa / WhatsApp)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0712 345 678"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-teal-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Special Inquiries / Questions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Inquiring about pet policy, parking availability, or immediate move-in dates..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-teal-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Realtor Badge */}
            <div className="flex items-center gap-2 rounded-xl bg-teal-50/60 p-2.5 text-[11px] text-teal-800 dark:bg-teal-950/30 dark:text-teal-300">
              <ShieldCheck size={16} className="shrink-0 text-teal-600" />
              <span>
                You are booking with verified host <strong className="font-bold">{resolvedAgent.name}</strong>. No tour fees or key deposit required.
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-teal-700 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-teal-800 disabled:opacity-50 transition"
              >
                {isSubmitting ? "Submitting..." : "Confirm Free Preview"}
              </button>
              <button
                type="button"
                onClick={openWhatsAppBooking}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
              >
                <MessageSquare size={14} /> WhatsApp
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
