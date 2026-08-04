import * as WorkspaceService
from "./workspace.service.js";

export async function getWorkspaces(

    req,

    res,

    next

){

    try{

        const workspaces=

            await WorkspaceService
                .getUserWorkspaces(

                    req.user._id

                );

        res.json({

            success:true,

            data:workspaces

        });

    }

    catch(error){

        next(error);

    }

}