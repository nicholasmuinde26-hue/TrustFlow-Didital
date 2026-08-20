import * as WorkspaceService
from "./workspace.service.js";
import { getWorkspaceDashboard as getDashboard } from './workspaceDashboard.service.js';

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

export async function getWorkspaceDashboard(req, res, next) {
  try {
    const data = await getDashboard({ workspaceId: req.params.workspaceId, userId: req.user._id });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
