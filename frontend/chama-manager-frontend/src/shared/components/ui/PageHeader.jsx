import Button from "./Button";
import { useTerminology } from '@/modules/workspaces/index.js';

const MODULE_TITLE_KEYS = {
  Contributions: "contributions", "Contribution Plans": "contributions",
  Loans: "loans", Savings: "savings", "Merry-Go-Round": "mgr",
  "Savings Share-out": "savings_shareout", Payouts: "payouts",
  Withdrawals: "withdrawals", Meetings: "meetings", "Polls & Voting": "polls",
  Announcements: "announcements", Chat: "chat", "Asset Portfolio": "assets",
  "Property & Leases": "property_leases", "Burial & Welfare": "burial_welfare",
  Fundraising: "fundraising", "Equipment Hire": "equipment_hire",
};

export default function PageHeader({
  title,
  subtitle,
  action,
}) {
  const { moduleLabel, organizationTerm } = useTerminology();
  const displayTitle = MODULE_TITLE_KEYS[title] ? moduleLabel(MODULE_TITLE_KEYS[title], title) : organizationTerm(title);
  const displaySubtitle = subtitle ? organizationTerm(subtitle) : subtitle;
  return (
    <div
      className="
      mb-8
      flex
      flex-col
      gap-4
      lg:flex-row
      lg:items-center
      lg:justify-between
      "
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {displayTitle}
        </h1>

        {displaySubtitle && (
          <p className="mt-2 text-slate-500">
            {displaySubtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-3">
          {action}
        </div>
      )}
    </div>
  );
}
