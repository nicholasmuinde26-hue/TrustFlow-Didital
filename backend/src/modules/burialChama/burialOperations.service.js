import mongoose from "mongoose";
import BurialChamaProfile from "../../models/BurialChamaProfile.js";
import BurialCase from "../../models/BurialCase.js";
import BurialFundraisingCampaign from "../../models/BurialFundraisingCampaign.js";
import { BurialEquipment, BurialEquipmentBooking } from "../../models/BurialEquipmentHire.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import AppError from "../../utils/AppError.js";
import accountingService from "../finance/accounting/accounting.service.js";

const objectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const positive = (value, name) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new AppError(`${name} must be greater than zero`, 400);
  return n;
};

async function requireBurialProfile(chamaId) {
  if (!objectId(chamaId)) throw new AppError("Burial chama not found", 404);
  const profile = await BurialChamaProfile.findOne({ chama_id: chamaId }).select("_id chama_id").lean();
  if (!profile) throw new AppError("Burial chama profile not found", 404);
  return profile;
}

class BurialOperationsService {
  async listCampaigns(chamaId) {
    await requireBurialProfile(chamaId);
    return BurialFundraisingCampaign.find({ chama_id: chamaId })
      .select("chama_id case_id title description target_amount raised_amount deadline status createdAt updatedAt")
      .sort({ createdAt: -1 }).lean();
  }

  async createCampaign(chamaId, actorId, input = {}) {
    await requireBurialProfile(chamaId);
    const title = String(input.title || "").trim();
    if (title.length < 3) throw new AppError("Campaign title must be at least 3 characters", 400);
    const target = positive(input.target_amount ?? input.target, "Target amount");
    let caseId = null;
    if (input.case_id || input.linkedCaseId) {
      caseId = input.case_id || input.linkedCaseId;
      if (!objectId(caseId) || !await BurialCase.exists({ _id: caseId, chama_id: chamaId })) {
        throw new AppError("The selected burial case does not belong to this chama", 404);
      }
    }
    return BurialFundraisingCampaign.create({
      chama_id: chamaId, case_id: caseId, title, target_amount: target,
      description: String(input.description || "").trim(),
      deadline: input.deadline ? new Date(input.deadline) : null,
      created_by: actorId,
    });
  }

  async recordCampaignContribution(chamaId, campaignId, actorId, input = {}) {
    await requireBurialProfile(chamaId);
    const amount = positive(input.amount, "Contribution amount");
    const method = String(input.method || "cash").toLowerCase();
    if (!["cash", "mpesa", "bank"].includes(method)) throw new AppError("Choose cash, M-Pesa or bank as the payment method", 400);
    const campaign = await BurialFundraisingCampaign.findOne({ _id: campaignId, chama_id: chamaId, status: "active" });
    if (!campaign) throw new AppError("Active fundraising campaign not found", 404);
    if (input.reference && campaign.contributions.some((row) => row.reference && row.reference.toLowerCase() === String(input.reference).trim().toLowerCase())) {
      throw new AppError("That payment reference is already recorded for this campaign", 409);
    }
    if (input.reference && await FinancialTransaction.exists({ owner_type: "Chama", owner_id: chamaId, external_reference: String(input.reference).trim(), status: "posted" })) {
      throw new AppError("That payment reference is already in the chama books", 409);
    }
    const contribution = campaign.contributions.create({
      donor_name: input.anonymous ? "" : String(input.donor_name || "").trim(),
      anonymous: Boolean(input.anonymous), amount, method,
      reference: String(input.reference || "").trim(), received_by: actorId,
    });
    campaign.contributions.push(contribution);
    await campaign.save();
    try {
      await accountingService.post({
        owner_type: "Chama", owner_id: chamaId, created_by: actorId, recordedBy: actorId,
        transactionType: "burial_fundraising_receipt", referenceType: "BURIAL_FUNDRAISING_RECEIPT",
        source_type: "BurialFundraisingContribution", source_id: contribution._id,
        campaignId: campaign._id, contributionId: contribution._id, collectionMethod: method,
        amount, currency: "KES", externalReference: contribution.reference || undefined,
        description: `Harambee receipt for ${campaign.title}`,
      });
    } catch (error) {
      await BurialFundraisingCampaign.updateOne(
        { _id: campaign._id, chama_id: chamaId, "contributions._id": contribution._id },
        { $set: { "contributions.$.status": "failed" } },
      );
      throw error;
    }
    const updated = await BurialFundraisingCampaign.findOne({ _id: campaign._id, chama_id: chamaId });
    if (updated.raised_amount >= updated.target_amount) {
      updated.status = "completed";
      updated.closed_at = new Date();
      await updated.save();
    }
    return updated;
  }

  async createEquipment(chamaId, actorId, input = {}) {
    await requireBurialProfile(chamaId);
    const name = String(input.name || "").trim();
    if (name.length < 2) throw new AppError("Equipment name is required", 400);
    const quantity = positive(input.quantity, "Quantity");
    if (!Number.isInteger(quantity)) throw new AppError("Quantity must be a whole number", 400);
    const rate = Number(input.daily_rate ?? input.dailyRate);
    if (!Number.isFinite(rate) || rate < 0) throw new AppError("Daily rate cannot be negative", 400);
    return BurialEquipment.create({
      chama_id: chamaId,
      chama_asset_id: input.chama_asset_id && objectId(input.chama_asset_id) ? input.chama_asset_id : null,
      name, quantity, daily_rate: rate,
      deposit_amount: Math.max(0, Number(input.deposit_amount || 0)),
      description: String(input.description || "").trim(), created_by: actorId,
    });
  }

