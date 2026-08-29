import React from "react";
import { Phone, MessageSquare, Home } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useRentalInquiries } from "../hooks/useBusiness";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";

const STATUS_STYLES = {
  new: "bg-blue-50 text-blue-700",
  contacted: "bg-amber-50 text-amber-700",
  closed: "bg-gray-100 text-gray-500",
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function RentalInquiriesPage() {
  const { workspaceId } = useWorkspace();
  const { inquiries, isLoading, updateInquiryStatus, isUpdatingStatus } = useRentalInquiries(workspaceId);
  const list = Array.isArray(inquiries) ? inquiries : [];

  const setStatus = async (inquiry, status) => {
    await updateInquiryStatus({ inquiryId: inquiry._id || inquiry.id, status });
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
        title="Tenant Inquiries"
        subtitle="Leads submitted through your storefront's 'Inquire' form on a room or plot listing."
      />

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No inquiries yet. When a tenant inquires about a listing on your storefront, it'll show up here.
          </div>
        ) : (
          list.map((inquiry) => {
            const id = inquiry._id || inquiry.id;
            const listingTitle = inquiry.listing_id?.title || "a listing";
            return (
              <div
                key={id}
                className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{inquiry.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                        STATUS_STYLES[inquiry.status] || STATUS_STYLES.new
                      }`}
                    >
                      {inquiry.status || "new"}
                    </span>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Home size={12} /> Re: {listingTitle}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Phone size={12} /> {inquiry.phone}
                  </p>
                  {inquiry.message && (
                    <p className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                      <MessageSquare size={12} className="mt-0.5 shrink-0" /> {inquiry.message}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400">{timeAgo(inquiry.createdAt)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {inquiry.status !== "contacted" && (
                    <button
                      disabled={isUpdatingStatus}
                      onClick={() => setStatus(inquiry, "contacted")}
                      className="rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Mark Contacted
                    </button>
                  )}
                  {inquiry.status !== "closed" && (
                    <button
                      disabled={isUpdatingStatus}
                      onClick={() => setStatus(inquiry, "closed")}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200"
                    >
                      Close
                    </button>
                  )}
                  <a
                    href={`tel:${inquiry.phone}`}
                    className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90"
                  >
                    Call
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
