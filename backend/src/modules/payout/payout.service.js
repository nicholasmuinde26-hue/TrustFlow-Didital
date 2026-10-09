import mongoose from "mongoose";
import { creditMemberWallet } from "../finance/memberWallet.service.js";

import Payout from "../../models/Payout.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import Chama from "../../models/Chama.js";

import AppError from "../../utils/AppError.js";
import { ingestEvent as ingestSecurityEvent } from "../security/security.service.js";

import accountingService
    from "../finance/accounting/accounting.service.js";


import {
    toDecimal,
    multiplyMoney,
    isMoneyPositive
} from "../../shared/decimal.js";



// ============================================================
// MONGODB TRANSACTION SUPPORT
// ============================================================
//
// Multi-document transactions require a replica set or mongos
// — a plain standalone MongoDB (common in local dev) throws
// "Transaction numbers are only allowed on a replica set
// member or mongos" the moment startTransaction() is called.
// Same guard used in chamaFinance.service.js / financeEngine.
// service.js: only start (and later commit) a transaction when
// the topology actually supports one. The session itself is
// still created and passed to every query either way — plain
// causal-consistency sessions work fine on standalone Mongo,
// it's specifically the transaction that doesn't.
//
// ============================================================

const canUseTransactions = () => {
    const topology = mongoose.connection?.client?.topology;
    const topologyType = topology?.description?.type;
    return (
        topologyType === "ReplicaSetWithPrimary" ||
        topologyType === "Sharded"
    );
};



// ============================================================
// PAYOUT SERVICE
// ============================================================
//
// Business orchestration layer.
//
// Responsibilities:
//
// ✓ Rotation management
// ✓ Payout lifecycle
// ✓ Member selection
// ✓ Payout state changes
// ✓ Calling Accounting Engine
//
// DOES NOT:
//
// ✗ Create journals
// ✗ Create ledger entries
// ✗ Resolve accounts
// ✗ Update balances
//
// ============================================================


const OWNER_TYPE = "Chama";


const DISBURSEMENT_METHODS = [
    "cash",
    "bank",
    "mpesa",
    "wallet"
];


// Every role treated as a Chama "official" for payout governance — able to
// stand in for a recused chairperson/treasurer seat. Kept in one place, same
// list loans use (LOAN_OFFICIAL_ROLES), so approval-chain and eligibility
// checks can't drift apart between the two maker-checker flows.
const PAYOUT_OFFICIAL_ROLES = ["treasurer", "chairperson", "secretary", "auditor", "committee_member"];

// The two seats that must always sign off on a payout, absent a recusal.
const BASE_PAYOUT_APPROVAL_ROLES = ["chairperson", "treasurer"];



const RECIPIENT_POPULATE = {

    path:"member_id",

    select:
        "role payout_position status user_id",

    populate:{

        path:"user_id",

        select:
            "name phone"

    }

};





// ============================================================
// GET MEMBERS ORDERED BY PAYOUT POSITION
// ============================================================

const getOrderedMembers = async (
    chamaId,
    session = null
)=>{


    return ChamaMembership.find({

        chama_id: chamaId,

        status:"active"

    })

    .populate(
        "user_id",
        "name phone"
    )

    .sort({

        payout_position:1

    })

    .session(session);


};






// ============================================================
// GET TREASURER
// ============================================================


const getActiveTreasurerMembership = (
    memberships
)=>{


    return memberships.find(

        membership =>
            membership.role === "treasurer"

    ) || null;


};




// ============================================================
// RESOLVE PAYOUT APPROVAL PLAN — CONFLICT-OF-INTEREST RECUSAL
// ============================================================
//
// "The chairperson and treasurer ran off with the merry-go-round pot" is
// exactly the failure mode maker-checker exists to prevent — but it still
// fails if the person collecting the payout THIS round also happens to be
// one of the two people who sign off on it. So: if the recipient holds
// chairperson or treasurer, that seat is recused and one other independent
// official (secretary / auditor / committee_member — never the recipient)
// must stand in, mirroring ChamaLoan's recusal_quorum_required. Computed
// once at payout creation and stored on the Payout so approvePayout can
// enforce it without re-deriving it on every sign-off.
//
// ============================================================

