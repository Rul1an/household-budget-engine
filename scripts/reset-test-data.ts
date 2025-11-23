import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { householdMembers, transactions } from '../src/db/schema';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function reset() {
    console.log('🗑️ Resetting test data...');

    const userId = '00000000-0000-0000-0000-000000000000';

    // Find household
    const member = await db.select().from(householdMembers).where(eq(householdMembers.userId, userId)).limit(1);

    if (member.length > 0) {
        const householdId = member[0].householdId;
        console.log(`Found household ${householdId} for mock user.`);

        // Delete transactions
        const result = await db.delete(transactions).where(eq(transactions.householdId, householdId)).returning();
        console.log(`Deleted ${result.length} transactions.`);
    } else {
        console.log('No household found for mock user.');
    }

    process.exit(0);
}

reset().catch((err) => {
    console.error('❌ Reset failed:', err);
    process.exit(1);
});
