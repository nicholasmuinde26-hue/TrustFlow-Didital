import mongoose from "mongoose";
import AppError from "../../utils/AppError.js";
import { assertImageDataUri, cleanText, cleanUrl, IMAGE_LIMITS } from "../../utils/imageData.js";
import Chama from "../../models/Chama.js";
import ChamaProfile from "../../models/ChamaProfile.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ChamaMemberKyc from "../../models/ChamaMemberKyc.js";
import ChamaOrgKyc, { ORG_REGISTRATION_TYPES } from "../../models/ChamaOrgKyc.js";

// Roles that count as "management" on the public page.
export const MANAGEMENT_ROLES = ["chairperson", "treasurer", "secretary", "auditor", "committee_member", "patron"];
const ROLE_ORDER = Object.fromEntries(MANAGEMENT_ROLES.map((role, index) => [role, index]));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VISIBILITY = ["public", "members", "hidden"];

// NOTE: never combine a "+nested.path" select with its parent ("public_profile").
// Mongo rejects that projection with "Path collision" (error 31249). List the
// sub-paths explicitly instead; naming a select:false path includes it.
const MEMBERSHIP_PROFILE_SELECT = [
  "role", "joined_at", "createdAt", "user_id",
  "public_profile.visibility", "public_profile.headline", "public_profile.bio",
  "public_profile.image_url", "public_profile.location", "public_profile.contact_email",
  "public_profile.updated_at",
].join(" ");
const CHAMA_PROFILE_SELECT = [
  "public_profile.enabled", "public_profile.description", "public_profile.location",
  "public_profile.purpose", "public_profile.contact_email", "public_profile.website",
  "public_profile.tagline", "public_profile.logo_url", "public_profile.cover_url",
].join(" ");

const notFound = () => new AppError("This profile is not available", 404);

// ----------------------------------------------------------------------
// A PERSON'S OWN PUBLIC PROFILE (members and management alike)
// ----------------------------------------------------------------------

const shapePerson = (membership, user, { includeImage = true } = {}) => {
  const p = membership.public_profile || {};
  return {
    membership_id: membership._id,
    name: user?.name || "Member",
    role: membership.role,
    is_management: MANAGEMENT_ROLES.includes(membership.role),
    member_since: membership.joined_at || membership.createdAt || null,
    visibility: p.visibility || "members",
    headline: p.headline || "",
    bio: p.bio || "",
    location: p.location || "",
    contact_email: p.contact_email || "",
    has_image: Boolean(p.image_url),
    ...(includeImage ? { image_url: p.image_url || null } : {}),
    updated_at: p.updated_at || null,
  };
};

export async function getMyPublicProfile(chamaId, membershipId) {
  const membership = await ChamaMembership.findOne({ _id: membershipId, chama_id: chamaId })
    .select(MEMBERSHIP_PROFILE_SELECT)
    .populate("user_id", "name");
  if (!membership) throw notFound();
  return shapePerson(membership, membership.user_id);
}

export async function saveMyPublicProfile(chamaId, membershipId, data = {}) {
  const set = { "public_profile.updated_at": new Date() };

  if (Object.hasOwn(data, "visibility")) {
    if (!VISIBILITY.includes(data.visibility)) throw new AppError("Visibility must be public, members or hidden", 400);
    set["public_profile.visibility"] = data.visibility;
  }
  if (Object.hasOwn(data, "headline")) set["public_profile.headline"] = cleanText(data.headline, 120);
  if (Object.hasOwn(data, "bio")) set["public_profile.bio"] = cleanText(data.bio, 800);
  if (Object.hasOwn(data, "location")) set["public_profile.location"] = cleanText(data.location, 120);
  if (Object.hasOwn(data, "contact_email")) {
    const email = cleanText(data.contact_email, 254).toLowerCase();
    if (email && !EMAIL.test(email)) throw new AppError("Enter a valid contact email", 400);
    set["public_profile.contact_email"] = email;
  }
  if (Object.hasOwn(data, "image_url")) {
    set["public_profile.image_url"] = assertImageDataUri(data.image_url, { label: "Profile photo", maxChars: IMAGE_LIMITS.publicAvatar, required: false });
  }

  const updated = await ChamaMembership.findOneAndUpdate(
    { _id: membershipId, chama_id: chamaId, status: "active" },
    { $set: set },
    { returnDocument: "after", runValidators: true }
  ).select(MEMBERSHIP_PROFILE_SELECT).populate("user_id", "name");
  if (!updated) throw notFound();
  return shapePerson(updated, updated.user_id);
}

