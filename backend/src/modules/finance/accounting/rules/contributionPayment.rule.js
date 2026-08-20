/**
 * ============================================================================
 * CONTRIBUTION PAYMENT ACCOUNTING RULE
 * ============================================================================
 */

import mongoose from "mongoose";
import FinancialAccount from "../../../../models/FinancialAccount.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

// FIXED: added :
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class ContributionPaymentRule {

    name = "CONTRIBUTION_PAYMENT";

   async resolveAccounts(context, session = null) {
    const opts = getOpts(session);
    const inner = context?.context || {};
    const metadata = context?.metadata || inner?.metadata || {};

    const owner_type =
        context?.owner_type ||
        inner?.owner_type ||
        metadata?.owner_type ||
        "Chama";

    // FIX: Added context.chamaId and context.chama_id
    const owner_id =
        context?.owner_id ||
        context?.chamaId || // <-- ADD THIS
        context?.chama_id || // <-- ADD THIS
        inner?.owner_id ||
        inner?.chamaId ||
        inner?.chama_id ||
        metadata?.owner_id ||
        metadata?.chamaId ||
        metadata?.chama_id;

    if (!owner_id) {
        console.error("[ContributionPaymentRule] Missing owner_id.", { context, metadata });
        throw new Error("owner_id is required for contribution payment");
    }

    const paymentMethod = metadata?.payment_method || metadata?.paymentMethod || 'cash';

    const assetAccountCodeMap = {
        cash: 'CASH',
        bank: 'BANK',
        mpesa: 'MPESA_CLEARING'
    };
    let assetAccountCode = assetAccountCodeMap[paymentMethod] || 'CASH';

    let assetAccount = await FinancialAccount.findOne({
        owner_type, owner_id, account_code: assetAccountCode
    }, null, opts);

    if (!assetAccount && assetAccountCode === 'MPESA_CLEARING') {
        assetAccount = await FinancialAccount.findOne({
            owner_type, owner_id, account_code: 'BANK'
        }, null, opts);
        if (assetAccount) {
            console.warn(`MPESA_CLEARING not found. Falling back to BANK for ${owner_id}`);
        }
    }

    let equityAccount = await FinancialAccount.findOne({
        owner_type, owner_id, account_code: "MEMBER_CONTRIBUTIONS"
    }, null, opts);

    if (!assetAccount ||!equityAccount) {
        await FinancialAccount.bootstrapSystemAccounts({
          owner_type,
          owner_id,
          created_by: context.created_by
        }, session);

        if (!assetAccount) {
            assetAccount = await FinancialAccount.findOne({
                owner_type, owner_id, account_code: assetAccountCode
            }, null, opts);
        }
        if (!equityAccount) {
            equityAccount = await FinancialAccount.findOne({
                owner_type, owner_id, account_code: "MEMBER_CONTRIBUTIONS"
            }, null, opts);
        }
    }

    if (!assetAccount) {
        throw new Error(`${assetAccountCode} account not configured.`);
    }
    if (!equityAccount) {
        throw new Error("MEMBER_CONTRIBUTIONS account not configured.");
    }

    return {
        debitAccount: assetAccount._id,
        creditAccount: equityAccount._id
    };
}

    async build(event, session = null) { // FIX: was 'context'
    const accounts = await this.resolveAccounts(event.context, session);

    return {
        transactionType: "CONTRIBUTION_PAYMENT",
        referenceType: "CONTRIBUTION_PAYMENT",
        referenceId: event.payment.reference, // FIX
        organization: event.context.organization,
        entries: [
            {
                account_id: accounts.debitAccount,
                entryType: "DEBIT",
                amount: event.payment.amount, // FIX: was context.amount
                description: `Contribution payment ${event.payment.reference}`
            },
            {
                account_id: accounts.creditAccount,
                entryType: "CREDIT",
                amount: event.payment.amount, // FIX
                description: `Contribution payment ${event.payment.reference}`
            }
        ],
        metadata: {
            member: event.context.metadata?.participant_id,
            contributionPlan: event.context.metadata?.contribution_plan_id,
            obligation_id: event.context.metadata?.obligation_id,
            payment_method: event.context.metadata?.payment_method,
            owner_type: event.context.metadata?.owner_type || 'Chama',
            owner_id: event.context.metadata?.owner_id || event.context.metadata?.chamaId
        }
    };
}
}

export default new ContributionPaymentRule();