  async listEquipment(chamaId) {
    await requireBurialProfile(chamaId);
    const assets = await BurialEquipment.find({ chama_id: chamaId }).sort({ name: 1 }).lean();
    const now = new Date();
    const bookings = await BurialEquipmentBooking.find({ chama_id: chamaId, status: { $in: ["confirmed", "issued", "overdue"] }, event_date: { $lte: now }, due_back_at: { $gt: now } }).select("equipment_id quantity event_date due_back_at status").lean();
    const occupied = new Map();
    bookings.forEach((booking) => occupied.set(String(booking.equipment_id), (occupied.get(String(booking.equipment_id)) || 0) + Number(booking.quantity || 0)));
    return assets.map((asset) => ({ ...asset, on_hire: occupied.get(String(asset._id)) || 0, available_quantity: Math.max(0, asset.quantity - (occupied.get(String(asset._id)) || 0)) }));
  }

  async listEquipmentBookings(chamaId, role) {
    await requireBurialProfile(chamaId);
    const bookings = await BurialEquipmentBooking.find({ chama_id: chamaId }).populate("equipment_id", "name daily_rate").sort({ event_date: -1 }).lean();
    if (["chairperson", "treasurer"].includes(String(role || "").toLowerCase())) return bookings;
    return bookings.map(({ hirer_phone: _privatePhone, ...booking }) => booking);
  }

  async createEquipmentBooking(chamaId, actorId, input = {}) {
    await requireBurialProfile(chamaId);
    if (!objectId(input.equipment_id)) throw new AppError("Choose equipment to book", 400);
    const equipment = await BurialEquipment.findOne({ _id: input.equipment_id, chama_id: chamaId, status: "active" });
    if (!equipment) throw new AppError("Active equipment was not found in this chama", 404);
    const quantity = positive(input.quantity || 1, "Quantity");
    if (!Number.isInteger(quantity)) throw new AppError("Quantity must be a whole number", 400);
    const start = new Date(input.event_date || input.eventDate);
    const days = positive(input.days || 1, "Hire duration");
    if (!Number.isInteger(days)) throw new AppError("Hire duration must be a whole number of days", 400);
    if (Number.isNaN(start.getTime())) throw new AppError("Enter a valid event date", 400);
    const end = new Date(start.getTime() + days * 86400000);
    const overlaps = await BurialEquipmentBooking.find({
      chama_id: chamaId, equipment_id: equipment._id,
      status: { $in: ["confirmed", "issued", "overdue"] },
      event_date: { $lt: end }, due_back_at: { $gt: start },
    }).select("quantity").lean();
    const reserved = overlaps.reduce((sum, booking) => sum + Number(booking.quantity || 0), 0);
    if (reserved + quantity > equipment.quantity) throw new AppError("Not enough units are available for those dates", 409);
    const amount = Number(input.amount || equipment.daily_rate * days * quantity);
    if (!Number.isFinite(amount) || amount < 0) throw new AppError("Hire amount cannot be negative", 400);
    if (!String(input.hirer_name || input.hirer || "").trim()) throw new AppError("Hirer name is required", 400);
    const paymentReference = String(input.payment_reference || "").trim();
    if (paymentReference && await FinancialTransaction.exists({ owner_type: "Chama", owner_id: chamaId, external_reference: paymentReference, status: "posted" })) {
      throw new AppError("That payment reference is already in the chama books", 409);
    }
    const paymentMethod = String(input.payment_method || input.paymentMethod || "unpaid").toLowerCase();
    if (!["cash", "mpesa", "bank", "unpaid"].includes(paymentMethod)) throw new AppError("Choose a supported payment method", 400);
    const booking = await BurialEquipmentBooking.create({
      chama_id: chamaId, equipment_id: equipment._id,
      hirer_name: String(input.hirer_name || input.hirer || "").trim(),
      hirer_phone: String(input.hirer_phone || input.phone || "").trim(),
      event_date: start, due_back_at: end, quantity, amount,
      deposit_amount: Math.max(0, Number(input.deposit_amount || 0)),
      payment_method: "unpaid",
      payment_reference: String(input.payment_reference || "").trim(), issued_by: actorId,
    });
    if (paymentMethod !== "unpaid" && amount + Number(input.deposit_amount || 0) > 0) {
      try {
        await accountingService.post({
          owner_type: "Chama", owner_id: chamaId, created_by: actorId, recordedBy: actorId,
          transactionType: "equipment_hire_payment", referenceType: "EQUIPMENT_HIRE_PAYMENT",
          source_type: "BurialEquipmentBooking", source_id: booking._id, bookingId: booking._id,
          collectionMethod: paymentMethod, hireAmount: amount, depositAmount: Number(input.deposit_amount || 0),
          amount: amount + Number(input.deposit_amount || 0), currency: "KES",
          externalReference: paymentReference || undefined,
          description: `Equipment hire from ${booking.hirer_name}`,
        });
        booking.payment_method = paymentMethod;
        await booking.save();
      } catch (error) {
        booking.status = "cancelled";
        booking.return_notes = `Payment posting failed: ${String(error.message || "").slice(0, 800)}`;
        await booking.save();
        throw error;
      }
    }
    return booking;
  }

  async returnEquipment(chamaId, bookingId, input = {}) {
    const booking = await BurialEquipmentBooking.findOne({ _id: bookingId, chama_id: chamaId });
    if (!booking) throw new AppError("Equipment booking not found", 404);
    if (["returned", "cancelled"].includes(booking.status)) throw new AppError("This booking is already closed", 409);
    booking.status = "returned";
    booking.returned_at = new Date();
    booking.return_notes = String(input.notes || "").trim();
    await booking.save();
    return booking;
  }
}

export default new BurialOperationsService();
