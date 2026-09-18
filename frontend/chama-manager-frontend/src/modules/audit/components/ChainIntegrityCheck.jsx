import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

import Button from "@/shared/components/ui/Button/Button";

import { useVerifyTrustChain } from "../hooks/useVerifyTrustChain";

// ============================================================
// CHAIN INTEGRITY CHECK
// ============================================================
//
// Every audit entry stores a hash of the previous entry's hash plus its
// own content. Pressing this re-walks the whole chain server-side and
// recomputes every hash from what is currently stored, so an edited
// field, a deleted entry, or two entries swapped all show up — and show
// up at a specific position, not as a vague warning.
//
// The copy avoids "tamper-proof". Nothing here prevents a write to the
// database; it makes one detectable. Overstating that is how a trust
// feature becomes the thing that destroys trust when someone tests it.
//
// ============================================================

const formatCheckedAt = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function ChainIntegrityCheck({ chamaId }) {
  const { mutate, data, error, isPending, isSuccess, isError } =
    useVerifyTrustChain(chamaId);

  const checkedAt = formatCheckedAt(data?.verifiedAt);

  // ----------------------------------------------------------
  // RESULT LINE
  // ----------------------------------------------------------

  let result = null;

  if (isError) {
    result = (
      <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
        <ShieldQuestion size={16} className="mt-0.5 shrink-0" />
        <p>
          Couldn&apos;t complete the check
          {error?.response?.status === 403
            ? " — you need to be an active member of this chama."
            : ". This says nothing about the record itself, only that the check didn't run. Try again in a moment."}
        </p>
      </div>
    );
  } else if (isSuccess && data.valid) {
    result = (
      <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <p>
          <span className="font-semibold">
            {data.totalEntries} {data.totalEntries === 1 ? "entry" : "entries"}{" "}
            verified.
          </span>{" "}
          Every entry still matches its own fingerprint, and each one links
          to the one before it — nothing has been edited, removed, or
          reordered since it was written.
          {checkedAt ? ` Checked ${checkedAt}.` : null}
        </p>
      </div>
    );
  } else if (isSuccess && !data.valid) {
    result = (
      <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">
            This record does not verify.
            {data.brokenAtSequence
              ? ` The chain breaks at entry ${data.brokenAtSequence}`
              : ""}
            {data.brokenAtSequence && data.verifiedEntries
              ? ` of ${data.expectedTotalEntries || data.totalEntries}.`
              : "."}
          </p>
          {data.reason ? (
            <p className="mt-1 text-red-600 dark:text-red-300">{data.reason}</p>
          ) : null}
          <p className="mt-1 text-slate-600 dark:text-mist-muted">
            Entries before that point still check out. Raise this with your
            chairperson and keep a copy of this result.
          </p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-obsidian-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-sm text-slate-600 dark:text-mist-muted">
            Each entry carries a fingerprint of the entry before it, so any
            change to the history can be detected — by any member, not just
            officials.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          loading={isPending}
          loadingLabel="Checking"
          onClick={() => mutate()}
          disabled={!chamaId}
        >
          Verify this record
        </Button>
      </div>

      {result}
    </div>
  );
}