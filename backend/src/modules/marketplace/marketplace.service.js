import mongoose from "mongoose";
import slugify from "slugify";
import MarketplaceCategory from "../../models/MarketplaceCategory.js";
import MarketplaceEnrollment from "../../models/MarketplaceEnrollment.js";
import MarketplaceListing from "../../models/MarketplaceListing.js";
import MarketplaceOrder from "../../models/MarketplaceOrder.js";
import MerchantSettlement from "../../models/MerchantSettlement.js";
import MarketplaceCommissionRule from "../../models/MarketplaceCommissionRule.js";
import Business from "../../models/Business.js";
import Product from "../../models/Product.js";
import RentalListing from "../../models/RentalListing.js";
import BusinessItem from "../../models/BusinessItem.js";
import BusinessTransaction from "../../models/BusinessTransaction.js";
import Storefront from "../../models/Storefront.js";
import PlatformAdmin from "../../models/PlatformAdmin.js";
import * as mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import AppError from "../../utils/AppError.js";
import { DEFAULT_RENTAL_PROPERTIES } from "./defaultRentals.data.js";

// ============================================================================
// DEFAULT CATEGORY HUBS INITIALIZATION
// ============================================================================
const DEFAULT_HUBS = [
  {
    slug: "retail",
    name: "Retail Marketplace",
    tagline: "Quality goods from verified independent shops",
    description: "Browse electronics, fashion, groceries, home living, hardware, and everyday essentials from local retailers.",
    icon: "ShoppingBag",
    hero_title: "Shop Local Merchants, All in One Place",
    hero_subtitle: "Order directly from verified businesses across the country with fast delivery and secure M-Pesa checkout.",
    theme_color: "#059669",
    theme_gradient: "from-emerald-950 via-slate-900 to-teal-950",
    filter_keys: ["price", "in_stock", "location", "subcategory"],
    subcategories: [
      { slug: "electronics", name: "Electronics & Gadgets", icon: "Tv" },
      { slug: "fashion", name: "Fashion & Apparel", icon: "Shirt" },
      { slug: "groceries", name: "Groceries & Supermarket", icon: "Apple" },
      { slug: "home", name: "Home & Furniture", icon: "Home" },
      { slug: "hardware", name: "Hardware & Construction", icon: "Wrench" },
      { slug: "beauty", name: "Beauty & Personal Care", icon: "Sparkles" },
    ],
    featured_collections: [
      { name: "Top Electronics", tag: "electronics", badge_color: "blue" },
      { name: "Everyday Deals", tag: "deals", badge_color: "emerald" },
      { name: "Verified Stores", tag: "verified", badge_color: "indigo" },
    ],
    is_active: true,
    sort_order: 1,
  },
  {
    slug: "rentals",
    name: "Rentals & Real Estate",
    tagline: "Apartments, rooms, and commercial plots from verified landlords",
    description: "Direct listings for residential rentals, bedsitters, family apartments, and commercial spaces.",
    icon: "Building",
    hero_title: "Find The Perfect Rental",
    hero_subtitle: "Discover the perfect property that suits your needs.",
    theme_color: "#0d5c52",
    theme_gradient: "from-teal-950 via-emerald-950 to-slate-900",
    filter_keys: ["location", "bedrooms", "rent_period", "price", "property_type", "amenities"],
    subcategories: [
      { slug: "apartments", name: "Apartments", icon: "Building2" },
      { slug: "houses", name: "Mansions & Villas", icon: "Home" },
      { slug: "rooms", name: "Bedsitters & Studios", icon: "Bed" },
      { slug: "commercial", name: "Commercial & Offices", icon: "Store" },
      { slug: "beachfront", name: "Beachfront & Coastal", icon: "Palmtree" },
      { slug: "plots", name: "Land & Plots", icon: "LandPlot" },
    ],
    featured_collections: [
      { name: "Kilimani Vacancies", tag: "kilimani", badge_color: "emerald" },
      { name: "Westlands Studios", tag: "westlands", badge_color: "teal" },
      { name: "Karen Luxury Villas", tag: "karen", badge_color: "amber" },
    ],
    is_active: true,
    sort_order: 2,
  },
  {
    slug: "services",
    name: "Services & Skilled Pros",
    tagline: "Book verified professionals, artisans, and service providers",
    description: "Find trusted plumbers, electricians, consultants, beauty technicians, and maintenance experts.",
    icon: "Briefcase",
    hero_title: "Hire Trusted Professionals Nearby",
    hero_subtitle: "Transparent pricing, verified client reviews, and direct service dispatch.",
    theme_color: "#7c3aed",
    theme_gradient: "from-purple-950 via-slate-900 to-violet-950",
    filter_keys: ["service_mode", "location", "price"],
    subcategories: [
      { slug: "home_repairs", name: "Plumbing & Electrical", icon: "Hammer" },
      { slug: "cleaning", name: "Cleaning & Fumigation", icon: "Sparkles" },
      { slug: "tech_support", name: "IT & Tech Support", icon: "Laptop" },
      { slug: "consulting", name: "Financial & Tax Services", icon: "FileText" },
      { slug: "events", name: "Event Planning & Catering", icon: "Calendar" },
    ],
    featured_collections: [
      { name: "Emergency Dispatch", tag: "emergency", badge_color: "rose" },
      { name: "Top Rated Pros", tag: "top_rated", badge_color: "amber" },
    ],
    is_active: true,
    sort_order: 3,
  },
  {
    slug: "food",
    name: "Restaurants & Menus",
    tagline: "Fresh meals, menus, and takeout from local kitchens",
    description: "Discover local eateries, order lunch for your team, or arrange food delivery directly from restaurant kitchens.",
    icon: "UtensilsCrossed",
    hero_title: "Discover Local Flavors and Order Online",
    hero_subtitle: "Direct kitchen prices with no predatory 30% platform markup.",
    theme_color: "#ea580c",
    theme_gradient: "from-amber-950 via-slate-900 to-orange-950",
    filter_keys: ["cuisine_type", "price", "is_vegetarian"],
    subcategories: [
      { slug: "fast_food", name: "Burgers, Fries & Grills", icon: "Flame" },
      { slug: "local_cuisine", name: "African & Local Dishes", icon: "Utensils" },
      { slug: "bakery", name: "Pastries & Cakes", icon: "Cookie" },
      { slug: "drinks", name: "Juices & Beverages", icon: "Coffee" },
    ],
    featured_collections: [
      { name: "Lunch Specials", tag: "lunch", badge_color: "orange" },
      { name: "Popular Spots", tag: "popular", badge_color: "amber" },
    ],
    is_active: true,
    sort_order: 4,
  },
];

