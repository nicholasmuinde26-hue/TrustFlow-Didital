import mongoose from "mongoose";
import crypto from "node:crypto";

import Payout from "../../models/Payout.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import Chama from "../../models/Chama.js";
import AppError from "../../utils/AppError.js";
import accountingService from "../finance/accounting/accounting.service.js";

import {
    toDecimal,
    multiplyMoney,
    isMoneyPositive
} from "../../shared/decimal.js";

// ============================================================
// PAYOUT SERVICE
// ============================================================

const OWNER_TYPE = "Chama";

const DISBURSEMENT_METHODS = [
    "cash",
    "bank",
    "mpesa"
];

const RECIPIENT_POPULATE = {
    path:"member_id",
    select:"role payout_position status user_id",
    populate:{ path:"user_id", select:"name phone" }
};

// ============================================================
// GET MEMBERS ORDERED BY PAYOUT POSITION
// ============================================================
const getOrderedMembers = async (chamaId)=>{
    return ChamaMembership.find({
        chama_id: chamaId,
        status:"active"
    })
   .populate("user_id", "name phone")
   .sort({ payout_position:1 });
};

// ============================================================
// GET TREASURER
// ============================================================
const getActiveTreasurerMembership = (memberships)=>{
    return memberships.find(membership => membership.role === "treasurer") || null;
};

// ============================================================
// VALIDATE DISBURSEMENT METHOD
// ============================================================
const validateDisbursementMethod = (method)=>{
    if(!DISBURSEMENT_METHODS.includes(method)){
        throw new AppError(`Invalid disbursement method. Supported methods: ${DISBURSEMENT_METHODS.join(", ")}`, 400);
    }
};

// ============================================================
// GET PAYOUT HISTORY
// ============================================================
export const getPayoutHistory = async (chamaId)=>{
    const chama = await Chama.findById(chamaId);
    if(!chama){
        throw new AppError("Chama not found", 404);
    }

    return Payout.find({ chama_id:chamaId })
   .populate(RECIPIENT_POPULATE)
   .sort({ createdAt:-1 });
};

// ============================================================
// GET CURRENT PAYOUT
// ============================================================
export const getCurrentPayout = async (chamaId)=>{
    return Payout.findOne({
        chama_id:chamaId,
        status:"pending"
    }).populate(RECIPIENT_POPULATE);
};

// ============================================================
// GET PAYOUT BY ID
// ============================================================
export const getPayoutById = async (chamaId, payoutId)=>{
    const payout = await Payout.findOne({
        _id:payoutId,
        chama_id:chamaId
    }).populate(RECIPIENT_POPULATE);

    if(!payout){
        throw new AppError("Payout not found", 404);
    }
    return payout;
};

