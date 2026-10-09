// ============================================================================
// PERIOD GUARD (logic - no mongoose, so it can be unit tested)
// ============================================================================
//
// Decides whether a posting may be written. The database lookup is injected;
// periodGuard.service.js wires in the real one.

import AppError from '../../../utils/AppError.js';
import { asObjectIdString, closedYearFilter } from '../../yearEnd/yearEnd.period.js';

export const PERIOD_CLOSED = 'PERIOD_CLOSED';

// The date a posting takes effect. Nothing passes one today, so this is
// "now"; callers that backdate set context.postingDate.
export const resolvePostingDate = (context = {}) => {
  const raw = context.postingDate ?? context.posting_date ?? null;
  if (raw === null) return new Date();
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Posting date is not a valid date.', 400);
  }
  return date;
};

// Financial years belong to chamas only. Group and business ledgers have no
// year, so they are never blocked here.
export const resolveChamaId = (context = {}) => {
  if (context.owner_type && context.owner_type !== 'Chama') return null;
  return asObjectIdString(
    context.owner_id ?? context.chama ?? context.chamaId ?? context.chama_id
  );
};

const day = (d) => new Date(d).toISOString().slice(0, 10);

export const assertPeriodOpen = async ({ context, findClosedYear }) => {
  const postingDate = resolvePostingDate(context);
  const chamaId = resolveChamaId(context);
  if (!chamaId) return postingDate;

  const year = await findClosedYear(closedYearFilter(chamaId, postingDate));
  if (year) {
    const error = new AppError(
      `Cannot post an entry dated ${day(postingDate)}: financial year "${year.label}" is closed` +
        (year.closed_at ? ` (closed ${day(year.closed_at)})` : '') +
        '. Date the entry in the current open year instead.',
      409
    );
    error.code = PERIOD_CLOSED;
    error.details = { yearId: String(year._id), postingDate: postingDate.toISOString() };
    throw error;
  }
  return postingDate;
};
