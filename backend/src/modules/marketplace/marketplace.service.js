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
import PlatformAdmin from "../../models/PlatformAdmin.js";
import * as mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import AppError from "../../utils/AppError.js";
import { getHubSlugForBusinessCategory, isBusinessEligibleForHub } from "./marketplaceHubs.js";
import { pushListingEditsToItem } from "./inventoryMarketplaceSync.service.js";
import { getOwnedBusiness } from "../business/business.service.js";
import { DEFAULT_RENTAL_PROPERTIES } from "./defaultRentals.data.js";
import { DEFAULT_RETAIL_STORES, DEFAULT_RETAIL_PRODUCTS } from "./defaultRetail.data.js";
import { DEFAULT_FOOD_RESTAURANTS, DEFAULT_FOOD_MENU } from "./defaultFood.data.js";
import { DEFAULT_SERVICE_PROVIDERS } from "./defaultServices.data.js";

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
    filter_keys: ["price", "in_stock", "brand", "rating", "subcategory"],
    subcategories: [
      { slug: "electronics", name: "Electronics & Gadgets", icon: "Tv" },
      { slug: "appliances", name: "Home & Kitchen Appliances", icon: "Tv" },
      { slug: "mobiles", name: "Mobiles & Smartwatches", icon: "Smartphone" },
      { slug: "clothing", name: "Clothing & Fashion", icon: "Shirt" },
      { slug: "footwear", name: "Footwear & Shoes", icon: "Footprints" },
      { slug: "furniture", name: "Furniture & Office", icon: "Armchair" },
      { slug: "beauty", name: "Beauty & Personal Care", icon: "Sparkles" },
      { slug: "groceries", name: "Groceries & Supermarket", icon: "Apple" },
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
    hero_title: "Find trusted help for everyday jobs",
    hero_subtitle: "Compare local professionals by service, rating, and area. Contact the provider directly to agree on a time.",
    theme_color: "#7c3aed",
    theme_gradient: "from-purple-950 via-slate-900 to-violet-950",
    filter_keys: ["service_mode", "location", "price"],
    subcategories: [
      { slug: "plumbing", name: "Plumbing", icon: "Wrench" },
      { slug: "electrical", name: "Electrical", icon: "Zap" },
      { slug: "home-cleaning", name: "Home Cleaning", icon: "Sparkles" },
      { slug: "painting", name: "Painting", icon: "Paintbrush" },
      { slug: "carpentry", name: "Carpentry", icon: "Hammer" },
      { slug: "appliance-repair", name: "Appliance Repair", icon: "Refrigerator" },
      { slug: "tailoring", name: "Tailoring", icon: "Scissors" },
      { slug: "photography", name: "Photography", icon: "Camera" },
      { slug: "beauty-grooming", name: "Beauty & Grooming", icon: "Sparkles" },
      { slug: "moving", name: "Moving", icon: "Truck" },
      { slug: "gardening", name: "Gardening", icon: "Flower2" },
      { slug: "tech-support", name: "Tech Support", icon: "Laptop" },
      { slug: "tutoring", name: "Tutoring", icon: "BookOpen" },
      { slug: "catering", name: "Catering", icon: "Utensils" },
      { slug: "pest-control", name: "Pest Control", icon: "Bug" },
      { slug: "auto-repair", name: "Auto Repair", icon: "Car" },
    ],
    featured_collections: [
      { name: "Top Rated Nearby", tag: "top_rated", badge_color: "emerald" },
      { name: "Home Repairs", tag: "home_repairs", badge_color: "blue" },
      { name: "Home Cleaning", tag: "home-cleaning", badge_color: "violet" },
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
      { slug: "local-dishes", name: "Kenyan Plates", icon: "Utensils" },
      { slug: "burgers", name: "Burgers", icon: "Sandwich" },
      { slug: "pizza", name: "Pizza", icon: "Pizza" },
      { slug: "grills", name: "Grills", icon: "Flame" },
      { slug: "pasta", name: "Pasta", icon: "Utensils" },
      { slug: "salads", name: "Fresh Bowls", icon: "Salad" },
      { slug: "sides", name: "Sides", icon: "Soup" },
      { slug: "drinks", name: "Drinks", icon: "Coffee" },
      { slug: "desserts", name: "Desserts", icon: "Cake" },
      { slug: "bakery", name: "Bakery", icon: "Cookie" },
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
    } else if (hub.slug === "rentals" || hub.slug === "retail" || hub.slug === "food" || hub.slug === "services") {
      await MarketplaceCategory.updateOne(
        { slug: hub.slug },
        {
          $set: {
            hero_title: hub.hero_title,
            hero_subtitle: hub.hero_subtitle,
            theme_color: hub.theme_color,
            theme_gradient: hub.theme_gradient,
            subcategories: hub.subcategories,
            filter_keys: hub.filter_keys,
          },
        }
      );
    }
  }
}

