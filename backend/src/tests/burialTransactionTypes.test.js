import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import FinancialTransaction from '../models/FinancialTransaction.js';

const burialTypes = [
  'burial_benefit_disbursement',
  'burial_fundraising_receipt',
  'burial_fundraising_handover',
  'equipment_hire_payment',
  'equipment_deposit_settlement',
];

test('burial and equipment journals use registered transaction types', async () => {
  for (const transaction_type of burialTypes) {
    const doc = new FinancialTransaction({
      owner_type: 'Chama',
      owner_id: new mongoose.Types.ObjectId(),
      transaction_type,
      amount: mongoose.Types.Decimal128.fromString('10.00'),
      currency: 'KES',
      source_type: 'Payment',
      source_id: new mongoose.Types.ObjectId(),
      created_by: new mongoose.Types.ObjectId(),
    });
    await doc.validate();
  }
});