export async function ensureDefaultCategories() {
  for (const hub of DEFAULT_HUBS) {
    const exists = await MarketplaceCategory.findOne({ slug: hub.slug });
    if (!exists) {
      await MarketplaceCategory.create(hub);
    } else if (hub.slug === "rentals") {
      await MarketplaceCategory.updateOne(
        { slug: "rentals" },
        {
          $set: {
            hero_title: hub.hero_title,
            hero_subtitle: hub.hero_subtitle,
            theme_color: hub.theme_color,
            theme_gradient: hub.theme_gradient,
            subcategories: hub.subcategories,
          },
        }
      );
    }
  }
}

export async function ensureDefaultRentals() {
  await ensureDefaultCategories();
  const rentalCount = await MarketplaceListing.countDocuments({ category_slug: "rentals" });
  if (rentalCount >= 10) return;

  // Find or create a rental business
  let business = await Business.findOne({ category: { $in: ["rental", "rentals"] } });
  if (!business) {
    business = await Business.findOne();
  }

  // If still no business (e.g. fresh DB), find first user and create an Apex Properties business
  if (!business) {
    let user = await mongoose.model("User").findOne();
    if (!user) {
      return;
    }
    business = await Business.create({
      name: "Apex Prime Real Estate & Property Managers",
      category: "rental",
      category_label: "Rentals & Real Estate",
      currency: "KES",
      location: "Kilimani, Nairobi",
      created_by: user._id,
    });
  }

  // Ensure enrollment exists for this business in rentals hub
  let enrollment = await MarketplaceEnrollment.findOne({
    business_id: business._id,
    category_slug: "rentals",
  });
  if (!enrollment) {
    await MarketplaceEnrollment.create({
      business_id: business._id,
      category_slug: "rentals",
      status: "approved",
      merchant_profile: {
        display_name: "Apex Prime Real Estate",
        tagline: "Verified Kenya Properties, Direct Landlord Contact",
        description: "Official real estate management portal offering vetted residential apartments, executive studios, and commercial properties across Kenya.",
      },
    });
  }

  // Seed all default rental properties
  for (const property of DEFAULT_RENTAL_PROPERTIES) {
    const existing = await MarketplaceListing.findOne({ slug: property.slug });
    if (!existing) {
      await MarketplaceListing.create({
        business_id: business._id,
        category_slug: "rentals",
        source_type: "RentalListing",
        source_id: new mongoose.Types.ObjectId(),
        title: property.title,
        slug: property.slug,
        description: property.description,
        short_description: property.short_description,
        price: property.price,
        compare_price: property.compare_price,
        currency: "KES",
        stock: 1,
        track_stock: false,
        images: property.images,
        thumbnail: property.thumbnail,
        subcategory: property.subcategory,
        tags: property.tags,
        rental_attributes: property.rental_attributes,
        moderation_status: "approved",
        visibility: "public",
        is_featured: Boolean(property.is_featured),
        featured_rank: property.featured_rank || 0,
        rating: property.rating || 4.9,
        review_count: property.review_count || 12,
      });
    }
  }
}

// ============================================================================
// CATEGORY HUBS MANAGEMENT
// ============================================================================

export async function listMarketplaceCategories() {
  await ensureDefaultCategories();
  return MarketplaceCategory.find({ is_active: true }).sort({ sort_order: 1 }).lean();
}

export async function getMarketplaceCategoryBySlug(slug) {
  await ensureDefaultCategories();
  if (slug && slug.toLowerCase() === "rentals") {
    await ensureDefaultRentals();
  }
  const category = await MarketplaceCategory.findOne({ slug: slug.toLowerCase(), is_active: true }).lean();
  if (!category) {
    throw new AppError(`Marketplace category '${slug}' not found`, 404);
  }
  return category;
}

export async function updateMarketplaceCategoryDesign(slug, designData, adminUser) {
  assertMarketplaceScope(adminUser, slug, "manageMarketplaceDesign");
  const category = await MarketplaceCategory.findOneAndUpdate(
    { slug: slug.toLowerCase() },
    { $set: designData },
    { new: true }
  );
  if (!category) throw new AppError("Category hub not found", 404);
  return category;
}

// ============================================================================
// ADMIN SCOPE & PERMISSION HELPER
// ============================================================================

export function assertMarketplaceScope(adminUser, targetCategorySlug, requiredPermission = null) {
  if (!adminUser) throw new AppError("Authentication required", 401);
  if (adminUser.systemRole === "super_admin") return true;

  const scopes = adminUser.marketplaceScopes || [];
  const hasScope = scopes.includes("*") || (targetCategorySlug && scopes.includes(targetCategorySlug.toLowerCase()));

  if (!hasScope) {
    throw new AppError(`You do not have administrative authority over the '${targetCategorySlug}' marketplace hub`, 403);
  }

  if (requiredPermission && adminUser.permissions && !adminUser.permissions[requiredPermission]) {
    throw new AppError(`Missing required administrative permission: ${requiredPermission}`, 403);
  }

  return true;
}

