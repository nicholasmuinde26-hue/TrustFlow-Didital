import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";

const MarketplaceCartContext = createContext(null);

const STORAGE_KEY = "marketplace_cart_items";

export function MarketplaceCartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.warn("Failed to persist cart items", e);
    }
  }, [cartItems]);

  const addToCart = (listing, qty = 1) => {
    if (!listing) return;
    const business = listing.business_id || {};
    const businessId = String(business._id || business.id || business);
    const businessName = business.name || "Verified Merchant";

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.listingId === listing._id);
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
          categorySlug: listing.category_slug || "retail",
          stock: listing.stock,
          track_stock: listing.track_stock,
        },
      ];
    });
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

  const itemCount = useMemo(() => cartItems.reduce((sum, i) => sum + i.qty, 0), [cartItems]);
  const subtotal = useMemo(() => cartItems.reduce((sum, i) => sum + i.price * i.qty, 0), [cartItems]);

  return (
    <MarketplaceCartContext.Provider
      value={{
        cartItems,
        merchantGroups,
        itemCount,
        subtotal,
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
        addToCart,
        updateQty,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </MarketplaceCartContext.Provider>
  );
}

export function useMarketplaceCart() {
  const context = useContext(MarketplaceCartContext);
  if (!context) {
    throw new Error("useMarketplaceCart must be used within a MarketplaceCartProvider");
  }
  return context;
}
