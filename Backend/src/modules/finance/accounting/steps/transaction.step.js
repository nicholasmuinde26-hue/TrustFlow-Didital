import financeTransactionService
    from "../../financeTransaction.service.js";

class TransactionStep {

    async execute(context, state, session) {

        state.transaction =

            await financeTransactionService.create(

                context,

                session

            );

        return state;

    }

}

export default new TransactionStep();