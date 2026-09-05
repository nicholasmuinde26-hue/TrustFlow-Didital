/**
 * ============================================================================
 * FINANCE ENGINE
 * ============================================================================
 *
 * Responsibilities:
 *
 * 1. Listen for completed payment events
 * 2. Route payments to the correct accounting rule
 * 3. Build double-entry accounting entries
 * 4. Create the FinancialTransaction header
 * 5. Apply Ledger/Account entries
 * 6. Mark the transaction as posted
 * 7. Link the financial transaction back to the payment
 *
 * ============================================================================
 */

import mongoose from "mongoose";

import paymentEventBus from "../../payment/payment.event.bus.js";
import { PAYMENT_EVENTS } from "../../payment/payment.constants.js";

import financeTransactionService from "./financeTransaction.service.js";
import financeAccountService from "./financeAccount.service.js";
import journalService from "./accounting/journal.service.js";
import ledgerService from "./accounting/ledger.service.js";

import ContributionPayment from "../../models/ContributionPayment.js";

// ============================================================================
// ACCOUNTING RULES
// ============================================================================

import savingsDepositRule from "./accounting/rules/savingsPayment.rule.js";
import contributionPaymentRule from "./accounting/rules/contributionPayment.rule.js";
import mgrContributionRule from "./accounting/rules/mgrContribution.rule.js";


// ============================================================================
// ACCOUNTING RULE REGISTRY
// ============================================================================

const RULES = [
    savingsDepositRule,
    contributionPaymentRule,
    mgrContributionRule,
];


// ============================================================================
// RULE â†’ FINANCIAL TRANSACTION TYPE
// ============================================================================
//
// Accounting rule names are internal accounting identifiers.
//
// FinancialTransaction.transaction_type uses its own enum.
//
// Example:
//
// SAVINGS_DEPOSIT
//        â†“
// deposit
//
// CONTRIBUTION_PAYMENT
//        â†“
// contribution_payment
//
// ============================================================================

const TRANSACTION_TYPE_BY_RULE = {
    SAVINGS_DEPOSIT: "deposit",
    CONTRIBUTION_PAYMENT: "contribution_payment",
    MGR_CONTRIBUTION: "mgr_contribution",
};


// ============================================================================
// MONGODB TRANSACTION SUPPORT
// ============================================================================

const canUseTransactions = () => {
    const topology = mongoose.connection?.client?.topology;

    const topologyType = topology?.description?.type;

    return (
        topologyType === "ReplicaSetWithPrimary" ||
        topologyType === "Sharded"
    );
};


const getOpts = (session) =>
    canUseTransactions() && session
        ? { session }
        : {};


// ============================================================================
// FINANCE ENGINE
// ============================================================================

class FinancialEngine {

    constructor() {
        this.setupListeners();
    }


    // ==========================================================================
    // EVENT LISTENERS
    // ==========================================================================

    setupListeners() {

        paymentEventBus.on(
            PAYMENT_EVENTS.COMPLETED,
            this.handlePaymentCompleted.bind(this)
        );

        console.log(
            "[FinanceEngine] Listening for PAYMENT_COMPLETED events"
        );
    }


    // ==========================================================================
    // POST ACCOUNTING TRANSACTION
    // ==========================================================================