const resolvePayoutApprovalPlan = async (chamaId, recipientMembership, session) => {

    const recipientRole = recipientMembership.role;
    const recusedRoles = BASE_PAYOUT_APPROVAL_ROLES.filter(role => role === recipientRole);
    const requiredRoles = BASE_PAYOUT_APPROVAL_ROLES.filter(role => role !== recipientRole);

    if (!recusedRoles.length) {
        return { requiredRoles, recusalQuorumRequired: 0 };
    }

    const quorumRequired = 1;

    const availableOfficialsCount = await ChamaMembership.countDocuments({
        chama_id: chamaId,
        _id: { $ne: recipientMembership._id },
        status: "active",
        role: { $in: PAYOUT_OFFICIAL_ROLES },
    }).session(session);

    const neededOfficials = requiredRoles.length + quorumRequired;

    if (availableOfficialsCount < neededOfficials) {
        throw new AppError(
            `This round's payout recipient holds the ${recusedRoles.join(", ")} role and is automatically ` +
            `recused from approving their own payout. This Chama needs ${neededOfficials} other independent ` +
            `official(s) to approve (1 to stand in for the recused seat` +
            `${requiredRoles.length ? ` plus the ${requiredRoles.join(", ")}` : ""}), but only ` +
            `${availableOfficialsCount} are currently available. The payout cannot proceed until enough ` +
            `independent officials are available.`,
            400
        );
    }

    return { requiredRoles, recusalQuorumRequired: quorumRequired };

};







// ============================================================
// VALIDATE DISBURSEMENT METHOD
// ============================================================


const validateDisbursementMethod = (
    method
)=>{


    if(
        !DISBURSEMENT_METHODS.includes(method)
    ){

        throw new AppError(

            `Invalid disbursement method. Supported methods: ${DISBURSEMENT_METHODS.join(", ")}`,

            400

        );

    }


};








// ============================================================
// GET PAYOUT HISTORY
// ============================================================


export const getPayoutHistory = async (
    chamaId
)=>{


    const chama =
        await Chama.findById(chamaId);



    if(!chama){

        throw new AppError(
            "Chama not found",
            404
        );

    }



    return Payout.find({

        chama_id:chamaId

    })

    .populate(
        RECIPIENT_POPULATE
    )

    .sort({

        createdAt:-1

    });


};








// ============================================================
// GET CURRENT PAYOUT
// ============================================================


export const getCurrentPayout = async (
    chamaId
)=>{


    return Payout.findOne({

        chama_id:chamaId,

        status:{ $in: ["pending", "approved"] }

    })

    .populate(
        RECIPIENT_POPULATE
    );


};








// ============================================================
// GET PAYOUT BY ID
// ============================================================


export const getPayoutById = async (
    chamaId,
    payoutId
)=>{


    const payout =
        await Payout.findOne({

            _id:payoutId,

            chama_id:chamaId

        })

        .populate(
            RECIPIENT_POPULATE
        );



    if(!payout){

        throw new AppError(
            "Payout not found",
            404
        );

    }



    return payout;


};

// ============================================================
// START PAYOUT
// ============================================================
//
// Creates payout obligation.
//
// This only creates the operational payout record.
//
// Accounting meaning:
//
// DR Member Contributions
// CR Payout Payable
//
// The Accounting Engine decides the accounts.
//
// ============================================================


