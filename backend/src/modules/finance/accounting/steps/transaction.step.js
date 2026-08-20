import mongoose from "mongoose";
import financeTransactionService from "../../financeTransaction.service.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class TransactionStep {
    async execute(context, state, session) {
        const opts = getOpts(session);
        state.transaction = await financeTransactionService.create(context, opts);
        return state;
    }
}
export default new TransactionStep();