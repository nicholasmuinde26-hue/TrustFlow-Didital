import paymentEventBus from './payment.event.bus.js';
import { PAYMENT_EVENTS } from './payment.constants.js';
import { notifyWorkspace } from '../services/workspaceNotify.js';

// ========================================
// PAYMENT -> NOTIFICATION BRIDGE
// ========================================
//
// Every payment product (contributions, loan repayments, wallet deposits, ...)
// finishes through the payment event bus, so listening here covers all of them
// with one handler instead of patching each module. The payer is told the
// result (in-app + SMS + WhatsApp for failures); the treasurer hears about
// failures too so they can follow up.
//
let registered = false;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const kes = (value) => `KES ${toNumber(value).toLocaleString('en-KE')}`;

const describeFailure = (reason) => {
  const text = String(reason || '').trim();
  return text ? text.slice(0, 140) : 'The payment was not completed.';
};

export const registerPaymentNotificationHandler = () => {
  if (registered) return;
  registered = true;

  const handle = (outcome) => (event) => {
    try {
      const chamaId = event?.context?.chamaId || event?.context?.owner_id || event?.payment?.ownerId;
      const payerUserId = event?.payment?.createdBy || event?.actor?.userId;
      if (!chamaId || !payerUserId) return;

      const amount = event?.payment?.amount;
      const reference = event?.payment?.reference;

      if (outcome === 'success') {
        notifyWorkspace('Chama', chamaId, 'MPESA_PAYMENT_SUCCESSFUL', {
          message: `Your payment of ${kes(amount)} was received${reference ? ` (ref ${String(reference).slice(0, 24)})` : ''}. Thank you.`,
          userId: payerUserId,
          amount,
          entityType: 'Payment',
          entityId: event?.payment?.id
        });
      } else {
        notifyWorkspace('Chama', chamaId, 'MPESA_PAYMENT_FAILED', {
          message: `Your payment of ${kes(amount)} did not go through. ${describeFailure(event?.payment?.failureReason)} Try again from Contributions.`,
          userId: payerUserId,
          amount,
          entityType: 'Payment',
          entityId: event?.payment?.id
        });
      }
    } catch (error) {
      console.error('[paymentNotification] failed:', error.message);
    }
  };

  paymentEventBus.on(PAYMENT_EVENTS.COMPLETED, handle('success'));
  paymentEventBus.on(PAYMENT_EVENTS.FAILED, handle('failed'));
};

export default registerPaymentNotificationHandler;
