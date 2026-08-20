import { EventEmitter } from "events";

const paymentEventBus = new EventEmitter();
paymentEventBus.setMaxListeners(20); // Audit + Finance + Notification + Reporting + WS

/**
 * Emits an event and waits for every listener to settle (awaiting any
 * promise a listener returns).
 *
 * Plain EventEmitter.emit() invokes listeners synchronously but never
 * awaits what an async listener returns - so FinanceEngine's ledger
 * posting (and, for MGR, the obligation/payout follow-up) could still be
 * mid-flight when the code that emitted the event already moved on. That
 * mattered most for synchronous flows like "treasurer marks a member
 * paid", where the HTTP response - and the dashboard refresh right after
 * it - needs the ledger/obligation update to have actually landed.
 *
 * A broken listener is logged, not thrown, so it never breaks the other
 * listeners or changes emitAsync's own contract.
 */
paymentEventBus.emitAsync = async function emitAsync(eventName, ...args) {
  const listeners = this.listeners(eventName);
  for (const listener of listeners) {
    try {
      await listener(...args);
    } catch (error) {
      console.error(`[payment.event.bus] Listener for "${eventName}" failed:`, error);
    }
  }
  return listeners.length > 0;
};

export default paymentEventBus;