import financeAccountService
    from "../../financeAccount.service.js";

class AccountStep {

    async execute(context, state, session) {

        state.updatedAccounts =

            await financeAccountService.applyEntries(

                state.entries,

                session

            );

        return state;

    }

}

export default new AccountStep();