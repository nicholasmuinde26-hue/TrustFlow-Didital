// Mirrors POLL_CATEGORIES / POLL_TYPES in backend/src/models/Poll.js.
// Suggested defaults reflect common Kenyan chama governance norms (e.g.
// secret ballot + supermajority for expulsion, plurality for elections),
// but every field stays editable — these are starting points, not rules.

export const POLL_CATEGORIES = [
  {
    value: "general",
    label: "General Motion",
    defaults: { pollType: "yes_no", passThresholdPercent: 50, quorumPercent: 50, anonymous: false, revealResults: "live" },
  },
  {
    value: "official_election",
    label: "Officials Election",
    description: "Elect chairperson, treasurer, secretary or auditor",
    defaults: { pollType: "election", passThresholdPercent: 50, quorumPercent: 50, anonymous: true, revealResults: "after_close" },
  },
  {
    value: "loan_approval",
    label: "Loan Approval",
    defaults: { pollType: "yes_no", passThresholdPercent: 50, quorumPercent: 50, anonymous: false, revealResults: "live" },
  },
  {
    value: "expenditure_approval",
    label: "Expenditure Approval",
    defaults: { pollType: "yes_no", passThresholdPercent: 66, quorumPercent: 50, anonymous: false, revealResults: "live" },
  },
  {
    value: "new_member_approval",
    label: "New Member Approval",
    defaults: { pollType: "yes_no", passThresholdPercent: 66, quorumPercent: 50, anonymous: false, revealResults: "live" },
  },
  {
    value: "member_discipline",
    label: "Member Discipline / Expulsion",
    description: "Secret ballot recommended to protect members from repercussions",
    defaults: { pollType: "yes_no", passThresholdPercent: 75, quorumPercent: 60, anonymous: true, revealResults: "after_close" },
  },
  {
    value: "contribution_change",
    label: "Contribution Amount / Cycle Change",
    defaults: { pollType: "yes_no", passThresholdPercent: 66, quorumPercent: 60, anonymous: false, revealResults: "live" },
  },
  {
    value: "merry_go_round_order",
    label: "Merry-Go-Round Payout Order",
    defaults: { pollType: "single_choice", passThresholdPercent: 50, quorumPercent: 50, anonymous: false, revealResults: "live" },
  },
  {
    value: "constitution_amendment",
    label: "Constitution Amendment",
    defaults: { pollType: "yes_no", passThresholdPercent: 75, quorumPercent: 66, anonymous: false, revealResults: "live" },
  },
  {
    value: "investment_decision",
    label: "Investment Decision",
    defaults: { pollType: "yes_no", passThresholdPercent: 66, quorumPercent: 50, anonymous: false, revealResults: "live" },
  },
  {
    value: "agm_resolution",
    label: "AGM Resolution",
    defaults: { pollType: "yes_no", passThresholdPercent: 50, quorumPercent: 50, anonymous: false, revealResults: "live" },
  },
  {
    value: "other",
    label: "Other",
    defaults: { pollType: "yes_no", passThresholdPercent: 50, quorumPercent: 50, anonymous: false, revealResults: "live" },
  },
];

export const POLL_TYPES = [
  { value: "yes_no", label: "Yes / No" },
  { value: "single_choice", label: "Pick One" },
  { value: "multi_choice", label: "Pick Several" },
  { value: "election", label: "Election (most votes wins)" },
];

export const POLL_ELIGIBILITY = [
  { value: "all_members", label: "All active members" },
  { value: "officials_only", label: "Officials only" },
];

export const OUTCOME_LABELS = {
  passed: { label: "Passed", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  decided: { label: "Decided", variant: "success" },
  no_quorum: { label: "No Quorum", variant: "warning" },
  no_majority: { label: "No Majority", variant: "warning" },
  tied: { label: "Tied", variant: "warning" },
  "n/a": { label: "Pending", variant: "neutral" },
};

export function categoryLabel(value) {
  return POLL_CATEGORIES.find((c) => c.value === value)?.label || "General";
}

export function categoryDefaults(value) {
  return POLL_CATEGORIES.find((c) => c.value === value)?.defaults || POLL_CATEGORIES[0].defaults;
}
