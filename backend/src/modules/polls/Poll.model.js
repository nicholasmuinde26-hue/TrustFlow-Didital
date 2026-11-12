import mongoose from "mongoose";

// ============================================================================
// POLL / VOTING MODEL
// ============================================================================
//
// Generic polling & voting engine for chama (and contribution-group)
// workspaces. Works for ANY chama and ANY event/decision a group needs to
// vote on — not tied to meetings only. Common Kenyan chama use cases this
// is designed around:
//
//   general               - any ordinary motion
//   official_election     - electing chairperson / treasurer / secretary / auditor
//   loan_approval         - approve/reject a member's loan application
//   expenditure_approval  - approve chama spending (e.g. AGM catering, land deposit)
//   new_member_approval   - admit a new member
//   member_discipline     - warning / fine / expulsion of a member
//   contribution_change   - change monthly contribution amount or cycle
//   merry_go_round_order  - approve/change the MGR payout order
//   constitution_amendment- amend the chama's constitution/bylaws
//   investment_decision   - approve an investment (land, shares, SACCO, etc.)
//   agm_resolution        - any Annual General Meeting resolution
//   other                 - anything else
//
// A poll can optionally be linked to a specific record elsewhere in the
// app (a loan, a member, a meeting, a payout, etc.) via `linked_event`, or
// stand entirely on its own ("any event").
//
// ============================================================================

export const POLL_CATEGORIES = [
  "general",
  "official_election",
  "loan_approval",
  "expenditure_approval",
  "new_member_approval",
  "member_discipline",
  "contribution_change",
  "merry_go_round_order",
  "constitution_amendment",
  "investment_decision",
  "agm_resolution",
  "other",
];

export const POLL_TYPES = ["yes_no", "single_choice", "multi_choice", "election"];

export const POLL_ELIGIBILITY = ["all_members", "officials_only"];

export const POLL_REVEAL_MODES = ["live", "after_close"];

export const POLL_STATUSES = ["draft", "open", "closed", "cancelled"];

export const LINKED_EVENT_TYPES = [
  "none",
  "meeting",
  "loan",
  "member",
  "contribution_plan",
  "payout",
  "goal",
];

const pollOptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: false }
);

const pollBallotSchema = new mongoose.Schema(
  {
    membership_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    option_ids: { type: [String], required: true, validate: (v) => Array.isArray(v) && v.length > 0 },
    voted_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const pollSchema = new mongoose.Schema(
  {
    // ------------------------------------------------------------------
    // WORKSPACE
    // ------------------------------------------------------------------
    workspace_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    workspace_type: {
      type: String,
      enum: ["Chama", "ContributionGroup"],
      required: true,
      index: true,
    },

    // ------------------------------------------------------------------
    // CONTENT
    // ------------------------------------------------------------------
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    category: { type: String, enum: POLL_CATEGORIES, default: "general", index: true },

    // ------------------------------------------------------------------
    // BALLOT SHAPE
    // ------------------------------------------------------------------
    poll_type: { type: String, enum: POLL_TYPES, default: "single_choice" },
    options: {
      type: [pollOptionSchema],
      validate: (v) => Array.isArray(v) && v.length >= 2,
    },

    // Optional link to any other record in the system this poll decides.
    linked_event: {
      type: {
        type: String,
        enum: LINKED_EVENT_TYPES,
        default: "none",
      },
      ref_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    },

    // ------------------------------------------------------------------
    // RULES
    // ------------------------------------------------------------------
    eligibility: { type: String, enum: POLL_ELIGIBILITY, default: "all_members" },
    anonymous: { type: Boolean, default: false },
    reveal_results: { type: String, enum: POLL_REVEAL_MODES, default: "live" },
    quorum_percent: { type: Number, min: 0, max: 100, default: 50 },
    pass_threshold_percent: { type: Number, min: 1, max: 100, default: 50 },

    // ------------------------------------------------------------------
    // LIFECYCLE
    // ------------------------------------------------------------------
    status: { type: String, enum: POLL_STATUSES, default: "draft", index: true },
    opens_at: { type: Date, default: null },
    closes_at: { type: Date, default: null },

    // Snapshot taken at publish time so results stay meaningful even if
    // membership changes while the poll is open.
    eligible_count_snapshot: { type: Number, default: 0 },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    published_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    published_at: { type: Date, default: null },
    closed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    closed_at: { type: Date, default: null },
    closed_reason: { type: String, enum: ["manual", "deadline", "full_turnout", "cancelled"], default: null },

    // ------------------------------------------------------------------
    // BALLOTS
    // ------------------------------------------------------------------
    ballots: { type: [pollBallotSchema], default: [] },

    // ------------------------------------------------------------------
    // COMPUTED RESULT (populated on close, or live if reveal_results=live)
    // ------------------------------------------------------------------
    result: {
      computed_at: { type: Date, default: null },
      total_eligible: { type: Number, default: 0 },
      total_votes: { type: Number, default: 0 },
      turnout_percent: { type: Number, default: 0 },
      quorum_met: { type: Boolean, default: false },
      tally: [
        {
          option_id: String,
          text: String,
          count: { type: Number, default: 0 },
          percent: { type: Number, default: 0 },
          approved: { type: Boolean, default: null },
        },
      ],
      outcome: {
        type: String,
        enum: ["passed", "rejected", "no_quorum", "no_majority", "tied", "decided", "n/a"],
        default: "n/a",
      },
      winning_option_id: { type: String, default: null },
    },
  },
  { timestamps: true }
);

pollSchema.index({ workspace_id: 1, status: 1, createdAt: -1 });
pollSchema.index({ status: 1, closes_at: 1 });

export default mongoose.models.Poll || mongoose.model("Poll", pollSchema);