// ============================================================================
// BUSINESS CATEGORY & HUB ELIGIBILITY HELPERS
// ============================================================================

export function getHubSlugForBusinessCategory(businessCategory) {
  if (!businessCategory) return "retail";
  const b = String(businessCategory).toLowerCase().trim();
  switch (b) {
    case "retail":
      return "retail";
    case "rental":
    case "rentals":
      return "rentals";
    case "service":
    case "services":
      return "services";
    case "restaurant":
    case "food":
      return "food";
    default:
      return "retail";
  }
}

export function isBusinessEligibleForHub(businessCategory, hubSlug) {
  if (!businessCategory || !hubSlug) return false;
  const b = String(businessCategory).toLowerCase().trim();
  const h = String(hubSlug).toLowerCase().trim();

  if (b === h) return true;
  if (b === "retail" && h === "retail") return true;
  if ((b === "rental" || b === "rentals") && (h === "rentals" || h === "rental")) return true;
  if ((b === "service" || b === "services") && (h === "services" || h === "service")) return true;
  if ((b === "restaurant" || b === "food") && (h === "food" || h === "restaurant")) return true;
  if (b === "other" && h === "retail") return true;

  return false;
}

// ============================================================================
// MERCHANT ENROLLMENT (OPT-IN TO CATEGORY HUBS)
// ============================================================================

export async function enrollBusinessInMarketplace(businessId, categorySlug, merchantProfile = {}, userId) {
  const business = await Business.findById(businessId);
  if (!business) throw new AppError("Business not found", 404);

  // Verify user has ownership or admin right on this business
  if (String(business.created_by) !== String(userId)) {
    throw new AppError("Only the business owner can enroll in marketplace hubs", 403);
  }

  const category = await MarketplaceCategory.findOne({ slug: categorySlug.toLowerCase() });
  if (!category) throw new AppError("Invalid marketplace category", 404);

  // Strictly enforce category eligibility: business can only opt in to its own category marketplace
  const isEligible = isBusinessEligibleForHub(business.category, categorySlug);
  if (!isEligible) {
    const hubTitle = category.name || categorySlug;
    throw new AppError(
      `Your business is registered under the '${business.category}' category and can only opt into its matching marketplace. You cannot enroll in '${hubTitle}'.`,
      400
    );
  }

  let enrollment = await MarketplaceEnrollment.findOne({
    business_id: businessId,
    category_slug: categorySlug.toLowerCase(),
  });

  const storefront = await Storefront.findOne({ business_id: businessId }).lean();

  const profile = {
    display_name: merchantProfile.display_name || storefront?.name || business.name,
    tagline: merchantProfile.tagline || storefront?.headline || "",
    description: merchantProfile.description || storefront?.subtitle || "",
    logo_url: merchantProfile.logo_url || "",
    banner_url: merchantProfile.banner_url || "",
    phone: merchantProfile.phone || business.mpesa_paybill || business.mpesa_till || "",
    email: merchantProfile.email || "",
    physical_location: merchantProfile.physical_location || business.location || storefront?.location_text || "",
    return_policy: merchantProfile.return_policy || "7-day inspection and return policy on defective goods.",
    delivery_info: merchantProfile.delivery_info || "Fast delivery across major cities.",
    badges: ["Verified Merchant"],
  };

  if (enrollment) {
    if (enrollment.status === "approved") {
      // Update profile
      enrollment.merchant_profile = { ...enrollment.merchant_profile, ...profile };
      await enrollment.save();
      return enrollment;
    }
    enrollment.status = "pending";
    enrollment.merchant_profile = profile;
    enrollment.applied_at = new Date();
    enrollment.rejection_reason = "";
    await enrollment.save();
    return enrollment;
  }

  enrollment = await MarketplaceEnrollment.create({
    business_id: businessId,
    category_slug: categorySlug.toLowerCase(),
    status: "pending",
    merchant_profile: profile,
  });

  return enrollment;
}

export async function getBusinessEnrollments(businessId) {
  return MarketplaceEnrollment.find({ business_id: businessId }).lean();
}

export async function listAdminEnrollments(adminUser, filter = {}) {
  const query = {};
  if (filter.status) query.status = filter.status;
  if (adminUser.systemRole !== "super_admin") {
    const scopes = adminUser.marketplaceScopes || [];
    if (!scopes.includes("*")) {
      query.category_slug = { $in: scopes };
    }
  }

  return MarketplaceEnrollment.find(query)
    .populate("business_id", "name category location currency created_by")
    .sort({ applied_at: -1 })
    .lean();
}

export async function reviewBusinessEnrollment(enrollmentId, { decision, reviewNotes, customCommissionRate }, adminUser) {
  const enrollment = await MarketplaceEnrollment.findById(enrollmentId);
  if (!enrollment) throw new AppError("Enrollment application not found", 404);

  assertMarketplaceScope(adminUser, enrollment.category_slug, "approveListings");

  if (!["approved", "rejected", "suspended"].includes(decision)) {
    throw new AppError("Invalid decision. Must be 'approved', 'rejected', or 'suspended'", 400);
  }

  enrollment.status = decision;
  enrollment.reviewed_by = adminUser._id || adminUser.userId;
  enrollment.reviewed_at = new Date();
  enrollment.review_notes = reviewNotes || "";
  if (decision === "rejected") {
    enrollment.rejection_reason = reviewNotes || "Application does not meet marketplace standards.";
  }
  if (customCommissionRate !== undefined && customCommissionRate !== null) {
    enrollment.custom_commission_rate = Number(customCommissionRate);
  }

  await enrollment.save();
  return enrollment;
}

// ============================================================================
// LISTINGS MANAGEMENT & MODERATION
// ============================================================================

