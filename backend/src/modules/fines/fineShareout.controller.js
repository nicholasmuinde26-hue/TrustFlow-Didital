import { createFineShareout, listFineShareouts, approveFineShareout, payFineShareoutItem, payFineShareoutItems, cancelFineShareout } from './fineShareout.service.js';

export async function list(req, res, next) {
  try { res.json({ success: true, data: { shareouts: await listFineShareouts(req.params.id) } }); }
  catch (error) { next(error); }
}

export async function create(req, res, next) {
  try {
    const shareout = await createFineShareout({ chamaId: req.params.id, createdBy: req.user._id, periodLabel: req.body.period_label, distributionBasis: req.body.distribution_basis, asOfDate: req.body.as_of_date });
    res.status(201).json({ success: true, data: { shareout } });
  } catch (error) { next(error); }
}

export async function approve(req, res, next) {
  try {
    const shareout = await approveFineShareout({ chamaId: req.params.id, shareoutId: req.params.shareoutId, approvedBy: req.user._id, approverMembership: req.membership });
    res.json({ success: true, data: { shareout } });
  } catch (error) { next(error); }
}

export async function payItem(req, res, next) {
  try {
    const shareout = await payFineShareoutItem({ chamaId: req.params.id, shareoutId: req.params.shareoutId, itemId: req.params.itemId, method: req.body.method, externalReference: req.body.external_reference, postedBy: req.user._id });
    res.json({ success: true, data: { shareout } });
  } catch (error) { next(error); }
}

export async function payItems(req, res, next) {
  try {
    const result = await payFineShareoutItems({ chamaId: req.params.id, shareoutId: req.params.shareoutId, items: req.body.items, itemIds: req.body.item_ids, method: req.body.method, postedBy: req.user._id });
    res.json({ success: true, data: { shareout: result.shareout, paid: result.paid, failed: result.failed } });
  } catch (error) { next(error); }
}

export async function cancel(req, res, next) {
  try {
    const shareout = await cancelFineShareout({ chamaId: req.params.id, shareoutId: req.params.shareoutId, cancelledBy: req.user._id });
    res.json({ success: true, data: { shareout } });
  } catch (error) { next(error); }
}
