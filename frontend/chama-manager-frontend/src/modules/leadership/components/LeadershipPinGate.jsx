import { useEffect, useState } from "react";
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Lock,
  MailQuestion,
  ShieldCheck,
} from "lucide-react";

import Spinner from "@/shared/components/ui/Spinner";
import PinInput from "./PinInput";
import leadershipApi from "../api/leadership.api";
import { useLeadershipSession } from "../context/LeadershipSessionProvider";

// ========================================
// LEADERSHIP PIN GATE
// ========================================
//
// Wraps the Leadership Desk. Nothing inside renders — not the tabs, not
// the header, not a skeleton hinting at balances — until the PIN is
// accepted. A gate that leaks the page shell behind a blurred overlay is
// a gate that leaks the page shell.
//
// Four states:
//
//   loading  — fetching whether a PIN exists for this seat
//   create   — first visit, choose a PIN
//   unlock   — PIN exists, enter it
//   reset    — forgot it; OTP to the leader's own phone/email
//
// The gate never persists anything. On unmount (navigating away from
// the desk) the desk token is dropped, which is exactly the "re-locks
// every time you navigate away and back" behaviour asked for.
//
// ========================================

const RESET_STEPS = { REQUEST: "request", CONFIRM: "confirm" };

const INVALIDATION_NOTES = {
  LEADERSHIP_SESSION_EXPIRED: "Your Leadership Desk session timed out.",
  LEADERSHIP_PIN_ROTATED: "Your PIN was changed, so other sessions were signed out.",
  LEADERSHIP_ROLE_CHANGED: "Your role in this Chama changed. Unlock again to continue.",
  LEADERSHIP_PIN_REQUIRED: null,
};