export const startPayout = async ({

    chamaId,

    created_by,

    contributionPlanId = null,

    amount: requestedAmount = null,

    roundStart = null,

    posted_by = null,

    session: existingSession = null

}) => {


    if(!created_by){

        throw new AppError(
            "Payout creator is required",
            400
        );

    }



    const ownsSession =
        !existingSession;



    const session =
        existingSession ||
        await mongoose.startSession();




    try {


        if(ownsSession && canUseTransactions()){

            session.startTransaction();

        }




        // ----------------------------------------------------
        // 1. Load Chama
        // ----------------------------------------------------


        const chama =
            await Chama.findById(chamaId)
            .session(session);



        if(!chama){

            throw new AppError(
                "Chama not found",
                404
            );

        }






        // ----------------------------------------------------
        // 2. Check active payout
        // ----------------------------------------------------


        const activePayout =
            await Payout.findOne({

                chama_id: chamaId,

                contribution_plan_id: contributionPlanId,

                status:{ $in: ["pending", "approved"] }

            })

            .session(session);



        if(activePayout){
            return activePayout;
        }






        // ----------------------------------------------------
        // 3. Get members
        // ----------------------------------------------------


        const memberships =
            await getOrderedMembers(

                chamaId,

                session

            );



        if(!memberships.length){

            throw new AppError(
                "No active members found",
                400
            );

        }






        // ----------------------------------------------------
        // 4. Validate treasurer
        // ----------------------------------------------------


        const treasurer =
            getActiveTreasurerMembership(
                memberships
            );



        if(!treasurer){

            throw new AppError(
                "No active treasurer found",
                400
            );

        }







        // ----------------------------------------------------
        // 5. Validate & auto-assign rotation positions
        // ----------------------------------------------------

        const unassigned = memberships.filter(
            member => member.payout_position === null || member.payout_position === undefined
        );

        if (unassigned.length > 0) {
            let maxPos = memberships.reduce(
                (max, m) => Math.max(max, Number(m.payout_position) || 0),
                0
            );
            for (const member of unassigned) {
                maxPos += 1;
                member.payout_position = maxPos;
                await ChamaMembership.updateOne(
                    { _id: member._id },
                    { $set: { payout_position: maxPos } }
                );
            }
        }







        // ----------------------------------------------------
        // 6. Determine next recipient
        // ----------------------------------------------------


        const lastPayout =
            await Payout.findOne({

                chama_id: chamaId,

                contribution_plan_id: contributionPlanId,

                status:"paid"

            })

            .sort({

                payout_position:-1

            })

            .session(session);



        let nextPosition = 1;



        if(lastPayout){


            nextPosition =

                lastPayout.payout_position
                >= memberships.length

                ? 1

                : lastPayout.payout_position + 1;


        }






        const recipient =
            memberships.find(

                member =>

                    member.payout_position === nextPosition

            );



        if(!recipient){

            throw new AppError(

                `No member exists at payout position ${nextPosition}`,

                400

            );

        }








        // ----------------------------------------------------
        // 7. Calculate payout amount
        // ----------------------------------------------------


        const amount = requestedAmount === null
            ? multiplyMoney(toDecimal(chama.monthly_savings), memberships.length)
            : toDecimal(requestedAmount);




        if(!isMoneyPositive(amount)){

            throw new AppError(
                "Invalid payout amount",
                400
            );

        }







        // ----------------------------------------------------
        // 7b. Resolve the approval plan (conflict-of-interest recusal)
        // ----------------------------------------------------


        const approvalPlan =
            await resolvePayoutApprovalPlan(
                chamaId,
                recipient,
                session
            );




        // ----------------------------------------------------
        // 8. Create payout record
        // ----------------------------------------------------


        const [payout] =

            await Payout.create(

                [{

                    chama_id:chamaId,

                    contribution_plan_id: contributionPlanId,

                    round_start: roundStart,

                    member_id:
                        recipient._id,


                    payout_position:
                        nextPosition,


                    amount:

                        mongoose.Types
                        .Decimal128
                        .fromString(
                            amount.toFixed()
                        ),


                    currency:"KES",

                    status:"pending",

                    required_approval_roles:
                        approvalPlan.requiredRoles,

                    recusal_quorum_required:
                        approvalPlan.recusalQuorumRequired

                }],

                {
                    session
                }

            );








        // ----------------------------------------------------
        // 9. Send event to accounting engine
        // ----------------------------------------------------


        const result =

            await accountingService.post({

                referenceType:
                    "PAYOUT_OBLIGATION",
                contribution_plan_id: contributionPlanId,


                owner_type:
                    OWNER_TYPE,


                owner_id:
                    chamaId,


                amount,


                currency:"KES",


                source_type:
                    "Payout",


                source_id:
                    payout._id,



                description:

                    `Payout obligation created for ${recipient._id}`,



                created_by,


                posted_by:
                    posted_by || created_by,



                session


            });









        // ----------------------------------------------------
        // 10. Link journal
        // ----------------------------------------------------


        payout.obligation_transaction_id =

            result.transactionId;



        await payout.save({
            session
        });








        if(ownsSession && session.inTransaction()){

            await session.commitTransaction();

        }

        // TrustOS observes the payout as it happens. Security telemetry must
        // never make a legitimate accounting operation unavailable, so an
        // ingestion failure is isolated; the event pipeline can retry from
        // audit/accounting records when a production event bus is attached.
        try {
            await ingestSecurityEvent({
                eventType: "PAYOUT.CREATED",
                actor: { userId: created_by, role: "TREASURER" },
                workspace: { type: "CHAMA", id: chamaId },
                transaction: {
                    amount: Number(amount.toString()),
                    currency: "KES",
                    recipientId: String(recipient.user_id || recipient._id),
                },
                metadata: { payoutId: String(payout._id) },
            });
        } catch (securityTelemetryError) {
            console.error("TrustOS telemetry failed for payout", securityTelemetryError.message);
        }




        return await Payout.findById(
            payout._id
        )

        .populate(
            RECIPIENT_POPULATE
        );




    }
    catch(error){


        if(
            ownsSession &&
            session.inTransaction()
        ){

            await session.abortTransaction();

        }


        throw error;


    }
    finally{


        if(ownsSession){

            await session.endSession();

        }


    }


};

