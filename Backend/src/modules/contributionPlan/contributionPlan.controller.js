import AppError
  from '../../utils/AppError.js';


import {

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

}
from "./contributionPlan.service.js";



// ========================================
// CONTRIBUTION PLAN CONTROLLER
// ========================================
//
// HTTP boundary.
//
// Responsibilities:
//
// ✓ Validate request context
// ✓ Extract params/body/query
// ✓ Call service layer
// ✓ Return response
//
// Does NOT:
// ✗ Validate business rules
// ✗ Handle accounting
// ✗ Manage obligations
//
// ========================================



// ========================================
// AUTH USER
// ========================================


const getAuthenticatedUserId = (

  req

) => {


  const userId =

    req.user?._id ||

    req.user?.id ||

    req.user?.user_id;



  if (!userId) {

    throw new AppError(

      "Authenticated user not found",

      401

    );

  }



  return userId;

};





// ========================================
// CREATE PLAN
// ========================================


export const createPlan = async (

req,

res,

next

)=>{


try {


const created_by =

getAuthenticatedUserId(req);



const plan =

await createContributionPlan({

...req.body,

created_by

});



return res.status(201).json({

success:true,

message:
"Contribution plan created successfully",

data:{
plan
}

});



}

catch(error){

next(error);

}



};





// ========================================
// GET PLAN
// ========================================


export const getPlanById = async (

req,

res,

next

)=>{


try{


const plan =

await getContributionPlanById({

plan_id:

req.params.planId,


owner_type:

req.query.owner_type,


owner_id:

req.query.owner_id

});



return res.json({

success:true,

data:{
plan
}

});


}

catch(error){

next(error);

}


};





// ========================================
// GET PLANS
// ========================================


export const getPlans = async (

req,

res,

next

)=>{


try{


const plans =

await getContributionPlans({

owner_type:

req.query.owner_type,


owner_id:

req.query.owner_id,


status:

req.query.status,


contribution_type:

req.query.contribution_type,


frequency:

req.query.frequency


});



return res.json({

success:true,

data:{

plans,

count:
plans.length

}

});


}

catch(error){

next(error);

}



};





// ========================================
// UPDATE PLAN
// ========================================


export const updatePlan = async (

req,

res,

next

)=>{


try{


const plan =

await updateContributionPlan({

plan_id:

req.params.planId,


owner_type:

req.body.owner_type,


owner_id:

req.body.owner_id,


updates:

req.body


});



return res.json({

success:true,

message:
"Contribution plan updated successfully",

data:{
plan
}

});


}

catch(error){

next(error);

}



};







// ========================================
// CHANGE PLAN STATUS
// ========================================


const executeStatusChange = async (

service,

req,

res,

message,

next

)=>{


try{


const plan =

await service({

plan_id:

req.params.planId,


owner_type:

req.body.owner_type,


owner_id:

req.body.owner_id

});



return res.json({

success:true,

message,

data:{
plan
}

});


}

catch(error){

next(error);

}


};







export const activatePlan = (

req,

res,

next

)=>

executeStatusChange(

activateContributionPlan,

req,

res,

"Contribution plan activated successfully",

next

);





export const pausePlan = (

req,

res,

next

)=>

executeStatusChange(

pauseContributionPlan,

req,

res,

"Contribution plan paused successfully",

next

);





export const resumePlan = (

req,

res,

next

)=>

executeStatusChange(

resumeContributionPlan,

req,

res,

"Contribution plan resumed successfully",

next

);





export const completePlan = (

req,

res,

next

)=>

executeStatusChange(

completeContributionPlan,

req,

res,

"Contribution plan completed successfully",

next

);





export const cancelPlan = (

req,

res,

next

)=>

executeStatusChange(

cancelContributionPlan,

req,

res,

"Contribution plan cancelled successfully",

next

);








// ========================================
// PLAN OBLIGATIONS
// ========================================


export const getPlanObligations = async (

req,

res,

next

)=>{


try{


const obligations =

await getContributionPlanObligations({

plan_id:

req.params.planId,


owner_type:

req.query.owner_type,


owner_id:

req.query.owner_id,


status:

req.query.status,


participant_type:

req.query.participant_type,


participant_id:

req.query.participant_id


});



return res.json({

success:true,

data:{

obligations,

count:

obligations.length

}

});


}

catch(error){

next(error);

}



};







// ========================================
// PLAN PAYMENTS
// ========================================


export const getPlanPayments = async (

req,

res,

next

)=>{


try{


const payments =

await getContributionPlanPayments({

plan_id:

req.params.planId,


owner_type:

req.query.owner_type,


owner_id:

req.query.owner_id,


status:

req.query.status,


participant_type:

req.query.participant_type,


participant_id:

req.query.participant_id


});



return res.json({

success:true,

data:{

payments,

count:

payments.length

}

});


}

catch(error){

next(error);

}



};







// ========================================
// FINANCIAL SUMMARY
// ========================================


export const getPlanFinancialSummary = async (

req,

res,

next

)=>{


try{


const summary =

await getContributionPlanFinancialSummary({

plan_id:

req.params.planId,


owner_type:

req.query.owner_type,


owner_id:

req.query.owner_id

});



return res.json({

success:true,

data:{
summary
}

});


}

catch(error){

next(error);

}



};