/**
 * ============================================================================
 * PAYMENT PROVIDER BOOTSTRAP
 * ============================================================================
 *
 * Registers all payment providers supported by the Payment Engine.
 *
 * This file is executed once during application startup.
 *
 * Adding a new payment provider should only require:
 *
 *   1. Creating the provider.
 *   2. Registering it here.
 *
 * payment.service.js never changes.
 *
 * ============================================================================
 */

import providerRegistry from "./provider.registry.js";

import MpesaProvider
    from "./mpesa/mpesa.provider.js";

// Future Providers
// import AirtelProvider from "./airtel/airtel.provider.js";
// import BankProvider from "./bank/bank.provider.js";
// import WalletProvider from "./wallet/wallet.provider.js";
// import StripeProvider from "./stripe/stripe.provider.js";
// import FlutterwaveProvider from "./flutterwave/flutterwave.provider.js";
// import ManualProvider from "./manual/manual.provider.js";

let initialized = false;

/**
 * Register all providers.
 */
export const initializePaymentProviders = () => {

    if (initialized) {

        return providerRegistry;

    }

    providerRegistry.register(

        new MpesaProvider()

    );

    /*
    providerRegistry.register(
        new AirtelProvider()
    );

    providerRegistry.register(
        new BankProvider()
    );

    providerRegistry.register(
        new WalletProvider()
    );

    providerRegistry.register(
        new StripeProvider()
    );

    providerRegistry.register(
        new FlutterwaveProvider()
    );

    providerRegistry.register(
        new ManualProvider()
    );
    */

    initialized = true;

    return providerRegistry;

};

export default initializePaymentProviders;