// ============================================================
// APPROVE PAYOUT
// ============================================================
//
// PHASE 1.5 — 2-OF-N COMMITTEE APPROVAL
//
// A real Chama doesn't let the person who
// controls the money also be the sole
// authority on when it moves — and it can't
// let ONE person from that committee move it
// alone either. Before the Treasurer can mark
// a payout as disbursed, every role in
// payout.required_approval_roles must sign
// off (chairperson AND treasurer, by default)
// — the same maker-checker pattern loan
// disbursement already uses.
//
// If the recipient themself holds one of
// those seats this round, that seat is
// recused and an independent official
// (secretary / auditor / committee_member)
// must stand in — see resolvePayoutApprovalPlan.
//
// This does NOT move money and does NOT
// touch the ledger — it only flips the
// Payout from 'pending' to 'approved' once
// the full quorum is in, which is the gate
// markPayoutPaid checks below.
//
// ============================================================


export const approvePayout = async ({

    chamaId,

    payoutId,

    membership,

    comment = '',

    ipAddress = null,

    session: existingSession = null

}) => {


    if(!membership || !membership._id){

        throw new AppError(
            "Approving member is required",
            400
        );

    }



    const ownsSession =
        !existingSession;



    const session =
        existingSession ||
        await mongoose.startSession();




    try {


        if(ownsSession && canUseTransactions()){

            session.startTransaction();

        }




        // ----------------------------------------------------
        // 1. Find payout
        // ----------------------------------------------------


        const payout =

            await Payout.findOne({

                _id:payoutId,

                chama_id:chamaId

            })

            .session(session);



        if(!payout){

            throw new AppError(
                "Payout not found",
                404
            );

        }




        // ----------------------------------------------------
        // 2. Validate state
        // ----------------------------------------------------


        if(payout.status !== "pending"){


            throw new AppError(

                payout.status === "approved"

                ? "This payout has already been approved"

                : `Cannot approve payout. Current status: ${payout.status}`,

                400

            );

        }




        // ----------------------------------------------------
        // 3. Conflict-of-interest recusal — the recipient can
        //    never approve their own payout, committee seat or not.
        // ----------------------------------------------------


        if(String(payout.member_id) === String(membership._id)){

            throw new AppError(
                "Conflict of interest recusal: You cannot approve your own payout.",
                403
            );

        }




        // ----------------------------------------------------
        // 4. Role eligibility — must hold a still-required seat,
        //    or be standing in for a recused one.
        // ----------------------------------------------------


        const requiredRoles =
            (payout.required_approval_roles && payout.required_approval_roles.length > 0)
                ? payout.required_approval_roles
                : BASE_PAYOUT_APPROVAL_ROLES;

        const quorumRequired =
            Number(payout.recusal_quorum_required || 0);

        const isOfficial =
            PAYOUT_OFFICIAL_ROLES.includes(membership.role);

        const isEligibleApprover =
            requiredRoles.includes(membership.role) ||
            (quorumRequired > 0 && isOfficial);


        if(!isEligibleApprover){

            throw new AppError(
                `Your role (${membership.role}) is not part of the approval chain for this payout`,
                403
            );

        }




        // ----------------------------------------------------
        // 5. One sign-off per official
        // ----------------------------------------------------


        const alreadyDecided =
            payout.approvals.some(
                a => String(a.membership_id) === String(membership._id)
            );

        if(alreadyDecided){

            throw new AppError(
                "You have already recorded a decision for this payout",
                400
            );

        }




        // ----------------------------------------------------
        // 6. Record this sign-off
        // ----------------------------------------------------


        payout.approvals.push({
            membership_id: membership._id,
            role: membership.role,
            decision: 'approved',
            comment: comment || null,
            decided_at: new Date(),
            ip_address: ipAddress || null,
        });




        // ----------------------------------------------------
        // 7. Evaluate whether the full quorum is now in
        // ----------------------------------------------------


        const approvedDecisions =
            payout.approvals.filter(a => a.decision === 'approved');

        const approvedRoles =
            new Set(approvedDecisions.map(a => a.role));

        const allRequiredRolesApproved =
            requiredRoles.every(role => approvedRoles.has(role));

        let quorumMet = true;

        if(quorumRequired > 0){

            const quorumFillers = new Set(
                approvedDecisions
                    .filter(a => !requiredRoles.includes(a.role))
                    .map(a => String(a.membership_id))
            );

            quorumMet = quorumFillers.size >= quorumRequired;

        }


        if(allRequiredRolesApproved && quorumMet){

            payout.status = "approved";
            payout.approved_by = membership._id;
            payout.approved_at = new Date();

        }



        await payout.save({
            session
        });



        if(ownsSession && session.inTransaction()){

            await session.commitTransaction();

        }



        return await Payout.findById(

            payout._id

        )

        .populate(

            RECIPIENT_POPULATE

        );


    }
    catch(error){



        if(
            ownsSession &&
            session.inTransaction()
        ){

            await session.abortTransaction();

        }



        throw error;


    }
    finally{



        if(ownsSession){

            await session.endSession();

        }


    }


};


