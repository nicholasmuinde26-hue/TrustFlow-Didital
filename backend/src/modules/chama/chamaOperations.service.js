import crypto from "node:crypto";
import AppError from "../../utils/AppError.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ChamaProfile from "../../models/ChamaProfile.js";
import ChamaGoal from "../../models/ChamaGoal.js";
import ChamaLoan from "../../models/ChamaLoan.js";
import ChamaMemberKyc from "../../models/ChamaMemberKyc.js";
import ChamaMeetingRecord from "../../models/ChamaMeetingRecord.js";
import ChamaInvitation from "../../models/ChamaInvitation.js";

export const officialRoles = ["chairperson", "treasurer", "secretary"];
export const canManage = (membership) => officialRoles.includes(membership.role);
export const requireRole = (membership, roles) => { if (!roles.includes(membership.role)) throw new AppError("You do not have permission for this Chama action", 403); };

export async function dashboard(chamaId, membership) {
  const [profile, goals, loans, kyc, meetings, officials, members] = await Promise.all([
    ChamaProfile.findOne({ chama_id: chamaId }), ChamaGoal.find({ chama_id: chamaId, status: "active" }).sort({ createdAt: -1 }),
    ChamaLoan.find(canManage(membership) ? { chama_id: chamaId } : { chama_id: chamaId, membership_id: membership._id }).sort({ createdAt: -1 }), ChamaMemberKyc.findOne({ chama_id: chamaId, membership_id: membership._id }),
    ChamaMeetingRecord.find({ chama_id: chamaId }).sort({ createdAt: -1 }).limit(5), ChamaMembership.find({ chama_id: chamaId, status: "active", role: { $in: officialRoles } }).populate("user_id", "name phone"), ChamaMembership.find({ chama_id: chamaId, status: "active" }).populate("user_id", "name phone")
  ]);
  return { profile, goals, loans, kyc, meetings, officials, members, membership };
}
export async function getProfile(chamaId) {
  let profile = await ChamaProfile.findOne({ chama_id: chamaId });
  if (!profile) {
    profile = await ChamaProfile.findOneAndUpdate(
      { chama_id: chamaId },
      { $setOnInsert: { chama_id: chamaId, contribution_cycle: "monthly", fine_amount: 0 } },
      { upsert: true, new: true }
    );
  }
  return profile;
}

export async function updateProfile(chamaId, data) { return ChamaProfile.findOneAndUpdate({ chama_id: chamaId }, { $set: { ...data, chama_id: chamaId } }, { new: true, upsert: true, runValidators: true }); }
export async function assignOfficial(chamaId, membershipId, role) { if (!officialRoles.includes(role)) throw new AppError("Role must be chairperson, treasurer, or secretary", 400); const member = await ChamaMembership.findOneAndUpdate({ _id: membershipId, chama_id: chamaId, status: "active" }, { role }, { new: true }); if (!member) throw new AppError("Active member not found", 404); return member; }
export async function createGoal(chamaId, userId, data) { if (!data.name || Number(data.target_amount) <= 0) throw new AppError("Goal name and target amount are required", 400); return ChamaGoal.create({ chama_id: chamaId, name: data.name, target_amount: data.target_amount, target_date: data.target_date || null, created_by: userId }); }
export async function submitKyc(chamaId, membershipId, data) { if (!data.id_number || !data.selfie_url || !data.id_document_url) throw new AppError("ID number, ID document URL, and selfie URL are required", 400); return ChamaMemberKyc.findOneAndUpdate({ chama_id: chamaId, membership_id: membershipId }, { $set: { id_number: data.id_number, selfie_url: data.selfie_url, id_document_url: data.id_document_url, status: "pending", reviewed_by: null, reviewed_at: null } }, { upsert: true, new: true, runValidators: true }); }
export async function reviewKyc(chamaId, membershipId, userId, status) { if (!["verified", "rejected"].includes(status)) throw new AppError("Invalid KYC review status", 400); const kyc = await ChamaMemberKyc.findOneAndUpdate({ chama_id: chamaId, membership_id: membershipId }, { status, reviewed_by: userId, reviewed_at: new Date() }, { new: true }); if (!kyc) throw new AppError("KYC submission not found", 404); return kyc; }
export async function createInvite(chamaId, userId, data) { const token = crypto.randomBytes(24).toString("hex"); const invitation = await ChamaInvitation.create({ chama_id: chamaId, phone: data.phone || null, role: data.role || "member", token, invited_by: userId, expires_at: new Date(Date.now() + 7 * 86400000) }); return { invitation, token, join_path: `/chamas/join?token=${token}` }; }
export async function acceptInvite(token, userId) { const invite = await ChamaInvitation.findOne({ token, accepted_at: null, expires_at: { $gt: new Date() } }); if (!invite) throw new AppError("Invitation is invalid or expired", 404); const member = await ChamaMembership.findOneAndUpdate({ chama_id: invite.chama_id, user_id: userId }, { $setOnInsert: { invited_by: invite.invited_by, joined_at: new Date(), payout_position: 999 }, $set: { role: invite.role, status: "active", accepted_at: new Date() } }, { upsert: true, new: true }); invite.accepted_at = new Date(); await invite.save(); return member; }
// Loan application/approval/disbursement now live in modules/loans/*
// (loanApplication.service.js, loanApproval.service.js, loanDisbursement.service.js).
// `dashboard()` above still reads ChamaLoan directly for the command-center feed.
export async function createMeetingRecord(chamaId, userId, data) { if (!data.title) throw new AppError("Meeting title is required", 400); return ChamaMeetingRecord.create({ chama_id: chamaId, title: data.title, agenda: (data.agenda || []).map((text) => ({ text })), status: "live", created_by: userId }); }
export async function checkIn(chamaId, meetingId, membership) { const meeting = await ChamaMeetingRecord.findOne({ _id: meetingId, chama_id: chamaId, status: "live" }); if (!meeting) throw new AppError("Live meeting not found", 404); if (!meeting.attendance.some((item) => String(item.membership_id) === String(membership._id))) meeting.attendance.push({ membership_id: membership._id, checked_in_at: new Date(), check_in_code: crypto.randomUUID() }); await meeting.save(); return meeting; }
export async function vote(chamaId, meetingId, membership, voteIndex, option) { const meeting = await ChamaMeetingRecord.findOne({ _id: meetingId, chama_id: chamaId, status: "live" }); const vote = meeting?.votes?.[Number(voteIndex)]; if (!vote || !vote.options.includes(option)) throw new AppError("Vote or option not found", 404); if (vote.ballots.some((item) => String(item.membership_id) === String(membership._id))) throw new AppError("You have already voted", 409); vote.ballots.push({ membership_id: membership._id, option }); await meeting.save(); return meeting; }
export async function updateMeetingRecord(chamaId, meetingId, data) { const meeting = await ChamaMeetingRecord.findOne({ _id: meetingId, chama_id: chamaId }); if (!meeting) throw new AppError("Meeting record not found", 404); if (data.minutes !== undefined) meeting.minutes = data.minutes; if (data.new_vote?.question && Array.isArray(data.new_vote.options)) meeting.votes.push({ question: data.new_vote.question, options: data.new_vote.options, ballots: [] }); if (data.close) { meeting.status = "closed"; meeting.votes.forEach((vote) => { const totals = vote.ballots.reduce((all, ballot) => ({ ...all, [ballot.option]: (all[ballot.option] || 0) + 1 }), {}); vote.resolution = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] || "No votes cast"; }); } await meeting.save(); return meeting; }