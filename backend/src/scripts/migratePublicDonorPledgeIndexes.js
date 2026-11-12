import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import ContributionPledge from '../models/ContributionPledge.js';
import ContributionDonor from '../models/ContributionDonor.js';

async function migrate() {
  await connectDatabase();
  const collection = ContributionPledge.collection;
  const indexes = await collection.indexes();
  const legacy = indexes.find((index) =>
    index.unique &&
    !index.partialFilterExpression &&
    index.key?.contribution_group_id === 1 &&
    index.key?.member_id === 1
  );

  if (legacy) await collection.dropIndex(legacy.name);

  await collection.createIndex(
    { contribution_group_id: 1, member_id: 1 },
    {
      unique: true,
      name: 'contribution_group_id_1_member_id_1',
      partialFilterExpression: { member_id: { $type: 'objectId' } },
    }
  );
  await ContributionDonor.collection.createIndex(
    { contribution_group_id: 1, phone_number: 1 },
    { unique: true, name: 'one_public_donor_per_group_phone' }
  );
  await collection.createIndex(
    { contribution_group_id: 1, donor_id: 1 },
    {
      unique: true,
      name: 'one_pledge_per_public_donation',
      partialFilterExpression: { donor_id: { $type: 'objectId' } },
    }
  );
  console.log('Public donor pledge indexes are ready.');
}

migrate()
  .catch((error) => {
    console.error('Public donor index migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
