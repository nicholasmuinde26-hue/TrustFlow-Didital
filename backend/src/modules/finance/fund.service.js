import Fund from '../../models/Fund.js';
import { mergeSettlementOverrides } from '../../constants/fund.constants.js';

/**
 * The settlement overrides to use for a chama's year-end close: each fund's own
 * settlement on its ledger account, with whatever was passed explicitly on top.
 */
export const settlementOverridesWithFunds = async (chamaId, explicit = {}) => {
  const funds = await Fund.find({ owner_type: 'Chama', owner_id: chamaId })
    .select('ledger_account_id settlement')
    .lean();
  return mergeSettlementOverrides(funds, explicit);
};