// ----------------------------------------------------------------------
// VIEWING SOMEONE ELSE'S PROFILE (the "tap a profile" card)
// ----------------------------------------------------------------------

async function publicChamaOrNull(chamaId) {
  if (!mongoose.isValidObjectId(chamaId)) return null;
  const [chama, profile] = await Promise.all([
    Chama.findById(chamaId).select("status visibility").lean(),
    ChamaProfile.findOne({ chama_id: chamaId }).select("public_profile.enabled").lean(),
  ]);
  return chama && chama.status === "active" && chama.visibility === "public" && profile?.public_profile?.enabled ? chama : null;
}

// viewerUser may be undefined (signed-out visitor).
export async function getPersonProfile(chamaId, membershipId, viewerUser, { includeImage = true } = {}) {
  if (!mongoose.isValidObjectId(chamaId) || !mongoose.isValidObjectId(membershipId)) throw notFound();
  const target = await ChamaMembership.findOne({ _id: membershipId, chama_id: chamaId, status: "active" })
    .select(MEMBERSHIP_PROFILE_SELECT)
    .populate("user_id", "name");
  if (!target) throw notFound();

  const viewerMembership = viewerUser
    ? await ChamaMembership.findOne({ chama_id: chamaId, user_id: viewerUser._id, status: "active" }).select("_id").lean()
    : null;
  const isSelf = viewerMembership && String(viewerMembership._id) === String(target._id);
  const visibility = target.public_profile?.visibility || "members";

  const allowed =
    isSelf ||
    (visibility === "members" && viewerMembership) ||
    (visibility === "public" && (viewerMembership || (await publicChamaOrNull(chamaId))));
  if (!allowed) throw notFound();

  return shapePerson(target, target.user_id, { includeImage });
}

// Raw image bytes for <img src>, so list pages do not carry base64 around.
export async function getPersonImage(chamaId, membershipId, viewerUser) {
  const person = await getPersonProfile(chamaId, membershipId, viewerUser, { includeImage: true });
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(person.image_url || "");
  if (!match) throw notFound();
  return { contentType: match[1].toLowerCase(), buffer: Buffer.from(match[2], "base64") };
}

// ----------------------------------------------------------------------
// PUBLIC CHAMA PAGE
// ----------------------------------------------------------------------

export async function getChamaPublicPage(chamaId) {
  if (!mongoose.isValidObjectId(chamaId)) throw new AppError("This Chama profile is not publicly available", 404);
  const [chama, profile, memberCount, orgKyc, people] = await Promise.all([
    Chama.findById(chamaId).select("name visibility status chama_type createdAt").lean(),
    ChamaProfile.findOne({ chama_id: chamaId }).select(`${CHAMA_PROFILE_SELECT} contribution_cycle meeting_day`).lean(),
    ChamaMembership.countDocuments({ chama_id: chamaId, status: "active" }),
    ChamaOrgKyc.findOne({ chama_id: chamaId }).select("status").lean(),
    ChamaMembership.find({ chama_id: chamaId, status: "active", "public_profile.visibility": "public" })
      .select("role joined_at createdAt public_profile.headline public_profile.visibility public_profile.updated_at user_id")
      .populate("user_id", "name")
      .lean(),
  ]);
  if (!chama || chama.status !== "active" || chama.visibility !== "public" || !profile?.public_profile?.enabled) {
    throw new AppError("This Chama profile is not publicly available", 404);
  }

  // Which of these people actually uploaded a photo? One cheap query that
  // never loads the images themselves.
  const withImage = new Set((await ChamaMembership.find({ _id: { $in: people.map((p) => p._id) }, "public_profile.image_url": { $type: "string", $ne: "" } }).select("_id").lean()).map((p) => String(p._id)));

  const { logo_url, cover_url, enabled, ...rest } = profile.public_profile;
  const cards = people.map((m) => ({
    membership_id: m._id,
    name: m.user_id?.name || "Member",
    role: m.role,
    is_management: MANAGEMENT_ROLES.includes(m.role),
    headline: m.public_profile?.headline || "",
    has_image: withImage.has(String(m._id)),
  }));
  const management = cards.filter((c) => c.is_management).sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));

  return {
    id: chama._id,
    name: chama.name,
    type: chama.chama_type,
    member_count: memberCount,
    created_at: chama.createdAt,
    contribution_cycle: profile.contribution_cycle,
    meeting_day: profile.meeting_day,
    verified: orgKyc?.status === "verified",
    logo_url: logo_url || null,
    cover_url: cover_url || null,
    ...rest,
    management,
    members: cards.filter((c) => !c.is_management),
  };
}

