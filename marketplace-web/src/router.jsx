import { createBrowserRouter, Navigate } from "react-router-dom";

import MarketplaceCategoryPage from "@/pages/MarketplaceCategoryPage";
import MarketplaceListingDetailPage from "@/pages/MarketplaceListingDetailPage";
import MarketplacePublicBusinessPage from "@/pages/MarketplacePublicBusinessPage";
import MarketplaceOrderTrackPage from "@/pages/MarketplaceOrderTrackPage";

// The marketplace owns the whole domain, so there is no "/marketplace" prefix:
//   shop.example.com/retail
//   shop.example.com/retail/products/some-slug
//   shop.example.com/stores/some-store
//   shop.example.com/track
const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/retail" replace /> },
  { path: "/track", element: <MarketplaceOrderTrackPage /> },
  { path: "/stores/:businessSlug", element: <MarketplacePublicBusinessPage /> },

  // Old ChamaManager-hosted links that merchants already shared keep working.
  { path: "/marketplace", element: <Navigate to="/retail" replace /> },
  { path: "/marketplace/track", element: <Navigate to="/track" replace /> },
  { path: "/marketplace/*", element: <LegacyPrefixRedirect /> },
  { path: "/businesses/:businessSlug", element: <LegacyBusinessRedirect /> },

  { path: "/:category/products/:slug", element: <MarketplaceListingDetailPage /> },
  { path: "/:category/listings/:slug", element: <MarketplaceListingDetailPage /> },
  { path: "/:categorySlug", element: <MarketplaceCategoryPage /> },
  { path: "*", element: <Navigate to="/retail" replace /> },
]);

import { useLocation, useParams } from "react-router-dom";

function LegacyPrefixRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/marketplace/, "") || "/"}${search}`} replace />;
}

function LegacyBusinessRedirect() {
  const { businessSlug } = useParams();
  return <Navigate to={`/stores/${businessSlug}`} replace />;
}

export default router;
