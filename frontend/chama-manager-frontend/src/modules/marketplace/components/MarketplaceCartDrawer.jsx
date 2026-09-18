import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Trash2,
  Plus,
  Minus,
  Store,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  User,
  MapPin,
} from "lucide-react";
import { useMarketplaceCart } from "../context/MarketplaceCartContext";
import marketplaceService from "../services/marketplace.service";
import toast from "react-hot-toast";

export default function MarketplaceCartDrawer() {
  const {
    isCartOpen,
    closeCart,
    cartItems,
    merchantGroups,
    subtotal,
    itemCount,
    updateQty,
    removeFromCart,
    clearCart,
  } = useMarketplaceCart();

  const [step, setStep] = useState("cart"); // "cart" | "checkout" | "success"
  const [fulfillmentType, setFulfillmentType] = useState("delivery");
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    delivery_address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  if (!isCartOpen) return null;

  const deliveryFee = fulfillmentType === "delivery" ? 250 : 0;
  const totalAmount = subtotal + deliveryFee;

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name.trim() || !formData.customer_phone.trim()) {
      toast.error("Name and M-Pesa phone number are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = cartItems.map((item) => ({
        listing_id: item.listingId,
        qty: item.qty,
      }));

      const payload = {
        customer_name: formData.customer_name.trim(),
        customer_phone: formData.customer_phone.trim(),
        customer_email: formData.customer_email.trim(),
        delivery_address:
          fulfillmentType === "delivery"
            ? formData.delivery_address.trim() || "Delivery in Nairobi"
            : "Store Pickup",
        fulfillment_type: fulfillmentType,
        delivery_fee: deliveryFee,
        payment_method: "mpesa",
        items: itemsPayload,
      };

      const result = await marketplaceService.checkout(payload);
      setOrderResult(result);
      clearCart();
      setStep("success");
      toast.success("Order placed successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === "success") {
      setStep("cart");
      setOrderResult(null);
    }
    closeCart();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col dark:bg-slate-900">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {step === "success"
                  ? "Order Confirmed"
                  : step === "checkout"
                  ? "Checkout & Payment"
                  : `Shopping Cart (${itemCount})`}
              </h2>
              {step === "cart" && merchantGroups.length > 1 && (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {merchantGroups.length} separate merchants in cart
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {step === "success" && orderResult ? (
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Order #{orderResult.order_number}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Thank you for your order! An M-Pesa STK push prompt has been dispatched to{" "}
                    <span className="font-bold">{formData.customer_phone}</span>.
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-left text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck size={16} /> M-Pesa Checkout Routing:
                  </p>
                  <p>
                    Enter your PIN on your phone to complete payment. Each merchant has been notified and will prepare your package for dispatch.
                  </p>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  <Link
                    to={`/marketplace/track?order=${orderResult.order_number}`}
                    onClick={handleClose}
                    className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                  >
                    Track My Order
                  </Link>
                  <button
                    onClick={handleClose}
                    className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Store size={44} className="mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-semibold">Your marketplace cart is empty.</p>
                <button
                  onClick={handleClose}
                  className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Explore Category Hubs
                </button>
              </div>
            ) : step === "cart" ? (
              <div className="space-y-6">
                {/* Multi-business split guidance note */}
                {merchantGroups.length > 1 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <div className="flex gap-2">
                      <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <span className="font-bold">Multi-Vendor Cart:</span> Your order contains items from {merchantGroups.length} independent shops. Each shop packages and fulfills its items separately.
                      </div>
                    </div>
                  </div>
                )}

                {/* Items Grouped by Merchant */}
                {merchantGroups.map((group) => (
                  <div
                    key={group.businessId}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    {/* Merchant attribution header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          <Store size={13} />
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {group.businessName}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        KES {group.subtotal.toLocaleString()}
                      </span>
                    </div>

                    {/* Merchant item rows */}
                    <div className="mt-3 space-y-3">
                      {group.items.map((item) => (
                        <div key={item.listingId} className="flex items-center gap-3">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="h-14 w-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-200 text-slate-400 dark:bg-slate-700">
                              <Store size={18} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate dark:text-white">
                              {item.title}
                            </h4>
                            <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                              KES {item.price.toLocaleString()}
                            </p>

                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex items-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                                <button
                                  onClick={() => updateQty(item.listingId, -1)}
                                  className="p-1 hover:text-emerald-600 text-slate-500"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="px-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                  {item.qty}
                                </span>
                                <button
                                  onClick={() => updateQty(item.listingId, 1)}
                                  className="p-1 hover:text-emerald-600 text-slate-500"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>

                              <button
                                onClick={() => removeFromCart(item.listingId)}
                                className="p-1 text-slate-400 hover:text-rose-500"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Checkout Form Step */
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                  <span className="text-xs font-bold text-slate-500 block mb-2">Fulfillment Method</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFulfillmentType("delivery")}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                        fulfillmentType === "delivery"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Truck size={14} /> Delivery (KES 250)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFulfillmentType("pickup")}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
                        fulfillmentType === "pickup"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Store size={14} /> Store Pickup (Free)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <User size={13} /> Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    placeholder="e.g. Grace Wanjiku"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Phone size={13} /> M-Pesa Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    placeholder="e.g. 0712345678"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    You will receive an M-Pesa PIN prompt on this phone.
                  </span>
                </div>

                {fulfillmentType === "delivery" && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <MapPin size={13} /> Delivery Address / Landmark
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={formData.delivery_address}
                      onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                      placeholder="e.g. Kilimani, Wood Avenue, Flat 4B"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900 space-y-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Items Subtotal:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      KES {subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Delivery Fee:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {deliveryFee > 0 ? `KES ${deliveryFee}` : "Free"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 font-black text-slate-900 dark:border-slate-800 dark:text-white">
                    <span>Total Due:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      KES {totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep("cart")}
                    className="w-1/3 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    Back to Cart
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Processing...
                      </>
                    ) : (
                      `Pay KES ${totalAmount.toLocaleString()} via M-Pesa`
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Drawer Footer (Only on Cart step) */}
          {step === "cart" && cartItems.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    KES {subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Estimated Delivery</span>
                  <span>KES 250</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-900 dark:border-slate-700 dark:text-white">
                  <span>Estimated Total</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    KES {(subtotal + 250).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setStep("checkout")}
                className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition"
              >
                Proceed to Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
