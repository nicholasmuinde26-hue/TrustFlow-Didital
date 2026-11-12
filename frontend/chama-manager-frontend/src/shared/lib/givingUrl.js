const BASE = String(import.meta.env.VITE_GIVING_URL || 'http://localhost:5175').replace(/\/+$/, '');

export const givingUrl = (joinCode) => `${BASE}/${encodeURIComponent(joinCode || '')}`;
