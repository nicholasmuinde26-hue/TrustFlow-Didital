import * as operations from "./chamaOperations.service.js";

const send = (handler) => async (req, res, next) => { try { const data = await handler(req); res.json({ success: true, data }); } catch (error) { next(error); } };
const official = (req) => operations.requireRole(req.membership, operations.officialRoles);

export const getCommandCenter = send((req) => operations.dashboard(req.chama._id, req.membership));
export const getProfile = send((req) => operations.getProfile(req.chama._id));
export const saveProfile = send((req) => { operations.requireRole(req.membership, ["chairperson", "treasurer"]); return operations.updateProfile(req.chama._id, req.body); });
export const setOfficial = send((req) => { operations.requireRole(req.membership, ["chairperson"]); return operations.assignOfficial(req.chama._id, req.params.membershipId, req.body.role); });
export const addGoal = send((req) => { official(req); return operations.createGoal(req.chama._id, req.user._id, req.body); });
export const submitKyc = send((req) => operations.submitKyc(req.chama._id, req.membership._id, req.body));
export const verifyKyc = send((req) => { operations.requireRole(req.membership, ["chairperson"]); return operations.reviewKyc(req.chama._id, req.params.membershipId, req.user._id, req.body.status); });
export const makeInvite = send((req) => { official(req); return operations.createInvite(req.chama._id, req.user._id, req.body); });
// Loans moved to the dedicated loan module — see modules/loans/loan.routes.js
// mounted at /api/v1/chamas/:chamaId/loans (spec: full loan lifecycle engine).
export const createMeetingRecord = send((req) => { official(req); return operations.createMeetingRecord(req.chama._id, req.user._id, req.body); });
export const checkInMeeting = send((req) => operations.checkIn(req.chama._id, req.params.meetingId, req.membership));
export const castVote = send((req) => operations.vote(req.chama._id, req.params.meetingId, req.membership, req.body.voteIndex, req.body.option));
export const saveMeetingRecord = send((req) => { official(req); return operations.updateMeetingRecord(req.chama._id, req.params.meetingId, req.body); });