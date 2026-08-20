/**
 * ============================================================================
 * ACCOUNT STEP
 * ============================================================================
 * Updates account balances from ledger entries
 * ============================================================================
 */
import mongoose from "mongoose"; // ADD
import financeAccountService from "../../financeAccount.service.js";

// Helper: detect if mongo supports transactions
const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

// Helper: only add session to opts if transactions are supported
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class AccountStep {
    async execute(context, state, session) {
        const opts = getOpts(session); // <-- KEY

        state.updatedAccounts = await financeAccountService.applyEntries(
            state.entries,
            opts // <-- pass opts, not raw session
        );

        return state;
    }
}

export default new AccountStep();