export async function submitListingToMarketplace(businessId, payload, userId) {
  const business = await Business.findById(businessId);
  if (!business) throw new AppError("Business not found", 404);
  if (String(business.created_by) !== String(userId)) {
    throw new AppError("Only the business owner can submit marketplace listings", 403);
  }

  const categorySlug = (payload.category_slug || getHubSlugForBusinessCategory(business.category)).toLowerCase();

  // Verify category eligibility
  if (!isBusinessEligibleForHub(business.category, categorySlug)) {
    throw new AppError(
      `Your business is registered under '${business.category}' and cannot publish listings to the '${categorySlug}' marketplace.`,
      403
    );
  }

  // Verify enrollment
  const enrollment = await MarketplaceEnrollment.findOne({
    business_id: businessId,
    category_slug: categorySlug,
    status: "approved",
  });
  if (!enrollment) {
    throw new AppError(`Business is not approved in the '${categorySlug}' marketplace. Please enroll and wait for approval.`, 403);
  }

  let sourceItem = null;
  let sourceType = payload.source_type || "Product";
  let title = payload.title;
  let price = Number(payload.price || 0);
  let stock = Number(payload.stock || 0);
  let description = payload.description || "";
  let images = Array.isArray(payload.images) ? payload.images : [];
  let thumbnail = payload.thumbnail || (images[0] || "");
  let subcategory = payload.subcategory || "";

  // If source_id provided, import from existing Product / BusinessItem / RentalListing
  if (payload.source_id) {
    if (sourceType === "Product") {
      sourceItem = await Product.findOne({ _id: payload.source_id, business_id: businessId });
      if (sourceItem) {
        title = title || sourceItem.title;
        price = price || sourceItem.base_price;
        stock = stock !== undefined ? stock : sourceItem.stock;
        description = description || sourceItem.description;
        images = images.length ? images : sourceItem.images;
        thumbnail = thumbnail || sourceItem.thumbnail || (images[0] || "");
        subcategory = subcategory || sourceItem.category;
      }
    } else if (sourceType === "RentalListing") {
      sourceItem = await RentalListing.findOne({ _id: payload.source_id, business_id: businessId });
      if (sourceItem) {
        title = title || sourceItem.title;
        price = price || sourceItem.rent_amount;
        description = description || sourceItem.description;
        images = images.length ? images : sourceItem.images;
        thumbnail = thumbnail || images[0] || "";
      }
    } else if (sourceType === "BusinessItem") {
      sourceItem = await BusinessItem.findOne({ _id: payload.source_id, business_id: businessId });
      if (sourceItem) {
        title = title || sourceItem.name;
        price = price || (sourceItem.online_price || sourceItem.price);
        stock = stock !== undefined ? stock : sourceItem.quantity;
        description = description || sourceItem.description;
        if (sourceItem.image_url && !images.length) images = [sourceItem.image_url];
        thumbnail = thumbnail || sourceItem.image_url || "";
        subcategory = subcategory || sourceItem.category;
      }
    }
  }

  if (!title?.trim()) throw new AppError("Title is required for marketplace listing", 400);
  if (price <= 0) throw new AppError("Valid price is required", 400);

  // Generate unique slug
  const baseSlug = slugify(`${title}-${business.name.slice(0, 10)}`, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;
  while (await MarketplaceListing.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const listing = await MarketplaceListing.create({
    business_id: businessId,
    category_slug: categorySlug,
    source_type: sourceType,
    source_id: sourceItem ? sourceItem._id : new mongoose.Types.ObjectId(),
    title: title.trim(),
    slug,
    description: description.trim(),
    short_description: payload.short_description || description.slice(0, 160),
    price,
    compare_price: payload.compare_price || null,
    currency: business.currency || "KES",
    stock,
    track_stock: payload.track_stock !== false,
    images,
    thumbnail,
    subcategory,
    tags: payload.tags || [],
    rental_attributes: payload.rental_attributes || {},
    service_attributes: payload.service_attributes || {},
    food_attributes: payload.food_attributes || {},
    moderation_status: "pending",
  });

  return listing;
}

export async function listMerchantMarketplaceListings(businessId, { categorySlug, status } = {}) {
  const query = { business_id: businessId };
  if (categorySlug) query.category_slug = categorySlug.toLowerCase();
  if (status) query.moderation_status = status;
  return MarketplaceListing.find(query).sort({ createdAt: -1 }).lean();
}

export async function updateMerchantMarketplaceListing(businessId, listingId, payload, userId) {
  const business = await Business.findById(businessId);
  if (!business) throw new AppError("Business not found", 404);
  if (String(business.created_by) !== String(userId)) {
    throw new AppError("Only the business owner can update this listing", 403);
  }

  const listing = await MarketplaceListing.findOne({ _id: listingId, business_id: businessId });
  if (!listing) throw new AppError("Listing not found", 404);

  const allowedFields = [
    "title",
    "description",
    "short_description",
    "price",
    "compare_price",
    "stock",
    "track_stock",
    "images",
    "thumbnail",
    "subcategory",
    "tags",
    "visibility",
  ];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      listing[field] = payload[field];
    }
  }

  if (payload.rental_attributes) {
    listing.rental_attributes = {
      ...(listing.rental_attributes?.toObject ? listing.rental_attributes.toObject() : listing.rental_attributes || {}),
      ...payload.rental_attributes,
    };
  }

  await listing.save();
  return listing;
}

export async function deleteMerchantMarketplaceListing(businessId, listingId, userId) {
  const business = await Business.findById(businessId);
  if (!business) throw new AppError("Business not found", 404);
  if (String(business.created_by) !== String(userId)) {
    throw new AppError("Only the business owner can delete this listing", 403);
  }

  const result = await MarketplaceListing.findOneAndDelete({ _id: listingId, business_id: businessId });
  if (!result) throw new AppError("Listing not found", 404);
  return { success: true, message: "Listing deleted successfully" };
}

