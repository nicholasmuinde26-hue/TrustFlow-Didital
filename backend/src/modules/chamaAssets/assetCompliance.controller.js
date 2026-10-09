import {
  createComplianceObligation,
  listComplianceObligations,
  getComplianceObligation,
  setComplianceObligationActive,
  addComplianceCycle,
  recordComplianceCyclePayment,
  waiveComplianceCycle,
} from "./assetCompliance.service.js";

// POST /chamas/:chamaId/assets/:assetId/compliance
export const createComplianceObligationController = async (req, res, next) => {
  try {
    const obligation = await createComplianceObligation(req.params.chamaId, req.params.assetId, req.user._id, req.body);
    return res.status(201).json({ success: true, message: "Compliance obligation created", data: { obligation } });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/assets/:assetId/compliance
export const listComplianceObligationsController = async (req, res, next) => {
  try {
    const { active } = req.query;
    const obligations = await listComplianceObligations(req.params.chamaId, req.params.assetId, {
      active: active === undefined ? undefined : active === "true",
    });
    return res.status(200).json({ success: true, data: { obligations } });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/compliance-obligations/:obligationId
export const getComplianceObligationController = async (req, res, next) => {
  try {
    const obligation = await getComplianceObligation(req.params.chamaId, req.params.obligationId);
    return res.status(200).json({ success: true, data: { obligation } });
  } catch (error) { next(error); }
};

// PATCH /chamas/:chamaId/compliance-obligations/:obligationId
export const setComplianceObligationActiveController = async (req, res, next) => {
  try {
    const obligation = await setComplianceObligationActive(req.params.chamaId, req.params.obligationId, req.body.active);
    return res.status(200).json({ success: true, message: "Obligation updated", data: { obligation } });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/compliance-obligations/:obligationId/cycles
export const addComplianceCycleController = async (req, res, next) => {
  try {
    const obligation = await addComplianceCycle(req.params.chamaId, req.params.obligationId, req.body);
    return res.status(201).json({ success: true, message: "Cycle added", data: { obligation } });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/compliance-obligations/:obligationId/cycles/:cycleId/pay
export const recordComplianceCyclePaymentController = async (req, res, next) => {
  try {
    const { amount, collectionMethod, description, category } = req.body;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A positive amount is required" });
    }
    const result = await recordComplianceCyclePayment(req.params.chamaId, req.params.obligationId, req.params.cycleId, {
      amount: Number(amount),
      collectionMethod,
      description,
      category,
      recordedBy: req.user._id,
    });
    return res.status(201).json({ success: true, message: "Payment recorded", data: result });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/compliance-obligations/:obligationId/cycles/:cycleId/waive
export const waiveComplianceCycleController = async (req, res, next) => {
  try {
    const obligation = await waiveComplianceCycle(req.params.chamaId, req.params.obligationId, req.params.cycleId, {
      reason: req.body.reason,
      waivedBy: req.user._id,
    });
    return res.status(200).json({ success: true, message: "Cycle waived", data: { obligation } });
  } catch (error) { next(error); }
};