// ============================================================
// START PAYOUT
// ============================================================
export const startPayout = async ({
    chamaId,
    created_by,
    contributionPlanId = null,
    amount: requestedAmount = null,
    roundStart = null,
    posted_by = null,
}) => {

    if(!created_by){
        throw new AppError("Payout creator is required", 400);
    }

    // 1. Load Chama
    const chama = await Chama.findById(chamaId);
    if(!chama){
        throw new AppError("Chama not found", 404);
    }

    // 2. Check active payout
    const activePayout = await Payout.findOne({
        chama_id: chamaId,
        contribution_plan_id: contributionPlanId,
        status:"pending"
    });
    if(activePayout){
        throw new AppError("There is already an active payout", 409);
    }

    // 3. Get members
    const memberships = await getOrderedMembers(chamaId);
    if(!memberships.length){
        throw new AppError("No active members found", 400);
    }

    // 4. Validate treasurer
    const treasurer = getActiveTreasurerMembership(memberships);
    if(!treasurer){
        throw new AppError("No active treasurer found", 400);
    }

    // 5. FORCE RE-SEQUENCE: 1..N to fix duplicates and nulls
    // Sort by old position first, then by join date as tiebreaker
    const sorted = [...memberships].sort((a, b) => {
        const pa = a.payout_position || 9999;
        const pb = b.payout_position || 9999;
        if(pa !== pb) return pa - pb;
        return new Date(a.joined_at) - new Date(b.joined_at);
    });

    const updates = sorted.map((member, index) => {
        const newPosition = index + 1;
        if (member.payout_position !== newPosition) {
            member.payout_position = newPosition;
            return member.save();
        }
        return null;
    }).filter(Boolean);

    if(updates.length > 0){
        await Promise.all(updates);
    }

    // Use the sorted + updated list going forward
    const finalMembers = sorted;

    // 6. Determine next recipient
    const lastPayout = await Payout.findOne({
        chama_id: chamaId,
        contribution_plan_id: contributionPlanId,
        status:"paid"
    }).sort({ payout_position:-1 });

    let nextPosition = 1;
    if(lastPayout){
        nextPosition = lastPayout.payout_position >= finalMembers.length? 1 : lastPayout.payout_position + 1;
    }

    const recipient = finalMembers.find(member => member.payout_position === nextPosition);
    if(!recipient){
        throw new AppError(`No member exists at payout position ${nextPosition}`, 400);
    }

    // 7. Calculate payout amount
    const amount = requestedAmount === null
       ? multiplyMoney(toDecimal(chama.monthly_savings), finalMembers.length)
        : toDecimal(requestedAmount);

    if(!isMoneyPositive(amount)){
        throw new AppError("Invalid payout amount", 400);
    }

    // 8. Create payout record
    const [payout] = await Payout.create([{
        chama_id:chamaId,
        contribution_plan_id: contributionPlanId,
        round_start: roundStart,
        member_id: recipient._id,
        payout_position: nextPosition,
        amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
        currency:"KES",
        status:"pending",
        reference: `PAYOUT-${chamaId}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    }]);

    // 9. Send event to accounting engine
    const result = await accountingService.post({
        referenceType: "PAYOUT_OBLIGATION",
        owner_type: OWNER_TYPE,
        owner_id: chamaId,
        amount,
        currency:"KES",
        source_type: "Payout",
        source_id: payout._id,
        description: `Payout obligation created for ${recipient.user_id?.name || recipient._id}`,
        created_by,
        posted_by: posted_by || created_by,
    });

    // 10. Link journal
    payout.obligation_transaction_id = result.transactionId;
    await payout.save();

    return await Payout.findById(payout._id).populate(RECIPIENT_POPULATE);
};
// ============================================================
// MARK PAYOUT PAID
// ============================================================
export const markPayoutPaid = async ({
    chamaId,
    payoutId,
    disbursement_method,
    external_reference = null,
    created_by,
    posted_by = null,
}) => {

    if(!created_by){
        throw new AppError("Payout settler is required", 400);
    }

    validateDisbursementMethod(disbursement_method);

    // REMOVED ALL SESSION CODE

    // 1. Find payout
    const payout = await Payout.findOne({ _id:payoutId, chama_id:chamaId });
    if(!payout){
        throw new AppError("Payout not found", 404);
    }

    // 2. Validate state
    if(payout.status!== "pending"){
        throw new AppError(`Cannot settle payout. Current status: ${payout.status}`, 400);
    }

    // 3. Verify recipient membership
    const membership = await ChamaMembership.findOne({
        _id:payout.member_id,
        chama_id:chamaId,
        status:"active"
    });
    if(!membership){
        throw new AppError("Payout recipient is not active", 400);
    }

    // 4. Accounting settlement
    const amount = toDecimal(payout.amount);

    const result = await accountingService.post({
        referenceType: "PAYOUT_SETTLEMENT",
        owner_type: OWNER_TYPE,
        owner_id: chamaId,
        amount,
        currency: payout.currency,
        source_type: "Payout",
        source_id: payout._id,
        description: `Payout settled via ${disbursement_method}`,
        metadata:{ disbursement_method, external_reference },
        created_by,
        posted_by: posted_by || created_by,
        // REMOVED: session
    });

    // 5. Update payout state
    payout.status = "paid";
    payout.paid_at = new Date();
    payout.disbursement_method = disbursement_method;
    payout.external_reference = external_reference;
    payout.financial_transaction_id = result.transactionId;
    await payout.save();

    return await Payout.findById(payout._id).populate(RECIPIENT_POPULATE);
};

// ============================================================
// CANCEL PAYOUT
// ============================================================
export const cancelPayout = async ({
    chamaId,
    payoutId,
    created_by,
    posted_by = null,
    reason = null,
}) => {

    if(!created_by){
        throw new AppError("Payout canceller is required", 400);
    }

    // REMOVED ALL SESSION CODE

    // 1. Find payout
    const payout = await Payout.findOne({ _id:payoutId, chama_id:chamaId });
    if(!payout){
        throw new AppError("Payout not found", 404);
    }

    // 2. Validate state
    if(payout.status!== "pending"){
        throw new AppError(`Cannot cancel payout. Current status: ${payout.status}`, 400);
    }

    // 3. Reverse accounting
    if(payout.obligation_transaction_id){
        const amount = toDecimal(payout.amount);

        await accountingService.post({
            referenceType: "PAYOUT_CANCELLATION",
            owner_type: OWNER_TYPE,
            owner_id: chamaId,
            amount,
            currency: payout.currency,
            source_type: "Payout",
            source_id: payout._id,
            description: reason? `Payout cancelled: ${reason}` : "Payout cancelled",
            metadata:{ reversedTransaction: payout.obligation_transaction_id },
            created_by,
            posted_by: posted_by || created_by,
            reversed_transaction_id: payout.obligation_transaction_id,
            // REMOVED: session
        });
    }

    // 4. Update payout state
    payout.status = "cancelled";
    payout.cancelled_at = new Date();
    await payout.save();

    return await Payout.findById(payout._id).populate(RECIPIENT_POPULATE);
};