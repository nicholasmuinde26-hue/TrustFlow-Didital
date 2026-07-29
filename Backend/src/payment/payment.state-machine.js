/**
 * ============================================================================
 * PAYMENT STATE MACHINE
 * ============================================================================
 */

import { PAYMENT_STATUS } from "./payment.constants.js";
import { PaymentValidationError } from "./payment.errors.js";

const TRANSITIONS = Object.freeze({

    [PAYMENT_STATUS.PENDING]: [

        PAYMENT_STATUS.PROCESSING,
        PAYMENT_STATUS.CANCELLED,
        PAYMENT_STATUS.FAILED

    ],

    [PAYMENT_STATUS.PROCESSING]: [

        PAYMENT_STATUS.COMPLETED,
        PAYMENT_STATUS.FAILED,
        PAYMENT_STATUS.CANCELLED

    ],

    [PAYMENT_STATUS.COMPLETED]: [

        PAYMENT_STATUS.REFUNDED

    ],

    [PAYMENT_STATUS.FAILED]: [],

    [PAYMENT_STATUS.CANCELLED]: [],

    [PAYMENT_STATUS.REFUNDED]: []

});

class PaymentStateMachine {

    canTransition(from, to) {

        return TRANSITIONS[from]?.includes(to);

    }

    transition(payment, nextStatus) {

        const currentStatus = payment.status;

        if (!this.canTransition(currentStatus, nextStatus)) {

            throw new PaymentValidationError(

                `Illegal payment transition: ${currentStatus} → ${nextStatus}`

            );

        }

        payment.status = nextStatus;

        return payment;

    }

}

export default new PaymentStateMachine();