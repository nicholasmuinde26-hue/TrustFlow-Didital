/**
 * ============================================================================
 * POSTING PIPELINE
 * ============================================================================
 *
 * Executes accounting steps sequentially.
 *
 * Each step receives:
 *  - PostingContext
 *  - Mutable State
 *  - Mongo Session
 *
 * Features: Transaction safety, step logging, error rollback
 * ============================================================================
 */

import mongoose from "mongoose";

class PostingPipeline {

    constructor(name = 'PostingPipeline') {
        this.steps = [];
        this.name = name;
    }

    add(step) {
        if (!step || typeof step.execute !== 'function') {
            throw new Error(`Pipeline step must have an execute(context, state, session) method`);
        }
        this.steps.push(step);
        return this;
    }

    async execute(context, state = {}, session) {
        const pipelineId = context?.referenceId || new mongoose.Types.ObjectId();
        const ownsSession = !session;
        const useSession = session || (mongoose.connection.readyState === 1 ? await mongoose.startSession() : null);

        if (useSession && ownsSession) {
            useSession.startTransaction();
        }

        console.log(`[POSTING] ${this.name} Started. Ref: ${pipelineId}. Steps: ${this.steps.length}`);

        try {
            let currentState = { ...state, pipelineId, stepResults: [] };

            for (let i = 0; i < this.steps.length; i++) {
                const step = this.steps[i];
                const stepName = step.constructor.name || `Step${i + 1}`;
                
                console.log(`[POSTING] Running ${stepName}...`);
                
                currentState = await step.execute(context, currentState, useSession);
                
                currentState.stepResults.push({ 
                    step: stepName, 
                    status: 'success',
                    timestamp: new Date() 
                });
            }

            if (useSession && ownsSession) {
                await useSession.commitTransaction();
                console.log(`[POSTING] ${this.name} Committed. Ref: ${pipelineId}`);
            }

            return currentState;

        } catch (error) {
            console.error(`[POSTING] ${this.name} FAILED. Ref: ${pipelineId}`, error.message);
            
            if (useSession && ownsSession && useSession.inTransaction()) {
                await useSession.abortTransaction();
                console.error(`[POSTING] ${this.name} Rolled back. Ref: ${pipelineId}`);
            }
            
            error.pipelineId = pipelineId;
            error.failedAtStep = state?.stepResults?.length || 0;
            throw error;

        } finally {
            if (useSession && ownsSession) {
                await useSession.endSession();
            }
        }
    }
}

export default PostingPipeline;