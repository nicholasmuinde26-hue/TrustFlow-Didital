import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";

const MarketplaceCartContext = createContext(null);

const STORAGE_KEY = "marketplace_cart_items";
export const CART_CATEGORIES = new Set(["retail", "food"]);
const normalizeCategory = (category) => String(category || "").trim().toLowerCase();
export const isCartCategory = (category) => CART_CATEGORIES.has(normalizeCategory(category));

export function MarketplaceCartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.map((item) => ({ ...item, categorySlug: normalizeCategory(item.categorySlug || "retail") }))
        : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState(null);
  const [fulfillmentByCategory, setFulfillmentByCategory] = useState({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.warn("Failed to persist cart items", e);
    }
  }, [cartItems]);

  const addToCart = (listing, qty = 1) => {
    if (!listing) return;
    const categorySlug = normalizeCategory(listing.category_slug || "retail");
    if (!isCartCategory(categorySlug)) {
      toast.error("This category uses bookings or direct contact instead of a shopping cart");
      return;
    }
    const business = listing.business_id || {};
    const businessId = String(business._id || business.id || business);
    const businessName = business.name || "Verified Merchant";

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.listingId === listing._id && normalizeCategory(i.categorySlug) === categorySlug
      );
      if (existingIndex > -1) {
        const item = prev[existingIndex];
        const newQty = item.qty + qty;
        if (listing.track_stock && listing.stock !== undefined && newQty > listing.stock) {
          toast.error(`Only ${listing.stock} units available in stock`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...item, qty: newQty };
        toast.success(`Updated "${listing.title}" quantity in cart`);
        return updated;
      }

      if (listing.track_stock && listing.stock !== undefined && qty > listing.stock) {
        toast.error(`Only ${listing.stock} units available in stock`);
        return prev;
      }

      toast.success(`Added "${listing.title}" to cart`);
      return [
        ...prev,
        {
          listingId: listing._id,
          id: listing._id,
          title: listing.title,
          slug: listing.slug,
          price: Number(listing.price || 0),
          currency: listing.currency || "KES",
          thumbnail: listing.thumbnail || (listing.images && listing.images[0]) || "",
          qty,
          businessId,
          businessName,
          categorySlug,
          stock: listing.stock,
          track_stock: listing.track_stock,
        },
      ];
    });
    setOpenCategory(categorySlug);
    setIsCartOpen(true);
  };

  const updateQty = (listingId, delta) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.listingId === listingId) {
            const nextQty = item.qty + delta;
            if (nextQty <= 0) return null;
            if (item.track_stock && item.stock !== undefined && nextQty > item.stock) {
              toast.error(`Maximum available stock reached`);
              return item;
            }
            return { ...item, qty: nextQty };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (listingId) => {
    setCartItems((prev) => prev.filter((i) => i.listingId !== listingId));
    toast.success("Item removed from cart");
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const clearCategoryCart = (categorySlug) => {
    const normalizedCategory = normalizeCategory(categorySlug);
    setCartItems((prev) => prev.filter((item) => normalizeCategory(item.categorySlug) !== normalizedCategory));
  };

  // Group items by owning business
  const merchantGroups = useMemo(() => {
    const map = {};
    for (const item of cartItems) {
      const bId = item.businessId || "general";
      if (!map[bId]) {
        map[bId] = {
          businessId: bId,
          businessName: item.businessName || "Merchant Store",
          items: [],
          subtotal: 0,
        };
      }
      map[bId].items.push(item);
      map[bId].subtotal += item.price * item.qty;
    }
    return Object.values(map);
  }, [cartItems]);

  return (
    <MarketplaceCartContext.Provider
      value={{
        cartItems,
        isCartOpen,
        openCategory,
        fulfillmentByCategory,
        setCategoryFulfillmentType: (category, type) => {
          if (isCartCategory(category) && ["delivery", "pickup"].includes(type)) {
            setFulfillmentByCategory((previous) => ({ ...previous, [normalizeCategory(category)]: type }));
          }
        },
        openCart: (category) => {
          if (isCartCategory(category)) {
            setOpenCategory(normalizeCategory(category));
            setIsCartOpen(true);
          }
        },
        closeCart: () => { setIsCartOpen(false); setOpenCategory(null); },
        addToCart,
        updateQty,
        removeFromCart,
        clearCart,
        clearCategoryCart,
      }}
    >
      {children}
    </MarketplaceCartContext.Provider>
  );
}

export function useMarketplaceCart(categorySlug = null) {
  const context = useContext(MarketplaceCartContext);
  if (!context) {
    throw new Error("useMarketplaceCart must be used within a MarketplaceCartProvider");
  }
  const normalizedCategory = normalizeCategory(categorySlug);
  const scopedItems = isCartCategory(normalizedCategory)
    ? context.cartItems.filter((item) => normalizeCategory(item.categorySlug || "retail") === normalizedCategory)
    : [];
  const merchantGroups = useMemo(() => {
    const map = {};
    for (const item of scopedItems) {
      const id = item.businessId || "general";
      if (!map[id]) map[id] = { businessId: id, businessName: item.businessName || "Merchant Store", items: [], subtotal: 0 };
      map[id].items.push(item);
      map[id].subtotal += item.price * item.qty;
    }
    return Object.values(map);
  }, [context.cartItems, normalizedCategory]);
  const itemCount = scopedItems.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = scopedItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return {
    ...context,
    cartItems: scopedItems,
    merchantGroups,
    itemCount,
    subtotal,
    isCartOpen: context.isCartOpen && context.openCategory === normalizedCategory,
    fulfillmentType: context.fulfillmentByCategory[normalizedCategory] || "delivery",
    setFulfillmentType: (type) => context.setCategoryFulfillmentType(normalizedCategory, type),
    openCart: () => context.openCart(normalizedCategory),
    addToCart: (listing, qty = 1) => context.addToCart({
      ...listing,
      category_slug: listing?.category_slug || normalizedCategory,
    }, qty),
    clearCart: () => context.clearCategoryCart(normalizedCategory),
  };
}
