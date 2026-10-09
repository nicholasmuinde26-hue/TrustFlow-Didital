import { useState } from "react";
import { IdCard, Image as ImageIcon, Loader2, ShieldCheck, User, X } from "lucide-react";
import toast from "react-hot-toast";

import chamaApi from "../api/chama.api";
import { imageFileToDataUri } from "@/utils/resizeImage";

// ========================================
// KYC SUBMIT MODAL
// ========================================
//
// chamaApi.submitKyc() has existed since the Command Center split, but
// nothing ever called it — the leadership-side review queue
// (TreasuryOversightTab's "Member KYC review") had a submission form to
// review, with no way for a member to actually create one. This is that
// form: it posts { id_number, id_document_url, selfie_url } to
// /chamas/:id/kyc and puts the member's membership into the "pending"
// queue leadership sees. All three fields are required by the backend
// (see the 400 it returns without them) — the ID document and selfie
// are read client-side and sent as data URIs, the same pattern
// AccountSettingsPage already uses for avatar_url, rather than a
// separate file-upload endpoint.
//
// The account-level ID number (Account Settings) is a personal-profile
// field on the User; this is the per-Chama verification of that number,
// which is why it's prefilled from the profile but still editable and
// submitted separately per workspace.
//
// ========================================

const ID_NUMBER_PATTERN = /^[A-Za-z0-9]{4,15}$/;
// Photos are shrunk in the browser before upload. A phone photo is often
// 3-8 MB; two of them used to blow past the API's 5 MB request limit and
// the submission failed. These sizes keep the ID readable but the whole
// request comfortably small.
function PhotoField({ id, label, hint, icon: Icon, value, onChange, error, maxDim = 1600, maxChars = 1_300_000 }) {
  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const dataUri = await imageFileToDataUri(file, { maxDim, maxChars });
      onChange(dataUri, null);
    } catch (err) {
      onChange(null, err?.message || "Failed to read that image. Try a different file.");
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3.5 py-2.5 transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-800"
      >
        {value ? (
          <img
            src={value}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-700">
            <Icon size={16} />
          </span>
        )}
        <span className="min-w-0 text-xs">
          <span className="block font-bold text-slate-700 dark:text-slate-300">
            {value ? "Change photo" : "Upload photo"}
          </span>
          <span className="block truncate text-[11px] text-slate-400">{hint}</span>
        </span>
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="sr-only"
        />
      </label>
      {error && (
        <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default function KycSubmitModal({
  workspaceId,
  initialIdNumber,
  status,
  onClose,
  onSubmitted,
  requirements = [],
}) {
  const [idNumber, setIdNumber] = useState(initialIdNumber || "");
  const [idDocumentUrl, setIdDocumentUrl] = useState(null);
  const [selfieUrl, setSelfieUrl] = useState(null);
  const [idDocumentError, setIdDocumentError] = useState(null);
  const [selfieError, setSelfieError] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState({});
  const labels = { date_of_birth: "Date of birth", residential_area: "Residential area", occupation: "Occupation", next_of_kin_name: "Next of kin name", next_of_kin_phone: "Next of kin phone" };

  const isResubmit = status === "rejected" || status === "pending";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    const trimmed = idNumber.trim();
    if (!trimmed) {
      setError("Enter your national ID or passport number.");
      return;
    }
    if (!ID_NUMBER_PATTERN.test(trimmed)) {
      setError("That doesn't look like a valid ID number.");
      return;
    }
    if (!idDocumentUrl) {
      setError("Upload a photo of your ID document.");
      return;
    }
    if (!selfieUrl) {
      setError("Upload a selfie for verification.");
      return;
    }
    if (requirements.some((field) => !String(details[field] || "").trim())) {
      setError("Complete all additional details requested by your Chama.");
      return;
    }

    setSubmitting(true);
    try {
      await chamaApi.submitKyc(workspaceId, {
        id_number: trimmed,
        id_document_url: idDocumentUrl,
        selfie_url: selfieUrl,
        additional_details: details,
      });
      toast.success(
        isResubmit ? "KYC resubmitted for review." : "KYC submitted for review."
      );
      onSubmitted?.();
      onClose?.();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Could not submit your KYC. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <ShieldCheck size={19} />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isResubmit ? "Resubmit your KYC" : "Submit your KYC"}
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {status === "rejected"
                  ? "Your last submission was rejected. Check the number and try again."
                  : "Leadership verifies this before your membership shows as fully KYC'd."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              National ID / Passport number
            </label>
            <div className="relative">
              <IdCard
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                autoFocus
                value={idNumber}
                onChange={(event) => setIdNumber(event.target.value)}
                placeholder="e.g. 12345678"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-3.5 text-xs font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              This is checked against the ID on file for your account and
              reviewed by your Chama's leadership.
            </p>
          </div>

          <PhotoField
            id="kyc-id-document"
            label="Photo of your ID document"
            hint="PNG, JPEG, or WEBP · under 2.8MB"
            icon={ImageIcon}
            value={idDocumentUrl}
            error={idDocumentError}
            onChange={(dataUri, err) => {
              setIdDocumentUrl(dataUri);
              setIdDocumentError(err);
            }}
          />

          {requirements.map((field) => (
            <div key={field}>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{labels[field] || field.replaceAll("_", " ")}</label>
              <input type={field === "date_of_birth" ? "date" : "text"} value={details[field] || ""} onChange={(event) => setDetails((previous) => ({ ...previous, [field]: event.target.value }))} required className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          ))}

          <PhotoField
            id="kyc-selfie"
            label="Selfie for verification"
            hint="A clear photo of your face"
            icon={User}
            maxDim={1024}
            maxChars={700_000}
            value={selfieUrl}
            error={selfieError}
            onChange={(dataUri, err) => {
              setSelfieUrl(dataUri);
              setSelfieError(err);
            }}
          />

          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-1/2 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Submitting…
                </>
              ) : (
                "Submit for review"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