// ============================================================
// MARK PAYOUT PAID
// ============================================================
//
// PHASE 2 — SETTLEMENT
//
// Records that the treasurer has already
// disbursed the money.
//
// This does NOT send money.
//
// It only records accounting:
//
// DR Payout Payable
// CR Cash / Bank / Mpesa
//
// Accounting is handled by:
// payout settlement rule
//
// ============================================================


export const markPayoutPaid = async ({

    chamaId,

    payoutId,

    disbursement_method,

    external_reference = null,

    created_by,

    posted_by = null,

    session: existingSession = null

}) => {


    if(!created_by){

        throw new AppError(
            "Payout settler is required",
            400
        );

    }



    validateDisbursementMethod(
        disbursement_method
    );




    const ownsSession =
        !existingSession;



    const session =
        existingSession ||
        await mongoose.startSession();




    try {


        if(ownsSession && canUseTransactions()){

            session.startTransaction();

        }





        // ----------------------------------------------------
        // 1. Find payout
        // ----------------------------------------------------


        const payout =
            await Payout.findOne({

                _id:payoutId,

                chama_id:chamaId

            })

            .session(session);




        if(!payout){

            throw new AppError(
                "Payout not found",
                404
            );

        }






        // ----------------------------------------------------
        // 2. Validate state
        // ----------------------------------------------------


        if(payout.status !== "approved"){


            throw new AppError(

                payout.status === "pending"

                ? "This payout must be approved by the chairperson before it can be paid"

                : `Cannot settle payout. Current status: ${payout.status}`,

                400

            );

        }







        // ----------------------------------------------------
        // 3. Verify recipient membership
        // ----------------------------------------------------


        const membership =

            await ChamaMembership.findOne({

                _id:payout.member_id,

                chama_id:chamaId,

                status:"active"

            })

            .session(session);




        if(!membership){

            throw new AppError(
                "Payout recipient is not active",
                400
            );

        }








        // ----------------------------------------------------
        // 4. Accounting settlement
        // ----------------------------------------------------
        //
        // Accounting engine decides:
        //
        // DR Payout Payable
        // CR Cash / Bank / Mpesa
        //
        // ----------------------------------------------------



        const amount =
            toDecimal(
                payout.amount
            );




        const result =

            await accountingService.post({

                referenceType:
                    "PAYOUT_SETTLEMENT",



                owner_type:
                    OWNER_TYPE,



                owner_id:
                    chamaId,



                amount,



                currency:
                    payout.currency,



                source_type:
                    "Payout",



                source_id:
                    payout._id,



                description:

                    `Payout settled via ${disbursement_method}`,



                metadata:{

                        wallet_destination: disbursement_method === "wallet",

                    external_reference

                },



                created_by,



                posted_by:
                    posted_by || created_by,



                session

            });









        // ----------------------------------------------------
        // 5. Update payout state
        // ----------------------------------------------------


        payout.status =
            "paid";


        payout.paid_at =
            new Date();


        payout.disbursement_method =
            disbursement_method;


        payout.external_reference =
            external_reference;

        if (disbursement_method === "wallet") {
            await creditMemberWallet({
                userId: membership.user_id,
                amount,
                sourceType: "Payout",
                sourceId: payout._id,
                createdBy: created_by,
                externalReference: external_reference,
                session,
            });
        }



        payout.financial_transaction_id =
            result.transactionId;



        await payout.save({
            session
        });










        if(ownsSession && session.inTransaction()){

            await session.commitTransaction();

        }





        return await Payout.findById(
            payout._id
        )

        .populate(
            RECIPIENT_POPULATE
        );






    }
    catch(error){


        if(
            ownsSession &&
            session.inTransaction()
        ){

            await session.abortTransaction();

        }


        throw error;


    }
    finally{


        if(ownsSession){

            await session.endSession();

        }


    }


};