let defaultRentalsSeedPromise = null;

export function ensureDefaultRentals() {
  if (!defaultRentalsSeedPromise) {
    defaultRentalsSeedPromise = seedDefaultRentals().finally(() => {
      defaultRentalsSeedPromise = null;
    });
  }
  return defaultRentalsSeedPromise;
}

async function seedDefaultRentals() {
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

let defaultRetailSeedPromise = null;

// Several requests hit the retail hub at once (categories, listings, stores).
// Without this guard each one seeded its own copy of the demo stores, which is
// where the repeated stores in the directory came from.
export function ensureDefaultRetail() {
  if (!defaultRetailSeedPromise) {
    defaultRetailSeedPromise = seedDefaultRetail().finally(() => {
      defaultRetailSeedPromise = null;
    });
  }
  return defaultRetailSeedPromise;
}

async function seedDefaultRetail() {
  await ensureDefaultCategories();
  const retailCount = await MarketplaceListing.countDocuments({ category_slug: "retail" });
  if (retailCount >= 20) return;

  // Find or create a user for created_by
  let user = await mongoose.model("User").findOne();
  const fallbackUserId = user ? user._id : new mongoose.Types.ObjectId();

  // Create or retrieve the 6 verified retail stores
  const storeMap = {};
  for (const store of DEFAULT_RETAIL_STORES) {
    let business = await Business.findOne({
      $or: [{ slug: store.slug }, { name: store.name }],
    });

    if (!business) {
      business = await Business.create({
        name: store.name,
        slug: store.slug,
        category: "retail",
        category_label: "Retail & Wholesale",
        currency: "KES",
        location: store.location,
        created_by: fallbackUserId,
      });
    }

    let enrollment = await MarketplaceEnrollment.findOne({
      business_id: business._id,
      category_slug: "retail",
    });

    if (!enrollment) {
      await MarketplaceEnrollment.create({
        business_id: business._id,
        category_slug: "retail",
        status: "approved",
        merchant_profile: {
          display_name: store.name,
          tagline: store.tagline,
          description: store.description,
          badges: store.badges,
          rating: store.rating,
          review_count: store.review_count,
          banner_url: store.banner,
          avatar_url: store.avatar,
        },
      });
    }

    storeMap[store.slug] = business._id;
  }

  const firstStoreId = Object.values(storeMap)[0] || fallbackUserId;

  // Seed the 28 products
  for (const product of DEFAULT_RETAIL_PRODUCTS) {
    const existing = await MarketplaceListing.findOne({ slug: product.slug });
    if (!existing) {
      const bizId = storeMap[product.storeSlug] || firstStoreId;
      await MarketplaceListing.create({
        business_id: bizId,
        category_slug: "retail",
        source_type: "Product",
        source_id: new mongoose.Types.ObjectId(),
        title: product.title,
        slug: product.slug,
        brand: product.brand,
        discount_pct: product.discount_pct,
        description: product.description,
        short_description: product.short_description,
        price: product.price,
        compare_price: product.compare_price,
        currency: "KES",
        stock: product.stock || 20,
        track_stock: true,
        images: product.images,
        thumbnail: product.thumbnail,
        subcategory: product.subcategory,
        tags: product.tags,
        moderation_status: "approved",
        visibility: "public",
        is_featured: Boolean(product.is_featured),
        featured_rank: product.featured_rank || 0,
        rating: product.rating || 4.8,
        review_count: product.review_count || 15,
      });
    }
  }
}

let defaultFoodSeedPromise = null;

export function ensureDefaultFood() {
  if (!defaultFoodSeedPromise) {
    defaultFoodSeedPromise = seedDefaultFood().finally(() => {
      defaultFoodSeedPromise = null;
    });
  }
  return defaultFoodSeedPromise;
}

async function seedDefaultFood() {
  await ensureDefaultCategories();
  const defaultSlugs = DEFAULT_FOOD_MENU.map((item) => item.slug);
  const seededCount = await MarketplaceListing.countDocuments({ category_slug: "food", slug: { $in: defaultSlugs } });
  if (seededCount >= DEFAULT_FOOD_MENU.length) return;

  const user = await mongoose.model("User").findOne();
  const createdBy = user?._id || new mongoose.Types.ObjectId();
  const businessMap = {};

  for (const restaurant of DEFAULT_FOOD_RESTAURANTS) {
    let business = await Business.findOne({ $or: [{ slug: restaurant.slug }, { name: restaurant.name }] });
    if (!business) {
      business = await Business.create({
        name: restaurant.name,
        slug: restaurant.slug,
        category: "restaurant",
        category_label: "Restaurant & Food",
        currency: "KES",
        location: restaurant.location,
        created_by: createdBy,
      });
    }

    let enrollment = await MarketplaceEnrollment.findOne({ business_id: business._id, category_slug: "food" });
    if (!enrollment) {
      await MarketplaceEnrollment.create({
        business_id: business._id,
        category_slug: "food",
        status: "approved",
        merchant_profile: {
          display_name: restaurant.name,
          tagline: restaurant.tagline,
          description: restaurant.description,
          banner_url: restaurant.banner,
          logo_url: restaurant.avatar,
          physical_location: restaurant.location,
          badges: ["Verified Kitchen", "Made Fresh"],
        },
      });
    }
    businessMap[restaurant.slug] = business._id;
  }

  for (const [index, item] of DEFAULT_FOOD_MENU.entries()) {
    if (await MarketplaceListing.exists({ slug: item.slug })) continue;
    await MarketplaceListing.create({
      business_id: businessMap[item.restaurantSlug],
      category_slug: "food",
      source_type: "BusinessItem",
      source_id: new mongoose.Types.ObjectId(),
      title: item.title,
      slug: item.slug,
      description: item.description,
      short_description: item.description,
      price: item.price,
      currency: "KES",
      stock: 50,
      track_stock: false,
      images: [item.photo],
      thumbnail: item.photo,
      subcategory: item.subcategory,
      tags: [item.cuisine.toLowerCase(), item.vegetarian ? "vegetarian" : "popular"],
      food_attributes: {
        cuisine_type: item.cuisine,
        is_vegetarian: item.vegetarian,
        preparation_time_minutes: item.prepTime,
      },
      moderation_status: "approved",
      visibility: "public",
      is_featured: index < 6,
      featured_rank: index < 6 ? index + 1 : 0,
      rating: 4.6 + ((index % 4) * 0.1),
      review_count: 18 + index * 3,
    });
  }
}

let defaultServicesSeedPromise = null;

export function ensureDefaultServices() {
  if (!defaultServicesSeedPromise) {
    defaultServicesSeedPromise = seedDefaultServices().finally(() => {
      defaultServicesSeedPromise = null;
    });
  }
  return defaultServicesSeedPromise;
}

async function seedDefaultServices() {
  await ensureDefaultCategories();
  const defaultSlugs = DEFAULT_SERVICE_PROVIDERS.map((provider) => provider.slug);
  const seededCount = await MarketplaceListing.countDocuments({ category_slug: "services", slug: { $in: defaultSlugs } });
  if (seededCount >= DEFAULT_SERVICE_PROVIDERS.length) return;

  const user = await mongoose.model("User").findOne();
  const createdBy = user?._id || new mongoose.Types.ObjectId();

  for (const [index, provider] of DEFAULT_SERVICE_PROVIDERS.entries()) {
    let business = await Business.findOne({ name: provider.name });
    if (!business) {
      business = await Business.create({
        name: provider.name,
        category: "service",
        category_label: provider.category,
        currency: "KES",
        location: provider.area,
        created_by: createdBy,
      });
    }

    let enrollment = await MarketplaceEnrollment.findOne({ business_id: business._id, category_slug: "services" });
    if (!enrollment) {
      await MarketplaceEnrollment.create({
        business_id: business._id,
        category_slug: "services",
        status: "approved",
        merchant_profile: {
          display_name: provider.name,
          tagline: `${provider.category} professional serving ${provider.area}`,
          description: provider.description,
          logo_url: provider.avatar,
          banner_url: provider.banner,
          physical_location: provider.area,
          badges: ["Verified Professional", `${provider.years}+ years experience`],
        },
      });
    }

    if (await MarketplaceListing.exists({ slug: provider.slug })) continue;
    await MarketplaceListing.create({
      business_id: business._id,
      category_slug: "services",
      source_type: "BusinessItem",
      source_id: new mongoose.Types.ObjectId(),
      title: provider.offer,
      slug: provider.slug,
      description: provider.description,
      short_description: `${provider.category} · ${provider.area} · ${provider.years}+ years experience`,
      price: provider.price,
      currency: "KES",
      stock: 1,
      track_stock: false,
      images: [provider.banner],
      thumbnail: provider.avatar,
      subcategory: provider.subcategory,
      tags: [provider.category.toLowerCase(), "verified", provider.area.toLowerCase()],
      service_attributes: {
        duration_minutes: provider.duration,
        service_mode: provider.mode,
        service_area: provider.area,
      },
      moderation_status: "approved",
      visibility: "public",
      is_featured: provider.featured,
      featured_rank: provider.featured ? index + 1 : 0,
      rating: provider.rating,
      review_count: provider.reviews,
    });
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
  if (slug && slug.toLowerCase() === "food") {
    await ensureDefaultFood();
  }
  if (slug && slug.toLowerCase() === "services") {
    await ensureDefaultServices();
  }
  if (slug && (slug.toLowerCase() === "retail" || slug.toLowerCase() === "all")) {
    await ensureDefaultRetail();
  }
  const category = await MarketplaceCategory.findOne({ slug: slug.toLowerCase(), is_active: true }).lean();
  if (!category) {
    throw new AppError(`Marketplace category '${slug}' not found`, 404);
  }
  return category;
}

export async function getCategoryStores(categorySlug = "retail") {
  const catSlug = String(categorySlug).toLowerCase().trim();
  if (catSlug === "retail") await ensureDefaultRetail();
  if (catSlug === "rentals") await ensureDefaultRentals();
  if (catSlug === "food") await ensureDefaultFood();
  if (catSlug === "services") await ensureDefaultServices();

  const enrollments = await MarketplaceEnrollment.find({
    category_slug: catSlug,
    status: "approved",
  })
    .populate("business_id", "name category location currency marketplace_slug marketplace_paused")
    .lean();

  // 1) Eligible approved stores, one per business (a business can hold more
  //    than one enrollment row, e.g. after a re-apply).
  const seenBusiness = new Set();
  const candidates = [];
  for (const en of enrollments) {
    const biz = en.business_id;
    if (!biz || biz.marketplace_paused) continue;
    if (!isBusinessEligibleForHub(biz.category, catSlug)) continue;
    const key = String(biz._id);
    if (seenBusiness.has(key)) continue;
    seenBusiness.add(key);

    const count = await MarketplaceListing.countDocuments({
      business_id: biz._id,
      category_slug: catSlug,
      moderation_status: "approved",
      visibility: "public",
    });
    candidates.push({ en, biz, count });
  }

  // 2) Collapse accidental copies: same store name AND same location is the
  //    same store. Keep the copy that actually has the most live products.
  //    A different business that merely shares a name (different location) is
  //    a separate store and stays.
  const norm = (v) => String(v || "").toLowerCase().replace(/\s+/g, " ").trim();
  const bestByKey = new Map();
  for (const c of candidates) {
    const name = c.en.merchant_profile?.display_name || c.biz.name;
    const key = `${norm(name)}|${norm(c.biz.location)}`;
    const current = bestByKey.get(key);
    if (!current || c.count > current.count) bestByKey.set(key, c);
  }
  const unique = candidates.filter((c) => bestByKey.get(
    `${norm(c.en.merchant_profile?.display_name || c.biz.name)}|${norm(c.biz.location)}`
  ) === c);

  const stores = [];
  for (const { en, biz, count } of unique) {
    // Every store needs its own URL. Stores without one get a unique slug saved
    // now, so a store link can never open somebody else's page.
    if (!biz.marketplace_slug) {
      const doc = await Business.findById(biz._id);
      if (doc) biz.marketplace_slug = await ensureMarketplaceSlug(doc);
    }

    const profile = en.merchant_profile || {};
    stores.push({
      _id: biz._id,
      name: profile.display_name || biz.name,
      slug: biz.marketplace_slug || slugify(biz.name, { lower: true, strict: true }),
      category: biz.category,
      tagline: profile.tagline || `Verified ${catSlug.toUpperCase()} Merchant`,
      description: profile.description || "",
      location: profile.physical_location || biz.location || "Nairobi, Kenya",
      rating: profile.rating || 4.8,
      review_count: profile.review_count || 120,
      badges: profile.badges || ["Verified Store"],
      primary_color: profile.primary_color || "#064e3b",
      hero_style: profile.hero_style || "gradient",
      banner: profile.banner_url || "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80",
      avatar: profile.logo_url || profile.avatar_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80",
      productCount: count,
      verifiedAt: en.reviewed_at || en.updatedAt || en.createdAt || null,
    });
  }
  // Newly verified stores first, so a store shows up at the top the moment it is approved.
  stores.sort((a, b) => new Date(b.verifiedAt || 0) - new Date(a.verifiedAt || 0));
  return stores;
}

export async function getRetailStores() {
  return getCategoryStores("retail");
}

export async function updateMarketplaceCategoryDesign(slug, designData, adminUser) {
  assertMarketplaceScope(adminUser, slug, "manageMarketplaceDesign");
  const category = await MarketplaceCategory.findOneAndUpdate(
    { slug: slug.toLowerCase() },
    { $set: designData },
    { returnDocument: 'after' }
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

export { getHubSlugForBusinessCategory, isBusinessEligibleForHub };

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

  await ensureMarketplaceSlug(business);

  const profile = {
    ...sanitizeMerchantProfile(merchantProfile),
    badges: ["Verified Merchant"],
  };
  profile.display_name = profile.display_name || business.name;
  profile.phone = profile.phone || business.mpesa_paybill || business.mpesa_till || "";
  profile.physical_location = profile.physical_location || business.location || "";
  profile.return_policy = profile.return_policy || "7-day inspection and return policy on defective goods.";
  profile.delivery_info = profile.delivery_info || "Fast delivery across major cities.";

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

// ============================================================================
// MERCHANT PROFILE (seller-controlled branding inside the marketplace)
// ============================================================================
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const PROFILE_TEXT_LIMITS = {
  display_name: 80,
  tagline: 140,
  description: 600,
  logo_url: 500,
  banner_url: 500,
  phone: 30,
  email: 120,
  physical_location: 160,
  return_policy: 400,
  delivery_info: 400,
};

/** Keeps only seller-editable fields, trims/limits them, and validates theme values. */
function sanitizeMerchantProfile(input = {}) {
  const out = {};
  for (const [key, limit] of Object.entries(PROFILE_TEXT_LIMITS)) {
    if (input[key] === undefined) continue;
    out[key] = String(input[key] ?? "").trim().slice(0, limit);
  }
  if (input.primary_color !== undefined) {
    if (!HEX_COLOR.test(String(input.primary_color))) {
      throw new AppError("Colours must be hex values like #064e3b", 400);
    }
    out.primary_color = String(input.primary_color).toLowerCase();
  }
  if (input.hero_style !== undefined) {
    if (!["gradient", "solid"].includes(input.hero_style)) {
      throw new AppError("Banner style must be gradient or solid", 400);
    }
    out.hero_style = input.hero_style;
  }
  return out;
}

/** Gives a business a unique, stable marketplace URL slug (existing slugs are never changed). */
export async function ensureMarketplaceSlug(business) {
  if (business.marketplace_slug) return business.marketplace_slug;
  const base = slugify(business.name || "", { lower: true, strict: true }) || `store-${String(business._id).slice(-6)}`;
  let candidate = base;
  let attempt = 1;
  while (await Business.exists({ marketplace_slug: candidate, _id: { $ne: business._id } })) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  business.marketplace_slug = candidate;
  await business.save();
  return candidate;
}

/**
 * Seller edits how their business appears in the marketplace: store name,
 * tagline, description, colours, banner style, contact/policy text.
 * Applies to every hub the business is enrolled in. Also lets the seller
 * hide / show the whole business in the marketplace.
 */
export async function updateMerchantProfile(businessId, user, payload = {}) {
  const business = await getOwnedBusiness(businessId, user, { write: true });

  const enrollments = await MarketplaceEnrollment.find({ business_id: business._id });
  if (enrollments.length === 0) {
    throw new AppError("Enroll in your marketplace hub first, then you can customise your store page", 400);
  }

  const patch = sanitizeMerchantProfile(payload.merchant_profile || payload);
  if (patch.display_name !== undefined && !patch.display_name) {
    throw new AppError("Store name cannot be empty", 400);
  }
  if (Object.keys(patch).length) {
    for (const enrollment of enrollments) {
      const current = enrollment.merchant_profile?.toObject
        ? enrollment.merchant_profile.toObject()
        : { ...(enrollment.merchant_profile || {}) };
      enrollment.merchant_profile = { ...current, ...patch };
      await enrollment.save();
    }
  }

  if (typeof payload.paused === "boolean") {
    business.marketplace_paused = payload.paused;
    await business.save();
  }

  return {
    paused: Boolean(business.marketplace_paused),
    slug: await ensureMarketplaceSlug(business),
    enrollments: await MarketplaceEnrollment.find({ business_id: business._id }).lean(),
  };
}

/** Seller-side read of the store profile + pause state (used to prefill the editor). */
export async function getMerchantProfile(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  const enrollment = await MarketplaceEnrollment.findOne({ business_id: business._id }).sort({ createdAt: 1 }).lean();
  return {
    enrolled: Boolean(enrollment),
    paused: Boolean(business.marketplace_paused),
    slug: business.marketplace_slug || null,
    business_name: business.name,
    profile: enrollment?.merchant_profile || {},
  };
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
  // Listings linked to an inventory item write their edits back to it,
  // so Inventory, POS and the marketplace keep one shared truth.
  await pushListingEditsToItem(listing, payload);
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
  if (listing.source_type === "BusinessItem") {
    await BusinessItem.updateOne(
      { _id: listing.source_id, business_id: business._id },
      { $set: { visible_online: newVis === "public" } }
    );
  } else if (listing.source_type === "RentalListing") {
    await RentalListing.updateOne(
      { _id: listing.source_id, business_id: business._id },
      { $set: { visible_online: newVis === "public" } }
    );
  }
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
  await RentalListing.updateOne(
    { _id: listing.source_id, business_id: business._id },
    { $set: { status: targetOccupied ? "occupied" : "vacant", visible_online: !targetOccupied } }
  );
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
  brand,
  rating,
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
  limit = 24,
}) {
  const targetCategory = (categorySlug && categorySlug !== "all") ? categorySlug.toLowerCase().trim() : "retail";

  if (targetCategory === "rentals") {
    await ensureDefaultRentals();
  } else if (targetCategory === "retail") {
    await ensureDefaultRetail();
  } else if (targetCategory === "food") {
    await ensureDefaultFood();
  } else if (targetCategory === "services") {
    await ensureDefaultServices();
  }

  const query = {
    category_slug: targetCategory,
    moderation_status: "approved",
    visibility: "public",
    "rental_attributes.is_occupied": { $ne: true },
  };

  // Strictly enforce category isolation: only include businesses eligible for this category hub
  let allowedBizCategories = [targetCategory];
  if (targetCategory === "retail") allowedBizCategories = ["retail", "Retail & Wholesale", "other"];
  else if (targetCategory === "rentals") allowedBizCategories = ["rental", "rentals"];
  else if (targetCategory === "services") allowedBizCategories = ["service", "services"];
  else if (targetCategory === "food") allowedBizCategories = ["restaurant", "food"];

  const eligibleBusinesses = await Business.find({
    category: { $in: allowedBizCategories },
    marketplace_paused: { $ne: true },
  }).select("_id").lean();
  query.business_id = { $in: eligibleBusinesses.map((b) => b._id) };

  if (subcategory && subcategory !== "All") {
    query.subcategory = subcategory;
  }

  if (brand && brand !== "All" && brand !== "any") {
    const brandRegex = new RegExp(`^${brand}$`, "i");
    query.$or = [
      { brand: brandRegex },
      { tags: { $in: [brandRegex] } },
      { title: new RegExp(brand, "i") },
    ];
  }

  if (rating !== undefined && rating !== "" && rating !== "any") {
    query.rating = { $gte: Number(rating) };
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
    const searchConditions = [
      { title: searchRegex },
      { description: searchRegex },
      { brand: searchRegex },
      { tags: { $in: [searchRegex] } },
      { "rental_attributes.location_text": searchRegex },
      { "rental_attributes.city": searchRegex },
      { "rental_attributes.neighborhood": searchRegex },
      { "rental_attributes.property_type": searchRegex },
    ];
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchConditions }];
      delete query.$or;
    } else {
      query.$or = searchConditions;
    }
  }

  const sort = {};
  if (sortBy === "price_asc") sort.price = 1;
  else if (sortBy === "price_desc") sort.price = -1;
  else if (sortBy === "rating" || sortBy === "rating_desc") sort.rating = -1;
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
      .populate("business_id", "name category location currency slug")
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
  if (categorySlug === "retail" || !categorySlug || categorySlug === "any") {
    await ensureDefaultRetail();
  }
  if (categorySlug === "food") {
    await ensureDefaultFood();
  }
  if (categorySlug === "services") {
    await ensureDefaultServices();
  }

  const query = { slug: slug.toLowerCase(), visibility: "public" };
  if (categorySlug && categorySlug !== "any") {
    query.category_slug = categorySlug.toLowerCase();
  }

  const listing = await MarketplaceListing.findOne(query)
    .populate("business_id", "name category location currency created_by marketplace_paused marketplace_slug")
    .lean();

  if (!listing || listing.moderation_status !== "approved" || listing.visibility !== "public" || listing.business_id?.marketplace_paused) {
    throw new AppError("Listing not found or not currently available", 404);
  }

  // Increment view count asynchronously
  MarketplaceListing.updateOne({ _id: listing._id }, { $inc: { view_count: 1 } }).catch(() => {});

  // Fetch owning business marketplace profile
  const [enrollment, relatedListings] = await Promise.all([
    MarketplaceEnrollment.findOne({
      business_id: listing.business_id._id,
      category_slug: listing.category_slug,
    }).lean(),
    MarketplaceListing.find({
      category_slug: listing.category_slug,
      moderation_status: "approved",
      visibility: "public",
      business_id: { $nin: await Business.find({ marketplace_paused: true }).distinct("_id") },
      _id: { $ne: listing._id },
    })
      .limit(4)
      .lean(),
  ]);

  const merchantProfile = enrollment?.merchant_profile || {};
  const businessSlug = listing.business_id.marketplace_slug || slugify(listing.business_id.name, { lower: true });

  return {
    listing,
    merchant: {
      id: listing.business_id._id,
      name: listing.business_id.name,
      slug: businessSlug,
      display_name: merchantProfile.display_name || listing.business_id.name,
      tagline: merchantProfile.tagline || "",
      description: merchantProfile.description || "",
      logo_url: merchantProfile.logo_url || "",
      primary_color: merchantProfile.primary_color || "#064e3b",
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
  // Resolve by marketplace slug first, then fall back to matching the business name
  const bySlug = await Business.findOne({ marketplace_slug: cleanSlug }).select("_id").lean();
  let businessId = bySlug?._id;

  if (!businessId) {
    // Name fallback for businesses without a slug. If several businesses share
    // the name, pick the one that actually has live listings.
    const businesses = await Business.find().select("name").lean();
    const matches = businesses.filter((b) => slugify(b.name, { lower: true }) === cleanSlug);
    if (matches.length === 1) {
      businessId = matches[0]._id;
    } else if (matches.length > 1) {
      const counts = await Promise.all(
        matches.map((b) =>
          MarketplaceListing.countDocuments({ business_id: b._id, moderation_status: "approved", visibility: "public" })
        )
      );
      businessId = matches[counts.indexOf(Math.max(...counts))]._id;
    }
  }

  if (!businessId) throw new AppError("Business merchant profile not found", 404);

  const [business, enrollments, listings] = await Promise.all([
    Business.findById(businessId).lean(),
    MarketplaceEnrollment.find({ business_id: businessId, status: "approved" }).lean(),
    MarketplaceListing.find({ business_id: businessId, moderation_status: "approved", visibility: "public" }).sort({ is_featured: -1, createdAt: -1 }).lean(),
  ]);

  if (business?.marketplace_paused) throw new AppError("This store is currently paused", 404);

  const activeEnrollment = enrollments[0];
  const merchantProfile = activeEnrollment?.merchant_profile || {};

  return {
    business: {
      id: business._id,
      name: business.name,
      slug: business.marketplace_slug || cleanSlug,
      category: business.category,
      category_slug: getHubSlugForBusinessCategory(business.category),
      currency: business.currency || "KES",
      location: merchantProfile.physical_location || business.location || "",
      display_name: merchantProfile.display_name || business.name,
      tagline: merchantProfile.tagline || "",
      description: merchantProfile.description || "",
      logo_url: merchantProfile.logo_url || "",
      banner_url: merchantProfile.banner_url || "",
      primary_color: merchantProfile.primary_color || "#064e3b",
      hero_style: merchantProfile.hero_style || "gradient",
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
  if (!["pending", "processing", "fulfilled", "cancelled"].includes(fulfillmentStatus)) {
    throw new AppError("Invalid fulfillment status", 400);
  }
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
