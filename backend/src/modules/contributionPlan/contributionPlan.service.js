/**
 * ============================================================================
 * CONTRIBUTION PLAN SERVICE
 * ============================================================================
 *
 * Business service for contribution plans.
 *
 * Responsibilities:
 *
 * ✓ Create plans
 * ✓ Update plans
 * ✓ Manage lifecycle
 * ✓ Query plans
 * ✓ Retrieve plan financial information
 *
 *
 * Does NOT:
 *
 * ✗ Process payments
 * ✗ Create journals
 * ✗ Update ledgers
 *
 * ============================================================================
 */


import mongoose from "mongoose";


import ContributionPlan
from "../../models/ContributionPlan.js";


import ContributionObligation
from "../../models/ContributionObligation.js";


import ContributionPayment
from "../../models/ContributionPayment.js";


import AppError
from "../../utils/AppError.js";





// ============================================================
// CONSTANTS
// ============================================================


const PLAN_STATUS = Object.freeze({

    DRAFT:
        "draft",

    ACTIVE:
        "active",

    PAUSED:
        "paused",

    COMPLETED:
        "completed",

    CANCELLED:
        "cancelled"

});





// ============================================================
// VALIDATORS
// ============================================================


export const validateObjectId = (

    id

)=>{


    if(

        !mongoose.Types.ObjectId.isValid(id)

    ){

        throw new AppError(

            "Invalid ID",

            400

        );

    }


    return true;

};





export const validateOwnerType = (

    type

)=>{


    const allowed = [

        "CHAMA",

        "GROUP",

        "USER"

    ];



    if(

        !allowed.includes(type)

    ){

        throw new AppError(

            "Invalid owner type",

            400

        );

    }


    return true;

};





export const validatePlanStatus = (

    status

)=>{


    if(

        !Object.values(PLAN_STATUS)

        .includes(status)

    ){

        throw new AppError(

            "Invalid contribution plan status",

            400

        );

    }


    return true;

};

// ============================================================
// CREATE CONTRIBUTION PLAN
// ============================================================


export const createContributionPlan = async({

    owner_type,

    owner_id,

    created_by,

    name,

    description = null,

    contribution_type,

    frequency,

    amount = null,

    target_amount = null,

    minimum_amount = null,

    maximum_amount = null,

    custom_frequency_days = null,

    start_date,

    end_date = null,

    is_permanent = false,

    merry_go_round = false,

    session = null


})=>{



    validateOwnerType(owner_type);



    if(!owner_id){

        throw new AppError(

            "Owner ID required",

            400

        );

    }




    if(!name){

        throw new AppError(

            "Contribution plan name required",

            400

        );

    }





    const plan =

        await ContributionPlan.create(

            [

                {


                    owner_type,


                    owner_id,


                    created_by,


                    name,


                    description,



                    contribution_type,



                    frequency,



                    amount,



                    target_amount,



                    minimum_amount,



                    maximum_amount,



                    custom_frequency_days,



                    start_date,



                    end_date,



                    is_permanent,



                    merry_go_round,



                    status:

                        PLAN_STATUS.DRAFT



                }

            ],


            {

                session

            }

        );





    return plan[0];

};









// ============================================================
// GET PLAN BY ID
// ============================================================


export const getContributionPlanById = async({

    plan_id,

    owner_type = null,

    owner_id = null,

    session = null


})=>{


    validateObjectId(plan_id);




    const query = {


        _id:

            plan_id


    };




    if(owner_type){

        query.owner_type =

            owner_type;

    }




    if(owner_id){

        query.owner_id =

            owner_id;

    }







    const plan =

        await ContributionPlan.findOne(query)

        .session(session);







    if(!plan){


        throw new AppError(

            "Contribution plan not found",

            404

        );

    }






    return plan;

};









// ============================================================
// GET OWNER PLANS
// ============================================================


export const getOwnerContributionPlans = async({

    owner_type,

    owner_id,

    status = null,

    contribution_type = null,

    frequency = null,

    session = null


})=>{





    const query = {



        owner_type,



        owner_id



    };







    if(status){


        query.status =

            status;


    }





    if(contribution_type){


        query.contribution_type =

            contribution_type;


    }





    if(frequency){


        query.frequency =

            frequency;


    }







    return ContributionPlan.find(query)

        .sort({

            createdAt:

                -1

        })

        .session(session);

};