export async function toggleListingVisibility(businessId, listingId, userId, visibility) {
  const business = await Business.findById(businessId);
  if (!business) throw new AppError("Business not found", 404);
  if (String(business.created_by) !== String(userId)) {
    throw new AppError("Only the business owner can update visibility", 403);
  }

  const listing = await MarketplaceListing.findOne({ _id: listingId, business_id: businessId });
  if (!listing) throw new AppError("Listing not found", 404);

  const newVis = visibility || (listing.visibility === "public" ? "unlisted" : "public");
  listing.visibility = newVis;
  await listing.save();
  return listing;
}

export async function toggleListingOccupancy(businessId, listingId, userId, isOccupied) {
  const business = await Business.findById(businessId);
  if (!business) throw new AppError("Business not found", 404);
  if (String(business.created_by) !== String(userId)) {
    throw new AppError("Only the business owner can update occupancy status", 403);
  }

  const listing = await MarketplaceListing.findOne({ _id: listingId, business_id: businessId });
  if (!listing) throw new AppError("Listing not found", 404);

  const currentOccupied = Boolean(listing.rental_attributes?.is_occupied);
  const targetOccupied = isOccupied !== undefined ? Boolean(isOccupied) : !currentOccupied;

  if (!listing.rental_attributes) {
    listing.rental_attributes = {};
  }
  listing.rental_attributes.is_occupied = targetOccupied;
  if (targetOccupied) {
    listing.stock = 0;
  } else {
    listing.stock = 1;
  }

  await listing.save();
  return listing;
}