    async post(ruleName, event, session = null) {

        const opts = getOpts(session);

        const sessionLocal =
            session ||
            (
                canUseTransactions()
                    ? await mongoose.startSession()
                    : null
            );


        if (sessionLocal && !session) {
            sessionLocal.startTransaction();
        }


        // Tracked here (not just inside try) so the catch block can mark
        // them failed if we're on a standalone Mongo instance, where
        // there's no session/transaction to roll them back automatically.
        let transaction = null;
        let journal = null;


        try {

            // ==================================================================
            // 1. FIND ACCOUNTING RULE
            // ==================================================================

            const rule = RULES.find(
                (r) => r.name === ruleName
            );


            if (!rule) {
                throw new Error(
                    `No accounting rule found for ${ruleName}`
                );
            }


            // ==================================================================
            // 2. BUILD ACCOUNTING RESULT
            // ==================================================================
            //
            // IMPORTANT:
            //
            // rule.build() returns:
            //
            // {
            //     transactionType,
            //     referenceType,
            //     referenceId,
            //     entries: [...]
            // }
            //
            // Therefore we MUST NOT call .map() directly
            // on the result of rule.build().
            //
            // ==================================================================

            const accountingResult = await rule.build(
                event,
                sessionLocal
            );


            if (!accountingResult) {
                throw new Error(
                    `Accounting rule ${ruleName} returned no result`
                );
            }


            // ==================================================================
            // 3. EXTRACT ENTRIES
            // ==================================================================

            const entries = Array.isArray(accountingResult)
                ? accountingResult
                : accountingResult.entries;


            if (!Array.isArray(entries)) {

                console.error(
                    `[FinanceEngine] Invalid accounting result from ${ruleName}:`,
                    accountingResult
                );

                throw new Error(
                    `Accounting rule ${ruleName} must return an entries array`
                );
            }


            if (entries.length === 0) {

                throw new Error(
                    `Accounting rule ${ruleName} returned zero ledger entries`
                );
            }


            // ==================================================================
            // 4. VALIDATE DOUBLE ENTRY
            // ==================================================================

            const debitEntries = entries.filter(
                (entry) => entry.entryType === "DEBIT"
            );

            const creditEntries = entries.filter(
                (entry) => entry.entryType === "CREDIT"
            );


            if (debitEntries.length === 0) {

                throw new Error(
                    `Accounting rule ${ruleName} has no DEBIT entry`
                );
            }


            if (creditEntries.length === 0) {

                throw new Error(
                    `Accounting rule ${ruleName} has no CREDIT entry`
                );
            }


            const totalDebits = debitEntries.reduce(
                (sum, entry) =>
                    sum + Number(entry.amount || 0),
                0
            );


            const totalCredits = creditEntries.reduce(
                (sum, entry) =>
                    sum + Number(entry.amount || 0),
                0
            );


            const difference = Math.abs(
                totalDebits - totalCredits
            );


            if (difference > 0.000001) {

                throw new Error(
                    `Unbalanced accounting entry for ${ruleName}. ` +
                    `Debits=${totalDebits}, Credits=${totalCredits}`
                );
            }


            // ==================================================================
            // 5. RESOLVE FINANCIAL TRANSACTION TYPE
            // ==================================================================

            const transactionType =
                TRANSACTION_TYPE_BY_RULE[ruleName];


            if (!transactionType) {

                throw new Error(
                    `No financial transaction type mapped for accounting rule ${ruleName}`
                );
            }


            // ==================================================================
            // 6. RESOLVE CHAMA OWNER
            // ==================================================================

            const context = event.context || {};
            const metadata = context.metadata || {};


            const chamaId =
                context.chamaId ||
                context.chama_id ||
                metadata.chamaId ||
                metadata.chama_id ||
                context.owner_id ||
                metadata.owner_id;


            const ownerType = chamaId
                ? (
                    context.owner_type ||
                    metadata.owner_type ||
                    "Chama"
                )
                : null;


            const ownerId =
                chamaId ||
                event.actor?.userId ||
                context.actorId ||
                metadata.actorId;


            if (!ownerId) {

                throw new Error(
                    `Unable to determine owner for financial transaction ${event.payment?.reference}`
                );
            }


            if (!ownerType) {

                throw new Error(
                    `Unable to determine owner_type for financial transaction ${event.payment?.reference}`
                );
            }


            // ==================================================================
            // 7. RESOLVE CREATED BY
            // ==================================================================

            const createdBy =
                event.actor?.userId ||
                context.actorId ||
                metadata.actorId ||
                ownerId;


            // ==================================================================
            // 8. CREATE FINANCIAL TRANSACTION HEADER
            // ==================================================================

            transaction =
                await financeTransactionService.create(

                    {
                        owner_type: ownerType,

                        owner_id: ownerId,

                        transactionType,

                        amount: event.payment.amount,

                        currency:
                            event.payment.currency ||
                            "KES",

                        source_type: "Payment",

                        source_id: event.payment.id,

                        reference:
                            event.payment.reference,

                        description:
                            `${ruleName} - ${event.payment.reference}`,

                        externalReference:
                            event.provider?.metadata
                                ?.checkoutRequestId ||
                            event.providerData
                                ?.checkoutRequestId ||
                            null,

                        created_by: createdBy,
                    },

                    sessionLocal
                );


            // ==================================================================
            // 9. CREATE JOURNAL HEADER
            // ==================================================================
            //
            // The Journal is the accounting "envelope" for this posting.
            // It groups the LedgerEntry rows created below and carries the
            // running debit/credit totals shown on the general ledger.
            //
            // ==================================================================

            journal = await journalService.create(

                {
                    chama: ownerId,

                    member:
                        context?.participantId ||
                        metadata?.participant_id ||
                        metadata?.participantId ||
                        null,

                    transactionType,

                    amount: event.payment.amount,

                    currency:
                        event.payment.currency ||
                        "KES",

                    description:
                        `${ruleName} - ${event.payment.reference}`,

                    provider:
                        event.payment.payment_method ||
                        event.payment.paymentMethod ||
                        event.payment.channel_type ||
                        null,

                    correlationId:
                        event.payment.reference,

                    metadata: {
                        ruleName,
                        paymentId: event.payment.id,
                    },
                },

                transaction,

                sessionLocal
            );


            // ==================================================================
            // 10. CREATE LEDGER ENTRIES (GENERAL LEDGER)
            // ==================================================================
            //
            // One immutable LedgerEntry row per debit/credit leg. This is
            // what powers the general ledger view on the finance dashboard.
            //
            // ==================================================================

            await ledgerService.createEntries(

                journal,

                transaction,

                entries.map((entry) => ({

                    account_id:
                        entry.account_id ||
                        entry.account,

                    entry_type:
                        entry.entryType,

                    amount:
                        entry.amount,

                    description:
                        entry.description ||
                        `${ruleName} - ${event.payment.reference}`,
                })),

                sessionLocal
            );


            // ==================================================================
            // 11. APPLY DOUBLE-ENTRY ACCOUNTING
            // ==================================================================

            await financeAccountService.applyEntries(

                entries.map((entry) => ({

                    account_id:
                        entry.account_id ||
                        entry.account,

                    entryType:
                        entry.entryType,

                    amount:
                        entry.amount,

                })),

                sessionLocal
            );


            // ==================================================================
            // 12. MARK JOURNAL + FINANCIAL TRANSACTION POSTED
            // ==================================================================
            //
            // This is the moment the payment is fully reflected in the
            // finance dashboard (account balances + transaction status)
            // and the general ledger (journal + ledger entries).
            //
            // ==================================================================

            await journalService.markPosted(
                journal._id,
                sessionLocal
            );

            await financeTransactionService.markCompleted(
                transaction._id,
                sessionLocal
            );


            // ==================================================================
            // 13. LINK FINANCIAL TRANSACTION TO CONTRIBUTION PAYMENT
            // ==================================================================
            //
            // Only attempt this when the payment actually belongs to
            // ContributionPayment.
            //
            // updateOne is intentionally non-fatal if no document exists.
            //
            // ==================================================================

            if (event.payment?.id) {

                await ContributionPayment.updateOne(

                    {
                        _id: event.payment.id,
                    },

                    {
                        $set: {
                            financial_transaction_id:
                                transaction._id,
                        },
                    },

                    opts
                );
            }


            // ==================================================================
            // 13b. CLOSE THE OBLIGATION (contribution / MGR only)
            // ==================================================================
            //
            // FinanceEngine only posts ledger entries. Closing the obligation
            // (paid_amount / status: pending -> partially_paid/paid) used to
            // live in contributionPayment.service.js's completeContributionPayment(),
            // but nothing calls that anymore since the event-bus refactor -
            // obligations were never actually marked paid. Doing it here, in
            // the same local transaction as the ledger posting, keeps the
            // two from ever drifting apart.
            // ==================================================================

            if (ruleName === "CONTRIBUTION_PAYMENT" || ruleName === "MGR_CONTRIBUTION") {

                const obligationId =
                    event.obligation?.id ||
                    event.context?.obligationId ||
                    metadata?.obligationId;

                if (obligationId) {

                    const contributionObligationService = (
                        await import("../contributionPlan/contributionObligation.service.js")
                    ).default;

                    await contributionObligationService.markPaid(
                        obligationId,
                        event.payment.amount,
                        sessionLocal
                    );

                } else {

                    console.warn(
                        `[FinanceEngine] ${ruleName} payment ${event.payment.reference} has no obligation id - ledger posted but nothing to mark paid.`
                    );
                }
            }


            // ==================================================================
            // 14. COMMIT LOCAL TRANSACTION
            // ==================================================================

            if (sessionLocal && !session) {

                await sessionLocal.commitTransaction();
            }


            // ==================================================================
            // 15. SUCCESS LOG
            // ==================================================================

            console.log(
                `[FinanceEngine] Posted ${ruleName} ` +
                `as ${transactionType} for ` +
                `${event.payment.reference}. ` +
                `Txn: ${transaction._id}`
            );


            return transaction;


        } catch (err) {

            // ==================================================================
            // ROLLBACK
            // ==================================================================

            if (sessionLocal && !session) {

                await sessionLocal.abortTransaction();

            } else {

                // No multi-document transaction available (standalone
                // Mongo), so nothing was rolled back automatically.
                // Explicitly mark whatever we already created as failed
                // so the finance dashboard and ledger don't show a
                // transaction/journal stuck in "pending" forever.

                if (transaction) {

                    await financeTransactionService
                        .markFailed(transaction._id, err.message)
                        .catch(() => {});
                }

                if (journal) {

                    await journalService
                        .markFailed(journal._id, err.message)
                        .catch(() => {});
                }
            }


            console.error(
                "[FinancialEngine] Failed to post",
                err
            );


            throw err;


        } finally {

            if (sessionLocal && !session) {

                await sessionLocal.endSession();
            }
        }
    }


