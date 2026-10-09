import {
  createLease,
  listLeases,
  getLease,
  endLease,
  addLeasePeriod,
  recordLeaseCashReceipt,
  recordLeaseInKindReceipt,
  waiveLeasePeriod,
  getLeaseSeasonTracker,
} from "./assetLease.service.js";

// POST /chamas/:chamaId/assets/:assetId/leases
export const createLeaseController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const {
      lessee_type, member_id, external_name, external_contact,
      arrangement_type, cash_amount, cash_frequency,
      in_kind_description, in_kind_unit,
      start_date, end_date, notes,
    } = req.body;
    const lease = await createLease(chamaId, assetId, req.user._id, {
      lesseeType: lessee_type,
      memberId: member_id,
      externalName: external_name,
      externalContact: external_contact,
      arrangementType: arrangement_type,
      cashAmount: cash_amount,
      cashFrequency: cash_frequency,
      inKindDescription: in_kind_description,
      inKindUnit: in_kind_unit,
      startDate: start_date,
      endDate: end_date,
      notes,
    });
    return res.status(201).json({ success: true, message: "Lease created", data: { lease } });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/assets/:assetId/leases
export const listLeasesController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const { status } = req.query;
    const leases = await listLeases(chamaId, assetId, { status });
    return res.status(200).json({ success: true, data: { leases } });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/leases/:leaseId
export const getLeaseController = async (req, res, next) => {
  try {
    const lease = await getLease(req.params.chamaId, req.params.leaseId);
    return res.status(200).json({ success: true, data: { lease } });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/leases/:leaseId/end
export const endLeaseController = async (req, res, next) => {
  try {
    const { reason, terminated } = req.body;
    const lease = await endLease(req.params.chamaId, req.params.leaseId, { reason, terminated: Boolean(terminated) });
    return res.status(200).json({ success: true, message: "Lease closed", data: { lease } });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/leases/:leaseId/periods
export const addLeasePeriodController = async (req, res, next) => {
  try {
    const {
      label, period_start, period_end, due_date,
      expected_cash_amount, expected_in_kind_quantity, expected_in_kind_unit, expected_in_kind_description,
    } = req.body;
    const lease = await addLeasePeriod(req.params.chamaId, req.params.leaseId, {
      label,
      periodStart: period_start,
      periodEnd: period_end,
      dueDate: due_date,
      expectedCashAmount: expected_cash_amount,
      expectedInKindQuantity: expected_in_kind_quantity,
      expectedInKindUnit: expected_in_kind_unit,
      expectedInKindDescription: expected_in_kind_description,
    });
    return res.status(201).json({ success: true, message: "Season/period added", data: { lease } });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/leases/:leaseId/tracker
export const getLeaseSeasonTrackerController = async (req, res, next) => {
  try {
    const tracker = await getLeaseSeasonTracker(req.params.chamaId, req.params.leaseId);
    return res.status(200).json({ success: true, data: tracker });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/leases/:leaseId/periods/:periodId/cash-receipt
export const recordLeaseCashReceiptController = async (req, res, next) => {
  try {
    const { amount, collectionMethod, mpesaReceiptNumber, description } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A positive amount is required" });
    }
    const result = await recordLeaseCashReceipt(req.params.chamaId, req.params.leaseId, req.params.periodId, {
      amount, collectionMethod, mpesaReceiptNumber, description, recordedBy: req.user._id,
    });
    return res.status(201).json({ success: true, message: "Cash receipt posted to the ledger", data: result });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/leases/:leaseId/periods/:periodId/in-kind-receipt
export const recordLeaseInKindReceiptController = async (req, res, next) => {
  try {
    const { quantity, unit, estimatedValue, valuationNote, description } = req.body;
    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ success: false, message: "A positive quantity is required" });
    }
    const result = await recordLeaseInKindReceipt(req.params.chamaId, req.params.leaseId, req.params.periodId, {
      quantity, unit, estimatedValue, valuationNote, description, recordedBy: req.user._id,
    });
    return res.status(201).json({ success: true, message: "In-kind receipt recorded", data: result });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/leases/:leaseId/periods/:periodId/waive
export const waiveLeasePeriodController = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await waiveLeasePeriod(req.params.chamaId, req.params.leaseId, req.params.periodId, { reason, waivedBy: req.user._id });
    return res.status(200).json({ success: true, message: "Period marked waived", data: result });
  } catch (error) { next(error); }
};