// ============================================================
// CANCEL PAYOUT
// ============================================================
//
// Cancels a pending payout.
//
// A payout can only be cancelled before settlement.
//
// Accounting reversal:
//
// Original:
//
// DR Member Contributions
// CR Payout Payable
//
//
// Reverse:
//
// DR Payout Payable
// CR Member Contributions
//
// Accounting engine handles the entries.
//
// ============================================================


export const cancelPayout = async ({

    chamaId,

    payoutId,

    created_by,

    posted_by = null,

    reason = null,

    session: existingSession = null

}) => {


    if(!created_by){

        throw new AppError(
            "Payout canceller is required",
            400
        );

    }




    const ownsSession =
        !existingSession;



    const session =
        existingSession ||
        await mongoose.startSession();





    try {



        if(ownsSession && canUseTransactions()){

            session.startTransaction();

        }






        // ----------------------------------------------------
        // 1. Find payout
        // ----------------------------------------------------


        const payout =

            await Payout.findOne({

                _id:payoutId,

                chama_id:chamaId

            })

            .session(session);




        if(!payout){

            throw new AppError(
                "Payout not found",
                404
            );

        }







        // ----------------------------------------------------
        // 2. Validate state
        // ----------------------------------------------------


        if(
            payout.status !== "pending" &&
            payout.status !== "approved"
        ){


            throw new AppError(

                `Cannot cancel payout. Current status: ${payout.status}`,

                400

            );

        }








        // ----------------------------------------------------
        // 3. Reverse accounting
        // ----------------------------------------------------
        //
        // Accounting engine handles:
        //
        // DR Payout Payable
        // CR Member Contributions
        //
        // ----------------------------------------------------



        if(payout.obligation_transaction_id){


            const amount =

                toDecimal(
                    payout.amount
                );




            await accountingService.post({


                referenceType:
                    "PAYOUT_CANCELLATION",
                contribution_plan_id: payout.contribution_plan_id,



                owner_type:
                    OWNER_TYPE,



                owner_id:
                    chamaId,



                amount,



                currency:
                    payout.currency,



                source_type:
                    "Payout",



                source_id:
                    payout._id,



                description:

                    reason

                    ? `Payout cancelled: ${reason}`

                    : "Payout cancelled",




                metadata:{


                    reversedTransaction:

                        payout.obligation_transaction_id


                },



                created_by,



                posted_by:
                    posted_by || created_by,



                reversed_transaction_id:

                    payout.obligation_transaction_id,



                session


            });


        }








        // ----------------------------------------------------
        // 4. Update payout state
        // ----------------------------------------------------


        payout.status =
            "cancelled";


        payout.cancelled_at =
            new Date();




        await payout.save({
            session
        });








        if(ownsSession && session.inTransaction()){

            await session.commitTransaction();

        }








        return await Payout.findById(

            payout._id

        )

        .populate(

            RECIPIENT_POPULATE

        );






    }
    catch(error){



        if(
            ownsSession &&
            session.inTransaction()
        ){

            await session.abortTransaction();

        }



        throw error;



    }
    finally{



        if(ownsSession){

            await session.endSession();

        }


    }


};
