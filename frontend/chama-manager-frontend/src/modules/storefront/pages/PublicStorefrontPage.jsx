import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  usePublicStorefront,
  usePlaceStorefrontOrder,
} from "../../business/hooks/useBusiness";

import AppTopBar from "../components/AppTopBar";
import BottomNav from "../components/BottomNav";
import HomeTab from "../components/HomeTab";
import ShopTab from "../components/ShopTab";
import CartTab from "../components/CartTab";
import AccountTab from "../components/AccountTab";
import ProductQuickView from "../components/ProductQuickView";
import OrderSuccess from "../components/OrderSuccess";

import { getItemId, getCategories, computeCartLines } from "../utils/storefront.utils";

const EMPTY_FORM = {
  customer_name: "",
  customer_phone: "",
  delivery_address: "",
  fulfillment_type: "delivery",
  payment_method: "mpesa",
};

export default function PublicStorefrontPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { storefront, business, items, isLoading, isError, refetch } = usePublicStorefront(slug);
  const placeOrderMutation = usePlaceStorefrontOrder(slug);

  // Shell navigation
  const [activeTab, setActiveTab] = useState("home");

  // Shop tab browsing state (kept here so switching tabs preserves it)
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortValue, setSortValue] = useState("relevance");
  const [quickViewItem, setQuickViewItem] = useState(null);

  // Cart + checkout state
  const [cart, setCart] = useState({}); // { [itemId]: qty }
  const [cartStep, setCartStep] = useState("cart"); // "cart" | "checkout"
  const [form, setForm] = useState(EMPTY_FORM);
  const [orderResult, setOrderResult] = useState(null);
  const [error, setError] = useState("");

  const categories = useMemo(() => getCategories(items), [items]);
  const cartLines = useMemo(() => computeCartLines(cart, items), [cart, items]);
  const subtotal = cartLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);

  const addToCart = (item) => {
    const itemId = getItemId(item);
    const current = cart[itemId] || 0;
    if (current >= item.quantity) return;
    setCart((prev) => ({ ...prev, [itemId]: current + 1 }));
  };

  const changeQty = (itemId, delta) => {
    setCart((prev) => {
      const next = { ...prev };
      const newQty = (next[itemId] || 0) + delta;
      if (newQty <= 0) delete next[itemId];
      else next[itemId] = newQty;
      return next;
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const updateForm = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const goToCategory = (cat) => {
    setCategory(cat);
    setActiveTab("shop");
  };

  const handlePlaceOrder = async () => {
    setError("");
    if (cartLines.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    try {
      const result = await placeOrderMutation.mutateAsync({
        ...form,
        items: cartLines.map((l) => ({ item_id: getItemId(l.item), qty: l.qty })),
      });
      setOrderResult(result);
      setCart({});
      setCartStep("cart");
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not place order.");
    }
  };

  const primaryColor = storefront?.theme?.primary_color || "#1F7A5C";
  const currency = business?.currency || "KES";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading storefront…</p>
      </div>
    );
  }

  if (isError || !storefront) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
        <p className="text-lg font-bold text-gray-900">Storefront not found</p>
        <p className="text-sm text-gray-500">This store may be offline or the link is incorrect.</p>
        <button onClick={refetch} className="text-sm font-bold text-blue-600">
          Try again
        </button>
      </div>
    );
  }

  if (orderResult) {
    return (
      <OrderSuccess
        orderResult={orderResult}
        slug={slug}
        phone={form.customer_phone}
        primaryColor={primaryColor}
        onContinueShopping={() => {
          setOrderResult(null);
          setActiveTab("home");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AppTopBar
        storefront={storefront}
        primaryColor={primaryColor}
        cartCount={cartCount}
        cartSubtotal={subtotal}
        currency={currency}
        onOpenCart={() => {
          setCartStep("cart");
          setActiveTab("cart");
        }}
      />

      {activeTab === "home" && (
        <HomeTab
          storefront={storefront}
          items={items}
          categories={categories}
          cart={cart}
          currency={currency}
          primaryColor={primaryColor}
          onAdd={addToCart}
          onChangeQty={changeQty}
          onOpenDetail={setQuickViewItem}
          onBrowseCategory={goToCategory}
        />
      )}

      {activeTab === "shop" && (
        <ShopTab
          items={items}
          categories={categories}
          category={category}
          onSelectCategory={setCategory}
          search={search}
          onSearchChange={setSearch}
          sortValue={sortValue}
          onSortChange={setSortValue}
          cart={cart}
          currency={currency}
          primaryColor={primaryColor}
          onAdd={addToCart}
          onChangeQty={changeQty}
          onOpenDetail={setQuickViewItem}
        />
      )}

      {activeTab === "cart" && (
        <CartTab
          step={cartStep}
          cartLines={cartLines}
          subtotal={subtotal}
          currency={currency}
          primaryColor={primaryColor}
          onChangeQty={changeQty}
          onRemove={removeFromCart}
          onGoToCheckout={() => setCartStep("checkout")}
          onBackToCart={() => setCartStep("cart")}
          onBrowse={() => setActiveTab("shop")}
          form={form}
          onFormChange={updateForm}
          onPlaceOrder={handlePlaceOrder}
          isPlacing={placeOrderMutation.isPending}
          error={error}
        />
      )}

      {activeTab === "account" && (
        <AccountTab
          storefront={storefront}
          business={business}
          primaryColor={primaryColor}
          onGoToTrack={() => navigate(`/store/${slug}/track`)}
        />
      )}

      <ProductQuickView
        item={quickViewItem}
        qtyInCart={quickViewItem ? cart[getItemId(quickViewItem)] || 0 : 0}
        currency={currency}
        primaryColor={primaryColor}
        onClose={() => setQuickViewItem(null)}
        onAdd={(item) => addToCart(item)}
        onChangeQty={changeQty}
        onViewCart={() => {
          setQuickViewItem(null);
          setCartStep("cart");
          setActiveTab("cart");
        }}
      />

      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          if (tab === "track") {
            navigate(`/store/${slug}/track`);
            return;
          }
          setActiveTab(tab);
        }}
        cartCount={cartCount}
        primaryColor={primaryColor}
      />
    </div>
  );
}
