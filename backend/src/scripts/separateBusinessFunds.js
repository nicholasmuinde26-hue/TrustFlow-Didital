import mongoose from 'mongoose';
import Chama from '../models/Chama.js';
import FinancialAccount from '../models/FinancialAccount.js';
import { previewSeparation, applySeparation } from '../modules/finance/businessFundsSeparation.service.js';

/**
 * Separate business & property money from the pooled chama accounts, for every chama.
 * (Treasurers and chairpersons can also do this per chama from the dashboard banner.)
 * Logic lives in modules/finance/businessFundsSeparation.service.js.
 *
 * SAFE BY DEFAULT: only prints what it would do. Pass --apply to post.
 * Idempotent: a second run posts nothing.
 *
 * Usage: node src/scripts/separateBusinessFunds.js [--apply] [--chama-id <id>] [--user-id <id>]
 *   --user-id  user recorded as the poster (defaults to the chama's creator)
 */
export async function runSeparateBusinessFunds({ chamaId = null, userId = null, apply = false, silent = false } = {}) {
  const log = (...a) => { if (!silent) console.log(...a); };
  const filter = { owner_type: 'Chama', account_code: { $regex: /^(ASI_|ASE_)|^PROFIT_WALLET_PAYABLE$/ } };
  if (chamaId) filter.owner_id = new mongoose.Types.ObjectId(chamaId);
  const ids = await FinancialAccount.distinct('owner_id', filter);
  log(`Found ${ids.length} chama(s) with business or property accounts${apply ? '' : ' (DRY RUN, pass --apply to post)'}`);

  const result = { chamas: ids.length, journalsPosted: 0, skipped: [] };
  for (const id of ids) {
    const plan = await previewSeparation(id);
    log(`\nChama ${id}: ${plan.accountsToMark.length} account(s) to mark`);
    for (const m of plan.moves) log(`  ${m.pooledAccountCode} -> ${m.fundAccountCode}: KES ${m.amount.toFixed(2)} (${m.direction})`);
    if (!apply) continue;
    let poster = userId;
    if (!poster) poster = (await Chama.findById(id).select('created_by').lean())?.created_by || null;
    if (!poster) { result.skipped.push(String(id)); log('  ! no --user-id and the chama has no creator, skipped'); continue; }
    result.journalsPosted += (await applySeparation(id, poster)).journalsPosted;
  }
  log(`\nSummary: ${JSON.stringify(result)}`);
  return result;
}

const isDirectRun = process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isDirectRun) {
  const args = process.argv.slice(2);
  const cli = { chamaId: null, userId: null, apply: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--chama-id') cli.chamaId = args[++i];
    else if (args[i] === '--user-id') cli.userId = args[++i];
    else if (args[i] === '--apply') cli.apply = true;
  }
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) { console.error('Set MONGO_URI (or MONGODB_URI)'); process.exit(1); }
  mongoose.connect(uri)
    .then(() => runSeparateBusinessFunds(cli))
    .then(() => mongoose.disconnect())
    .catch((err) => { console.error(err); process.exit(1); });
}