// ============================================================
// UPDATE CONTRIBUTION PLAN
// ============================================================


export const updateContributionPlan = async({

    plan_id,

    owner_type,

    owner_id,

    updates,

    session = null


})=>{





    const plan =

        await getContributionPlanById({

            plan_id,

            owner_type,

            owner_id,

            session

        });







    if(

        [

            PLAN_STATUS.COMPLETED,

            PLAN_STATUS.CANCELLED

        ]

        .includes(plan.status)

    ){


        throw new AppError(

            "This plan cannot be updated",

            400

        );


    }







    const allowedFields = [



        "name",


        "description",


        "amount",


        "target_amount",


        "minimum_amount",


        "maximum_amount",


        "frequency",


        "custom_frequency_days",


        "start_date",


        "end_date",


        "is_permanent",


        "merry_go_round"



    ];







    for(const field of allowedFields){


        if(

            updates[field] !== undefined

        ){

            plan[field] =

                updates[field];

        }


    }






    await plan.save({

        session

    });





    return plan;

};
// ============================================================
// ACTIVATE CONTRIBUTION PLAN
// ============================================================


export const activateContributionPlan = async({

    plan_id,

    owner_type,

    owner_id,

    session = null


})=>{



    const plan =

        await getContributionPlanById({

            plan_id,

            owner_type,

            owner_id,

            session

        });





    if(

        plan.status === PLAN_STATUS.CANCELLED

    ){

        throw new AppError(

            "Cancelled plans cannot be activated",

            400

        );

    }






    if(

        plan.status === PLAN_STATUS.COMPLETED

    ){

        throw new AppError(

            "Completed plans cannot be activated",

            400

        );

    }






    plan.status =

        PLAN_STATUS.ACTIVE;






    await plan.save({

        session

    });






    return plan;


};









// ============================================================
// PAUSE CONTRIBUTION PLAN
// ============================================================


export const pauseContributionPlan = async({

    plan_id,

    owner_type,

    owner_id,

    session = null


})=>{



    const plan =

        await getContributionPlanById({

            plan_id,

            owner_type,

            owner_id,

            session

        });






    if(

        plan.status !== PLAN_STATUS.ACTIVE

    ){

        throw new AppError(

            "Only active plans can be paused",

            400

        );

    }






    plan.status =

        PLAN_STATUS.PAUSED;






    await plan.save({

        session

    });





    return plan;


};









// ============================================================
// RESUME CONTRIBUTION PLAN
// ============================================================


export const resumeContributionPlan = async({

    plan_id,

    owner_type,

    owner_id,

    session = null


})=>{



    const plan =

        await getContributionPlanById({

            plan_id,

            owner_type,

            owner_id,

            session

        });







    if(

        plan.status !== PLAN_STATUS.PAUSED

    ){

        throw new AppError(

            "Only paused plans can resume",

            400

        );

    }






    plan.status =

        PLAN_STATUS.ACTIVE;






    await plan.save({

        session

    });






    return plan;


};









// ============================================================
// COMPLETE CONTRIBUTION PLAN
// ============================================================


export const completeContributionPlan = async({

    plan_id,

    owner_type,

    owner_id,

    session = null


})=>{



    const plan =

        await getContributionPlanById({

            plan_id,

            owner_type,

            owner_id,

            session

        });







    if(

        plan.status === PLAN_STATUS.CANCELLED

    ){

        throw new AppError(

            "Cancelled plans cannot be completed",

            400

        );

    }







    plan.status =

        PLAN_STATUS.COMPLETED;







    await plan.save({

        session

    });






    return plan;


};









// ============================================================
// CANCEL CONTRIBUTION PLAN
// ============================================================


