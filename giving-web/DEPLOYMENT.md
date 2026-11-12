# Giving site deployment

The giving frontend, API, and reconciliation worker are deployable independently from the main app. Both backend processes use the same MongoDB. Public donation STK pushes use `MPESA_GIVING_CALLBACK_URL` (for example, `https://give-api.example.com/api/v1/giving/mpesa/callback`). The Giving API settles those callbacks and runs a giving-only reconciliation worker; the ChamaManager callback and worker explicitly skip public giving intents.

## Before deploying

1. Back up the database and run `npm run migrate:public-donor-indexes` from `ChamaManager/backend`. This replaces the legacy unique pledge index with a member-only partial index and creates indexes for public donations and donors.
2. Deploy the backend changes. Set `GIVING_ALLOWED_ORIGINS` to the giving site origin, `TRUST_PROXY` to the number of trusted proxy hops, and `MPESA_GIVING_CALLBACK_URL` to the Giving API callback route. Run `npm run start:giving` as the API service on `GIVING_PORT` (default `5002`) and `npm run start:giving-worker` as a separate worker service. The Giving API health endpoint checks MongoDB, logs request IDs, and uses MongoDB-backed rate-limit counters shared by instances. The worker reconciles public donation STK requests and runs contribution-group close/deadline lifecycle work.
3. From `ChamaManager/giving-web`, install dependencies with `npm install`, set `VITE_API_URL` to the Giving API base ending in `/api/v1`, and set `VITE_ORGANIZER_API_URL` to the main ChamaManager API base ending in `/api/v1`. The donor checkout uses the Giving API; organizer sign-in, applications, and group management use the main API. Run `npm run build` and publish the generated `dist/` directory as a static site. Configure the host to use the included SPA fallback (`public/_redirects` or `vercel.json`).
4. Set `VITE_GIVING_URL` in ChamaManager to the public giving origin so old `/g/:joinCode` links redirect to the standalone site.

5. Run `npm run test:public-giving` from `ChamaManager/backend` to verify idempotent request reuse, duplicate in-flight STK protection, donation total calculation after failures, and late callback handling.
6. The standalone download is `giving-web-standalone.zip`; it includes the Vite app, SPA host configuration, package manifest, lockfile, and environment template.

For local development, run the main API on port 5000 and `npm run start:giving` in the backend. Run `npm run dev` in this directory; Vite proxies `/api` to the giving API on port 5002. Organizer requests use `http://localhost:5000/api/v1` by default and the dev site runs on port 5175.

Donor name, phone, and optional receipt email are stored privately on a `ContributionDonor`; no app user or group membership is created. M-Pesa status polling uses a random bearer token whose hash is stored on the payment intent. Receipt email is best-effort and requires the existing SMTP or Resend configuration. Keep HTTPS enabled at the reverse proxy and use managed MongoDB backups and payment-failure alerts for production.
