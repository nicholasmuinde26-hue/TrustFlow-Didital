/**
 * ============================================================================
 * ACCOUNTING SERVICE
 * ============================================================================
 */
import mongoose from "mongoose";

import contributionPaymentRule from "./rules/contributionPayment.rule.js";
import payoutRule from "./rules/payout.rule.js";
import withdrawalRule from "./rules/withdrawal.rule.js";
import savingsShareoutRule from "./rules/savingsShareout.rule.js";
import chamaContributionPayoutRule from "./rules/chamaContributionPayout.rule.js";
import chamaAssetIncomeRule from "./rules/chamaAssetIncome.rule.js";
import chamaAssetExpenseRule from "./rules/chamaAssetExpense.rule.js";
import chamaAssetPurchaseRule from "./rules/chamaAssetPurchase.rule.js";
import chamaProfitDistributionRule from "./rules/chamaProfitDistribution.rule.js";
import businessFundsReclassRule from "./rules/businessFundsReclass.rule.js";
import adjustmentRule from "./rules/adjustment.rule.js";
import accountingValidator from "./accounting.validator.js";
import journalService from "./journal.service.js";
import ledgerService from "./ledger.service.js";
import financeAccountService from "../financeAccount.service.js";
import financeTransactionService from "../financeTransaction.service.js";
import { assertPeriodOpen } from "./periodGuard.service.js";

// Helper: detect if mongo supports transactions
const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

// Helper: only add session to opts if transactions are supported
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class AccountingService {
    constructor(){
        this.rules = {
            CONTRIBUTION_PAYMENT: contributionPaymentRule,
            PAYOUT_OBLIGATION: payoutRule,
            PAYOUT_SETTLEMENT: payoutRule,
            PAYOUT_CANCELLATION: payoutRule,
            WITHDRAWAL_OBLIGATION: withdrawalRule,
            WITHDRAWAL_SETTLEMENT: withdrawalRule,
            WITHDRAWAL_CANCELLATION: withdrawalRule,
            SAVINGS_SHAREOUT_OBLIGATION: savingsShareoutRule,
            SAVINGS_SHAREOUT_SETTLEMENT: savingsShareoutRule,
            SAVINGS_SHAREOUT_CANCELLATION: savingsShareoutRule,
            CHAMA_CONTRIB_PAYOUT_SETTLEMENT: chamaContributionPayoutRule,
            CHAMA_ASSET_INCOME_POSTING: chamaAssetIncomeRule,
            CHAMA_ASSET_EXPENSE_POSTING: chamaAssetExpenseRule,
            CHAMA_ASSET_PURCHASE_POSTING: chamaAssetPurchaseRule,
            // These three were posted by chamaAsset.service.js (postProfitLedger) but had
            // no registered rule, so every profit distribution failed at the ledger step.
            CHAMA_PROFIT_DISTRIBUTION_POSTING: chamaProfitDistributionRule,
            CHAMA_PROFIT_WALLET_CREDIT_POSTING: chamaProfitDistributionRule,
            CHAMA_PROFIT_WALLET_WITHDRAWAL_POSTING: chamaProfitDistributionRule,
            BUSINESS_FUNDS_RECLASS: businessFundsReclassRule,
            LEDGER_ADJUSTMENT_POSTING: adjustmentRule
        };
    }

    async post(context, session = null){ // ADD session param here
        const opts = getOpts(session);

        // Reject anything dated inside a closed financial year before any write.
        const postingDate = await assertPeriodOpen(context, opts);

        const rule = this.getRule(context.referenceType || context.transactionType);

        const posting = await rule.build(context, session); // pass session down

        accountingValidator.validate(posting);

        const transaction = await financeTransactionService.create(context, session);

        const journal = await journalService.create(posting, transaction, session);

        // Stamp the date the guard checked, so ledger posted_at (what year-end reads)
        // cannot differ from the date that was validated.
        const datedEntries = posting.entries.map((entry) => ({ ...entry, posted_at: entry.posted_at || postingDate }));

        const ledgerEntries = await ledgerService.createEntries(journal, transaction, datedEntries, session);

        await financeAccountService.applyEntries(ledgerEntries, session);

        const postedJournal = await journalService.markPosted(journal._id, session, postingDate);

        if (typeof posting.afterPost === "function") {
            await posting.afterPost({ transaction, journal: postedJournal, ledgerEntries }, session);
        }

        return {
            success: true,
            journalId: postedJournal._id,
            transactionId: transaction._id, // use transaction._id, not postedJournal.transaction
            ledgerEntries
        };
    }

    getRule(type){
        const rule = this.rules[type];
        if(!rule){
            throw new Error(`No accounting rule registered for ${type}`);
        }
        return rule;
    }
}

export default new AccountingService();