export async function getAdminModerationQueue(adminUser, { categorySlug, status = "pending", page = 1, limit = 20 } = {}) {
  const query = {};
  if (status) query.moderation_status = status;

  if (categorySlug) {
    query.category_slug = categorySlug.toLowerCase();
  } else if (adminUser.systemRole !== "super_admin") {
    const scopes = adminUser.marketplaceScopes || [];
    if (!scopes.includes("*")) {
      query.category_slug = { $in: scopes };
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [listings, total] = await Promise.all([
    MarketplaceListing.find(query)
      .populate("business_id", "name category location currency created_by")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    MarketplaceListing.countDocuments(query),
  ]);

  return { listings, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
}

export async function reviewMarketplaceListing(listingId, { decision, notes, isFeatured, featuredRank }, adminUser) {
  const listing = await MarketplaceListing.findById(listingId);
  if (!listing) throw new AppError("Listing not found", 404);

  assertMarketplaceScope(adminUser, listing.category_slug, "approveListings");

  if (!["approved", "rejected", "changes_requested"].includes(decision)) {
    throw new AppError("Invalid decision. Must be 'approved', 'rejected', or 'changes_requested'", 400);
  }

  listing.moderation_status = decision;
  listing.moderated_by = adminUser._id || adminUser.userId;
  listing.moderated_at = new Date();
  listing.moderation_notes = notes || "";
  if (isFeatured !== undefined) listing.is_featured = Boolean(isFeatured);
  if (featuredRank !== undefined) listing.featured_rank = Number(featuredRank);

  await listing.save();
  return listing;
}

// ============================================================================
// PUBLIC BROWSING & SEARCH
// ============================================================================

export async function searchPublicListings({
  categorySlug,
  subcategory,
  search,
  minPrice,
  maxPrice,
  inStock,
  location,
  bedrooms,
  rentPeriod,
  propertyType,
  petsAllowed,
  furnished,
  cuisine,
  isVegetarian,
  sortBy = "featured",
  page = 1,
  limit = 20,
}) {
  if (categorySlug === "rentals" || !categorySlug || categorySlug === "all") {
    await ensureDefaultRentals();
  }

  const query = {
    moderation_status: "approved",
    visibility: "public",
    "rental_attributes.is_occupied": { $ne: true },
  };

  if (categorySlug && categorySlug !== "all") {
    query.category_slug = categorySlug.toLowerCase();
  }
  if (subcategory && subcategory !== "All") {
    query.subcategory = subcategory;
  }

  if (inStock) {
    query.$or = [{ track_stock: false }, { stock: { $gt: 0 } }];
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined && minPrice !== "") query.price.$gte = Number(minPrice);
    if (maxPrice !== undefined && maxPrice !== "") query.price.$lte = Number(maxPrice);
  }

  // Category specific filters
  if (bedrooms !== undefined && bedrooms !== "" && bedrooms !== "any") {
    query["rental_attributes.bedrooms"] = Number(bedrooms);
  }
  if (rentPeriod) query["rental_attributes.rent_period"] = rentPeriod;
  if (propertyType && propertyType !== "All" && propertyType !== "any") {
    query.$or = [
      { "rental_attributes.property_type": new RegExp(propertyType, "i") },
      { "rental_attributes.listing_type": new RegExp(propertyType, "i") },
      { subcategory: new RegExp(propertyType, "i") },
    ];
  }
  if (petsAllowed === true || petsAllowed === "true") {
    query["rental_attributes.pets_allowed"] = true;
  }
  if (furnished === true || furnished === "true") {
    query["rental_attributes.furnished"] = true;
  }
  if (cuisine) query["food_attributes.cuisine_type"] = new RegExp(cuisine, "i");
  if (isVegetarian) query["food_attributes.is_vegetarian"] = true;

  if (search?.trim()) {
    const s = search.trim();
    const searchRegex = new RegExp(s, "i");
    query.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { tags: { $in: [searchRegex] } },
      { "rental_attributes.location_text": searchRegex },
      { "rental_attributes.city": searchRegex },
      { "rental_attributes.neighborhood": searchRegex },
      { "rental_attributes.property_type": searchRegex },
    ];
  }

  const sort = {};
  if (sortBy === "price_asc") sort.price = 1;
  else if (sortBy === "price_desc") sort.price = -1;
  else if (sortBy === "newest") sort.createdAt = -1;
  else if (sortBy === "popular") sort.sales_count = -1;
  else {
    // Default: featured first, then newest
    sort.is_featured = -1;
    sort.featured_rank = -1;
    sort.createdAt = -1;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [listings, total] = await Promise.all([
    MarketplaceListing.find(query)
      .populate("business_id", "name category location currency")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    MarketplaceListing.countDocuments(query),
  ]);

  return {
    listings,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      hasMore: skip + listings.length < total,
    },
  };
}

export async function getPublicListingBySlug(categorySlug, slug) {
  if (categorySlug === "rentals" || categorySlug === "any") {
    await ensureDefaultRentals();
  }

  const query = { slug: slug.toLowerCase() };
  if (categorySlug && categorySlug !== "any") {
    query.category_slug = categorySlug.toLowerCase();
  }

  const listing = await MarketplaceListing.findOne(query)
    .populate("business_id", "name category location currency created_by")
    .lean();

  if (!listing || listing.moderation_status !== "approved") {
    throw new AppError("Listing not found or not currently available", 404);
  }

  // Increment view count asynchronously
  MarketplaceListing.updateOne({ _id: listing._id }, { $inc: { view_count: 1 } }).catch(() => {});

  // Fetch owning business storefront/enrollment profile
  const [enrollment, storefront, relatedListings] = await Promise.all([
    MarketplaceEnrollment.findOne({
      business_id: listing.business_id._id,
      category_slug: listing.category_slug,
    }).lean(),
    Storefront.findOne({ business_id: listing.business_id._id }).lean(),
    MarketplaceListing.find({
      category_slug: listing.category_slug,
      moderation_status: "approved",
      _id: { $ne: listing._id },
    })
      .limit(4)
      .lean(),
  ]);

  const merchantProfile = enrollment?.merchant_profile || {};
  const businessSlug = storefront?.slug || slugify(listing.business_id.name, { lower: true });

  return {
    listing,
    merchant: {
      id: listing.business_id._id,
      name: listing.business_id.name,
      slug: businessSlug,
      display_name: merchantProfile.display_name || listing.business_id.name,
      tagline: merchantProfile.tagline || storefront?.headline || "",
      description: merchantProfile.description || storefront?.subtitle || "",
      logo_url: merchantProfile.logo_url || "",
      phone: merchantProfile.phone || "",
      location: merchantProfile.physical_location || listing.business_id.location || "",
      badges: merchantProfile.badges || ["Verified Merchant"],
      return_policy: merchantProfile.return_policy || "",
      delivery_info: merchantProfile.delivery_info || "",
    },
    relatedListings,
  };
}

export async function getPublicBusinessProfile(businessSlug) {
  const cleanSlug = slugify(businessSlug, { lower: true });
  // Find storefront or match business by name
  let storefront = await Storefront.findOne({ slug: cleanSlug }).lean();
  let businessId = storefront?.business_id;

  if (!businessId) {
    const businesses = await Business.find().lean();
    const matched = businesses.find((b) => slugify(b.name, { lower: true }) === cleanSlug);
    if (matched) businessId = matched._id;
  }

  if (!businessId) throw new AppError("Business merchant profile not found", 404);

  const [business, enrollments, listings] = await Promise.all([
    Business.findById(businessId).lean(),
    MarketplaceEnrollment.find({ business_id: businessId, status: "approved" }).lean(),
    MarketplaceListing.find({ business_id: businessId, moderation_status: "approved" }).sort({ is_featured: -1, createdAt: -1 }).lean(),
  ]);

  const activeEnrollment = enrollments[0];
  const merchantProfile = activeEnrollment?.merchant_profile || {};

  return {
    business: {
      id: business._id,
      name: business.name,
      slug: storefront?.slug || cleanSlug,
      currency: business.currency || "KES",
      location: merchantProfile.physical_location || business.location || storefront?.location_text || "",
      display_name: merchantProfile.display_name || storefront?.name || business.name,
      tagline: merchantProfile.tagline || storefront?.headline || "",
      description: merchantProfile.description || storefront?.subtitle || "",
      logo_url: merchantProfile.logo_url || "",
      banner_url: merchantProfile.banner_url || "",
      badges: merchantProfile.badges || ["Verified Merchant"],
      return_policy: merchantProfile.return_policy || "",
      delivery_info: merchantProfile.delivery_info || "",
    },
    hubs: enrollments.map((e) => e.category_slug),
    listings,
  };
}

// ============================================================================
// COMMISSION CALCULATION HELPER
// ============================================================================

export async function getEffectiveCommissionRate(categorySlug, businessId) {
  // Check merchant-specific commission rule
  if (businessId) {
    const merchantEnrollment = await MarketplaceEnrollment.findOne({
      business_id: businessId,
      category_slug: categorySlug.toLowerCase(),
    });
    if (merchantEnrollment?.custom_commission_rate !== null && merchantEnrollment?.custom_commission_rate !== undefined) {
      return merchantEnrollment.custom_commission_rate;
    }

    const merchantRule = await MarketplaceCommissionRule.findOne({
      business_id: businessId,
      category_slug: categorySlug.toLowerCase(),
      is_active: true,
    });
    if (merchantRule) return merchantRule.commission_rate;
  }

  // Category-level rule
  const categoryRule = await MarketplaceCommissionRule.findOne({
    category_slug: categorySlug.toLowerCase(),
    business_id: null,
    is_active: true,
  });
  if (categoryRule) return categoryRule.commission_rate;

  // Global default rule
  const defaultRule = await MarketplaceCommissionRule.findOne({
    category_slug: "*",
    is_active: true,
  });
  if (defaultRule) return defaultRule.commission_rate;

  return 5; // Default 5% platform commission
}

// ============================================================================
// MARKETPLACE CHECKOUT & SETTLEMENTS
// ============================================================================

export async function processMarketplaceCheckout(orderData, buyerUser = null) {
  if (!orderData.customer_name?.trim() || !orderData.customer_phone?.trim()) {
    throw new AppError("Customer name and valid phone number are required for checkout", 400);
  }

  if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
    throw new AppError("Checkout cart must contain at least one item", 400);
  }

  const processedItems = [];
  const merchantMap = new Map(); // businessId -> { subtotal, delivery_fee, commission, net, name }
  let calculatedSubtotal = 0;

  for (const cartItem of orderData.items) {
    const listingId = cartItem.listing_id || cartItem.id;
    const listing = await MarketplaceListing.findById(listingId);
    if (!listing || listing.moderation_status !== "approved") {
      throw new AppError(`Item "${cartItem.name || 'Selected item'}" is no longer available`, 400);
    }

    const qty = Math.max(1, Number(cartItem.qty || 1));
    if (listing.track_stock && listing.stock < qty) {
      throw new AppError(`Insufficient stock for "${listing.title}". Only ${listing.stock} units remain.`, 400);
    }

    const price = listing.price;
    const lineTotal = price * qty;
    calculatedSubtotal += lineTotal;

    const commissionRate = await getEffectiveCommissionRate(listing.category_slug, listing.business_id);
    const commissionAmount = Math.round((lineTotal * commissionRate) / 100);
    const netSettlement = lineTotal - commissionAmount;

    processedItems.push({
      listing_id: listing._id,
      business_id: listing.business_id,
      name: listing.title,
      qty,
      price,
      line_total: lineTotal,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      net_settlement_amount: netSettlement,
      fulfillment_status: "pending",
      delivery_fee_allocation: 0,
    });

    // Accumulate merchant allocations
    const bIdStr = String(listing.business_id);
    if (!merchantMap.has(bIdStr)) {
      const business = await Business.findById(listing.business_id).select("name currency created_by").lean();
      merchantMap.set(bIdStr, {
        business_id: listing.business_id,
        business_name: business?.name || "Merchant",
        subtotal: 0,
        delivery_fee: 0,
        commission_amount: 0,
        net_amount: 0,
        settlement_status: "pending",
        fulfillment_status: "pending",
      });
    }

    const mAlloc = merchantMap.get(bIdStr);
    mAlloc.subtotal += lineTotal;
    mAlloc.commission_amount += commissionAmount;
    mAlloc.net_amount += netSettlement;
  }

  // Delivery fee allocation: distribute flat or per merchant
  const baseDeliveryFee = orderData.fulfillment_type === "delivery" ? Number(orderData.delivery_fee || 0) : 0;
  const merchantAllocations = Array.from(merchantMap.values());
  const deliveryPerMerchant = merchantAllocations.length > 0 ? Math.round(baseDeliveryFee / merchantAllocations.length) : 0;

  for (const mAlloc of merchantAllocations) {
    mAlloc.delivery_fee = deliveryPerMerchant;
    mAlloc.net_amount += deliveryPerMerchant; // Delivery fee credited to merchant for fulfillment
  }

  const totalDeliveryFee = baseDeliveryFee;
  const totalCommissionFee = processedItems.reduce((sum, item) => sum + item.commission_amount, 0);
  const totalAmount = calculatedSubtotal + totalDeliveryFee;
  const orderNumber = `MKT-${Math.floor(100000 + Math.random() * 900000)}`;

  const order = await MarketplaceOrder.create({
    order_number: orderNumber,
    buyer_id: buyerUser?._id || null,
    customer_name: orderData.customer_name.trim(),
    customer_phone: orderData.customer_phone.trim(),
    customer_email: orderData.customer_email || "",
    delivery_address: orderData.delivery_address || "Store Pickup",
    fulfillment_type: orderData.fulfillment_type || "delivery",
    items: processedItems,
    merchant_allocations: merchantAllocations,
    is_multi_merchant: merchantAllocations.length > 1,
    subtotal: calculatedSubtotal,
    total_delivery_fee: totalDeliveryFee,
    total_commission_fee: totalCommissionFee,
    total_amount: totalAmount,
    payment_method: orderData.payment_method || "mpesa",
    payment_status: "pending",
  });

  // Deduct live stock from MarketplaceListing and underlying source
  for (const item of processedItems) {
    const listing = await MarketplaceListing.findById(item.listing_id);
    if (listing && listing.track_stock) {
      listing.stock = Math.max(0, listing.stock - item.qty);
      listing.sales_count += item.qty;
      await listing.save();

      // Also deduct from underlying source if it was a Product or BusinessItem
      if (listing.source_type === "Product" && listing.source_id) {
        Product.updateOne({ _id: listing.source_id }, { $inc: { stock: -item.qty, sales_count: item.qty } }).catch(() => {});
      } else if (listing.source_type === "BusinessItem" && listing.source_id) {
        BusinessItem.updateOne({ _id: listing.source_id, track_stock: true }, { $inc: { quantity: -item.qty } }).catch(() => {});
      }
    }
  }

  // Create MerchantSettlement records for each merchant
  for (const mAlloc of merchantAllocations) {
    await MerchantSettlement.create({
      business_id: mAlloc.business_id,
      order_id: order._id,
      order_number: orderNumber,
      gross_amount: mAlloc.subtotal + mAlloc.delivery_fee,
      platform_commission: mAlloc.commission_amount,
      delivery_allocation: mAlloc.delivery_fee,
      net_settlement_amount: mAlloc.net_amount,
      currency: "KES",
      status: "pending",
    });

    // Record internal BusinessTransaction sale on merchant ledger
    const business = await Business.findById(mAlloc.business_id);
    if (business) {
      BusinessTransaction.create({
        business_id: business._id,
        type: "sale",
        direction: "cash_in",
        amount: mAlloc.net_amount,
        currency: business.currency || "KES",
        payment_channel: orderData.payment_method === "cash_on_delivery" ? "cash" : "mpesa",
        status: "pending",
        description: `Marketplace Order #${orderNumber} (${mAlloc.business_name})`,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        external_reference: orderNumber,
        created_by: business.created_by,
      }).catch((err) => console.warn("[Marketplace Tx Log Error]", err.message));
    }
  }

  // If M-Pesa payment, trigger STK Push
  let stk = null;
  if (orderData.payment_method === "mpesa" && orderData.customer_phone) {
    try {
      stk = await mpesaService.initiateStkPush({
        amount: totalAmount,
        phoneNumber: orderData.customer_phone,
        accountReference: orderNumber,
        transactionDescription: `Marketplace Order ${orderNumber}`,
      });
      order.checkout_request_id = stk.checkoutRequestId;
      await order.save();
    } catch (e) {
      console.warn("[Marketplace STK Push Error]", e.message);
    }
  }

  return { order, order_number: orderNumber, stk };
}

