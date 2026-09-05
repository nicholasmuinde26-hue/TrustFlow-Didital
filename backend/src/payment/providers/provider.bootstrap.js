/**
 * ============================================================================
 * PAYMENT PROVIDER BOOTSTRAP
 * ============================================================================
 */

import providerRegistry from "./provider.registry.js";

import MpesaProvider from "./mpesa/mpesa.provider.js"; // This is already an instance
import MpesaC2bProvider from "./mpesa/mpesaC2b.provider.js"; // This is already an instance
import CashProvider from "./cash/cash.provider.js"; // This is already an instance

// Future Providers
// import AirtelProvider from "./airtel/airtel.provider.js";
// import BankProvider from "./bank/bank.provider.js";
// import WalletProvider from "./wallet/wallet.provider.js";
// import StripeProvider from "./stripe/stripe.provider.js";
// import FlutterwaveProvider from "./flutterwave/flutterwave.provider.js";

let initialized = false;

/**
 * Register all providers.
 */
export const initializePaymentProviders = () => {

    if (initialized) {
        return providerRegistry;
    }

    providerRegistry.register(MpesaProvider); // <-- NO new
    providerRegistry.register(MpesaC2bProvider); // <-- NO new
    providerRegistry.register(CashProvider); // <-- NO new

    /*
    providerRegistry.register(AirtelProvider);
    providerRegistry.register(BankProvider);
    providerRegistry.register(WalletProvider);
    providerRegistry.register(StripeProvider);
    providerRegistry.register(FlutterwaveProvider);
    providerRegistry.register(ManualProvider);
    */

    initialized = true;
    return providerRegistry;
};

export default initializePaymentProviders;