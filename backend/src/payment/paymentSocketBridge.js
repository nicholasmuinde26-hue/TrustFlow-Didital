import paymentEventBus from "./payment.event.bus.js";
import { PAYMENT_EVENTS, PAYMENT_STATUS } from "./payment.constants.js";
import { getIO } from "../modules/realtime/socketServer.js";

/**
 * ============================================================================
 * PAYMENT -> SOCKET.IO BRIDGE
 * ============================================================================
 *
 * business.service.js has its own tiny emitBusinessTransactionStatus() bridge
 * for POS/Business STK pushes (those never go through PaymentIntent). Every
 * OTHER STK push in the app - chama contributions, MGR round contributions,
 * savings deposits, contribution-group pledges - goes through the shared
 * PaymentIntent -> payment.service.js -> paymentEventBus pipeline instead,
 * and until now nothing on that pipeline ever reached the browser in
 * real time. The frontend's STK modals only ever found out via their HTTP
 * polling fallback (every 2-6s), which is why "instant" detection of
 * insufficient funds / cancellation / success never actually happened for
 * those flows even though the backend already knew the result immediately
 * after M-Pesa's callback landed.
 *
 * This module subscribes to the same paymentEventBus that FinanceEngine
 * listens on (see finance/financeEngine.service.js) and re-emits a
 * "payment:status" Socket.IO event to the paying user's own room
 * (`user:<userId>`), which is exactly what useStkPushFlow.js already
 * listens for on the frontend. It is purely additive - HTTP polling stays
 * as the fallback for whenever a socket isn't connected.
 */

const STATUS_BY_EVENT = Object.freeze({
  [PAYMENT_EVENTS.COMPLETED]: PAYMENT_STATUS.COMPLETED,
  [PAYMENT_EVENTS.FAILED]: PAYMENT_STATUS.FAILED,
  [PAYMENT_EVENTS.CANCELLED]: PAYMENT_STATUS.CANCELLED,
});

function emitPaymentStatus(event, status) {
  try {
    const io = getIO();
    const payment = event?.payment || {};
    const userId = payment.createdBy;

    if (!userId) {
      console.warn(
        `[paymentSocketBridge] Payment ${payment.id || "unknown"} has no createdBy - cannot target a user room, leaving HTTP polling as the only detection path for this one`
      );
      return;
    }

    io.to(`user:${userId}`).emit("payment:status", {
      paymentIntentId: payment.paymentIntentId ? String(payment.paymentIntentId) : null,
      checkoutRequestId: payment.providerPaymentId || null,
      paymentId: payment.id ? String(payment.id) : null,
      status,
      // Only surface a failure reason for non-completed terminal states -
      // mirrors the same rule payment.service.js applies when it persists
      // failure_reason on the PaymentIntent itself.
      failureReason: status === PAYMENT_STATUS.COMPLETED ? null : (payment.failureReason || null),
      amount: payment.amount || null,
      productType: payment.productType || null,
      ownerId: payment.ownerId ? String(payment.ownerId) : null,
      ownerType: payment.ownerType || null,
      phoneNumber: payment.phoneNumber || null,
    });
  } catch (error) {
    // Socket.IO may not be initialized yet (unit tests, one-off scripts,
    // or a request that races server startup) - this must never throw
    // back into the event bus's emitAsync loop, since HTTP polling is
    // still there to pick up the result either way.
    console.warn(
      `[paymentSocketBridge] Failed to emit payment:status for payment ${event?.payment?.id || "unknown"}:`,
      error.message
    );
  }
}

export function registerPaymentSocketBridge() {
  for (const [eventName, status] of Object.entries(STATUS_BY_EVENT)) {
    paymentEventBus.on(eventName, (event) => emitPaymentStatus(event, status));
  }
  console.log("[paymentSocketBridge] payment:status Socket.IO bridge registered (completed/failed/cancelled)");
}

export default registerPaymentSocketBridge;
