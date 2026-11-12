// The marketplace is its own site on its own domain (see marketplace-web).
// ChamaManager never renders marketplace pages; it only links out to them.
// Set VITE_MARKETPLACE_URL to that domain, e.g. https://shop.example.com
const BASE = String(import.meta.env.VITE_MARKETPLACE_URL || "http://localhost:5174").replace(/\/+$/, "");

export const marketplaceUrl = (path = "") =>
  `${BASE}${path ? (path.startsWith("/") ? path : `/${path}`) : ""}`;

export const marketplaceHubUrl = (hubSlug) => marketplaceUrl(`/${hubSlug}`);

export const marketplaceStoreUrl = (businessSlug) => marketplaceUrl(`/stores/${businessSlug}`);

export const marketplaceListingUrl = (categorySlug, listingSlug) =>
  categorySlug === "rentals"
    ? marketplaceUrl(`/rentals/listings/${listingSlug}`)
    : marketplaceUrl(`/${categorySlug || "retail"}/products/${listingSlug}`);
