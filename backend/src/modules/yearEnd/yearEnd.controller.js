import AppError from '../../utils/AppError.js';
import ChamaFinancialYear from '../../models/Chamafinancialyear.js';
import {
  beginClose, finalizeClose, cancelClose, getCloseStatus, getCloseSnapshot,
  verifySealedClose, seedOpeningBalances,
} from './yearEnd.service.js';
import { getOpeningBalances } from './yearEnd.opening.service.js';

const actor = (req) => {
  const userId = req.user?._id || req.user?.id || req.user?.user_id;
  if (!userId) throw new AppError('Authenticated user not found', 401);
  return { userId, membershipId: req.membership?._id || null };
};

export const status = async (req, res, next) => {
  try {
    const data = await getCloseStatus({ chamaId: req.params.chamaId, yearId: req.params.yearId });
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

export const snapshot = async (req, res, next) => {
  try {
    const data = await getCloseSnapshot({
      chamaId: req.params.chamaId, yearId: req.params.yearId, closeId: req.query.closeId || null,
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

export const start = async (req, res, next) => {
  try {
    const { userId, membershipId } = actor(req);
    const { settlement_overrides: settlementOverrides = {}, note = '' } = req.body || {};
    const data = await beginClose({
      chamaId: req.params.chamaId, yearId: req.params.yearId, userId, membershipId,
      settlementOverrides, note,
    });
    res.status(201).json({ success: true, message: 'Year-end close started. It needs approval before the year is closed.', data });
  } catch (e) { next(e); }
};

export const finalize = async (req, res, next) => {
  try {
    const { userId } = actor(req);
    const data = await finalizeClose({ chamaId: req.params.chamaId, yearId: req.params.yearId, userId });
    res.json({ success: true, message: 'Financial year closed.', data });
  } catch (e) { next(e); }
};

export const cancel = async (req, res, next) => {
  try {
    const { userId, membershipId } = actor(req);
    const data = await cancelClose({
      chamaId: req.params.chamaId, yearId: req.params.yearId, userId, membershipId,
      reason: req.body?.reason || '',
    });
    res.json({ success: true, message: 'Year-end close cancelled. The financial year is open again.', data });
  } catch (e) { next(e); }
};

export const verify = async (req, res, next) => {
  try {
    const data = await verifySealedClose({ chamaId: req.params.chamaId, yearId: req.params.yearId });
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

export const openings = async (req, res, next) => {
  try {
    const data = await getOpeningBalances(req.params.chamaId, req.params.yearId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

export const seedOpenings = async (req, res, next) => {
  try {
    const year = await ChamaFinancialYear.findOne({ _id: req.params.yearId, chama_id: req.params.chamaId });
    if (!year) throw new AppError('Financial year not found.', 404);
    const data = await seedOpeningBalances({ chamaId: req.params.chamaId, targetYear: year });
    res.json({ success: true, data });
  } catch (e) { next(e); }
};
