/**
 * ============================================================================
 * POSTING PIPELINE
 * ============================================================================
 *
 * Executes accounting steps sequentially.
 *
 * Each step receives:
 *
 *  - PostingContext
 *  - Mutable State
 *  - Mongo Session
 *
 * ============================================================================
 */

class PostingPipeline {

    constructor() {

        this.steps = [];

    }

    add(step) {

        this.steps.push(step);

        return this;

    }

    async execute(context, state, session) {

        for (const step of this.steps) {

            state = await step.execute(

                context,

                state,

                session

            );

        }

        return state;

    }

}

export default PostingPipeline;