export async function trackMarketplaceOrder(orderNumber, phone) {
  if (!orderNumber?.trim()) throw new AppError("Order number is required", 400);

  const query = { order_number: orderNumber.trim().toUpperCase() };
  if (phone?.trim()) {
    const cleanPhone = phone.trim();
    query.customer_phone = { $regex: cleanPhone.slice(-8), $options: "i" };
  }

  const order = await MarketplaceOrder.findOne(query).lean();
  if (!order) throw new AppError("Order not found with provided details", 404);

  return order;
}

// ============================================================================
// MERCHANT DASHBOARD (ORDERS & SETTLEMENTS)
// ============================================================================

export async function listMerchantMarketplaceOrders(businessId, { fulfillmentStatus, page = 1, limit = 20 } = {}) {
  const query = { "items.business_id": businessId };
  if (fulfillmentStatus) {
    query["merchant_allocations.fulfillment_status"] = fulfillmentStatus;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    MarketplaceOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    MarketplaceOrder.countDocuments(query),
  ]);

  // Filter items in each order to only include those belonging to this business
  const filteredOrders = orders.map((ord) => {
    const myItems = ord.items.filter((i) => String(i.business_id) === String(businessId));
    const myAllocation = ord.merchant_allocations.find((a) => String(a.business_id) === String(businessId));
    return {
      _id: ord._id,
      order_number: ord.order_number,
      customer_name: ord.customer_name,
      customer_phone: ord.customer_phone,
      delivery_address: ord.delivery_address,
      fulfillment_type: ord.fulfillment_type,
      payment_status: ord.payment_status,
      payment_method: ord.payment_method,
      createdAt: ord.createdAt,
      items: myItems,
      allocation: myAllocation,
    };
  });

  return { orders: filteredOrders, pagination: { total, page: Number(page), limit: Number(limit) } };
}

