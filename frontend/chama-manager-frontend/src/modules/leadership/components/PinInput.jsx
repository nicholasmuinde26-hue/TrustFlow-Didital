import { useEffect, useRef } from "react";

// ========================================
// PIN INPUT
// ========================================
//
// One box per digit, 4-6 digits, numeric keypad on mobile.
//
// `type="password"` rather than a custom masking scheme so password
// managers and the OS keyboard behave normally, and `inputMode="numeric"`
// so a Kenyan treasurer on a phone gets the number pad rather than the
// full keyboard — this is typed standing up in a meeting, not at a desk.
//
// ========================================

export default function PinInput({
  length = 4,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  ariaLabel = "PIN",
}) {
  const inputs = useRef([]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputs.current[0]?.focus();
    }
  }, [autoFocus, disabled]);

  const digits = String(value || "")
    .padEnd(length, " ")
    .slice(0, length)
    .split("");

  const commit = (next) => {
    onChange(next);
    if (next.length === length) {
      onComplete?.(next);
    }
  };

  const handleChange = (index) => (event) => {
    const typed = event.target.value.replace(/\D/g, "");
    if (!typed) return;

    const chars = String(value || "").split("");

    // Pasting or fast typing can deliver several digits at once — spread
    // them across the remaining boxes instead of dropping all but one.
    typed.split("").forEach((digit, offset) => {
      const slot = index + offset;
      if (slot < length) chars[slot] = digit;
    });

    const next = chars.join("").slice(0, length);
    commit(next);

    const nextEmpty = Math.min(index + typed.length, length - 1);
    inputs.current[nextEmpty]?.focus();
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const chars = String(value || "").split("");

      if (chars[index]) {
        chars[index] = "";
        commit(chars.join("").replace(/\s/g, ""));
      } else if (index > 0) {
        chars[index - 1] = "";
        commit(chars.join("").replace(/\s/g, ""));
        inputs.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex items-center gap-2.5" role="group" aria-label={ariaLabel}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={length}
          disabled={disabled}
          value={digits[index]?.trim() || ""}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          aria-label={`${ariaLabel} digit ${index + 1}`}
          className="h-14 w-12 rounded-2xl border-2 border-slate-200 bg-slate-50 text-center text-2xl font-black text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-emerald-400"
        />
      ))}
    </div>
  );
}
