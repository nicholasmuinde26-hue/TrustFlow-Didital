import { useId, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { imageFileToDataUri } from "@/utils/resizeImage";

// ========================================
// IMAGE PICKER
// ========================================
//
// One picker for every profile / KYC / logo upload. It always shrinks the
// chosen photo in the browser first (see utils/resizeImage.js), so the
// request stays under the API's size limits, and shows a preview with a
// remove button. `onChange(dataUri | null)`.
//
// shape: "round" (avatar/logo), "wide" (cover/document).
//
// ========================================

export default function ImagePicker({ label, hint, value, onChange, shape = "round", maxDim = 800, maxChars = 450_000, disabled = false, removable = true, capture }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onChange(await imageFileToDataUri(file, { maxDim, maxChars }));
    } catch (err) {
      setError(err?.message || "Could not use that photo.");
    } finally {
      setBusy(false);
    }
  };

  const previewClass = shape === "round" ? "h-16 w-16 rounded-full" : "h-16 w-28 rounded-xl";

  return (
    <div>
      {label && <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>}
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
        <div className={`grid shrink-0 place-items-center overflow-hidden bg-slate-100 text-slate-400 dark:bg-slate-700 ${previewClass}`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <Camera size={18} />}
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <label htmlFor={id} className={`inline-flex cursor-pointer rounded-lg bg-white px-3 py-1.5 font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 ${disabled || busy ? "pointer-events-none opacity-50" : ""}`}>
            {value ? "Change photo" : "Choose photo"}
          </label>
          <input id={id} type="file" accept="image/png,image/jpeg,image/webp" capture={capture} onChange={handleFile} disabled={disabled || busy} className="sr-only" />
          {removable && value && !disabled && (
            <button type="button" onClick={() => onChange(null)} className="ml-2 inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline">
              <Trash2 size={12} /> Remove
            </button>
          )}
          {hint && <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p>}
        </div>
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