    // ==========================================================================
    // PAYMENT COMPLETED EVENT
    // ==========================================================================

    async handlePaymentCompleted(event) {

        try {

            // ==================================================================
            // DETERMINE PRODUCT TYPE
            // ==================================================================

            let productType =
                event.payment?.productType ||
                event.payment?.type ||
                event.context?.productType ||
                event.context?.metadata?.productType ||
                event.context?.metadata?.product_type ||
                event.context?.obligation?.productType ||
                "contribution";


            // ==================================================================
            // SAFETY-NET REFERENCE DETECTION
            // ==================================================================

            const reference =
                event.payment?.reference || "";


            if (
                reference.startsWith("CHAMA-SAVE")
            ) {

                productType = "savings";

            } else if (
                reference.startsWith("CHAMA-CONTRIB")
            ) {

                productType = "contribution";

            } else if (
                reference.startsWith("CHAMA-MGR")
            ) {

                productType = "mgr";
            }


            console.log(
                `[FinanceEngine] Routing payment ` +
                `${reference} with productType: ${productType}`
            );


            // ==================================================================
            // SAVINGS
            // ==================================================================

            if (productType === "savings") {

                await this.post(
                    "SAVINGS_DEPOSIT",
                    event
                );

                return;
            }


            // ==================================================================
            // CONTRIBUTION
            // ==================================================================

            if (productType === "contribution") {

                await this.post(
                    "CONTRIBUTION_PAYMENT",
                    event
                );

                return;
            }


            // ==================================================================
            // MERRY-GO-ROUND
            // ==================================================================

            if (productType === "mgr") {

                await this.post(
                    "MGR_CONTRIBUTION",
                    event
                );

                // Best-effort: a failure below must not undo the payment
                // that was just recorded and posted to the ledger.
                const chamaId =
                    event.context?.chamaId ||
                    event.context?.owner_id;

                if (chamaId) {

                    const MgrPolicy = (await import(
                        "../../models/MgrPolicy.js"
                    )).default;

                    const activePolicy = await MgrPolicy.findOne({
                        chama_id: chamaId,
                        status: "active",
                    });

                    if (activePolicy) {
                        // Governed MGR workflow: just sync the round's
                        // collected total. Payout is never auto-created
                        // here - it requires an explicit Treasurer
                        // proposal (proposePayout) plus multi-role
                        // approval sign-off (separation of duties).
                        const mgrService = (await import(
                            "../mgr/mgr.service.js"
                        )).default;

                        await mgrService.syncRoundCollection({
                            chamaId,
                            policyId: activePolicy._id,
                            amount: event.payment?.amount,
                            actorUserId: event.actor?.userId,
                        }).catch((err) => {
                            console.error(
                                "[FinanceEngine] mgrService.syncRoundCollection failed:",
                                err.message
                            );
                        });
                    } else {
                        // Legacy, ungoverned MGR - no MgrPolicy has been
                        // set up for this chama, so the original
                        // auto-payout-on-full-collection behavior is
                        // preserved for backwards compatibility.
                        const { maybeCreateMgrPayoutForChama } = await import(
                            "../chama/chamaFinance.service.js"
                        );

                        await maybeCreateMgrPayoutForChama(
                            chamaId,
                            event.actor?.userId
                        ).catch((err) => {
                            console.error(
                                "[FinanceEngine] maybeCreateMgrPayoutForChama failed:",
                                err.message
                            );
                        });
                    }
                }

                return;
            }


            // ==================================================================
            // UNKNOWN PRODUCT
            // ==================================================================

            console.warn(
                `[FinanceEngine] No accounting rule for productType: ${productType}`
            );


        } catch (err) {

            console.error(
                "[FinanceEngine] Error in event handler",
                err
            );
        }
    }
}


// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export default new FinancialEngine();
