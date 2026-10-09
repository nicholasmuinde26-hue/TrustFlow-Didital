// Pure mapping from an inventory item (BusinessItem) to the fields of its
// marketplace listing. No imports on purpose: easy to test, no DB needed.

/** Marketplace price = online price when set, otherwise the in-store price. */
export function effectiveOnlinePrice(item) {
  const online = Number(item.online_price);
  return online > 0 ? online : Number(item.price || 0);
}

/** Fields that always follow the inventory item. */
export function listingFieldsFromItem(item) {
  const description = item.description || "";
  const tracksStock = item.track_stock !== false;
  const fields = {
    title: item.name,
    description,
    short_description: description.slice(0, 160),
    price: effectiveOnlinePrice(item),
    track_stock: tracksStock,
    stock: tracksStock ? Math.max(0, Number(item.quantity || 0)) : 0,
    subcategory: item.category || "",
    visibility: item.visible_online !== false && item.status !== "archived" ? "public" : "unlisted",
  };
  // Only overwrite photos when the item actually has one, so extra photos
  // added directly on a listing are not wiped by an unrelated stock edit.
  if (item.image_url) {
    fields.images = [item.image_url];
    fields.thumbnail = item.image_url;
  }
  return fields;
}
