import * as WorkspaceService
from "./workspace.service.js";
import { getWorkspaceDashboard as getDashboard } from './workspaceDashboard.service.js';
import { getCatalogForClient } from '../../constants/workspaceModules.constants.js';

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

export async function getWorkspaceDirectory(req, res, next) {
  try {
    const { type, query, search } = req.query;
    const directory = await WorkspaceService.getDirectoryWorkspaces(type, query || search || '');
    res.status(200).json({
      success: true,
      data: directory,
    });
  } catch (error) {
    next(error);
  }
}

// Static catalog of switchable modules and presets (no per-user data).
export function getModuleCatalog(req, res) {
    res.json({
        success: true,
        data: getCatalogForClient()
    });
}
