import ContributionDonor from '../models/ContributionDonor.js';
import ContributionGroup from '../models/ContributionGroup.js';
import PaymentIntent from '../models/PaymentIntent.js';
import { sendPublicGivingReceiptEmail } from './notifications/email.service.js';

// Best-effort, deduplicated donor receipt for a successfully settled public gift.
export async function sendPublicGivingReceipt(paymentIntentId) {
  const claimExpiredAt = new Date(Date.now() - 10 * 60_000);
  const intent = await PaymentIntent.findOneAndUpdate(
    { _id: paymentIntentId, 'metadata.publicDonation': true, 'metadata.publicReceiptEmailSentAt': { $exists: false }, $or: [{ 'metadata.publicReceiptEmailClaimedAt': { $exists: false } }, { 'metadata.publicReceiptEmailClaimedAt': { $lt: claimExpiredAt } }] },
    { $set: { 'metadata.publicReceiptEmailClaimedAt': new Date() } },
    { new: true },
  );
  if (!intent || intent.status !== 'completed') return false;
  try {
    const donorId = intent.metadata?.donorId || intent.participant_id;
    const [donor, group] = await Promise.all([
      ContributionDonor.findById(donorId).select('display_name email'),
      ContributionGroup.findById(intent.owner_id).select('name'),
    ]);
    if (!donor?.email) {
      await PaymentIntent.updateOne({ _id: intent._id }, { $unset: { 'metadata.publicReceiptEmailClaimedAt': 1 } });
      return false;
    }
    await sendPublicGivingReceiptEmail({
      to: donor.email,
      name: donor.display_name,
      amount: Number(intent.amount?.toString?.() ?? intent.amount).toLocaleString('en-KE'),
      causeName: group?.name || 'the fundraiser',
      reference: intent.reference,
    });
    await PaymentIntent.updateOne({ _id: intent._id }, { $set: { 'metadata.publicReceiptEmailSentAt': new Date() }, $unset: { 'metadata.publicReceiptEmailClaimedAt': 1 } });
    return true;
  } catch (error) {
    await PaymentIntent.updateOne({ _id: intent._id }, { $unset: { 'metadata.publicReceiptEmailClaimedAt': 1 } }).catch(() => {});
    console.error(JSON.stringify({ level: 'error', event: 'public_giving_receipt_failed', paymentIntentId: String(intent._id), message: error.message }));
    return false;
  }
}
