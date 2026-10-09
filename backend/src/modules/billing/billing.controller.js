import Invoice from '../../models/Invoice.js';
import AppError from '../../utils/AppError.js';
import { ALLOWED_MONTHS } from '../../constants/billing.constants.js';
import { getOrCreateSubscription, listPlans, priceForChama } from './billingEntitlement.service.js';
import {
  createInvoice,
  getBillingSummary,
  payInvoice,
  reconcilePendingInvoice,
  switchToFree,
} from './billingPayment.service.js';

const uid = (req) => req.user._id || req.user.id;

// What the client may see of an invoice. Phone numbers and raw provider
// fields stay on the server.
const present = (invoice) => {
  const doc = invoice.toObject ? invoice.toObject() : invoice;
  const last = [...(doc.attempts || [])].pop();
  return {
    _id: doc._id,
    number: doc.number,
    plan_code: doc.plan_code,
    plan_name: doc.plan_name,
    months: doc.months,
    base_amount: doc.base_amount,
    credit: doc.credit,
    amount: doc.amount,
    currency: doc.currency,
    status: doc.status,
    paid_at: doc.paid_at,
    period_start: doc.period_start,
    period_end: doc.period_end,
    mpesa_receipt: doc.mpesa_receipt,
    created_at: doc.createdAt,
    last_attempt: last ? { status: last.status, reason: last.result_desc, at: last.updatedAt } : null,
  };
};

export const getSummary = async (req, res, next) => {
  try {
    res.json({ success: true, data: await getBillingSummary(req.chama._id) });
  } catch (error) { next(error); }
};

export const getPlans = async (req, res, next) => {
  try {
    const [plans, subscription] = await Promise.all([listPlans(), getOrCreateSubscription(req.chama._id)]);
    res.json({
      success: true,
      // price_monthly is what THIS chama pays; list_price_monthly appears only
      // when the platform gave the group a special price.
      data: plans.map((p) => priceForChama(p, subscription)).map((p) => ({
        code: p.code, name: p.name, tagline: p.tagline, price_monthly: p.price_monthly,
        list_price_monthly: p.list_price_monthly ?? null,
        max_members: p.max_members, modules: p.modules,
      })),
    });
  } catch (error) { next(error); }
};

export const listInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ chama_id: req.chama._id, status: { $ne: 'void' } })
      .sort({ createdAt: -1 }).limit(36);
    res.json({ success: true, data: invoices.map(present) });
  } catch (error) { next(error); }
};

export const createInvoiceController = async (req, res, next) => {
  try {
    const planCode = String(req.body?.plan_code || '').toLowerCase().trim();
    const months = Number(req.body?.months || 1);
    if (!planCode) throw new AppError('plan_code is required', 400);
    if (!ALLOWED_MONTHS.includes(months)) throw new AppError(`months must be one of ${ALLOWED_MONTHS.join(', ')}`, 400);
    const invoice = await createInvoice({ chamaId: req.chama._id, planCode, months, userId: uid(req) });
    res.status(201).json({ success: true, data: present(invoice) });
  } catch (error) { next(error); }
};

export const getInvoice = async (req, res, next) => {
  try {
    let invoice = await Invoice.findOne({ _id: req.params.invoiceId, chama_id: req.chama._id });
    if (!invoice) throw new AppError('Invoice not found', 404);
    invoice = await reconcilePendingInvoice(invoice);
    res.json({ success: true, data: present(invoice), summary: await getBillingSummary(req.chama._id) });
  } catch (error) { next(error); }
};

export const payInvoiceController = async (req, res, next) => {
  try {
    const phone = String(req.body?.phone_number || '').trim();
    if (!phone) throw new AppError('phone_number is required', 400);
    const { invoice, customerMessage } = await payInvoice({
      chamaId: req.chama._id, invoiceId: req.params.invoiceId, phoneNumber: phone, userId: uid(req),
    });
    res.status(202).json({ success: true, message: customerMessage || 'Check your phone to approve the payment', data: present(invoice) });
  } catch (error) { next(error); }
};

export const switchToFreeController = async (req, res, next) => {
  try {
    res.json({ success: true, data: await switchToFree({ chamaId: req.chama._id }) });
  } catch (error) { next(error); }
};
