import AppError from '../../utils/AppError.js';
import {
  getHubDashboard,
  getMonthMatrix,
  getStatement,
  statementToCsv,
  statementToPdf,
  statementFilename,
} from './contributionHub.service.js';
import { getMemberMonthView } from './contributionDashboard.service.js';

const chamaIdOf = (req) => req.chama?._id || req.params.workspaceId;
const isLeadership = (req) =>
  ['treasurer', 'chairperson', 'secretary'].includes(req.membership?.role) ||
  ['super_admin', 'sub_admin'].includes(req.user?.systemRole);

/** GET /:workspaceId/finance/contribution-dashboard?month=2026-09[&year=<fyId>][&include=all] */
export const hubDashboard = async (req, res, next) => {
  try {
    const data = await getHubDashboard({
      chamaId: chamaIdOf(req),
      month: req.query.month || null,
      yearId: req.query.year || null,
      includeInactive: req.query.include === 'all',
    });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

/** GET /:workspaceId/finance/contribution-matrix?month=2026-09 - treasurer / chairperson. */
export const hubMatrix = async (req, res, next) => {
  try {
    if (!isLeadership(req)) throw new AppError('Member contribution matrix is available to Chama officials only.', 403);
    const data = await getMonthMatrix({
      chamaId: chamaIdOf(req),
      month: req.query.month || null,
      yearId: req.query.year || null,
    });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

/** GET /:workspaceId/finance/contribution-me?month=2026-09 - the caller's own rows + year matrix. */
export const hubMyMonth = async (req, res, next) => {
  try {
    if (!req.membership?._id) throw new AppError('Chama membership context is required.', 400);
    const data = await getMemberMonthView({
      chamaId: chamaIdOf(req),
      membership: req.membership,
      month: req.query.month || null,
      yearId: req.query.year || null,
    });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

/**
 * GET /:workspaceId/finance/contribution-statement
 *     ?scope=month|year &month=2026-09 &year=<fyId> &format=json|csv|pdf &memberId=<membershipId>
 *
 * Members always get their own statement. Only leadership may name another
 * member with memberId - for anyone else it is ignored, never honoured.
 */
export const hubStatement = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'json').toLowerCase();
    if (!['json', 'csv', 'pdf'].includes(format)) throw new AppError("format must be 'json', 'csv' or 'pdf'.", 400);

    const membershipId = isLeadership(req) && req.query.memberId ? req.query.memberId : req.membership?._id;
    if (!membershipId) throw new AppError('Chama membership context is required.', 400);

    const st = await getStatement({
      chamaId: chamaIdOf(req),
      membershipId,
      scope: req.query.scope || 'month',
      month: req.query.month || null,
      yearId: req.query.year || null,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${statementFilename(st, 'csv')}"`);
      return res.send(statementToCsv(st));
    }
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${statementFilename(st, 'pdf')}"`);
      return res.send(statementToPdf(st));
    }
    return res.json({ success: true, data: st });
  } catch (e) {
    next(e);
  }
};

export default { hubDashboard, hubMatrix, hubMyMonth, hubStatement };
