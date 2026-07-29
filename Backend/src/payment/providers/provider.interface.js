/**
 * ============================================================================
 * PAYMENT PROVIDER INTERFACE
 * ============================================================================
 *
 * Defines the contract that every payment provider must implement.
 *
 * Examples:
 *
 *   • M-Pesa
 *   • Airtel Money
 *   • Bank
 *   • Manual
 *   • Wallet
 *   • Stripe
 *   • Flutterwave
 *
 * The Payment Engine ONLY communicates with providers through
 * this interface.
 *
 * This guarantees that adding a new provider never requires
 * changing payment.service.js.
 *
 * ============================================================================
 */

export default class PaymentProvider {

    constructor({
        name,
        displayName = null,
        version = "1.0.0"
    }) {

        if (!name) {
            throw new Error(
                "Payment provider requires a unique name."
            );
        }

        this.name = name;

        this.displayName =
            displayName || name;

        this.version = version;
    }

    /**
     * ------------------------------------------------------------
     * Provider metadata
     * ------------------------------------------------------------
     */

    getMetadata() {

        return {

            name: this.name,

            displayName: this.displayName,

            version: this.version

        };

    }

    /**
     * ------------------------------------------------------------
     * Validate provider-specific request.
     * ------------------------------------------------------------
     */
    async validate() {

        throw new Error(
            `${this.name}: validate() not implemented`
        );

    }

    /**
     * ------------------------------------------------------------
     * Initiate payment.
     * ------------------------------------------------------------
     */
    async initiate() {

        throw new Error(
            `${this.name}: initiate() not implemented`
        );

    }

    /**
     * ------------------------------------------------------------
     * Query payment status.
     * ------------------------------------------------------------
     */
    async query() {

        throw new Error(
            `${this.name}: query() not implemented`
        );

    }

    /**
     * ------------------------------------------------------------
     * Process callback/webhook.
     * ------------------------------------------------------------
     */
    async processCallback() {

        throw new Error(
            `${this.name}: processCallback() not implemented`
        );

    }

    /**
     * ------------------------------------------------------------
     * Cancel payment.
     * ------------------------------------------------------------
     */
    async cancel() {

        throw new Error(
            `${this.name}: cancel() not implemented`
        );

    }

    /**
     * ------------------------------------------------------------
     * Refund payment.
     * ------------------------------------------------------------
     */
    async refund() {

        throw new Error(
            `${this.name}: refund() not implemented`
        );

    }

}