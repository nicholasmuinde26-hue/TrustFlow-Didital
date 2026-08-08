import mongoose from "mongoose";

import Payout from "../../models/Payout.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import Chama from "../../models/Chama.js";

import AppError from "../../utils/AppError.js";

import accountingService
    from "../finance/accounting/accounting.service.js";


import {
    toDecimal,
    multiplyMoney,
    isMoneyPositive
} from "../../shared/decimal.js";



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
    "mpesa"
];



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

        status:"pending"

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


        if(ownsSession){

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

                status:"pending"

            })

            .session(session);



        if(activePayout){

            throw new AppError(
                "There is already an active payout",
                409
            );

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
        // 5. Validate rotation positions
        // ----------------------------------------------------


        const invalidMember =
            memberships.find(

                member =>

                    member.payout_position === null ||

                    member.payout_position === undefined

            );



        if(invalidMember){

            throw new AppError(
                "All members must have payout positions",
                400
            );

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

                    status:"pending"

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








        if(ownsSession){

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


        if(ownsSession){

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

                `Cannot settle payout. Current status: ${payout.status}`,

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

                    disbursement_method,

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



        payout.financial_transaction_id =
            result.transactionId;



        await payout.save({
            session
        });










        if(ownsSession){

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



        if(ownsSession){

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








        if(ownsSession){

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
