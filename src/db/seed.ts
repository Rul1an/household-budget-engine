import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { householdMembers, households } from './schema';

import { env } from '../env';

const connectionString = env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
    console.log('🌱 Seeding database...');

    // 1. Create Mock Auth Schema & User
    await client`CREATE SCHEMA IF NOT EXISTS auth`;
    await client`CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY,
    email text
  )`;

    await client`
    INSERT INTO auth.users (id, email)
    VALUES ('00000000-0000-0000-0000-000000000000', 'mock@example.com')
    ON CONFLICT (id) DO NOTHING
  `;

    // 2. Create Tables (if not using migration tool for this step)
    // We assume Drizzle Kit push will handle the rest, but for FKs to work, auth.users must exist first.
    // Actually, we should run this seed AFTER migration, but migration might fail if auth.users is missing.
    // So we run this "Pre-seed" to set up auth, then we might need to run migration.

    // Let's just insert data assuming tables exist. If they don't, we need to run migration first.
    // But migration depends on auth.users. So we MUST run this raw SQL first.

    console.log('✅ Mock Auth setup complete.');

    // 3. Insert Household
    const userId = '00000000-0000-0000-0000-000000000000';

    try {
        // Check if household exists
        const existingHousehold = await db.query.households.findFirst({
            where: (households, { eq }) => eq(households.ownerId, userId)
        });

        if (!existingHousehold) {
            const [household] = await db.insert(households).values({
                name: 'My Local Household',
                ownerId: userId
            }).returning();

            console.log('🏠 Created household:', household.id);

            // 4. Insert Member
            await db.insert(householdMembers).values({
                householdId: household.id,
                userId: userId,
                role: 'ADMIN',
                isAccepted: true
            });
            console.log('👤 Created member for household');
        } else {
            console.log('🏠 Household already exists');
        }

        // 5. Seed Default Categories
        // We need the household ID. If we just created it, we have it. If it existed, we need to fetch it.
        const household = await db.query.households.findFirst({
            where: (households, { eq }) => eq(households.ownerId, userId)
        });

        if (household) {
            const defaultCategories = [
                { name: 'Vaste Lasten', isFixed: true, isAllowance: false },
                { name: 'Toeslagen', isFixed: false, isAllowance: true },
                { name: 'Inkomen', isFixed: false, isAllowance: false }, // Income is usually positive, flag usage depends on logic
                { name: 'Overig', isFixed: false, isAllowance: false }
            ];

            for (const cat of defaultCategories) {
                await db.insert(schema.categories)
                    .values({
                        householdId: household.id,
                        name: cat.name,
                        type: cat.name === 'Inkomen' || cat.name === 'Toeslagen' ? 'INCOME' : 'EXPENSE',
                        isFixed: cat.isFixed,
                        isAllowance: cat.isAllowance
                    })
                    .onConflictDoNothing()
                    .returning();
            }
            console.log('🗂️ Default categories seeded');
        }
    } catch (e: any) {
        if (e.code === '42P01') { // undefined_table
            console.log('⚠️ Tables not found. Run "npx drizzle-kit push" and then run this seed script again.');
        } else {
            throw e;
        }
    }

    console.log('✅ Seeding complete (Auth setup finished).');
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
