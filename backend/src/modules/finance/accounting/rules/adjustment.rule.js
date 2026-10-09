/**
 * ============================================================================
 * LEDGER ADJUSTMENT ACCOUNTING RULE
 * ============================================================================
 *
 * A generic manual correction: the initiator names ANY two FinancialAccounts
 * belonging to the same workspace and an amount; this rule just builds the
 * balanced posting. Unlike the other rules it does not resolve accounts by
 * a fixed ACCOUNT_CODES key - it posts straight to the account_id the
 * approval carried, which ledger.service.js#createEntries accepts directly.
 *
 * Supported events:
 *
 * LEDGER_ADJUSTMENT_POSTING   (posted the moment an adjustment is approved)
 *
 *      DR <debit_account_id>
 *      CR <credit_account_id>
 *
 * DOES NOT:
 *
 * ✗ Query FinancialAccount
 * ✗ Modify balances
 * ✗ Create journals
 * ✗ Decide whether the adjustment is allowed - approval already happened
 *
 * ============================================================================
 */

import { ENTRY_TYPES } from "../accounting.constants.js";

class AdjustmentRule {

    async build(context) {
        switch (context.referenceType) {
            case "LEDGER_ADJUSTMENT_POSTING":
                return this.buildPosting(context);

            default:
                throw new Error(`Unsupported adjustment event ${context.referenceType}`);
        }
    }

    buildPosting(context) {
        if (!context.debitAccountId || !context.creditAccountId) {
            throw new Error("Ledger adjustment requires debitAccountId and creditAccountId");
        }

        return {
            transactionType: "LEDGER_ADJUSTMENT_POSTING",
            description: context.description || "Manual ledger adjustment",
            chama: context.chama || context.owner_id || context.ownerId || context.chamaId,
            member: context.member || context.memberId || context.created_by,
            amount: context.amount,
            currency: context.currency || "KES",
            entries: [
                {
                    account_id: context.debitAccountId,
                    entryType: ENTRY_TYPES.DEBIT,
                    amount: context.amount,
                    description: context.description || "Manual ledger adjustment"
                },
                {
                    account_id: context.creditAccountId,
                    entryType: ENTRY_TYPES.CREDIT,
                    amount: context.amount,
                    description: context.description || "Manual ledger adjustment"
                }
            ]
        };
    }
}

export default new AdjustmentRule();