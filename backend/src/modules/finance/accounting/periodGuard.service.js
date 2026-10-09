import ChamaFinancialYear from "../../../models/Chamafinancialyear.js";
import { assertPeriodOpen as assertOpen } from "./periodGuard.logic.js";

export { resolvePostingDate, PERIOD_CLOSED } from "./periodGuard.logic.js";

/**
 * Throws (409, code PERIOD_CLOSED) if the posting would land inside a closed
 * financial year. Returns the resolved posting date.
 *
 * `opts` is the { session } object built by getOpts() - empty when the
 * deployment has no transaction support.
 */
export const assertPeriodOpen = (context, opts = {}) =>
  assertOpen({
    context,
    findClosedYear: (filter) => ChamaFinancialYear.findOne(filter, null, opts).lean(),
  });
