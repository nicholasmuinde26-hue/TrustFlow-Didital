/**
 * ============================================================================
 * BACKFILL: FinancialAccount.name for legacy documents
 * ============================================================================
 *
 * WHY:
 *   The FinancialAccount schema made `name` a required field after some
 *   accounts had already been created without one (directly, or via an
 *   older version of bootstrapSystemAccounts). Any payment that tries to
 *   post a balance update to one of these accounts fails with:
 *
 *     ValidationError: FinancialAccount validation failed: name: Path `name` is required.
 *
 *   because mongoose re-validates the WHOLE document on every .save(), not
 *   just the fields that changed.
 *
 * WHAT THIS DOES:
 *   Finds every FinancialAccount with a missing/blank `name`, and sets one
 *   based on its account_code (falling back to account_category/type for
 *   anything non-standard). Safe to re-run — already-named accounts are
 *   left untouched.
 *
 * USAGE:
 *   node scripts/backfill-financial-account-names.js
 *
 *   Reads MONGODB_URI (or MONGO_URI) from your existing backend .env, same
 *   as the app itself. Add --dry-run to only report what would change.
 * ============================================================================
 */

import "dotenv/config";
import mongoose from "mongoose";
import FinancialAccount from "../src/models/FinancialAccount.js";

const ACCOUNT_NAME_BY_CODE = {
  CASH: "Cash",
  BANK: "Bank",
  MPESA_CLEARING: "M-Pesa Clearing",
  MEMBER_CONTRIBUTIONS: "Member Contributions",
  MEMBER_SAVINGS: "Member Savings",
  PAYOUT_CLEARING: "Payout Clearing",
  LOAN_RECEIVABLE: "Loans Receivable",
  INTEREST_INCOME: "Loan Interest Income",
  PENALTY_INCOME: "Loan Penalty Income",
};

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI (or MONGO_URI) is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected. ${dryRun ? "(dry run — no writes will be made)" : ""}`);

  // Catch missing field, null, and empty/whitespace-only strings.
  const broken = await FinancialAccount.find({
    $or: [
      { name: { $exists: false } },
      { name: null },
      { name: "" },
    ],
  });

  console.log(`Found ${broken.length} FinancialAccount doc(s) missing a name.`);

  let fixed = 0;
  for (const account of broken) {
    const name =
      ACCOUNT_NAME_BY_CODE[account.account_code] ||
      `${account.account_category || account.account_type || "Untitled"} account`
        .replace(/^./, (c) => c.toUpperCase());

    console.log(
      `  - ${account._id} (owner: ${account.owner_type}:${account.owner_id}, code: ${account.account_code || "n/a"}) -> "${name}"`
    );

    if (!dryRun) {
      account.name = name;
      await account.save({ validateModifiedOnly: true });
      fixed += 1;
    }
  }

  console.log(dryRun ? "Dry run complete. No changes written." : `Backfilled ${fixed} account(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});