export async function updateMerchantFulfillmentStatus(businessId, orderId, { fulfillmentStatus }) {
  const order = await MarketplaceOrder.findById(orderId);
  if (!order) throw new AppError("Order not found", 404);

  let updated = false;
  for (const item of order.items) {
    if (String(item.business_id) === String(businessId)) {
      item.fulfillment_status = fulfillmentStatus;
      updated = true;
    }
  }

  for (const alloc of order.merchant_allocations) {
    if (String(alloc.business_id) === String(businessId)) {
      alloc.fulfillment_status = fulfillmentStatus;
      if (fulfillmentStatus === "fulfilled") {
        alloc.settlement_status = "cleared";
        // Also clear settlement record
        MerchantSettlement.updateOne(
          { business_id: businessId, order_id: order._id },
          { status: "cleared", cleared_at: new Date() }
        ).catch(() => {});
      }
    }
  }

  if (!updated) throw new AppError("No items in this order belong to this business", 403);

  await order.save();
  return order;
}

export async function getMerchantSettlementsSummary(businessId) {
  const settlements = await MerchantSettlement.find({ business_id: businessId }).sort({ createdAt: -1 }).lean();

  const totalGross = settlements.reduce((sum, s) => sum + s.gross_amount, 0);
  const totalCommission = settlements.reduce((sum, s) => sum + s.platform_commission, 0);
  const totalNet = settlements.reduce((sum, s) => sum + s.net_settlement_amount, 0);

  const pendingSettlement = settlements
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + s.net_settlement_amount, 0);

  const clearedSettlement = settlements
    .filter((s) => s.status === "cleared" || s.status === "ready_for_payout")
    .reduce((sum, s) => sum + s.net_settlement_amount, 0);

  const paidOut = settlements
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.net_settlement_amount, 0);

  return {
    summary: {
      totalGross,
      totalCommission,
      totalNet,
      pendingSettlement,
      clearedSettlement,
      paidOut,
    },
    settlements,
  };
}

// ============================================================================
// MARKETPLACE ADMIN ANALYTICS
// ============================================================================

export async function getMarketplaceAdminAnalytics(adminUser) {
  const query = {};
  if (adminUser.systemRole !== "super_admin") {
    const scopes = adminUser.marketplaceScopes || [];
    if (!scopes.includes("*")) {
      query.category_slug = { $in: scopes };
    }
  }

  const [categories, approvedListings, pendingListings, enrollments, orders] = await Promise.all([
    MarketplaceCategory.find(query.category_slug ? { slug: query.category_slug } : {}).lean(),
    MarketplaceListing.countDocuments({ ...query, moderation_status: "approved" }),
    MarketplaceListing.countDocuments({ ...query, moderation_status: "pending" }),
    MarketplaceEnrollment.countDocuments({ ...query, status: "approved" }),
    MarketplaceOrder.find({ payment_status: "paid" }).lean(),
  ]);

  const totalGMV = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const totalCommissionCollected = orders.reduce((sum, o) => sum + o.total_commission_fee, 0);

  return {
    overview: {
      totalGMV,
      totalOrders: orders.length,
      totalCommissionCollected,
      approvedListings,
      pendingListings,
      activeMerchants: enrollments,
    },
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      isActive: c.is_active,
    })),
  };
}