export const cancelContributionPlan = async({

    plan_id,

    owner_type,

    owner_id,

    session = null


})=>{



    const plan =

        await getContributionPlanById({

            plan_id,

            owner_type,

            owner_id,

            session

        });







    if(

        plan.status === PLAN_STATUS.COMPLETED

    ){

        throw new AppError(

            "Completed plans cannot be cancelled",

            400

        );

    }







    plan.status =

        PLAN_STATUS.CANCELLED;






    await plan.save({

        session

    });






    return plan;


};

// ============================================================
// GET PLAN OBLIGATIONS
// ============================================================
//
// Returns all obligations generated from a contribution plan.
//
// Plan
//   |
//   └── Obligations
//
// ============================================================


export const getContributionPlanObligations = async({

    plan_id,

    owner_type = null,

    owner_id = null,

    status = null,

    participant_type = null,

    participant_id = null,

    session = null


})=>{



    validateObjectId(plan_id);




    // Ensure plan exists

    await getContributionPlanById({

        plan_id,

        owner_type,

        owner_id,

        session

    });






    const query = { plan_id };

    if (owner_type) query.owner_type = owner_type;
    if (owner_id) query.owner_id = owner_id;






    if(status){


        query.status = status.includes(',') ? { $in: status.split(',') } : status;


    }






    if(participant_id){


        query.participant_id = participant_id;


    }








    return ContributionObligation.find(query)



        .populate({ path: 'participant_id', model: participant_type || 'ChamaMembership', select: 'user_id role status', populate: { path: 'user_id', select: 'name phone' } })



        .sort({

            due_date:

                1

        })



        .session(session);



};









// ============================================================
// GET PLAN PAYMENTS
// ============================================================
//
// ContributionPlan
//       |
//       └── Payments
//
// ============================================================


export const getContributionPlanPayments = async({

    plan_id,

    owner_type = null,

    owner_id = null,

    status = null,

    participant_type = null,

    participant_id = null,

    session = null


})=>{



    validateObjectId(plan_id);





    await getContributionPlanById({

        plan_id,

        owner_type,

        owner_id,

        session

    });






    const query = {


        plan:

            plan_id


    };






    if(status){


        query.status =

            status;


    }






    if(participant_id){


        query.member =

            participant_id;


    }







    return ContributionPayment.find(query)



        .populate({


            path:

                "member",



            select:

                "user role status"



        })



        .sort({

            createdAt:

                -1

        })



        .session(session);



};









// ============================================================
// FINANCIAL SUMMARY
// ============================================================
//
// Provides aggregated plan financial information.
//
// Includes:
//
// - Expected contribution
// - Paid amount
// - Outstanding amount
// - Payment count
//
// ============================================================


export const getContributionPlanFinancialSummary = async({

    plan_id,

    owner_type = null,

    owner_id = null,

    session = null


})=>{



    validateObjectId(plan_id);





    await getContributionPlanById({

        plan_id,

        owner_type,

        owner_id,

        session

    });







    const obligations =

        await ContributionObligation.find({

            plan:

                plan_id

        })

        .session(session);







    const payments =

        await ContributionPayment.find({

            plan:

                plan_id,


            status:

                "COMPLETED"


        })

        .session(session);








    let expectedAmount =

        0;





    let paidAmount =

        0;







    for(const obligation of obligations){


        expectedAmount +=

            Number(

                obligation.expected_amount ||

                obligation.amount ||

                0

            );


    }







    for(const payment of payments){


        paidAmount +=

            Number(

                payment.amount ||

                0

            );


    }








    return {



        planId:

            plan_id,



        expectedAmount,



        paidAmount,



        outstandingAmount:

            expectedAmount -

            paidAmount,



        obligationCount:

            obligations.length,



        paymentCount:

            payments.length,



        collectionPercentage:

            expectedAmount === 0

            ?

            0

            :

            (

                paidAmount /

                expectedAmount

            ) * 100



    };


};

// ============================================================
// SERVICE EXPORTS
// ============================================================


export default {

    createContributionPlan,

    getContributionPlanById,

    getOwnerContributionPlans,

    updateContributionPlan,


    activateContributionPlan,

    pauseContributionPlan,

    resumeContributionPlan,

    completeContributionPlan,

    cancelContributionPlan,


    getContributionPlanObligations,

    getContributionPlanPayments,

    getContributionPlanFinancialSummary

};
