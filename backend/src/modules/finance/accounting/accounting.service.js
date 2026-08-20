/**
 * ============================================================================
 * ACCOUNTING SERVICE
 * ============================================================================
 */
import mongoose from "mongoose";

import contributionPaymentRule from "./rules/contributionPayment.rule.js";
import payoutRule from "./rules/payout.rule.js";
import accountingValidator from "./accounting.validator.js";
import journalService from "./journal.service.js";
import ledgerService from "./ledger.service.js";
import financeAccountService from "../financeAccount.service.js";
import financeTransactionService from "../financeTransaction.service.js";

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
            PAYOUT_CANCELLATION: payoutRule
        };
    }

    async post(context, session = null){ // ADD session param here
        const opts = getOpts(session);

        const rule = this.getRule(context.referenceType || context.transactionType);

        const posting = await rule.build(context, session); // pass session down

        accountingValidator.validate(posting);

        const transaction = await financeTransactionService.create(context, session);

        const journal = await journalService.create(posting, transaction, session);

        const ledgerEntries = await ledgerService.createEntries(journal, transaction, posting.entries, session);

        await financeAccountService.applyEntries(ledgerEntries, session);

        const postedJournal = await journalService.markPosted(journal._id, session);

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