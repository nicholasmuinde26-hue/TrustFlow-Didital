import * as operations from "./chamaOperations.service.js";
import AppError from "../../utils/AppError.js";
import * as profiles from "./publicProfiles.service.js";

const send = (handler) => async (req, res, next) => { try { const data = await handler(req); res.json({ success: true, data }); } catch (error) { next(error); } };
const official = async (req) => { await operations.assertActiveTreasurer(req.chama._id); operations.requireRole(req.membership, operations.officialRoles); };

export const getCommandCenter = send((req) => operations.dashboard(req.chama._id, req.membership));
export const getProfile = send((req) => operations.getProfile(req.chama._id));
export const saveProfile = send(async (req) => {
  await operations.assertActiveTreasurer(req.chama._id);
  operations.requireRole(req.membership, ["chairperson", "treasurer"]);
  if (req.membership.role !== "chairperson" && ["kyc_requirements", "public_profile"].some((field) => Object.hasOwn(req.body || {}, field))) {
    throw new AppError("Only the chairperson can manage KYC requirements and the public Chama profile", 403);
  }
  return operations.updateProfile(req.chama._id, req.body);
});
export const setOfficial = send(async (req) => {
  operations.requireRole(req.membership, ["chairperson"]);
  // Appointing a Treasurer is the exception that unlocks the Chama.
  // Every other official-role change requires an active Treasurer.
  if (req.body?.role !== "treasurer") {
    await operations.assertActiveTreasurer(req.chama._id);
  }
  return operations.assignOfficial(req.chama._id, req.params.membershipId, req.body.role);
});
export const addGoal = send(async (req) => { await official(req); return operations.createGoal(req.chama._id, req.user._id, req.body); });
export const submitKyc = send((req) => operations.submitKyc(req.chama._id, req.membership._id, req.body));
export const verifyKyc = send(async (req) => {
  await operations.assertActiveTreasurer(req.chama._id);
  operations.requireRole(req.membership, ["chairperson", "treasurer"]);
  if (String(req.params.membershipId) === String(req.membership._id)) throw new AppError("You cannot review your own KYC submission", 403);
  return operations.reviewKyc(req.chama._id, req.params.membershipId, req.user._id, req.body.status, req.body.reason);
});
export const getPublicProfile = send((req) => operations.getPublicProfile(req.params.chamaId));
export const makeInvite = send(async (req) => { await official(req); return operations.createInvite(req.chama._id, req.user._id, req.body); });
// Loans moved to the dedicated loan module — see modules/loans/loan.routes.js
// mounted at /api/v1/chamas/:chamaId/loans (spec: full loan lifecycle engine).
export const createMeetingRecord = send(async (req) => { await official(req); return operations.createMeetingRecord(req.chama._id, req.user._id, req.body); });
export const checkInMeeting = send((req) => operations.checkIn(req.chama._id, req.params.meetingId, req.membership));
export const castVote = send((req) => operations.vote(req.chama._id, req.params.meetingId, req.membership, req.body.voteIndex, req.body.option));
export const saveMeetingRecord = send(async (req) => { await official(req); return operations.updateMeetingRecord(req.chama._id, req.params.meetingId, req.body); });

import * as moduleChangeService from "../workspaces/workspacemodulechange.service.js";

export const getModuleSettings = send((req) => moduleChangeService.getModuleSettings(req.chama._id));
export const requestModuleChange = send(async (req) => {
  operations.requireRole(req.membership, ["chairperson"]);
  return moduleChangeService.requestModuleChange({
    chamaId: req.chama._id,
    userId: req.user._id,
    membershipId: req.membership._id,
    modules: req.body.modules,
    note: req.body.note,
  });
});
export const cancelModuleChange = send(async (req) => {
  operations.requireRole(req.membership, ["chairperson", "secretary", "treasurer"]);
  return moduleChangeService.cancelModuleChange({
    chamaId: req.chama._id,
    requestId: req.params.requestId,
    userId: req.user._id,
    membershipId: req.membership._id,
    reason: req.body?.reason,
  });
});

// ========================================
// PUBLIC PROFILES + KYC DOCUMENTS + CHAMA KYC
// ========================================

// Anyone may view a person's card that its owner made public; members may
// also see "members" cards. optionalAuth supplies req.user when present.
export const getPersonProfile = send((req) => profiles.getPersonProfile(req.params.chamaId, req.params.membershipId, req.user, { includeImage: true }));
export const getPersonImage = async (req, res, next) => {
  try {
    const { contentType, buffer } = await profiles.getPersonImage(req.params.chamaId, req.params.membershipId, req.user);
    res.set({ "Content-Type": contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" });
    res.send(buffer);
  } catch (error) { next(error); }
};
export const getMyPublicProfile = send((req) => profiles.getMyPublicProfile(req.chama._id, req.membership._id));
export const saveMyPublicProfile = send((req) => profiles.saveMyPublicProfile(req.chama._id, req.membership._id, req.body));
export const saveChamaPublicProfile = send(async (req) => {
  operations.requireRole(req.membership, ["chairperson", "secretary"]);
  return profiles.updateChamaPublicProfile(req.chama._id, req.body);
});
export const getChamaPublicSettings = send(async (req) => {
  operations.requireRole(req.membership, ["chairperson", "secretary"]);
  return profiles.readChamaPublicSettings(req.chama._id);
});

export const getKycDocuments = send(async (req) => {
  operations.requireRole(req.membership, ["chairperson", "treasurer"]);
  if (String(req.params.membershipId) === String(req.membership._id)) throw new AppError("You cannot open your own KYC documents for review", 403);
  return profiles.getKycDocuments(req.chama._id, req.params.membershipId);
});

export const getOrgKyc = send(async (req) => {
  operations.requireRole(req.membership, ["chairperson", "treasurer", "secretary"]);
  return profiles.getOrgKyc(req.chama._id);
});
export const submitOrgKyc = send(async (req) => {
  operations.requireRole(req.membership, ["chairperson"]);
  return profiles.submitOrgKyc(req.chama._id, req.user._id, req.body);
});
