/**
 * ============================================================================
 * PAYMENT PROVIDER REGISTRY
 * ============================================================================
 */

class ProviderRegistry {

    constructor() {
        this.providers = new Map();
    }

    register(provider) {
        if (!provider) throw new Error("Provider instance is required.");
        if (!provider.name) throw new Error("Provider must expose a name.");
        if (this.providers.has(provider.name)) throw new Error(`Payment provider "${provider.name}" is already registered.`);
        this.providers.set(provider.name, provider);
        return provider;
    }

    get(name) {
        const provider = this.providers.get(name);
        if (!provider) throw new Error(`Payment provider "${name}" is not registered.`);
        return provider;
    }

    has(name) { return this.providers.has(name); }
    unregister(name) { this.providers.delete(name); }
    clear() { this.providers.clear(); }
    list() { return [...this.providers.keys()]; }

    getMetadata() {
        return this.list().map(name => this.providers.get(name).getMetadata());
    }
}

const providerRegistry = new ProviderRegistry();
export default providerRegistry; // <-- must be default export