// The chama's own public details, editable at any time by its officials.
// Dedicated and separate from saveProfile on purpose: that route repoints
// money (M-Pesa/bank) and rightly needs a payment PIN; changing a tagline
// or a logo must not.
export async function updateChamaPublicProfile(chamaId, data = {}) {
  const set = {};
  const text = (key, max) => { if (Object.hasOwn(data, key)) set[`public_profile.${key}`] = cleanText(data[key], max); };
  text("description", 1200); text("location", 160); text("purpose", 300); text("tagline", 140);
  if (Object.hasOwn(data, "contact_email")) {
    const email = cleanText(data.contact_email, 254).toLowerCase();
    if (email && !EMAIL.test(email)) throw new AppError("Enter a valid contact email", 400);
    set["public_profile.contact_email"] = email;
  }
  if (Object.hasOwn(data, "website")) set["public_profile.website"] = cleanUrl(data.website);
  if (Object.hasOwn(data, "enabled")) set["public_profile.enabled"] = Boolean(data.enabled);
  if (Object.hasOwn(data, "logo_url")) set["public_profile.logo_url"] = assertImageDataUri(data.logo_url, { label: "Logo", maxChars: IMAGE_LIMITS.logo, required: false });
  if (Object.hasOwn(data, "cover_url")) set["public_profile.cover_url"] = assertImageDataUri(data.cover_url, { label: "Cover image", maxChars: IMAGE_LIMITS.publicCover, required: false });

  if (set["public_profile.enabled"]) {
    const chama = await Chama.findById(chamaId).select("visibility").lean();
    if (chama?.visibility !== "public") throw new AppError("Set the group's visibility to Public before publishing its profile", 400);
  }
  if (!Object.keys(set).length) throw new AppError("Nothing to update", 400);
  return readChamaPublicSettings(chamaId, set);
}

export async function readChamaPublicSettings(chamaId, set) {
  const doc = await ChamaProfile.findOneAndUpdate(
    { chama_id: chamaId },
    set ? { $set: set, $setOnInsert: { chama_id: chamaId } } : { $setOnInsert: { chama_id: chamaId } },
    { returnDocument: "after", upsert: true, runValidators: true }
  ).select(CHAMA_PROFILE_SELECT);
  return doc.public_profile;
}

// ----------------------------------------------------------------------
// MEMBER / MANAGEMENT KYC: documents for review
// ----------------------------------------------------------------------

// The review queue deliberately omits the two big images; a reviewer
// loads them for one person at a time, here. Browsers also refuse to
// navigate to data: URIs, which is why the old "Open ID document"
// links did nothing.
export async function getKycDocuments(chamaId, membershipId) {
  const kyc = await ChamaMemberKyc.findOne({ chama_id: chamaId, membership_id: membershipId }).lean();
  if (!kyc) throw new AppError("KYC submission not found", 404);
  return { id_document_url: kyc.id_document_url, selfie_url: kyc.selfie_url, status: kyc.status };
}

