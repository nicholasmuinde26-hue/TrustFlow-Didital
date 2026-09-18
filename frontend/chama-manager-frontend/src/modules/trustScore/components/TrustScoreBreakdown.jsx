const COMPONENT_LABELS = {
  repayment: "On-time repayment",
  kyc: "Active KYC coverage",
  disputes: "Dispute rate",
  auditIntegrity: "Audit trail integrity",
  officialAccountability: "Official accountability",
};

const COMPONENT_DESCRIPTIONS = {
  repayment: "Share of due loan installments paid in full, on or before their due date.",
  kyc: "Share of active members with a verified KYC record.",
  disputes: "How many member-raised disputes were logged in the last 12 months, weighted by how serious/unresolved they are.",
  auditIntegrity: "Whether this chama's tamper-evident audit trail still verifies end to end.",
  officialAccountability: "Peer ratings of officials, blended with how often high-value payouts had the required independent co-signers.",
};

function scoreColor(score) {
  if (score === null || score === undefined) return "bg-slate-200 dark:bg-obsidian-raised";
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export default function TrustScoreBreakdown({ components, componentsUsed = [] }) {
  if (!components) return null;

  const keys = Object.keys(COMPONENT_LABELS);

  return (
    <div className="space-y-4">
      {keys.map((key) => {
        const component = components[key];
        const hasData = component?.hasData && componentsUsed.includes(key);

        return (
          <div key={key}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-slate-800 dark:text-mist">
                {COMPONENT_LABELS[key]}
              </p>
              <p className="text-sm font-semibold text-slate-600 dark:text-mist-muted">
                {hasData ? `${component.score}/100` : "No data yet"}
              </p>
            </div>

            <p className="mt-0.5 text-xs text-slate-500 dark:text-mist-muted">
              {COMPONENT_DESCRIPTIONS[key]}
            </p>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
              {hasData && (
                <div
                  className={`h-full rounded-full ${scoreColor(component.score)}`}
                  style={{ width: `${component.score}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
