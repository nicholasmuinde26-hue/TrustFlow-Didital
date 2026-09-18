
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/app/providers/SocketProvider";

/**
 * M-Pesa STK Push flow
 *
 * Phases:
 *   idle
 *   sending
 *   awaiting_pin
 *   processing
 *   completed
 *   failed
 *   cancelled
 *   timeout
 *
 * Socket.IO is the primary real-time detection mechanism.
 * HTTP polling is the backup.
 */

const TERMINAL = new Set([
  "completed",
  "failed",
  "cancelled",
]);

const PIN_PHASE_MS = 15000;
const DEFAULT_TIMEOUT_MS = 60000;

const SOCKET_BACKUP_POLL_MS = 6000;
const NO_SOCKET_POLL_MS = 2000;

export default function useStkPushFlow({
  fetchStatus,
  onResolved,
  pinPhaseMs = PIN_PHASE_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  /*
   * IMPORTANT:
   *
   * Do not assume that useSocket() exposes:
   *
   *   { on, off, connected }
   *
   * Your SocketProvider may instead expose:
   *
   *   { socket, connected }
   *
   * or:
   *
   *   { socket, isConnected }
   */

  const socketContext = useSocket() || {};

  const socket =
    socketContext.socket ||
    socketContext.client ||
    socketContext.io ||
    null;

  const connected =
    typeof socketContext.connected === "boolean"
      ? socketContext.connected
      : typeof socketContext.isConnected === "boolean"
        ? socketContext.isConnected
        : !!socket?.connected;

  const [phase, setPhase] = useState("idle");
  const [failureReason, setFailureReason] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const idRef = useRef({
    paymentIntentId: null,
    checkoutRequestId: null,
  });

  const resolvedRef = useRef(true);

  const timersRef = useRef({
    countdown: null,
    pinBump: null,
    poll: null,
    kick: null,
  });

  /**
   * Clear every timer belonging to the current payment.
   */
  const clearTimers = useCallback(() => {
    const timers = timersRef.current;

    if (timers.countdown) {
      clearInterval(timers.countdown);
    }

    if (timers.pinBump) {
      clearTimeout(timers.pinBump);
    }

    if (timers.poll) {
      clearInterval(timers.poll);
    }

    if (timers.kick) {
      clearTimeout(timers.kick);
    }

    timersRef.current = {
      countdown: null,
      pinBump: null,
      poll: null,
      kick: null,
    };
  }, []);

  /**
   * Resolve the payment exactly once.
   */
  const resolve = useCallback(
    (status, reason = null, raw = null) => {
      if (resolvedRef.current) {
        return;
      }

      resolvedRef.current = true;

      clearTimers();

      setFailureReason(reason || null);
      setPhase(status);

      if (typeof onResolved === "function") {
        onResolved(status, reason || null, raw);
      }
    },
    [clearTimers, onResolved]
  );

  /**
   * HTTP polling fallback.
   */
  const poll = useCallback(async () => {
    if (resolvedRef.current) {
      return;
    }

    if (typeof fetchStatus !== "function") {
      return;
    }

    const { paymentIntentId } = idRef.current;

    if (!paymentIntentId) {
      return;
    }

    try {
      const result = await fetchStatus(paymentIntentId);

      if (!result || resolvedRef.current) {
        return;
      }

      if (TERMINAL.has(result.status)) {
        resolve(
          result.status,
          result.failureReason,
          result.raw
        );
      }
    } catch (error) {
      /*
       * A polling failure should NOT fail the payment.
       *
       * It is normally a transient network/backend issue.
       * The next poll will retry.
       */
      console.warn(
        "[useStkPushFlow] Status polling failed:",
        error
      );
    }
  }, [fetchStatus, resolve]);

  /**
   * Start the STK initiation phase.
   */
  const startSending = useCallback(() => {
    clearTimers();

    resolvedRef.current = false;

    idRef.current = {
      paymentIntentId: null,
      checkoutRequestId: null,
    };

    setFailureReason(null);
    setSecondsLeft(0);
    setPhase("sending");
  }, [clearTimers]);

  /**
   * Call this after the backend successfully initiates
   * the STK push and returns the payment IDs.
   */
  const beginWaiting = useCallback(
    (paymentIntentId, checkoutRequestId = null) => {
      if (!paymentIntentId) {
        console.error(
          "[useStkPushFlow] beginWaiting called without paymentIntentId"
        );

        return;
      }

      clearTimers();

      idRef.current = {
        paymentIntentId,
        checkoutRequestId,
      };

      resolvedRef.current = false;

      setFailureReason(null);
      setPhase("awaiting_pin");

      const initialSeconds = Math.ceil(timeoutMs / 1000);

      setSecondsLeft(initialSeconds);

      /**
       * Countdown.
       */
      timersRef.current.countdown = setInterval(() => {
        setSecondsLeft((current) => {
          if (current <= 1) {
            resolve(
              "timeout",
              "Payment confirmation timed out. If you completed the payment, your balance will update shortly."
            );

            return 0;
          }

          return current - 1;
        });
      }, 1000);

      /**
       * After approximately 15 seconds,
       * change the UI from:
       *
       * "Enter your M-Pesa PIN"
       *
       * to:
       *
       * "Processing payment..."
       *
       * This is only a UX phase.
       */
      timersRef.current.pinBump = setTimeout(() => {
        setPhase((currentPhase) => {
          if (currentPhase === "awaiting_pin") {
            return "processing";
          }

          return currentPhase;
        });
      }, pinPhaseMs);

      /**
       * Polling is only a backup when Socket.IO is connected.
       *
       * When Socket.IO is unavailable, polling becomes
       * the primary detection mechanism.
       */
      const pollingInterval = connected
        ? SOCKET_BACKUP_POLL_MS
        : NO_SOCKET_POLL_MS;

      timersRef.current.poll = setInterval(
        poll,
        pollingInterval
      );

      /**
       * Early check.
       *
       * This handles the case where the M-Pesa callback
       * reached the backend before the socket listener was
       * fully ready.
       */
      timersRef.current.kick = setTimeout(() => {
        poll();
      }, 1500);
    },
    [
      clearTimers,
      connected,
      pinPhaseMs,
      timeoutMs,
      poll,
      resolve,
    ]
  );

  /**
   * Cancel from the UI.
   */
  const cancel = useCallback(
    (reason = "Payment cancelled by user") => {
      resolve("cancelled", reason);
    },
    [resolve]
  );

  /**
   * Reset the complete payment flow.
   */
  const reset = useCallback(() => {
    clearTimers();

    resolvedRef.current = true;

    idRef.current = {
      paymentIntentId: null,
      checkoutRequestId: null,
    };

    setPhase("idle");
    setFailureReason(null);
    setSecondsLeft(0);
  }, [clearTimers]);

  /**
   * Socket.IO real-time payment status listener.
   *
   * IMPORTANT:
   * We use socket.on/socket.off directly instead of assuming
   * the provider exposes on/off.
   */
  useEffect(() => {
    if (!socket) {
      console.warn(
        "[useStkPushFlow] Socket.IO client unavailable. Falling back to polling."
      );

      return undefined;
    }

    if (
      typeof socket.on !== "function" ||
      typeof socket.off !== "function"
    ) {
      console.warn(
        "[useStkPushFlow] Socket client does not expose on/off."
      );

      return undefined;
    }

    const handler = (payload = {}) => {
      if (resolvedRef.current) {
        return;
      }

      const {
        paymentIntentId,
        checkoutRequestId,
      } = idRef.current;

      const matchesPaymentIntent =
        Boolean(
          payload.paymentIntentId &&
          paymentIntentId &&
          String(payload.paymentIntentId) ===
            String(paymentIntentId)
        );

      const matchesCheckoutRequest =
        Boolean(
          payload.checkoutRequestId &&
          checkoutRequestId &&
          String(payload.checkoutRequestId) ===
            String(checkoutRequestId)
        );

      if (
        !matchesPaymentIntent &&
        !matchesCheckoutRequest
      ) {
        return;
      }

      /*
       * Only terminal statuses should resolve the flow.
       *
       * This protects the UI from accidentally resolving
       * because of an intermediate socket event.
       */
      if (!TERMINAL.has(payload.status)) {
        return;
      }

      resolve(
        payload.status,
        payload.failureReason || null,
        payload
      );
    };

    socket.on("payment:status", handler);

    return () => {
      socket.off("payment:status", handler);
    };
  }, [socket, resolve]);

  /**
   * Cleanup on component unmount.
   */
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    phase,
    failureReason,
    secondsLeft,

    startSending,
    beginWaiting,
    cancel,
    reset,

    /*
     * Useful for debugging/UI.
     */
    connected,
  };
}
