/**
 * Migration Script: Update obsolete lead statuses to 'new'
 * 
 * This script updates all leads with the following statuses:
 * - busy
 * - no-answer
 * - email/whatsApp-sent
 * 
 * All matching leads will be updated to status: 'new'
 * 
 * Run with: npx tsx src/scripts/migrate-statuses.ts
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'job-portal-prod';

const OLD_STATUSES = ['busy', 'no-answer', 'email/whatsApp-sent'];
const NEW_STATUS = 'new';

async function migrate() {
    if (!MONGO_URI) {
        console.error('❌ MONGO_URI not found in .env');
        process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);
        const leadsCollection = db.collection('leads');

        // Count leads to be updated
        const countBefore = await leadsCollection.countDocuments({
            status: { $in: OLD_STATUSES }
        });

        console.log(`\n📊 Found ${countBefore} leads with obsolete statuses:`);
        
        // Show breakdown by status
        for (const status of OLD_STATUSES) {
            const count = await leadsCollection.countDocuments({ status });
            console.log(`   - ${status}: ${count}`);
        }

        if (countBefore === 0) {
            console.log('\n✨ No leads need migration. All good!');
            return;
        }

        // Update lead status
        console.log(`\n🔄 Updating lead statuses to '${NEW_STATUS}'...`);
        const leadResult = await leadsCollection.updateMany(
            { status: { $in: OLD_STATUSES } },
            { $set: { status: NEW_STATUS } }
        );
        console.log(`✅ Updated ${leadResult.modifiedCount} leads`);

        // Also update activities inside leads
        console.log('\n🔄 Updating activity statuses inside leads...');
        const activityResult = await leadsCollection.updateMany(
            { 'activities.status': { $in: OLD_STATUSES } },
            { $set: { 'activities.$[elem].status': NEW_STATUS } },
            { arrayFilters: [{ 'elem.status': { $in: OLD_STATUSES } }] }
        );
        console.log(`✅ Updated activities in ${activityResult.modifiedCount} leads`);

        console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

migrate();
