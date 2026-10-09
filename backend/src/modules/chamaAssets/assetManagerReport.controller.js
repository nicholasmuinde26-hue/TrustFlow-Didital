import {
  listReportPeriods,
  submitManagerReport,
  acknowledgeManagerReport,
  getManagerPerformance,
  setManagerReportingConfig,
} from "./assetManagerReport.service.js";

// GET /chamas/:chamaId/assets/:assetId/reports
// Open to every member — same transparency principle as the progress
// dashboard. A caretaker's report history is exactly what co-owners
// need visibility into.
export const listReportPeriodsController = async (req, res, next) => {
  try {
    // { reports, reporting: { enabled, cadence }, manager: { type, userId, name, assignedAt } }
    const overview = await listReportPeriods(req.params.chamaId, req.params.assetId);
    return res.status(200).json({ success: true, data: overview });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/assets/:assetId/reports/:reportId/submit
// The assigned member manager submits for themselves; a chama leader
// may submit on behalf of an external caretaker with no account — see
// assetManagerReport.service.js#submitManagerReport for how that's told
// apart.
export const submitManagerReportController = async (req, res, next) => {
  try {
    const { chamaId, assetId, reportId } = req.params;
    const isLeader = ["chairperson", "treasurer", "secretary"].includes(req.membership?.role);
    const { operational_status, income_collected, expenses_incurred, condition_rating, maintenance_flag, note } = req.body;
    const report = await submitManagerReport(chamaId, assetId, reportId, {
      submittedByUserId: req.user._id,
      isLeader,
      payload: { operational_status, income_collected, expenses_incurred, condition_rating, maintenance_flag, note },
    });
    return res.status(200).json({ success: true, message: "Report submitted", data: { report } });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/assets/:assetId/reports/:reportId/acknowledge
export const acknowledgeManagerReportController = async (req, res, next) => {
  try {
    const { chamaId, assetId, reportId } = req.params;
    const report = await acknowledgeManagerReport(chamaId, assetId, reportId, {
      acknowledgedByUserId: req.user._id,
      comment: req.body?.comment,
    });
    return res.status(200).json({ success: true, message: "Report acknowledged", data: { report } });
  } catch (error) { next(error); }
};

// PATCH /chamas/:chamaId/assets/:assetId/reporting
// Body: { enabled?, cadence?: "monthly" | "quarterly" } — leadership only
// (enforced at the route).
export const setManagerReportingConfigController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const { enabled, cadence } = req.body || {};
    const reporting = await setManagerReportingConfig(chamaId, assetId, { enabled, cadence });
    return res.status(200).json({ success: true, message: "Reporting settings updated", data: { reporting } });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/assets/managers/:userId/performance
// Any active member can look up a caretaker's track record — the exact
// thing a chama should check before rotating who's responsible for a
// property next, not something leadership should have to be asked for.
export const getManagerPerformanceController = async (req, res, next) => {
  try {
    const performance = await getManagerPerformance(req.params.chamaId, req.params.userId);
    return res.status(200).json({ success: true, data: performance });
  } catch (error) { next(error); }
};