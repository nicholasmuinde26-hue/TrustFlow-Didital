import React, { useMemo, useState } from "react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessPos } from "../hooks/useBusiness";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";
import Button from "../../../shared/components/ui/Button";

const PAYMENT_CHANNELS = [
  { key: "cash", label: "Cash" },
  { key: "mpesa", label: "M-Pesa" },
  { key: "till", label: "Card / Till" },
];

export default function PosPage() {
  const { workspaceId, currentWorkspace } = useWorkspace();
  const { items, isLoading, refetch, checkout, isCheckingOut } = useBusinessPos(workspaceId);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState({}); // { [itemId]: qty }
  const [paymentChannel, setPaymentChannel] = useState("cash");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  const inventoryList = Array.isArray(items) ? items : [];

  const categories = useMemo(() => {
    const set = new Set(inventoryList.map((i) => i.category || "General"));
    return ["All", ...Array.from(set)];
  }, [inventoryList]);

  const filteredItems = useMemo(() => {
    return inventoryList.filter((item) => {
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      const matchesSearch =
        !search.trim() ||
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.sku?.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [inventoryList, activeCategory, search]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([itemId, qty]) => {
        const item = inventoryList.find((i) => (i._id || i.id) === itemId);
        if (!item || qty <= 0) return null;
        return { item, qty, lineTotal: Number(item.price || 0) * qty };
      })
      .filter(Boolean);
  }, [cart, inventoryList]);

  const subtotal = cartLines.reduce((sum, line) => sum + line.lineTotal, 0);

  const addToCart = (item) => {
    const itemId = item._id || item.id;
    const currentQty = cart[itemId] || 0;
    if (currentQty >= (item.quantity || 0)) return; // can't exceed live stock
    setCart((prev) => ({ ...prev, [itemId]: currentQty + 1 }));
  };

  const changeQty = (itemId, delta) => {
    setCart((prev) => {
      const next = { ...prev };
      const newQty = (next[itemId] || 0) + delta;
      if (newQty <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = newQty;
      }
      return next;
    });
  };

  const handleCharge = async () => {
    setError("");
    setReceipt(null);
    if (cartLines.length === 0) {
      setError("Add at least one item to the sale.");
      return;
    }
    if (paymentChannel === "mpesa" && !customerPhone.trim()) {
      setError("Enter the customer's phone number to collect via M-Pesa.");
      return;
    }
    try {
      const result = await checkout({
        items: cartLines.map((line) => ({ item_id: line.item._id || line.item.id, qty: line.qty })),
        payment_channel: paymentChannel,
        customer_phone: customerPhone.trim() || undefined,
      });
      setReceipt(result);
      setCart({});
      setCustomerPhone("");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not complete the sale.");
    }
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
        title="Point of Sale"
        description="Stock updates automatically when a sale is charged"
        onRefresh={refetch}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* CATALOG */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item or SKU…"
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  activeCategory === cat
                    ? "bg-primary text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filteredItems.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
                No items match.
              </div>
            ) : (
              filteredItems.map((item) => {
                const itemId = item._id || item.id;
                const inCart = cart[itemId] || 0;
                const outOfStock = (item.quantity || 0) <= 0;
                const lowStock = !outOfStock && item.quantity <= 10;

                return (
                  <button
                    key={itemId}
                    disabled={outOfStock || inCart >= item.quantity}
                    onClick={() => addToCart(item)}
                    className={`relative rounded-2xl border p-4 text-left transition-all ${
                      outOfStock
                        ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/40"
                        : "border-gray-200 bg-white hover:border-primary hover:shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    }`}
                  >
                    <span
                      className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        outOfStock
                          ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300"
                          : lowStock
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {outOfStock ? "Out of stock" : `${item.quantity} in stock`}
                    </span>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-xl">
                      {item.icon || "📦"}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{item.sku}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {currentWorkspace?.currency || "KES"} {Number(item.price || 0).toLocaleString()}
                      </span>
                      {inCart > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                          {inCart} in cart
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CHECKOUT */}
        <div className="w-full flex-shrink-0 rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:w-96">
          <div className="border-b border-gray-100 p-4 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Current Sale</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{cartLines.length} item line(s)</p>
          </div>

          <div className="max-h-80 overflow-y-auto p-4">
            {cartLines.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Tap items to add them to the sale.</p>
            ) : (
              cartLines.map((line) => {
                const itemId = line.item._id || line.item.id;
                return (
                  <div key={itemId} className="flex items-center justify-between border-b border-dashed border-gray-100 py-3 last:border-0 dark:border-gray-700">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{line.item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {currentWorkspace?.currency || "KES"} {Number(line.item.price || 0).toLocaleString()} each
                      </p>
                    </div>
                    <div className="mx-3 flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 dark:bg-gray-900">
                      <button
                        onClick={() => changeQty(itemId, -1)}
                        className="text-sm font-bold text-primary"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-xs font-bold">{line.qty}</span>
                      <button
                        onClick={() => changeQty(itemId, 1)}
                        disabled={line.qty >= line.item.quantity}
                        className="text-sm font-bold text-primary disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-16 text-right text-sm font-bold text-gray-900 dark:text-white">
                      {line.lineTotal.toLocaleString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-3 border-t border-gray-100 p-4 dark:border-gray-700">
            <div className="flex items-center justify-between text-base font-extrabold text-gray-900 dark:text-white">
              <span>Total</span>
              <span>
                {currentWorkspace?.currency || "KES"} {subtotal.toLocaleString()}
              </span>
            </div>

            <div className="flex gap-2">
              {PAYMENT_CHANNELS.map((channel) => (
                <button
                  key={channel.key}
                  onClick={() => setPaymentChannel(channel.key)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
                    paymentChannel === channel.key
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "border border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  }`}
                >
                  {channel.label}
                </button>
              ))}
            </div>

            {paymentChannel === "mpesa" && (
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Customer phone e.g. 2547XXXXXXXX"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            )}

            {error && <p className="text-xs font-medium text-red-600">{error}</p>}

            {receipt && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Sale completed — receipt {receipt.receipt_number}. Stock updated.
              </div>
            )}

            <Button
              onClick={handleCharge}
              disabled={isCheckingOut || cartLines.length === 0}
              className="w-full"
            >
              {isCheckingOut ? "Charging…" : `Charge ${currentWorkspace?.currency || "KES"} ${subtotal.toLocaleString()}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
