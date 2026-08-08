import crypto from "node:crypto";
import FinancialAccount from "../../models/FinancialAccount.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import Journal from "../../models/Journal.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import financeAccountService from "./financeAccount.service.js";
import AppError from "../../utils/AppError.js";

const increaseEntry = (account) => account.normal_balance === "debit" ? "debit" : "credit";
const decreaseEntry = (account) => account.normal_balance === "debit" ? "credit" : "debit";

export async function postFinanceOperation({ ownerType, ownerId, userId, operation, sourceAccountId, destinationAccountId, amount, description }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("Amount must be greater than zero", 400);
  if (!["deposit", "withdrawal", "transfer"].includes(operation)) throw new AppError("Unsupported finance operation", 400);
  if (!sourceAccountId || !destinationAccountId || String(sourceAccountId) === String(destinationAccountId)) throw new AppError("Choose two different financial accounts", 400);
  const accounts = await FinancialAccount.find({ _id: { $in: [sourceAccountId, destinationAccountId] }, owner_type: ownerType, owner_id: ownerId });
  if (accounts.length !== 2) throw new AppError("One or both accounts do not belong to this workspace", 400);
  const source = accounts.find((account) => String(account._id) === String(sourceAccountId));
  const destination = accounts.find((account) => String(account._id) === String(destinationAccountId));
  if (operation === "transfer" && (source.normal_balance !== "debit" || destination.normal_balance !== "debit")) throw new AppError("Transfers must be between asset or expense accounts", 400);
  if (operation === "deposit" && (source.normal_balance !== "credit" || destination.normal_balance !== "debit")) throw new AppError("A deposit must move from a credit account into an asset account", 400);
  if (operation === "withdrawal" && (source.normal_balance !== "debit" || destination.normal_balance !== "debit")) throw new AppError("A withdrawal must move from an asset account to an expense or asset account", 400);
  const reference = `FIN-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
  const transaction = await FinancialTransaction.create({ owner_type: ownerType, owner_id: ownerId, transaction_type: operation, amount: value, currency: "KES", source_type: "FinanceOperation", source_id: ownerId, reference, status: "posted", description: description?.trim() || `${operation} recorded in finance dashboard`, created_by: userId, posted_by: userId, posted_at: new Date() });
  const journal = await Journal.create({ journalNumber: `JR-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`, transaction: transaction._id, chama: ownerId, transactionType: operation, amount: value, currency: "KES", narration: transaction.description, status: "POSTED", totalDebit: value, totalCredit: value });
  const entries = await LedgerEntry.insertMany([
    { transaction_id: transaction._id, owner_type: ownerType, owner_id: ownerId, account_id: source._id, entry_type: decreaseEntry(source), amount: value, currency: "KES", description: transaction.description, status: "posted", posted_at: new Date(), posted_by: userId },
    { transaction_id: transaction._id, owner_type: ownerType, owner_id: ownerId, account_id: destination._id, entry_type: increaseEntry(destination), amount: value, currency: "KES", description: transaction.description, status: "posted", posted_at: new Date(), posted_by: userId },
  ]);
  await financeAccountService.applyEntries(entries);
  return { transaction, journal, entries };
}
