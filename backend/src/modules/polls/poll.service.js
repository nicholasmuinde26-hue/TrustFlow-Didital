import crypto from "node:crypto";
import mongoose from "mongoose";

import Chama from "../../models/Chama.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionGroup from "../../models/ContributionGroup.js";
import ContributionGroupMember from "../../models/ContributionGroupMember.js";
import Poll, { POLL_CATEGORIES, POLL_TYPES, POLL_ELIGIBILITY, POLL_REVEAL_MODES } from "../../models/Poll.js";
import AppError from "../../utils/AppError.js";

// ============================================================================
// OFFICIAL ROLES PER WORKSPACE TYPE
// ============================================================================
//
// Mirrors the roles allowed to manage announcements (see
// modules/announcements/announcement.controller.js) — polls are a form of
// formal workspace communication/decision-making, so the same people who
// can post an official announcement can call and manage a vote.
//
// ============================================================================

const CHAMA_OFFICIAL_ROLES = ["chairperson", "secretary", "treasurer"];
const CONTRIBUTION_GROUP_OFFICIAL_ROLES = ["organizer", "co_organizer"];

// ============================================================================
// WORKSPACE CONTEXT
// ============================================================================

export async function getWorkspaceContext(workspaceId, userId) {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new AppError("Invalid workspace ID", 400);
  }

  if (await Chama.exists({ _id: workspaceId })) {
    const membership = await ChamaMembership.findOne({
      chama_id: workspaceId,
      user_id: userId,
      status: "active",
    }).select("role");
    if (!membership) throw new AppError("You are not an active member of this workspace", 403);
    return {
      workspaceType: "Chama",
      membershipId: membership._id,
      role: membership.role,
      canManage: CHAMA_OFFICIAL_ROLES.includes(membership.role),
    };
  }

  if (await ContributionGroup.exists({ _id: workspaceId })) {
    const membership = await ContributionGroupMember.findOne({
      contribution_group_id: workspaceId,
      user_id: userId,
      status: "active",
    }).select("role");
    if (!membership) throw new AppError("You are not an active member of this workspace", 403);
    return {
      workspaceType: "ContributionGroup",
      membershipId: membership._id,
      role: membership.role,
      canManage: CONTRIBUTION_GROUP_OFFICIAL_ROLES.includes(membership.role),
    };
  }

  throw new AppError("Workspace not found", 404);
}

async function countEligibleMembers(workspaceType, workspaceId, eligibility) {
  if (workspaceType === "Chama") {
    const query = { chama_id: workspaceId, status: "active" };
    if (eligibility === "officials_only") query.role = { $in: CHAMA_OFFICIAL_ROLES };
    return ChamaMembership.countDocuments(query);
  }

  const query = { contribution_group_id: workspaceId, status: "active" };
  if (eligibility === "officials_only") query.role = { $in: CONTRIBUTION_GROUP_OFFICIAL_ROLES };
  return ContributionGroupMember.countDocuments(query);
}

