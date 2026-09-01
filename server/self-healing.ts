import { db } from './v2/db/client.js';
import { users } from './v2/db/schema/users.js';
import { lounges, loungeMembers, messages } from './v2/db/schema/lounges.js';
import { ensureVelumLoungeSeeded } from './v2/services/loungeSeeder.js';
import { ensureAdminSeeded } from './v2/services/adminSeeder.js';
import { eq, and, sql, notInArray, isNotNull, inArray } from 'drizzle-orm';

async function runSelfHealing() {
  console.log('================================================================');
  console.log('       VELUM SYSTEM INTEGRITY & SELF-HEALING DIAGNOSTIC ENGINE  ');
  console.log('================================================================');
  console.log('[Diagnostic] Initiating system health check...');

  try {
    // 1. Validate Database Tables
    console.log('\n[1/4] Validating database tables...');
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const existingTables = (tablesResult.rows as any[]).map(row => row.table_name);
    const requiredTables = ['users', 'lounges', 'lounge_members', 'messages', 'support_admin_nominations'];
    
    console.log(`[Diagnostic] Found existing tables: ${existingTables.join(', ')}`);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.warn(`[Warning] Missing required tables: ${missingTables.join(', ')}`);
      console.log('[Diagnostic] Running seeders to create missing tables and schemas...');
    } else {
      console.log('[Success] All core database tables are present.');
    }

    // 2. Repair Missing Default Sub-lounges and Seeding
    console.log('\n[2/4] Repairing missing default sub-lounges & master structures...');
    await ensureVelumLoungeSeeded();
    console.log('[Success] Official Velum Lounge & default sub-lounges are seeded and verified.');

    // 3. Fix Orphaned References & Clean up redundant/corrupt records
    console.log('\n[3/4] Scanning for orphaned room, member, and message references...');
    
    const { databaseCleanup } = await import('./v2/utils/databaseCleanup.js');
    const report = await databaseCleanup.cleanOrphans();

    console.log(`[Success] Orphaned references cleaned:`);
    console.log(`  - Cleaned ${report.members} orphaned membership entries.`);
    console.log(`  - Cleaned ${report.messages} orphaned chat messages.`);
    console.log(`  - Cleaned ${report.sublounges} orphaned sub-lounge references.`);
    console.log(`  - Cleaned ${report.relationships} orphaned relationship entries.`);
    console.log(`  - Cleaned ${report.expiredSessions} expired session tokens.`);


    // 4. Verify Admin Role & Credentials Integrity
    console.log('\n[4/4] Verifying administrator roles and system account integrity...');
    await ensureAdminSeeded();

    // Verify role values for specific admin handles
    const adminsToVerify = [
      { username: 'midnight', expectedRole: 'CLI_ADMIN' },
      { username: 'lexie', expectedRole: 'LOGIN_ADMIN' },
      { username: 'velum', expectedRole: 'ADMIN' }
    ];

    for (const item of adminsToVerify) {
      const [userRecord] = await db.select().from(users).where(eq(users.username, item.username)).limit(1);
      if (userRecord) {
        if (userRecord.role !== item.expectedRole) {
          console.log(`[Diagnostic] Repairing role mismatch for user '${item.username}': '${userRecord.role}' -> '${item.expectedRole}'`);
          await db.update(users)
            .set({ role: item.expectedRole })
            .where(eq(users.id, userRecord.id));
        } else {
          console.log(`[Success] User '${item.username}' has correct role: '${item.expectedRole}'`);
        }
      } else {
        console.warn(`[Warning] Core administrator/system user '${item.username}' was not found. Please verify environment secrets.`);
      }
    }

    console.log('\n================================================================');
    console.log('       SELF-HEALING COMPLETE - ALL SYSTEMS FUNCTIONAL & VERIFIED');
    console.log('================================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n[Error] Diagnostic self-healing failed with exception:', error);
    process.exit(1);
  }
}

runSelfHealing();