// ----------------------------------------------------------------------
// CHAMA (ORGANISATION) KYC
// ----------------------------------------------------------------------

export async function getOrgKyc(chamaId) {
  const kyc = await ChamaOrgKyc.findOne({ chama_id: chamaId }).lean();
  return kyc ? { ...kyc, has_certificate: Boolean(await ChamaOrgKyc.exists({ chama_id: chamaId, certificate_url: { $type: "string", $ne: "" } })) } : null;
}

export async function submitOrgKyc(chamaId, userId, data = {}) {
  const legal_name = cleanText(data.legal_name, 160);
  if (!legal_name) throw new AppError("Enter the group's registered name", 400);
  if (!ORG_REGISTRATION_TYPES.includes(data.registration_type)) throw new AppError("Choose how the group is registered", 400);
  const registration_number = cleanText(data.registration_number, 60);
  const informal = ["informal", "other"].includes(data.registration_type);
  if (!informal && !registration_number) throw new AppError("Enter the registration number", 400);
  if (!data.officials_confirmed) throw new AppError("Confirm that the officials are authorised to act for the group", 400);

  const existing = await ChamaOrgKyc.findOne({ chama_id: chamaId }).select("status +certificate_url");
  if (existing?.status === "verified") throw new AppError("This group is already verified. Contact support to change verified details.", 409);

  const certificate = assertImageDataUri(data.certificate_url, { label: "Registration certificate or group letter", maxChars: IMAGE_LIMITS.certificate, required: false }) || existing?.certificate_url || null;
  if (!informal && !certificate) throw new AppError("Upload a photo of the registration certificate", 400);
  if (informal && !certificate && cleanText(data.physical_address, 240).length < 5) {
    throw new AppError("For an unregistered group, upload a signed group letter or give the group's address", 400);
  }

  await ChamaOrgKyc.findOneAndUpdate(
    { chama_id: chamaId },
    { $set: {
      legal_name, registration_type: data.registration_type, registration_number,
      kra_pin: cleanText(data.kra_pin, 20).toUpperCase(),
      physical_address: cleanText(data.physical_address, 240),
      contact_phone: cleanText(data.contact_phone, 20),
      certificate_url: certificate, officials_confirmed: true,
      status: "pending", rejection_reason: "", submitted_by: userId, submitted_at: new Date(), reviewed_by: null, reviewed_at: null,
    }, $setOnInsert: { chama_id: chamaId } },
    { upsert: true, runValidators: true }
  );
  return getOrgKyc(chamaId);
}

// ---- platform admin side ----

export async function listOrgKycForAdmin(status = "pending") {
  const filter = ["pending", "verified", "rejected"].includes(status) ? { status } : {};
  const rows = await ChamaOrgKyc.find(filter).sort({ submitted_at: 1 }).limit(200).populate("chama_id", "name").populate("submitted_by", "name phone").lean();
  return rows;
}

export async function getOrgKycForAdmin(chamaId) {
  const row = await ChamaOrgKyc.findOne({ chama_id: chamaId }).select("+certificate_url").populate("chama_id", "name").populate("submitted_by", "name phone").lean();
  if (!row) throw new AppError("No Chama KYC submission found", 404);
  return row;
}

export async function reviewOrgKyc(chamaId, adminUserId, status, reason = "") {
  if (!["verified", "rejected"].includes(status)) throw new AppError("Invalid review status", 400);
  if (status === "rejected" && !String(reason).trim()) throw new AppError("A reason is required when rejecting", 400);
  const row = await ChamaOrgKyc.findOneAndUpdate(
    { chama_id: chamaId },
    { status, rejection_reason: status === "rejected" ? cleanText(reason, 500) : "", reviewed_by: adminUserId, reviewed_at: new Date() },
    { returnDocument: "after" }
  ).lean();
  if (!row) throw new AppError("No Chama KYC submission found", 404);
  return row;
}