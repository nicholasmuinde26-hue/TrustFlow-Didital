import { requirePermission } from './permission.middleware.js';

/**
 * Guards the all-members contribution overview (every member's expected and
 * paid figures, and their phone numbers).
 *
 * Plain members hold contributions.view at 'own' scope only, so they must
 * never reach it - they read their own contributions through the member
 * endpoints instead. Only roles holding contributions.view at 'all' scope
 * pass. Shared by the contribution-calendar route and the older MGR route so
 * the rule lives in one place.
 */
export const requireViewAllContributions = [
  requirePermission('contributions.view', { checkSelfAction: false }),
  (req, res, next) =>
    req.permissionResult?.scope === 'all'
      ? next()
      : res.status(403).json({
          success: false,
          code: 'PERMISSION_DENIED',
          message: "Only officials can see every member's contributions.",
        }),
];