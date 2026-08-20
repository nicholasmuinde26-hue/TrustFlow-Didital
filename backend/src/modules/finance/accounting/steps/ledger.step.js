import mongoose from "mongoose";
import ledgerService from "../ledger.service.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class LedgerStep {
    async execute(context, state, session) {
        const opts = getOpts(session);
        const ledger = await ledgerService.post(state.journal, state.transaction, opts);
        
        state.entries = ledger.entries;
        state.debit = ledger.debit;
        state.credit = ledger.credit;
        state.balanced = ledger.balanced;
        return state;
    }
}
export default new LedgerStep();