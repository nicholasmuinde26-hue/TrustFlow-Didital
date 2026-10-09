import slugify from "slugify";
import MarketplaceListing from "../../models/MarketplaceListing.js";
import MarketplaceEnrollment from "../../models/MarketplaceEnrollment.js";
import BusinessItem from "../../models/BusinessItem.js";
import AppError from "../../utils/AppError.js";
import { effectiveOnlinePrice, listingFieldsFromItem } from "./inventoryListingMapper.js";
import { getHubSlugForBusinessCategory, isBusinessEligibleForHub } from "./marketplaceHubs.js";

/**
 * INVENTORY -> MARKETPLACE SYNC
 *
 * BusinessItem (Inventory & Stock) is the single source of truth.
 * A MarketplaceListing with source_type "BusinessItem" is only a mirror:
 * name, description, price, stock, photo, category and visibility are all
 * copied from the item, so the seller never types them twice and the shop
 * floor (POS) and the marketplace can never disagree about what is left.
 */

const MIRRORED_CATEGORIES = ["retail", "food", "services"];

const notEnrolled = (hub) => {
  const error = new AppError(
    `Join the ${hub} marketplace first. Your enrollment must be approved before products can be published.`,
    409
  );
  error.code = "NOT_ENROLLED";
  return error;
};

