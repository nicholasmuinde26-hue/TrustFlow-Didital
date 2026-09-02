/**
 * Shared helpers for the buyer-facing storefront.
 * Kept framework-free so they're easy to unit test in isolation.
 */

export function getItemId(item) {
  return String(item?._id || item?.id || "");
}

/**
 * The price a buyer actually pays. `online_price` overrides the
 * in-store `price` when the seller has set one (e.g. a web-only deal).
 */
export function getSellingPrice(item) {
  const online = item?.online_price;
  if (online !== null && online !== undefined && online !== "") {
    return Number(online);
  }
  return Number(item?.price || 0);
}

/**
 * The "was" price to show struck through, only when it's a genuine
 * markdown (online price strictly lower than shelf price). We never
 * invent a discount — if there's no online_price, or it isn't lower,
 * there's no strikethrough and no percentage badge.
 */
export function getWasPrice(item) {
  const online = item?.online_price;
  const shelf = Number(item?.price || 0);
  if (online === null || online === undefined || online === "") return null;
  const onlineNum = Number(online);
  return onlineNum < shelf ? shelf : null;
}

export function getDiscountPercent(item) {
  const was = getWasPrice(item);
  if (!was) return null;
  const sell = getSellingPrice(item);
  const pct = Math.round(((was - sell) / was) * 100);
  return pct > 0 ? pct : null;
}

export function formatMoney(amount, currency = "KES") {
  const n = Number(amount || 0);
  return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function getStockState(item) {
  if (!item?.in_stock || Number(item?.quantity) <= 0) return "out";
  if (item?.low_stock) return "low";
  return "in";
}

/** Unique, alphabetised category list plus an implicit "All". */
export function getCategories(items) {
  const set = new Set();
  for (const item of items) {
    const cat = (item?.category || "General").trim();
    if (cat) set.add(cat);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export const SORT_OPTIONS = [
  { value: "relevance", label: "Top picks" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name_asc", label: "Name: A to Z" },
];

export function sortItems(items, sortValue) {
  const list = [...items];
  switch (sortValue) {
    case "price_asc":
      return list.sort((a, b) => getSellingPrice(a) - getSellingPrice(b));
    case "price_desc":
      return list.sort((a, b) => getSellingPrice(b) - getSellingPrice(a));
    case "name_asc":
      return list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    default:
      // "Relevance": in-stock and discounted items surface first,
      // otherwise keep the seller's original listing order.
      return list.sort((a, b) => {
        const stockRank = { in: 0, low: 0, out: 1 };
        const sA = stockRank[getStockState(a)];
        const sB = stockRank[getStockState(b)];
        if (sA !== sB) return sA - sB;
        const dA = getDiscountPercent(a) ? 0 : 1;
        const dB = getDiscountPercent(b) ? 0 : 1;
        return dA - dB;
      });
  }
}

/**
 * Decorative emoji for a category chip/icon when the item itself has
 * no image/icon set. Purely cosmetic — falls back to a generic box
 * for anything that doesn't match a known keyword.
 */
const CATEGORY_EMOJI = [
  [/phone|mobile|tablet/i, "📱"],
  [/electronic|gadget|appliance/i, "🔌"],
  [/computer|laptop|pc/i, "💻"],
  [/fashion|cloth|wear|apparel/i, "👕"],
  [/shoe|footwear/i, "👟"],
  [/home|kitchen|furniture/i, "🛋️"],
  [/beauty|cosmetic|skincare/i, "💄"],
  [/health|pharma|medic/i, "💊"],
  [/sport|fitness|outdoor/i, "⚽"],
  [/baby|kid|toy/i, "🧸"],
  [/automotive|car|vehicle/i, "🚗"],
  [/book|stationery/i, "📚"],
  [/food|grocery|drink/i, "🛒"],
  [/jewel|watch|accessor/i, "⌚"],
  [/tool|hardware|construction/i, "🛠️"],
];

export function getCategoryEmoji(category) {
  const label = String(category || "");
  for (const [pattern, emoji] of CATEGORY_EMOJI) {
    if (pattern.test(label)) return emoji;
  }
  return "🏷️";
}

export function computeCartLines(cart, items) {
  return Object.entries(cart)
    .map(([itemId, qty]) => {
      const item = items.find((i) => getItemId(i) === itemId);
      if (!item || qty <= 0) return null;
      const unitPrice = getSellingPrice(item);
      return { item, qty, unitPrice, lineTotal: unitPrice * qty };
    })
    .filter(Boolean);
}
