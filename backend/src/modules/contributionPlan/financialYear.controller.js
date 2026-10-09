import AppError from "../../utils/AppError.js";
import { getActiveYear, resolveYearForView, listYears, createYear, activateYear, closeYear } from "./financialYear.service.js";

const getAuthenticatedUserId = (req) => {
  const userId = req.user?._id || req.user?.id || req.user?.user_id;
  if (!userId) {
    throw new AppError("Authenticated user not found", 401);
  }
  return userId;
};

export const getActive = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const year = await getActiveYear(chamaId);
    return res.json({ success: true, data: year });
  } catch (error) {
    next(error);
  }
};

export const listAll = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const years = await listYears(chamaId);
    return res.json({ success: true, data: years });
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const { label, start_date, end_date } = req.body;
    const userId = getAuthenticatedUserId(req);
    
    if (!label || !start_date || !end_date) {
        throw new AppError("Label, start_date, and end_date are required", 400);
    }
    const year = await createYear({ chamaId, label, startDate: start_date, endDate: end_date, userId });
    return res.status(201).json({ success: true, data: year });
  } catch (error) {
    next(error);
  }
};

export const activate = async (req, res, next) => {
  try {
    const { chamaId, yearId } = req.params;
    const userId = getAuthenticatedUserId(req);
    const year = await activateYear({ chamaId, yearId, userId });
    return res.json({ success: true, message: "Financial year is now active.", data: year });
  } catch (error) {
    next(error);
  }
};

export const close = async (req, res, next) => {
  try {
    const { chamaId, yearId } = req.params;
    const userId = getAuthenticatedUserId(req);
    const year = await closeYear({ chamaId, yearId, userId, membershipId: req.membership?._id || null });
    return res.json({
      success: true,
      message: "Year-end close started. The financial year closes once it is approved and finalized.",
      data: year,
    });
  } catch (error) {
    next(error);
  }
};