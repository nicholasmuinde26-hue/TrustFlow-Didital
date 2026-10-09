import mongoose from 'mongoose';

import Chama from '../models/Chama.js';
import AppError from '../utils/AppError.js';
import { isModuleEnabled, WORKSPACE_MODULES } from '../constants/workspaceModules.constants.js';
import { isBillingEnforced } from '../constants/billing.constants.js';
import { checkBillingAccess } from '../modules/billing/billingEntitlement.service.js';

const isChamaDocument = (chama) => chama?.constructor?.modelName === 'Chama';

/**
 * requireModule('loans')
 *
 * Blocks a request when the chama behind it has switched that module off.
 * The error carries `code: 'MODULE_DISABLED'` (the error handler forwards
 * string codes) so the frontend can tell it apart from a permission error.
 *
 * Two ways it finds the chama:
 *
 *   1. req.chama - set by requireChamaMember. Mount this directly after it and
 *      the check costs no extra query:
 *
 *        router.use('/:chamaId/loans', requireChamaMember, requireModule('loans'));
 *
 *   2. By id - for the shared workspace routers (polls, announcements,
 *      meetings, chat) that serve chamas, contribution groups AND businesses
 *      and never load req.chama. It reads :workspaceId / :chamaId / :id and
 *      does one small lean query. If the id is not a Chama (a contribution
 *      group or business) the request passes straight through.
 *
 * Other notes
 *   - Platform admins (req.membership.isSystemAdmin) pass through so support
 *     can still inspect data a chama has since switched off.
 *   - Switching a module off hides and blocks it; it never deletes data.
 *     Switching it back on restores everything.
 */
export const requireModule = (moduleKey) => {
  if (!WORKSPACE_MODULES[moduleKey]) {
    // Fail loudly at startup if a route is wired to a typo'd key.
    throw new Error(`requireModule: unknown workspace module "${moduleKey}"`);
  }

  return async (req, _res, next) => {
    try {
      if (req.membership?.isSystemAdmin) return next();

      let chama = isChamaDocument(req.chama) ? req.chama : null;

      if (!chama) {
        const id = req.params?.chamaId || req.params?.workspaceId || req.params?.id;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return next();
        chama = await Chama.findById(id).select('chama_type workspace_config').lean();
        if (!chama) return next(); // not a chama: nothing to configure
      }

      if (!isModuleEnabled(chama, moduleKey)) {
        const error = new AppError(
          `${WORKSPACE_MODULES[moduleKey].label} is not enabled for this chama`,
          403
        );
        error.code = 'MODULE_DISABLED';
        error.module = moduleKey;
        return next(error);
      }

      // Platform subscription: a module outside the chama's plan, or a lapsed
      // subscription, blocks WRITES only. Reads always pass so records and
      // money history are never held hostage. Off unless BILLING_ENFORCEMENT=on.
      if (isBillingEnforced()) {
        const verdict = await checkBillingAccess({
          chamaId: chama._id,
          method: req.method,
          url: req.originalUrl,
          moduleKey,
        });
        if (verdict) {
          const error = new AppError(verdict.message, verdict.status);
          error.code = verdict.code;
          error.module = moduleKey;
          return next(error);
        }
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export default requireModule;
