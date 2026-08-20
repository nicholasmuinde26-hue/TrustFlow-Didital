import mongoose from "mongoose";
import journalService from "../journal.service.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class JournalStep {
    async execute(context, state, session) {
        const opts = getOpts(session);
        state.journal = await journalService.create(context, state.transaction, opts);
        return state;
    }
}
export default new JournalStep();