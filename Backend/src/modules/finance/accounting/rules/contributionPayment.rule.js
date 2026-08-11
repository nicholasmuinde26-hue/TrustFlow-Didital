/**
 * ============================================================================
 * CONTRIBUTION PAYMENT ACCOUNTING RULE
 * ============================================================================
 */

import mongoose from "mongoose"; // ADD
import FinancialAccount from "../../../../models/FinancialAccount.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class ContributionPaymentRule {

    async resolveAccounts(context, session = null) { // ADD session
        const opts = getOpts(session);
        const { owner_type, owner_id, metadata } = context;
        const paymentMethod = metadata?.payment_method || 'cash';

        // 1. Map payment method to asset account
        const assetAccountCodeMap = {
            cash: 'CASH',
            bank: 'BANK',
            mpesa: 'MPESA_CLEARING'
        };
        let assetAccountCode = assetAccountCodeMap[paymentMethod] || 'CASH';

        let assetAccount = await FinancialAccount.findOne({
            owner_type, owner_id, account_code: assetAccountCode
        }, null, opts);

        // 2. Fallback: if MPESA_CLEARING missing, use BANK
        if (!assetAccount && assetAccountCode === 'MPESA_CLEARING') {
            assetAccount = await FinancialAccount.findOne({
                owner_type, owner_id, account_code: 'BANK'
            }, null, opts);
            if (assetAccount) {
                console.warn(`MPESA_CLEARING not found. Falling back to BANK for ${owner_id}`);
            }
        }

        // 3. Use MEMBER_CONTRIBUTIONS to match your FinanceService summary
        let equityAccount = await FinancialAccount.findOne({
            owner_type, owner_id, account_code: "MEMBER_CONTRIBUTIONS"
        }, null, opts);

        // 4. Self-heal: workspaces created before account bootstrapping was
        // wired into chama/contribution-group creation (or any other gap)
        // won't have a chart of accounts yet. Rather than hard-failing every
        // contribution for them, create the missing system accounts on
        // first use. bootstrapSystemAccounts() is idempotent (findOne then
        // create), so this is safe to call even when accounts partially exist.
        if (!assetAccount || !equityAccount) {
            await FinancialAccount.bootstrapSystemAccounts({ owner_type, owner_id });

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

    async build(context, session = null) { // ADD session
        const accounts = await this.resolveAccounts(context, session);

        return {
            transactionType: "CONTRIBUTION_PAYMENT",
            referenceType: "CONTRIBUTION_PAYMENT",
            referenceId: context.referenceId,
            organization: context.organization,
            entries: [
                {
                    account_id: accounts.debitAccount,
                    entryType: "DEBIT",
                    amount: context.amount,
                    description: `Contribution payment ${context.referenceId}`
                },
                {
                    account_id: accounts.creditAccount,
                    entryType: "CREDIT",
                    amount: context.amount,
                    description: `Contribution payment ${context.referenceId}`
                }
            ],
            metadata: {
                member: context.metadata?.participant_id,
                contributionPlan: context.metadata?.contribution_plan_id,
                obligation_id: context.metadata?.obligation_id,
                payment_method: context.metadata?.payment_method
            }
        };
    }
}

export default new ContributionPaymentRule();