function isEligibleVoter(context, eligibility) {
  if (eligibility !== "officials_only") return true;
  return context.canManage;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function slugOptionId(text, index) {
  const base = String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "option"}-${index}-${crypto.randomBytes(2).toString("hex")}`;
}

function buildOptions(pollType, submittedOptions) {
  if (pollType === "yes_no") {
    return [
      { id: "yes", text: "Yes" },
      { id: "no", text: "No" },
    ];
  }

  if (!Array.isArray(submittedOptions) || submittedOptions.length < 2) {
    throw new AppError("At least 2 options are required for this poll type", 400);
  }

  const texts = submittedOptions.map((o) => (typeof o === "string" ? o : o?.text)).map((t) => String(t || "").trim());

  if (texts.some((t) => t.length < 1)) {
    throw new AppError("Every option needs text", 400);
  }

  const unique = new Set(texts.map((t) => t.toLowerCase()));
  if (unique.size !== texts.length) {
    throw new AppError("Poll options must be unique", 400);
  }

  return texts.map((text, index) => ({ id: slugOptionId(text, index), text }));
}

// ============================================================================
// DTO
// ============================================================================

export function toPollDTO(poll, { context, memberNames } = {}) {
  const p = poll.toObject ? poll.toObject() : poll;

  const myMembershipId = context?.membershipId ? String(context.membershipId) : null;
  const myBallot = myMembershipId
    ? p.ballots.find((b) => String(b.membership_id) === myMembershipId)
    : null;

  const isOfficial = Boolean(context?.canManage);
  const isOpen = p.status === "open";
  const resultsHidden =
    p.reveal_results === "after_close" && p.status !== "closed" && p.status !== "cancelled";

  let result = null;
  if (!resultsHidden && p.result?.computed_at) {
    result = {
      totalEligible: p.result.total_eligible,
      totalVotes: p.result.total_votes,
      turnoutPercent: p.result.turnout_percent,
      quorumMet: p.result.quorum_met,
      outcome: p.result.outcome,
      winningOptionId: p.result.winning_option_id,
      tally: p.result.tally.map((t) => ({
        optionId: t.option_id,
        text: t.text,
        count: t.count,
        percent: t.percent,
        approved: t.approved,
      })),
    };
  }

  return {
    id: p._id,
    workspaceId: p.workspace_id,
    workspaceType: p.workspace_type,
    title: p.title,
    description: p.description,
    category: p.category,
    pollType: p.poll_type,
    options: p.options.map((o) => ({ id: o.id, text: o.text })),
    linkedEvent: p.linked_event?.type && p.linked_event.type !== "none" ? p.linked_event : null,
    eligibility: p.eligibility,
    anonymous: p.anonymous,
    revealResults: p.reveal_results,
    quorumPercent: p.quorum_percent,
    passThresholdPercent: p.pass_threshold_percent,
    status: p.status,
    opensAt: p.opens_at,
    closesAt: p.closes_at,
    eligibleCountSnapshot: p.eligible_count_snapshot,
    createdBy: p.created_by,
    publishedAt: p.published_at,
    closedAt: p.closed_at,
    closedReason: p.closed_reason,
    createdAt: p.createdAt,
    totalVotesCast: p.ballots.length,
    myVote: myBallot ? myBallot.option_ids : null,
    hasVoted: Boolean(myBallot),
    canManage: isOfficial,
    canVote: isOpen && !myBallot && isEligibleVoter(context || {}, p.eligibility),
    resultsHidden,
    result,
  };
}

// ============================================================================
// TALLYING
// ============================================================================

export function computeTally(poll) {
  const totalVotes = poll.ballots.length;
  const totalEligible = poll.eligible_count_snapshot || 0;
  const turnoutPercent = totalEligible > 0 ? Math.round((totalVotes / totalEligible) * 1000) / 10 : 0;
  const quorumMet = totalEligible === 0 ? true : turnoutPercent >= poll.quorum_percent;

  const counts = new Map(poll.options.map((o) => [o.id, 0]));
  for (const ballot of poll.ballots) {
    for (const optionId of ballot.option_ids) {
      if (counts.has(optionId)) counts.set(optionId, counts.get(optionId) + 1);
    }
  }

  const tally = poll.options.map((o) => {
    const count = counts.get(o.id) || 0;
    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 1000) / 10 : 0;
    return { option_id: o.id, text: o.text, count, percent, approved: null };
  });

  let outcome = "n/a";
  let winningOptionId = null;

  if (!quorumMet) {
    outcome = "no_quorum";
  } else if (poll.poll_type === "election") {
    const max = Math.max(0, ...tally.map((t) => t.count));
    const leaders = tally.filter((t) => t.count === max && max > 0);
    if (leaders.length === 1) {
      outcome = "decided";
      winningOptionId = leaders[0].option_id;
    } else {
      outcome = "tied";
    }
  } else if (poll.poll_type === "yes_no") {
    const yes = tally.find((t) => t.option_id === "yes");
    const no = tally.find((t) => t.option_id === "no");
    const passed = (yes?.percent || 0) >= poll.pass_threshold_percent;
    outcome = passed ? "passed" : "rejected";
    winningOptionId = passed ? yes?.option_id : no?.option_id;
  } else if (poll.poll_type === "single_choice") {
    const max = Math.max(0, ...tally.map((t) => t.count));
    const leaders = tally.filter((t) => t.count === max && max > 0);
    if (leaders.length > 1) {
      outcome = "tied";
    } else if (leaders.length === 1) {
      const leader = leaders[0];
      outcome = leader.percent >= poll.pass_threshold_percent ? "passed" : "no_majority";
      winningOptionId = leader.option_id;
    } else {
      outcome = "no_majority";
    }
  } else if (poll.poll_type === "multi_choice") {
    // Each option stands (or falls) on its own — approved if the share of
    // ALL voters (not votes cast, since one voter can pick many) choosing
    // it meets the pass threshold.
    for (const t of tally) {
      const shareOfVoters = totalVotes > 0 ? Math.round((counts.get(t.option_id) / totalVotes) * 1000) / 10 : 0;
      t.approved = shareOfVoters >= poll.pass_threshold_percent;
    }
    outcome = tally.some((t) => t.approved) ? "passed" : "rejected";
  }

  return {
    computed_at: new Date(),
    total_eligible: totalEligible,
    total_votes: totalVotes,
    turnout_percent: turnoutPercent,
    quorum_met: quorumMet,
    tally,
    outcome,
    winning_option_id: winningOptionId,
  };
}

// ============================================================================
// LIST / GET
// ============================================================================

export async function listPolls(workspaceId, { status } = {}) {
  const query = { workspace_id: workspaceId };
  if (status && status !== "all") query.status = status;
  return Poll.find(query).sort({ status: 1, createdAt: -1 });
}

export async function getPoll(workspaceId, pollId) {
  if (!mongoose.Types.ObjectId.isValid(pollId)) throw new AppError("Invalid poll ID", 400);
  const poll = await Poll.findOne({ _id: pollId, workspace_id: workspaceId });
  if (!poll) throw new AppError("Poll not found", 404);
  return poll;
}

// ============================================================================
// CREATE
// ============================================================================

export async function createPoll(workspaceId, workspaceType, userId, context, data) {
  const title = String(data.title || "").trim();
  if (title.length < 3) throw new AppError("A poll title of at least 3 characters is required", 400);

  const category = POLL_CATEGORIES.includes(data.category) ? data.category : "general";
  const pollType = POLL_TYPES.includes(data.pollType) ? data.pollType : "single_choice";
  const eligibility = POLL_ELIGIBILITY.includes(data.eligibility) ? data.eligibility : "all_members";
  const revealResults = POLL_REVEAL_MODES.includes(data.revealResults) ? data.revealResults : "live";

  const quorumPercent = data.quorumPercent !== undefined ? Number(data.quorumPercent) : 50;
  const passThresholdPercent = data.passThresholdPercent !== undefined ? Number(data.passThresholdPercent) : 50;

  if (Number.isNaN(quorumPercent) || quorumPercent < 0 || quorumPercent > 100) {
    throw new AppError("Quorum percent must be between 0 and 100", 400);
  }
  if (Number.isNaN(passThresholdPercent) || passThresholdPercent < 1 || passThresholdPercent > 100) {
    throw new AppError("Pass threshold percent must be between 1 and 100", 400);
  }

  const options = buildOptions(pollType, data.options);

  let closesAt = null;
  if (data.closesAt) {
    closesAt = new Date(data.closesAt);
    if (Number.isNaN(closesAt.getTime())) throw new AppError("Invalid closing date", 400);
    if (closesAt.getTime() <= Date.now()) throw new AppError("Closing date must be in the future", 400);
  }

  let linkedEvent = { type: "none", ref_id: null };
  if (data.linkedEvent?.type && data.linkedEvent.type !== "none") {
    if (!mongoose.Types.ObjectId.isValid(data.linkedEvent.refId)) {
      throw new AppError("Invalid linked event reference", 400);
    }
    linkedEvent = { type: data.linkedEvent.type, ref_id: data.linkedEvent.refId };
  }

  // Only officials may skip the draft step and publish immediately.
  const publishNow = Boolean(data.publish) && context.canManage;

  const poll = await Poll.create({
    workspace_id: workspaceId,
    workspace_type: workspaceType,
    title,
    description: String(data.description || "").trim(),
    category,
    poll_type: pollType,
    options,
    linked_event: linkedEvent,
    eligibility,
    anonymous: Boolean(data.anonymous),
    reveal_results: revealResults,
    quorum_percent: quorumPercent,
    pass_threshold_percent: passThresholdPercent,
    closes_at: closesAt,
    created_by: userId,
    status: "draft",
  });

  if (publishNow) {
    return publishPoll(workspaceId, poll._id, userId, context);
  }

  return poll;
}

// ============================================================================
// PUBLISH (draft -> open)
// ============================================================================

export async function publishPoll(workspaceId, pollId, userId, context) {
  if (!context.canManage) throw new AppError("Only chama officials can open a poll for voting", 403);

  const poll = await getPoll(workspaceId, pollId);
  if (poll.status !== "draft") throw new AppError("Only a draft poll can be published", 400);

  if (!poll.closes_at) {
    // Default voting window: 7 days, so a poll never lingers open forever
    // if nobody sets an explicit deadline — matches Kenyan chama practice
    // of giving members "one week to respond".
    poll.closes_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  poll.eligible_count_snapshot = await countEligibleMembers(poll.workspace_type, workspaceId, poll.eligibility);
  poll.status = "open";
  poll.opens_at = new Date();
  poll.published_by = userId;
  poll.published_at = new Date();
  await poll.save();
  return poll;
}

// ============================================================================
// VOTE
// ============================================================================

export async function castVote(workspaceId, pollId, context, optionIds) {
  const poll = await getPoll(workspaceId, pollId);

  if (poll.status !== "open") throw new AppError("This poll is not open for voting", 400);
  if (poll.closes_at && poll.closes_at.getTime() <= Date.now()) {
    // Deadline passed but the sweep job hasn't closed it yet — close it now.
    await closePollInternal(poll, null, "deadline");
    throw new AppError("Voting has closed for this poll", 400);
  }

  if (!isEligibleVoter(context, poll.eligibility)) {
    throw new AppError("Only chama officials may vote in this poll", 403);
  }

  const already = poll.ballots.some((b) => String(b.membership_id) === String(context.membershipId));
  if (already) throw new AppError("You have already voted in this poll", 409);

  const ids = Array.isArray(optionIds) ? optionIds : [optionIds];
  if (ids.length === 0) throw new AppError("Select an option to vote", 400);
  if (poll.poll_type !== "multi_choice" && ids.length > 1) {
    throw new AppError("This poll only accepts a single choice", 400);
  }

  const validIds = new Set(poll.options.map((o) => o.id));
  if (ids.some((id) => !validIds.has(id))) throw new AppError("Invalid option selected", 400);

  poll.ballots.push({ membership_id: context.membershipId, option_ids: ids, voted_at: new Date() });

  if (poll.reveal_results === "live") {
    poll.result = computeTally(poll);
  }

  // Full turnout — no reason to keep the ballot box open.
  if (poll.eligible_count_snapshot > 0 && poll.ballots.length >= poll.eligible_count_snapshot) {
    await closePollInternal(poll, null, "full_turnout");
    return poll;
  }

  await poll.save();
  return poll;
}

// ============================================================================
// CLOSE
// ============================================================================

async function closePollInternal(poll, userId, reason) {
  poll.status = "closed";
  poll.closed_at = new Date();
  poll.closed_by = userId;
  poll.closed_reason = reason;
  poll.result = computeTally(poll);
  await poll.save();
  return poll;
}

export async function closePoll(workspaceId, pollId, userId, context) {
  if (!context.canManage) throw new AppError("Only chama officials can close a poll", 403);

  const poll = await getPoll(workspaceId, pollId);
  if (poll.status !== "open") throw new AppError("Only an open poll can be closed", 400);

  return closePollInternal(poll, userId, "manual");
}

export async function cancelPoll(workspaceId, pollId, userId, context) {
  if (!context.canManage) throw new AppError("Only chama officials can cancel a poll", 403);

  const poll = await getPoll(workspaceId, pollId);
  if (!["draft", "open"].includes(poll.status)) {
    throw new AppError("Only a draft or open poll can be cancelled", 400);
  }

  poll.status = "cancelled";
  poll.closed_at = new Date();
  poll.closed_by = userId;
  poll.closed_reason = "cancelled";
  await poll.save();
  return poll;
}

// ============================================================================
// AUTO-CLOSE SWEEP (used by the background job)
// ============================================================================

export async function autoCloseExpiredPolls() {
  const expired = await Poll.find({ status: "open", closes_at: { $ne: null, $lte: new Date() } });
  const closed = [];
  for (const poll of expired) {
    await closePollInternal(poll, null, "deadline");
    closed.push(poll);
  }
  return closed;
}
