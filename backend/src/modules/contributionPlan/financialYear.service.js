import ChamaFinancialYear from '../../models/Chamafinancialyear.js';
import AppError from '../../utils/AppError.js';
import { beginClose } from '../yearEnd/yearEnd.service.js';
import { yearsOverlap } from '../yearEnd/yearEnd.period.js';

export const getActiveYear = async (chamaId, now = new Date()) => {
  return ChamaFinancialYear.findOne({
    chama_id: chamaId,
    start_date: { $lte: now },
    end_date: { $gte: now },
    status: 'active'
  });
};

export const resolveYearForView = async (chamaId, yearId = null, now = new Date()) => {
  if (yearId) {
    return ChamaFinancialYear.findOne({ _id: yearId, chama_id: chamaId });
  }
  return getActiveYear(chamaId, now);
};

export const listYears = async (chamaId) => {
  return ChamaFinancialYear.find({ chama_id: chamaId }).sort({ start_date: -1 });
};

/**
 * Create a financial year.
 *
 * This never touches another year. If the chama already has an active year,
 * the new one is created as 'upcoming' and becomes active only after the
 * current year has been closed through the year-end close (approval, snapshot,
 * audit seal) and activateYear is called. Dates may not overlap an existing
 * year; a year closed early only occupies the dates up to its closing day.
 */
export const createYear = async ({ chamaId, label, startDate, endDate, userId }) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('Start date and end date must be valid dates.', 400);
  }
  if (end <= start) throw new AppError('The end date must be after the start date.', 400);

  const existing = await ChamaFinancialYear.find({ chama_id: chamaId });
  const clash = existing.find((y) => yearsOverlap(y, { start_date: start, end_date: end, status: 'upcoming' }));
  if (clash) {
    throw new AppError(`These dates overlap the financial year "${clash.label}".`, 409);
  }

  const hasActive = existing.some((y) => y.status === 'active');
  const newYear = new ChamaFinancialYear({
    chama_id: chamaId,
    label,
    start_date: start,
    end_date: end,
    status: hasActive ? 'upcoming' : 'active',
    created_by: userId
  });

  try {
    await newYear.save();
  } catch (error) {
    // The database allows one active year per chama; a concurrent create won.
    if (error?.code === 11000) {
      throw new AppError('Another financial year became active while this one was being created. Reload and try again.', 409);
    }
    throw error;
  }
  return newYear;
};

/**
 * Make an existing ('upcoming') year the active one. Refuses while another
 * year is still active: that year has to be closed first, through the
 * year-end close, so its books are approved and sealed before the next year
 * starts. Closed years cannot be reactivated.
 */
export const activateYear = async ({ chamaId, yearId, userId }) => {
  const year = await ChamaFinancialYear.findOne({ _id: yearId, chama_id: chamaId });
  if (!year) throw new AppError('Financial year not found.', 404);
  if (year.status === 'active') return year;
  if (year.status === 'closed') {
    throw new AppError('A closed financial year cannot be reactivated. Create a new one instead.', 409);
  }

  const currentlyActive = await ChamaFinancialYear.findOne({ chama_id: chamaId, status: 'active' });
  if (currentlyActive && String(currentlyActive._id) !== String(year._id)) {
    throw new AppError(
      `"${currentlyActive.label}" is still the active financial year. Close it first (year-end close), then activate this one.`,
      409
    );
  }

  year.status = 'active';
  year.updated_by = userId;
  try {
    await year.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('Another financial year became active while this one was being activated. Reload and try again.', 409);
    }
    throw error;
  }
  return year;
};

/**
 * Close a financial year (e.g. leadership ends the year ahead of its end_date).
 *
 * This no longer flips the status. It starts the year-end close (open ->
 * closing): a snapshot is taken and an approval request raised, and the year
 * only becomes 'closed' when that close is approved and finalized - see
 * modules/yearEnd.
 */
export const closeYear = async ({ chamaId, yearId, userId, membershipId = null, settlementOverrides = {}, note = '' }) => {
  const { year } = await beginClose({ chamaId, yearId, userId, membershipId, settlementOverrides, note });
  return year;
};
