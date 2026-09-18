import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireAdmin, requireAdminPermission } from '../../middleware/admin.middleware.js';
import { ingest, center, riskSignals, alerts, alert, respond } from './security.controller.js';

const router = express.Router();
// Telemetry is server-to-server in production. This protected endpoint is also useful while modules are being instrumented.
router.post('/events', protect, ingest);
// The Security Command Center is the Security Admin's workspace (Compliance
// gets it too, for oversight). It used to be reachable by any admin at all
// via bare requireAdmin — a Support or Finance admin could acknowledge or
// resolve live fraud alerts, which is exactly the kind of cross-workspace
// leakage a "real product" admin console shouldn't have.
router.use(protect, requireAdmin, requireAdminPermission('security'));
router.get('/command-center', center);
// Risk-signal dashboard: failed logins, velocity anomalies, flagged
// transactions and device/IP anomalies — the "inspect wholly" view that
// audit logs + entity lookups alone don't give Security.
router.get('/risk-signals', riskSignals);
router.get('/alerts', alerts);
router.get('/alerts/:alertId', alert);
router.post('/alerts/:alertId/respond', respond);
export default router;