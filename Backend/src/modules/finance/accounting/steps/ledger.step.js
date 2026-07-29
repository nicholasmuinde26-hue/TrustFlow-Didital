import ledgerService
    from "../ledger.service.js";

class LedgerStep {

    async execute(context, state, session) {

        const ledger =

            await ledgerService.post(

                state.journal,

                state.transaction,

                session

            );

        state.entries = ledger.entries;

        state.debit = ledger.debit;

        state.credit = ledger.credit;

        state.balanced = ledger.balanced;

        return state;

    }

}

export default new LedgerStep();