async function uniqueSlug(title, businessName) {
  const base =
    slugify(`${title}-${(businessName || "").slice(0, 10)}`, { lower: true, strict: true }) ||
    `item-${Date.now()}`;
  let slug = base;
  let counter = 1;
  while (await MarketplaceListing.exists({ slug })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

function assertPublishable(business) {
  const hub = getHubSlugForBusinessCategory(business.category);
  if (hub === "rentals") {
    throw new AppError("Rental businesses publish rooms and plots from Rental Listings, not Inventory.", 400);
  }
  if (!MIRRORED_CATEGORIES.includes(hub) || !isBusinessEligibleForHub(business.category, hub)) {
    throw new AppError(`Your business category cannot publish inventory to the ${hub} marketplace.`, 403);
  }
  return hub;
}

/** Returns the hub slug if the business is approved to publish there, else throws NOT_ENROLLED. */
async function assertEnrolled(business, hub) {
  const enrollment = await MarketplaceEnrollment.findOne({
    business_id: business._id,
    category_slug: hub,
    status: "approved",
  }).select("_id");
  if (!enrollment) throw notEnrolled(hub);
}

/**
 * Publish (or re-publish) one inventory item. Idempotent: calling it twice
 * never creates a second listing.
 */
export async function publishInventoryItem(business, item) {
  const hub = assertPublishable(business);
  await assertEnrolled(business, hub);

  if (!item.name?.trim()) throw new AppError("Item name is required before publishing", 400);
  if (effectiveOnlinePrice(item) <= 0) throw new AppError(`Set a price for "${item.name}" before publishing`, 400);

  // Publishing means "show it online", so keep the item flag in step.
  if (item.visible_online === false || item.status === "archived") {
    if (item.status === "archived") throw new AppError(`"${item.name}" is archived and cannot be published`, 400);
    item.visible_online = true;
    await item.save();
  }

  const existing = await MarketplaceListing.findOne({
    business_id: business._id,
    source_type: "BusinessItem",
    source_id: item._id,
  });

  if (existing) {
    Object.assign(existing, listingFieldsFromItem(item));
    if (["rejected", "changes_requested"].includes(existing.moderation_status)) {
      // A moderator acted on this listing, so a republish goes back to review.
      existing.moderation_status = "pending";
      existing.moderation_notes = "";
    } else if (existing.moderation_status !== "approved" && !existing.moderated_by) {
      // Never reviewed by a moderator (e.g. created pending by an earlier
      // version): the merchant is already approved, so it goes live.
      existing.moderation_status = "approved";
    }
    await existing.save();
    return existing;
  }

  return MarketplaceListing.create({
    business_id: business._id,
    category_slug: hub,
    source_type: "BusinessItem",
    source_id: item._id,
    slug: await uniqueSlug(item.name, business.name),
    currency: business.currency || "KES",
    // The merchant's enrollment was already approved by an admin, so their
    // products go live straight away. Admins can still reject or hide any
    // listing afterwards from the moderation console.
    moderation_status: "approved",
    ...listingFieldsFromItem(item),
  });
}

/**
 * One-time heal: listings created "pending" by the first version of this
 * feature were never seen by a moderator. Approve them for merchants whose
 * enrollment is approved. Listings a moderator touched are left alone.
 */
export async function approveUnreviewedInventoryListings(business) {
  const hub = getHubSlugForBusinessCategory(business.category);
  const enrolled = await MarketplaceEnrollment.exists({
    business_id: business._id,
    category_slug: hub,
    status: "approved",
  });
  if (!enrolled) return 0;
  const res = await MarketplaceListing.updateMany(
    {
      business_id: business._id,
      source_type: "BusinessItem",
      moderation_status: "pending",
      moderated_by: null,
      visibility: { $ne: "archived" },
    },
    { $set: { moderation_status: "approved" } }
  );
  return res.modifiedCount || 0;
}

/** Take an item off the marketplace without deleting the listing's history. */
export async function unpublishInventoryItem(business, item) {
  item.visible_online = false;
  await item.save();
  await MarketplaceListing.updateMany(
    { business_id: business._id, source_type: "BusinessItem", source_id: item._id, visibility: { $ne: "archived" } },
    { $set: { visibility: "unlisted" } }
  );
  return item;
}

/** Publish many items; one bad item never blocks the rest. */
export async function publishInventoryItems(business, itemIds = []) {
  const hub = assertPublishable(business);
  await assertEnrolled(business, hub);

  const query = { business_id: business._id, status: "active" };
  if (itemIds.length) query._id = { $in: itemIds };
  const items = await BusinessItem.find(query);

  const results = { published: 0, skipped: [], listings: [] };
  for (const item of items) {
    try {
      results.listings.push(await publishInventoryItem(business, item));
      results.published += 1;
    } catch (error) {
      results.skipped.push({ item_id: item._id, name: item.name, reason: error.message });
    }
  }
  return results;
}

/**
 * Push the current state of an item to every listing mirroring it.
 * Called after any inventory change (edit, restock, POS sale, ...).
 * No-op for items that were never published.
 */
export async function syncItemToListings(item) {
  if (!item) return;
  await MarketplaceListing.updateMany(
    {
      business_id: item.business_id,
      source_type: "BusinessItem",
      source_id: item._id,
      visibility: { $ne: "archived" },
    },
    { $set: listingFieldsFromItem(item) }
  );
}

/** Item removed from inventory: its listings disappear from the marketplace. */
export async function archiveItemListings(businessId, itemId) {
  await MarketplaceListing.updateMany(
    { business_id: businessId, source_type: "BusinessItem", source_id: itemId },
    { $set: { visibility: "archived" } }
  );
}

/**
 * Edits made on a linked listing (Marketplace page) flow back to the item,
 * so there is still only one place the truth lives.
 */
export async function pushListingEditsToItem(listing, changes = {}) {
  if (listing.source_type !== "BusinessItem") return;
  const set = {};
  if (changes.title !== undefined) set.name = changes.title;
  if (changes.description !== undefined) set.description = String(changes.description).slice(0, 500);
  if (changes.price !== undefined) set.online_price = Number(changes.price);
  if (changes.stock !== undefined && listing.track_stock) set.quantity = Math.max(0, Number(changes.stock));
  if (changes.subcategory !== undefined) set.category = changes.subcategory || "General";
  if (changes.visibility !== undefined) set.visible_online = changes.visibility === "public";
  if (changes.images?.length) set.image_url = changes.images[0];
  if (!Object.keys(set).length) return;
  await BusinessItem.updateOne({ _id: listing.source_id, business_id: listing.business_id }, { $set: set });
}

/** Attach a small `marketplace` status object to each inventory item for the UI. */
export async function attachMarketplaceState(items) {
  const ids = items.map((i) => i._id);
  const listings = await MarketplaceListing.find({
    source_type: "BusinessItem",
    source_id: { $in: ids },
    visibility: { $ne: "archived" },
  })
    .select("source_id slug moderation_status visibility moderation_notes category_slug")
    .lean();
  const bySource = new Map(listings.map((l) => [String(l.source_id), l]));

  return items.map((item) => {
    const plain = typeof item.toObject === "function" ? item.toObject() : item;
    const listing = bySource.get(String(plain._id));
    let state = "not_published";
    if (listing) {
      if (listing.moderation_status === "approved") state = listing.visibility === "public" ? "live" : "hidden";
      else state = listing.moderation_status; // pending | rejected | changes_requested | draft
    }
    return {
      ...plain,
      marketplace: {
        state,
        listing_id: listing?._id || null,
        slug: listing?.slug || null,
        category_slug: listing?.category_slug || null,
        notes: listing?.moderation_notes || "",
      },
    };
  });
}
