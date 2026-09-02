import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, ExternalLink, Home, ClipboardList } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useStorefrontSettings, useStorefrontOrders, useBusinessInventory } from "../hooks/useBusiness";
import { RentalOccupancySnapshot } from "../components/RentalOccupancySnapshot";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";
import Button from "../../../shared/components/ui/Button";
import Card, { CardHeader, CardContent } from "../../../shared/components/ui/Card";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  fulfilled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function StorefrontPage() {
  const { workspaceId, currentWorkspace } = useWorkspace();
  const isRental = currentWorkspace?.category === "rental";

  const { storefront, isLoading: loadingStorefront, updateStorefront, isUpdating } = useStorefrontSettings(workspaceId);

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (storefront && !form) {
      setForm({
        slug: storefront.slug || "",
        name: storefront.name || "",
        headline: storefront.headline || "",
        status: storefront.status || "live",
      });
    }
  }, [storefront, form]);

  const storefrontUrl = form?.slug ? `${window.location.origin}/store/${form.slug}` : "";

  const handleSave = async () => {
    setSaved(false);
    await updateStorefront(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCopyLink = async () => {
    if (!storefrontUrl) return;
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the link is still selectable/visible below.
    }
  };

  const handleShare = async () => {
    if (!storefrontUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: form?.name || "My storefront",
          text: isRental
            ? "Browse my available rooms and plots"
            : `Shop at ${form?.name || "my store"}`,
          url: storefrontUrl,
        });
      } catch {
        // User cancelled the share sheet — nothing to do.
      }
    } else {
      handleCopyLink();
    }
  };

  if (loadingStorefront || !form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Online Storefront"
        subtitle={
          isRental
            ? "A public page tenants can browse — share it so people can see your vacant rooms and plots, no account or app required"
            : "A public marketplace page buyers can order from — no account, no app required"
        }
      />

      {/* SHARE LINK — the primary reason a landlord/seller comes to this page */}
      <Card>
        <CardHeader
          title="Share your storefront"
          subtitle={
            isRental
              ? "Send this link to prospective tenants, post it on social media, or add it to a listing site."
              : "Send this link to customers, add it to your social bios, or print it on receipts."
          }
        />
        <CardContent className="space-y-4">
          {storefrontUrl ? (
            <>
              <div className="flex flex-col gap-2 rounded-xl bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="truncate font-mono text-xs text-primary sm:text-sm">{storefrontUrl}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={handleCopyLink}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleShare}>
                    Share
                  </Button>
                  <a href={storefrontUrl} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm">
                      <ExternalLink size={14} />
                    </Button>
                  </a>
                </div>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                  form.status === "live"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {form.status === "live" ? "Live — visible to the public" : "Paused — hidden from the public"}
              </span>
            </>
          ) : (
            <p className="text-sm text-gray-400">Set a storefront URL slug below to get your share link.</p>
          )}

          {isRental && (
            <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
              <Link to={`/workspace/${workspaceId}/business/rental-listings`}>
                <Button variant="secondary" size="sm">
                  <Home size={14} /> Manage Rooms &amp; Plots
                </Button>
              </Link>
              <Link to={`/workspace/${workspaceId}/business/rental-inquiries`}>
                <Button variant="secondary" size="sm">
                  <ClipboardList size={14} /> Tenant Inquiries
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STOREFRONT CONFIG */}
      <Card>
        <CardHeader title="Storefront Settings" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                {isRental ? "Landlord / business name" : "Store name"}
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Storefront URL slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                Headline shown to {isRental ? "tenants" : "buyers"}
              </label>
              <input
                value={form.headline}
                onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                placeholder={isRental ? "e.g. Quality rooms & plots in Kilimani" : ""}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={isUpdating} size="sm">
              {isUpdating ? "Saving…" : "Save changes"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setForm((f) => ({ ...f, status: f.status === "live" ? "paused" : "live" }))}
            >
              {form.status === "live" ? "Pause storefront" : "Go live"}
            </Button>
            {saved && <span className="text-xs font-semibold text-emerald-600">Saved</span>}
          </div>
        </CardContent>
      </Card>

      {isRental ? (
        <RentalOccupancySnapshot workspaceId={workspaceId} currency={currentWorkspace?.currency || "KES"} />
      ) : (
        <ProductStorefrontExtras workspaceId={workspaceId} />
      )}
    </div>
  );
}

/* ============================================================
   Product-catalog-only sections. A rental storefront has no
   "inventory" or "orders" — tenants submit inquiries instead
   (see Rooms & Plots / Tenant Inquiries) — so these only render
   for retail/restaurant/service categories.
============================================================ */
function ProductStorefrontExtras({ workspaceId }) {
  const { orders, isLoading: loadingOrders, updateOrderStatus } = useStorefrontOrders(workspaceId);
  const { inventory, isLoading: loadingInventory, updateInventoryItem } = useBusinessInventory(workspaceId);

  const toggleVisible = async (item) => {
    await updateInventoryItem({
      itemId: item._id || item.id,
      visible_online: !item.visible_online,
    });
  };

  return (
    <>
      {/* CATALOG VISIBILITY */}
      <Card>
        <CardHeader
          title="What buyers can see"
          subtitle="Toggling an item here uses the exact same inventory record as the POS and Inventory & Stock pages."
        />
        <CardContent>
          {loadingInventory ? (
            <Spinner size="md" />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {(inventory || []).map((item) => (
                <div key={item._id || item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-base">
                      {item.icon || "📦"}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.quantity} in stock · KES {Number(item.price || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleVisible(item)}
                    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                      item.visible_online ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        item.visible_online ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ORDER FULFILLMENT */}
      <Card>
        <CardHeader title="Online Orders" />
        <CardContent>
          {loadingOrders ? (
            <Spinner size="md" />
          ) : orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No online orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-2 pr-4">Order</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {orders.map((order) => (
                    <tr key={order._id || order.id}>
                      <td className="py-3 pr-4 font-mono text-xs font-bold">{order.order_code}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900 dark:text-white">{order.customer_name}</p>
                        <p className="text-xs text-gray-500">{order.customer_phone}</p>
                      </td>
                      <td className="py-3 pr-4 font-semibold">{Number(order.total_amount || 0).toLocaleString()}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[order.fulfillment_status] || STATUS_STYLES.pending}`}>
                          {order.fulfillment_status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {order.fulfillment_status !== "fulfilled" && order.fulfillment_status !== "cancelled" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateOrderStatus({ orderId: order._id || order.id, status: "processing" })}
                              className="text-xs font-bold text-blue-600 hover:underline"
                            >
                              Processing
                            </button>
                            <button
                              onClick={() => updateOrderStatus({ orderId: order._id || order.id, status: "fulfilled" })}
                              className="text-xs font-bold text-emerald-600 hover:underline"
                            >
                              Fulfilled
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
