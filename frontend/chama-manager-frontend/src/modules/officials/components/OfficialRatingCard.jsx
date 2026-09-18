import { useState } from "react";
import { Star, ChevronDown, ChevronUp } from "lucide-react";

import Button from "@/shared/components/ui/Button/Button";
import Spinner from "@/shared/components/ui/Spinner";

import StarRatingInput from "./StarRatingInput";
import { useOfficialRatingDetail } from "../hooks/useOfficials";

const ROLE_LABEL = {
  treasurer: "Treasurer",
  chairperson: "Chairperson",
  secretary: "Secretary",
  auditor: "Auditor",
  committee_member: "Committee member",
};

export default function OfficialRatingCard({ official, chamaId, canViewDetail, onSubmitRating, isSubmitting }) {
  const [rating, setRating] = useState(official.viewerRating || 0);
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const { data: detail, isLoading: detailLoading } = useOfficialRatingDetail(
    chamaId,
    official.membershipId,
    { enabled: showDetail && canViewDetail }
  );

  const handleSubmit = () => {
    if (!rating) return;
    onSubmitRating({ membershipId: official.membershipId, rating, comment: comment || undefined });
    setShowForm(false);
  };

  return (
    <div className="border-b border-slate-100 py-4 last:border-0 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {official.name}
          </p>
          <p className="text-xs text-slate-400">{ROLE_LABEL[official.role] || official.role}</p>
        </div>

        <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
          <Star size={16} className="fill-yellow-400 text-yellow-400" />
          {official.averageRating !== null ? official.averageRating : "—"}
          <span className="text-xs text-slate-400">({official.ratingCount})</span>
        </div>
      </div>

      {!official.isSelf && (
        <div className="mt-2">
          {!showForm ? (
            <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
              {official.viewerRating ? "Update your rating" : "Rate this official"}
            </Button>
          ) : (
            <div className="mt-2 space-y-2">
              <StarRatingInput value={rating} onChange={setRating} />
              <textarea
                className="w-full rounded-[var(--radius-control)] border border-slate-300 bg-white p-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900"
                rows={2}
                placeholder="Comment (optional, visible only to treasurer/auditor)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={!rating || isSubmitting} onClick={handleSubmit}>
                  Submit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {canViewDetail && (
        <div className="mt-2">
          <Button size="sm" variant="ghost" onClick={() => setShowDetail((s) => !s)}>
            {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Per-rater detail
          </Button>

          {showDetail && (
            <div className="mt-2 space-y-2 rounded-md bg-slate-50 p-3 dark:bg-slate-800">
              {detailLoading && <Spinner size="sm" label="Loading detail" />}
              {!detailLoading && (!detail || detail.length === 0) && (
                <p className="text-xs text-slate-400">No ratings yet.</p>
              )}
              {!detailLoading &&
                detail?.map((r) => (
                  <div key={r.id} className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">{r.ratedBy}</span> rated {r.rating}/5
                    {r.comment && ` — "${r.comment}"`}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
