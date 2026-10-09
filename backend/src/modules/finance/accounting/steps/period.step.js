/**
 * ============================================================================
 * PERIOD STEP
 * ============================================================================
 * Rejects a posting dated inside a closed financial year. Must run BEFORE any
 * step that writes (transaction, journal, ledger, account), so a rejected
 * posting leaves nothing behind.
 * ============================================================================
 */
import mongoose from "mongoose";
import { assertPeriodOpen } from "../periodGuard.service.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class PeriodStep {
    async execute(context, state, session) {
        const opts = getOpts(session);
        state.postingDate = await assertPeriodOpen(context, opts);
        return state;
    }
}
export default new PeriodStep();
