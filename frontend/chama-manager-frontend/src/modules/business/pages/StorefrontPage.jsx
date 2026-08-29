import React, { useEffect, useState } from "react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useStorefrontSettings, useStorefrontOrders, useBusinessInventory } from "../hooks/useBusiness";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";
import Button from "../../../shared/components/ui/Button";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  fulfilled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function StorefrontPage() {
  const { workspaceId } = useWorkspace();
  const { storefront, isLoading: loadingStorefront, updateStorefront, isUpdating } = useStorefrontSettings(workspaceId);
  const { orders, isLoading: loadingOrders, updateOrderStatus } = useStorefrontOrders(workspaceId);
  const { inventory, isLoading: loadingInventory, updateInventoryItem } = useBusinessInventory(workspaceId);

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

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

  const toggleVisible = async (item) => {
    await updateInventoryItem({
      itemId: item._id || item.id,
      visible_online: !item.visible_online,
    });
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
        description="A public marketplace page buyers can order from — no account, no app required"
      />

      {/* STOREFRONT CONFIG */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Storefront Settings</h3>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              form.status === "live"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {form.status === "live" ? "Live" : "Paused"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Store name</label>
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
            <label className="mb-1 block text-xs font-semibold text-gray-500">Headline shown to buyers</label>
            <input
              value={form.headline}
              onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
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

        {storefrontUrl && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3">
            <span className="truncate text-xs font-mono text-primary">{storefrontUrl}</span>
            <a href={storefrontUrl} target="_blank" rel="noreferrer" className="ml-3 flex-shrink-0 text-xs font-bold text-primary hover:underline">
              Open →
            </a>
          </div>
        )}
      </div>

      {/* CATALOG VISIBILITY */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-white">What buyers can see</h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Toggling an item here uses the exact same inventory record as the POS and Inventory & Stock pages.
        </p>

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
      </div>

      {/* ORDER FULFILLMENT */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Online Orders</h3>

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
      </div>
    </div>
  );
}