export default function LeadershipPinGate({ chamaId, children }) {
  const { isUnlockedFor, adoptSession, clearSession, invalidationReason } =
    useLeadershipSession();

  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [mode, setMode] = useState(null); // 'create' | 'unlock' | 'reset'

  const unlocked = isUnlockedFor(chamaId);

  // Drop the session whenever this gate unmounts. This is the mechanism
  // behind the re-lock: leaving the desk for Members, Chat, anywhere,
  // ends the unlocked session rather than leaving it warm in memory.
  useEffect(() => {
    return () => clearSession(null);
  }, [clearSession]);

  useEffect(() => {
    if (unlocked) return undefined;

    let cancelled = false;
    setLoadError(null);

    leadershipApi
      .status(chamaId)
      .then((result) => {
        if (cancelled) return;
        setStatus(result);
        setMode(result.pinSet ? "unlock" : "create");
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error?.response?.data?.message ||
            "Could not check your Leadership Desk PIN. Refresh and try again."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [chamaId, unlocked]);

  if (unlocked) {
    return children;
  }

  if (loadError) {
    return (
      <GateShell>
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      </GateShell>
    );
  }

  if (!status) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const notice = invalidationReason ? INVALIDATION_NOTES[invalidationReason] : null;

  return (
    <GateShell notice={notice} lockedUntil={status.lockedOut ? status.lockedUntil : null}>
      {mode === "create" && (
        <CreatePinForm
          chamaId={chamaId}
          onUnlocked={(session) => adoptSession(session, chamaId)}
        />
      )}

      {mode === "unlock" && (
        <UnlockForm
          chamaId={chamaId}
          lockedOut={status.lockedOut}
          onUnlocked={(session) => adoptSession(session, chamaId)}
          onForgot={() => setMode("reset")}
        />
      )}

      {mode === "reset" && (
        <ResetPinFlow
          chamaId={chamaId}
          onUnlocked={(session) => adoptSession(session, chamaId)}
          onCancel={() => setMode("unlock")}
        />
      )}
    </GateShell>
  );
}

// ========================================
// SHELL
// ========================================

function GateShell({ children, notice, lockedUntil }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center py-10">
      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex items-start gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Lock size={22} />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
              Leadership Desk
            </p>
            <h1 className="text-xl font-black leading-tight text-slate-900 dark:text-white">
              Locked
            </h1>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              This desk controls the group's money, roles and rules, so it asks
              for a PIN separate from your login — every time you open it.
            </p>
          </div>
        </div>

        {notice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            {notice}
          </div>
        )}

        {lockedUntil && (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              Too many incorrect attempts. Try again after{" "}
              {new Date(lockedUntil).toLocaleTimeString("en-KE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              , or reset your PIN by OTP.
            </span>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

function FormError({ message }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ========================================
// CREATE (FIRST VISIT)
// ========================================

function CreatePinForm({ chamaId, onUnlocked }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (busy) return;

    if (pin.length < 4) {
      setError("Choose a PIN of at least 4 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setError("The two PINs don't match.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const session = await leadershipApi.setPin(chamaId, pin);
      onUnlocked(session);
    } catch (err) {
      setPin("");
      setConfirmPin("");
      setError(
        err?.response?.data?.message || "Could not save that PIN. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-900 dark:border-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-200">
        <strong className="font-black">Set up your PIN.</strong> It belongs to
        your seat in this Chama only — if you lead another group, that one has
        its own PIN. Don't reuse your M-Pesa PIN.
      </div>

      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Choose a 4-digit PIN
        </label>
        <PinInput value={pin} onChange={setPin} disabled={busy} />
      </div>

      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Confirm it
        </label>
        <PinInput
          value={confirmPin}
          onChange={setConfirmPin}
          onComplete={() => pin.length >= 4 && submit()}
          disabled={busy}
          autoFocus={false}
        />
      </div>

      <FormError message={error} />

      <button
        type="button"
        onClick={submit}
        disabled={busy || pin.length < 4 || confirmPin.length < 4}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Saving
          </>
        ) : (
          <>
            <ShieldCheck size={15} /> Set PIN and open the desk
          </>
        )}
      </button>
    </div>
  );
}

// ========================================
// UNLOCK
// ========================================

function UnlockForm({ chamaId, lockedOut, onUnlocked, onForgot }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (candidate) => {
    const value = candidate ?? pin;
    if (busy || lockedOut || value.length < 4) return;

    setBusy(true);
    setError(null);

    try {
      const session = await leadershipApi.unlock(chamaId, value);
      onUnlocked(session);
    } catch (err) {
      setPin("");
      setError(
        err?.response?.data?.message || "That PIN wasn't accepted. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Enter your PIN
        </label>
        <PinInput
          value={pin}
          onChange={setPin}
          onComplete={submit}
          disabled={busy || lockedOut}
        />
      </div>

      <FormError message={error} />

      <button
        type="button"
        onClick={() => submit()}
        disabled={busy || lockedOut || pin.length < 4}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Unlocking
          </>
        ) : (
          <>
            <KeyRound size={15} /> Unlock Leadership Desk
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onForgot}
        className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-bold text-slate-500 underline-offset-2 transition hover:text-emerald-700 hover:underline dark:text-slate-400 dark:hover:text-emerald-400"
      >
        <MailQuestion size={14} /> Forgot your PIN?
      </button>
    </div>
  );
}

// ========================================
// RESET BY OTP
// ========================================

function ResetPinFlow({ chamaId, onUnlocked, onCancel }) {
  const [step, setStep] = useState(RESET_STEPS.REQUEST);
  const [sentTo, setSentTo] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const requestCode = async () => {
    setBusy(true);
    setError(null);

    try {
      const result = await leadershipApi.requestReset(chamaId);
      setSentTo(result.sentTo);
      setStep(RESET_STEPS.CONFIRM);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not send a reset code. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (busy) return;

    if (newPin.length < 4) {
      setError("Choose a PIN of at least 4 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      setError("The two PINs don't match.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const session = await leadershipApi.confirmReset(chamaId, {
        otpCode,
        newPin,
      });
      onUnlocked(session);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not reset your PIN. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  if (step === RESET_STEPS.REQUEST) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          We'll send a one-time code to the phone number or email on your
          account — the same way phone verification works. Resetting the PIN
          also signs out any other unlocked Leadership Desk session.
        </div>

        <FormError message={error} />

        <button
          type="button"
          onClick={requestCode}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Sending
            </>
          ) : (
            <>
              <MailQuestion size={15} /> Send me a reset code
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full text-xs font-bold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Back to PIN entry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-900 dark:border-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-200">
        Code sent to <strong className="font-black">{sentTo}</strong>.
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          One-time code
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otpCode}
          onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
          maxLength={6}
          placeholder="6-digit code"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-black tracking-[0.4em] text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          New PIN
        </label>
        <PinInput value={newPin} onChange={setNewPin} disabled={busy} autoFocus={false} />
      </div>

      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Confirm new PIN
        </label>
        <PinInput
          value={confirmPin}
          onChange={setConfirmPin}
          disabled={busy}
          autoFocus={false}
        />
      </div>

      <FormError message={error} />

      <button
        type="button"
        onClick={confirm}
        disabled={busy || otpCode.length < 4 || newPin.length < 4}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Resetting
          </>
        ) : (
          <>
            <ShieldCheck size={15} /> Reset PIN and open the desk
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="w-full text-xs font-bold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        Cancel
      </button>
    </div>
  );
}
