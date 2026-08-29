import React, { useState } from "react";
import { Plus, Pencil, Trash2, PackagePlus, X, Globe } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessInventory } from "../hooks/useBusiness";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";
import { readImageAsDataUri } from "../../../shared/utils/readImageAsDataUri";

const CATEGORY_COPY = {
  restaurant: { singular: "Menu Item", plural: "Menu Items", tracksStockDefault: false },
  service: { singular: "Service", plural: "Services", tracksStockDefault: false },
  retail: { singular: "Product", plural: "Products", tracksStockDefault: true },
  other: { singular: "Product", plural: "Products", tracksStockDefault: true },
};

const EMPTY_FORM = {
  name: "",
  sku: "",
  category: "",
  description: "",
  price: "",
  online_price: "",
  cost_price: "",
  quantity: "",
  track_stock: true,
  visible_online: true,
  icon: "📦",
  image_url: "",
};

export default function InventoryPage() {
  const { workspaceId, currentWorkspace } = useWorkspace();
  const bizCategory = currentWorkspace?.category || "retail";
  const copy = CATEGORY_COPY[bizCategory] || CATEGORY_COPY.retail;

  const {
    inventory,
    isLoading,
    refetch,
    addInventoryItem,
    isAdding,
    updateInventoryItem,
    isUpdating,
    deleteInventoryItem,
    restockInventoryItem,
    isRestocking,
  } = useBusinessInventory(workspaceId);
  const inventoryList = Array.isArray(inventory) ? inventory : [];

  const [modalMode, setModalMode] = useState(null); // "add" | "edit" | null
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const [restockTarget, setRestockTarget] = useState(null);
  const [restockQty, setRestockQty] = useState("");

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, track_stock: copy.tracksStockDefault });
    setEditingId(null);
    setError("");
    setModalMode("add");
  };

  const openEdit = (item) => {
    setForm({
      name: item.name || "",
      sku: item.sku || "",
      category: item.category || "",
      description: item.description || "",
      price: item.price ?? "",
      online_price: item.online_price ?? "",
      cost_price: item.cost_price ?? "",
      quantity: item.quantity ?? "",
      track_stock: item.track_stock !== false,
      visible_online: item.visible_online !== false,
      icon: item.icon || "📦",
      image_url: item.image_url || "",
    });
    setEditingId(item._id || item.id);
    setError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUri = await readImageAsDataUri(file);
      setForm((f) => ({ ...f, image_url: dataUri }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError(`${copy.singular} name is required`);
      return;
    }
    if (!form.price || Number(form.price) < 0) {
      setError("A valid price is required");
      return;
    }

    const payload = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      description: form.description,
      price: Number(form.price),
      online_price: form.online_price === "" ? null : Number(form.online_price),
      cost_price: Number(form.cost_price || 0),
      quantity: form.track_stock ? Number(form.quantity || 0) : 0,
      track_stock: form.track_stock,
      visible_online: form.visible_online,
      icon: form.icon,
      image_url: form.image_url,
    };

    try {
      if (modalMode === "edit" && editingId) {
        await updateInventoryItem({ itemId: editingId, ...payload });
      } else {
        await addInventoryItem(payload);
      }
      closeModal();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Something went wrong");
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Remove "${item.name}"? This can't be undone.`)) return;
    await deleteInventoryItem(item._id || item.id);
  };

  const openRestock = (item) => {
    setRestockTarget(item);
    setRestockQty("");
  };

  const submitRestock = async (e) => {
    e.preventDefault();
    if (!restockTarget || !restockQty || Number(restockQty) <= 0) return;
    await restockInventoryItem({ itemId: restockTarget._id || restockTarget.id, add_quantity: Number(restockQty) });
    setRestockTarget(null);
    setRestockQty("");
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
        title={copy.plural}
        subtitle={
          copy.tracksStockDefault
            ? "Add products, edit details, and restock what's running low."
            : `Add, edit, and price the ${copy.plural.toLowerCase()} your customers see.`
        }
        action={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition"
          >
            <Plus size={16} /> Add {copy.singular}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {inventoryList.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No {copy.plural.toLowerCase()} yet. Click "Add {copy.singular}" to create your first one.
          </div>
        ) : (
          inventoryList.map((item) => {
            const tracksStock = item.track_stock !== false;
            return (
              <div
                key={item._id || item.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-11 w-11 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">
                        {item.icon || "📦"}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.sku ? `SKU: ${item.sku}` : item.category || "General"}
                      </p>
                    </div>
                  </div>
                  {item.visible_online && (
                    <span title="Visible on storefront" className="flex-shrink-0 text-primary">
                      <Globe size={14} />
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-500">{tracksStock ? "In Stock" : "Availability"}</span>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {tracksStock ? item.quantity || 0 : "Unlimited"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Price</span>
                    <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                      KES {Number(item.price || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  {tracksStock && (
                    <button
                      onClick={() => openRestock(item)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                    >
                      <PackagePlus size={13} /> Restock
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(item)}
                    className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="ml-auto flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {modalMode === "edit" ? `Edit ${copy.singular}` : `Add ${copy.singular}`}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

              <div className="flex items-center gap-3">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                    {form.icon}
                  </span>
                )}
                <label className="cursor-pointer text-xs font-bold text-primary hover:underline">
                  Upload photo
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhoto} />
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">{copy.singular} name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder={`e.g. ${copy.singular === "Menu Item" ? "Chicken Biryani" : copy.singular === "Service" ? "Haircut & Styling" : "Dish Soap 750ml"}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Category</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="e.g. Beverages"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">SKU (optional)</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Price (in-store)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Online price (optional)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.online_price}
                    onChange={(e) => setForm((f) => ({ ...f, online_price: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Same as in-store"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.track_stock}
                  onChange={(e) => setForm((f) => ({ ...f, track_stock: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Track stock quantity (turn off for services or made-to-order items)
              </label>

              {form.track_stock && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">
                    {modalMode === "edit" ? "Quantity in stock" : "Starting quantity"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  {modalMode === "edit" && (
                    <p className="mt-1 text-[11px] text-gray-400">To add stock instead, use the "Restock" button on the card.</p>
                  )}
                </div>
              )}

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
                  {isAdding || isUpdating ? "Saving…" : modalMode === "edit" ? "Save changes" : `Add ${copy.singular}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESTOCK MODAL */}
      {restockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Restock "{restockTarget.name}"</h3>
              <button onClick={() => setRestockTarget(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500">Currently {restockTarget.quantity || 0} in stock.</p>
            <form onSubmit={submitRestock} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Quantity to add</label>
                <input
                  type="number"
                  min="1"
                  autoFocus
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRestockTarget(null)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRestocking}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isRestocking ? "Saving…" : "Add stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}