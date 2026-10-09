import { useState } from "react";
import { Link } from "react-router-dom";
import { Flag } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import AssetDiscrepancyQueue from "@/modules/chamaAssets/components/AssetDiscrepancyQueue";
import { Notice, SectionCard } from "../components/DeskUI";

// Members can flag any income or expense entry on a chama asset that looks
// wrong. Each flag lands here as a multi-signatory review, exactly like any
// other risky decision: the person who raised it can't clear it, the person
// who recorded the entry can't rule on it, and it needs the same number of
// leader sign-offs as an investment decision. Reviewing it in place here
// keeps it next to the rest of the desk; the asset page shows the same queue.
export default function AssetReviewsTab({ workspaceId }) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? user?._id;
  const [notice, setNotice] = useState(null); // { message, isError }

  return (
    <div className="space-y-5">
      {notice && <Notice tone={notice.isError ? "error" : "success"}>{notice.message}</Notice>}
      <SectionCard
        icon={Flag}
        title="Asset entries flagged by members"
        description="Confirm a discrepancy if the entry really is wrong, or dismiss the flag once you've checked. Confirmed discrepancies count against the manager's track record."
        action={<Link to={`/workspace/${workspaceId}/assets`} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Open assets</Link>}
      >
        <AssetDiscrepancyQueue
          chamaId={workspaceId}
          canReview
          currentUserId={currentUserId}
          notify={(message, isError) => setNotice({ message, isError: Boolean(isError) })}
          emptyMessage="No flagged entries. Members can flag any asset income or expense entry from the asset's statement."
        />
      </SectionCard>
    </div>
  );
}
