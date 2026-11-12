import Fund from '../../models/Fund.js';
import BurialChamaProfile from '../../models/BurialChamaProfile.js';
import { mergeSettlementOverrides } from '../../constants/fund.constants.js';

/**
 * The settlement overrides to use for a chama's year-end close: each fund's own
 * settlement on its ledger account, with whatever was passed explicitly on top.
 */
export const settlementOverridesWithFunds = async (chamaId, explicit = {}) => {
  const funds = await Fund.find({ owner_type: 'Chama', owner_id: chamaId })
    .populate('ledger_account_id', 'account_code')
    .select('ledger_account_id settlement kind')
    .lean();
  const overrides = mergeSettlementOverrides(funds.map((fund) => ({
    ...fund,
    ledger_account_id: fund.ledger_account_id?._id || fund.ledger_account_id,
  })), explicit);
  const burialProfile = await BurialChamaProfile.exists({ chama_id: chamaId });
  if (burialProfile) {
    for (const fund of funds) {
      if (fund.kind !== 'welfare' && fund.kind !== 'reserve' && fund.kind !== 'case') continue;
      const accountId = fund.ledger_account_id?._id || fund.ledger_account_id;
      if (accountId) overrides[String(accountId)] = 'retained';
      const accountCode = fund.ledger_account_id?.account_code;
      if (accountCode) overrides[accountCode] = 'retained';
    }
  }
  return overrides;
};
