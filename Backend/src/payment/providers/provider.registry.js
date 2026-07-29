/**
 * ============================================================================
 * PAYMENT PROVIDER REGISTRY
 * ============================================================================
 *
 * Central registry of all payment providers.
 *
 * Providers register themselves once during application startup.
 *
 * payment.service.js resolves providers from here instead of
 * using switch statements or if/else chains.
 *
 * ============================================================================
 */

class ProviderRegistry {

    constructor() {

        this.providers = new Map();

    }

    /**
     * Register a provider.
     */
    register(provider) {

        if (!provider) {

            throw new Error(
                "Provider instance is required."
            );

        }

        if (!provider.name) {

            throw new Error(
                "Provider must expose a name."
            );

        }

        if (this.providers.has(provider.name)) {

            throw new Error(
                `Payment provider "${provider.name}" is already registered.`
            );

        }

        this.providers.set(
            provider.name,
            provider
        );

        return provider;

    }

    /**
     * Resolve provider by name.
     */
    get(name) {

        const provider =
            this.providers.get(name);

        if (!provider) {

            throw new Error(
                `Payment provider "${name}" is not registered.`
            );

        }

        return provider;

    }

    /**
     * Check registration.
     */
    has(name) {

        return this.providers.has(name);

    }

    /**
     * Remove provider.
     */
    unregister(name) {

        this.providers.delete(name);

    }

    /**
     * Remove everything.
     */
    clear() {

        this.providers.clear();

    }

    /**
     * Provider names.
     */
    list() {

        return [...this.providers.keys()];

    }

    /**
     * Provider metadata.
     */
    getMetadata() {

        return this.list().map(name =>
            this.providers
                .get(name)
                .getMetadata()
        );

    }

}

export default new ProviderRegistry();