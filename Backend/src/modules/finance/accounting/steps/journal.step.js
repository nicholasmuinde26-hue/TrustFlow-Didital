import journalService
    from "../journal.service.js";

class JournalStep {

    async execute(context, state, session) {

        state.journal =

            await journalService.create(

                context,

                state.transaction,

                session

            );

        return state;

    }

}

export default new JournalStep();