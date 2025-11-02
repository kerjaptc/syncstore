/**
 * Rollback Plan Creation Script
 * Task 8.5: Create rollback plan
 */

import { db } from '../src/lib/db';
import { syncLogs } from '../src/lib/db/sync-logs-schema';
import { masterProducts } from '../src/lib/db/master-catalog-schema';
import { desc, eq, and, gte } from 'drizzle-orm';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface RollbackPlan {
  plan_id: string;
  created_at: string;
  scope: 'PARTIAL' | 'FULL';
  affected_products: number;
  affected_platforms: string[];
  rollback_procedures: RollbackProcedure[];
  sql_scripts: {
    partial_rollback: string;
    full_rollback: string;
    verification_queries: string[];
  };
  estimated_duration: string;
  risk_assessment: {
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    potential_impacts: string[];
    mitigation_strategies: string[];
  };
}

interface RollbackProcedure {
  step: number;
  description: string;
  sql_command?: string;
  verification_query?: string;
  rollback_command?: string;
  estimated_time: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

async function createRollbackPlan(): Promise<RollbackPlan> {
  console.log('🧪 Task 8.5: Creating rollback plan\n');
  console.log('Generating comprehensive rollback procedures and SQL scripts...\n');

  try {
    // Step 1: Analyze current sync state
    console.log('1️⃣ Analyzing current sync state...');
    
    const recentSyncs = await db
      .select({
        productId: syncLogs.productId,
        platform: syncLogs.platform,
        status: syncLogs.status,
        syncedAt: syncLogs.syncedAt,
        batchId: syncLogs.batchId,
      })
      .from(syncLogs)
      .where(gte(syncLogs.syncedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) // Last 7 days
      .orderBy(desc(syncLogs.syncedAt));

    const uniqueProducts = new Set(recentSyncs.map(s => s.productId));
    const platforms = [...new Set(recentSyncs.map(s => s.platform))];
    const successfulSyncs = recentSyncs.filter(s => s.status === 'success');

    console.log(`   ✅ Recent syncs (7 days): ${recentSyncs.length}`);
    console.log(`   📦 Affected products: ${uniqueProducts.size}`);
    console.log(`   🌐 Platforms: ${platforms.join(', ')}`);
    console.log(`   ✅ Successful syncs: ${successfulSyncs.length}`);

    // Step 2: Generate rollback procedures
    console.log('\n2️⃣ Generating rollback procedures...');
    
    const rollbackProcedures: RollbackProcedure[] = [
      {
        step: 1,
        description: 'Create backup of current sync_logs table',
        sql_command: `CREATE TABLE sync_logs_backup_${Date.now()} AS SELECT * FROM sync_logs;`,
        verification_query: `SELECT COUNT(*) FROM sync_logs_backup_${Date.now()};`,
        estimated_time: '30 seconds',
        risk_level: 'LOW',
      },
      {
        step: 2,
        description: 'Stop all active sync workers',
        sql_command: 'N/A - Manual process',
        verification_query: 'SELECT COUNT(*) FROM bullmq_jobs WHERE status = "active";',
        estimated_time: '1 minute',
        risk_level: 'MEDIUM',
      },
      {
        step: 3,
        description: 'Clear failed jobs from dead letter queue',
        sql_command: 'N/A - BullMQ operation',
        verification_query: 'SELECT COUNT(*) FROM bullmq_failed_jobs;',
        estimated_time: '30 seconds',
        risk_level: 'LOW',
      },
      {
        step: 4,
        description: 'Partial rollback: Remove syncs from last 24 hours',
        sql_command: `DELETE FROM sync_logs WHERE synced_at >= NOW() - INTERVAL '24 hours';`,
        verification_query: `SELECT COUNT(*) FROM sync_logs WHERE synced_at >= NOW() - INTERVAL '24 hours';`,
        rollback_command: `INSERT INTO sync_logs SELECT * FROM sync_logs_backup_${Date.now()} WHERE synced_at >= NOW() - INTERVAL '24 hours';`,
        estimated_time: '2 minutes',
        risk_level: 'MEDIUM',
      },
      {
        step: 5,
        description: 'Full rollback: Remove all sync logs',
        sql_command: 'TRUNCATE TABLE sync_logs;',
        verification_query: 'SELECT COUNT(*) FROM sync_logs;',
        rollback_command: `INSERT INTO sync_logs SELECT * FROM sync_logs_backup_${Date.now()};`,
        estimated_time: '5 minutes',
        risk_level: 'HIGH',
      },
      {
        step: 6,
        description: 'Reset master product sync status',
        sql_command: `UPDATE master_products SET last_synced_at = NULL, sync_status = 'pending' WHERE id IN (SELECT DISTINCT product_id FROM sync_logs_backup_${Date.now()});`,
        verification_query: `SELECT COUNT(*) FROM master_products WHERE sync_status = 'pending';`,
        estimated_time: '1 minute',
        risk_level: 'MEDIUM',
      },
      {
        step: 7,
        description: 'Clear BullMQ job queues',
        sql_command: 'N/A - BullMQ operation',
        verification_query: 'SELECT COUNT(*) FROM bullmq_jobs;',
        estimated_time: '30 seconds',
        risk_level: 'LOW',
      },
      {
        step: 8,
        description: 'Restart sync workers with clean state',
        sql_command: 'N/A - Manual process',
        verification_query: 'SELECT COUNT(*) FROM bullmq_workers WHERE status = "active";',
        estimated_time: '2 minutes',
        risk_level: 'LOW',
      },
    ];

    console.log(`   ✅ Generated ${rollbackProcedures.length} rollback procedures`);

    // Step 3: Generate SQL scripts
    console.log('\n3️⃣ Generating SQL scripts...');
    
    const timestamp = Date.now();
    const backupTableName = `sync_logs_backup_${timestamp}`;
    
    const partialRollbackSQL = `
-- Partial Rollback Script (Last 24 Hours)
-- Generated: ${new Date().toISOString()}

-- Step 1: Create backup
CREATE TABLE ${backupTableName} AS SELECT * FROM sync_logs;

-- Step 2: Remove recent syncs (last 24 hours)
DELETE FROM sync_logs 
WHERE synced_at >= NOW() - INTERVAL '24 hours';

-- Step 3: Reset product sync status
UPDATE master_products 
SET last_synced_at = NULL, sync_status = 'pending' 
WHERE id IN (
  SELECT DISTINCT product_id 
  FROM ${backupTableName} 
  WHERE synced_at >= NOW() - INTERVAL '24 hours'
);

-- Verification queries
SELECT 'Recent syncs removed' as status, COUNT(*) as count 
FROM sync_logs 
WHERE synced_at >= NOW() - INTERVAL '24 hours';

SELECT 'Products reset' as status, COUNT(*) as count 
FROM master_products 
WHERE sync_status = 'pending';
`;

    const fullRollbackSQL = `
-- Full Rollback Script (All Syncs)
-- Generated: ${new Date().toISOString()}

-- Step 1: Create backup
CREATE TABLE ${backupTableName} AS SELECT * FROM sync_logs;

-- Step 2: Clear all sync logs
TRUNCATE TABLE sync_logs;

-- Step 3: Reset all product sync status
UPDATE master_products 
SET last_synced_at = NULL, sync_status = 'pending';

-- Step 4: Clear platform mappings (if needed)
-- UPDATE master_products SET shopee_item_id = NULL, tiktok_product_id = NULL;

-- Verification queries
SELECT 'All syncs removed' as status, COUNT(*) as count FROM sync_logs;
SELECT 'All products reset' as status, COUNT(*) as count FROM master_products WHERE sync_status = 'pending';
`;

    const verificationQueries = [
      'SELECT COUNT(*) as total_sync_logs FROM sync_logs;',
      'SELECT platform, COUNT(*) as count FROM sync_logs GROUP BY platform;',
      'SELECT status, COUNT(*) as count FROM sync_logs GROUP BY status;',
      'SELECT COUNT(*) as pending_products FROM master_products WHERE sync_status = \'pending\';',
      'SELECT COUNT(*) as active_workers FROM bullmq_workers WHERE status = \'active\';',
      'SELECT COUNT(*) as queued_jobs FROM bullmq_jobs WHERE status IN (\'waiting\', \'active\');',
    ];

    // Step 4: Risk assessment
    console.log('\n4️⃣ Performing risk assessment...');
    
    const riskAssessment = {
      risk_level: uniqueProducts.size > 1000 ? 'HIGH' : uniqueProducts.size > 100 ? 'MEDIUM' : 'LOW' as const,
      potential_impacts: [
        'Loss of sync history and audit trail',
        'Need to re-sync all affected products',
        'Temporary service disruption during rollback',
        'Potential data inconsistency between platforms',
        'Impact on ongoing batch operations',
      ],
      mitigation_strategies: [
        'Create comprehensive backup before rollback',
        'Notify users of maintenance window',
        'Test rollback procedures in staging environment',
        'Have platform API credentials ready for re-sync',
        'Monitor system health during rollback process',
        'Prepare communication for stakeholders',
      ],
    };

    console.log(`   📊 Risk level: ${riskAssessment.risk_level}`);
    console.log(`   ⚠️  Potential impacts: ${riskAssessment.potential_impacts.length}`);
    console.log(`   🛡️  Mitigation strategies: ${riskAssessment.mitigation_strategies.length}`);

    // Step 5: Create rollback plan
    const plan: RollbackPlan = {
      plan_id: `rollback_plan_${timestamp}`,
      created_at: new Date().toISOString(),
      scope: 'PARTIAL', // Default to partial, can be changed to FULL
      affected_products: uniqueProducts.size,
      affected_platforms: platforms,
      rollback_procedures: rollbackProcedures,
      sql_scripts: {
        partial_rollback: partialRollbackSQL,
        full_rollback: fullRollbackSQL,
        verification_queries: verificationQueries,
      },
      estimated_duration: '15-30 minutes',
      risk_assessment: riskAssessment,
    };

    // Step 6: Save rollback scripts to files
    console.log('\n5️⃣ Saving rollback scripts to files...');
    
    const scriptsDir = join(process.cwd(), 'scripts', 'rollback');
    
    try {
      // Create rollback directory if it doesn't exist
      const fs = require('fs');
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }

      // Save SQL scripts
      writeFileSync(join(scriptsDir, `partial-rollback-${timestamp}.sql`), partialRollbackSQL);
      writeFileSync(join(scriptsDir, `full-rollback-${timestamp}.sql`), fullRollbackSQL);
      writeFileSync(join(scriptsDir, `verification-queries-${timestamp}.sql`), verificationQueries.join(';\n\n') + ';');
      
      // Save rollback plan as JSON
      writeFileSync(join(scriptsDir, `rollback-plan-${timestamp}.json`), JSON.stringify(plan, null, 2));
      
      console.log(`   ✅ Saved rollback scripts to: ${scriptsDir}`);
      console.log(`   📄 Partial rollback: partial-rollback-${timestamp}.sql`);
      console.log(`   📄 Full rollback: full-rollback-${timestamp}.sql`);
      console.log(`   📄 Verification: verification-queries-${timestamp}.sql`);
      console.log(`   📄 Plan JSON: rollback-plan-${timestamp}.json`);
    } catch (error) {
      console.log(`   ⚠️  Could not save files: ${error}`);
    }

    // Step 7: Display rollback plan
    console.log('\n🎯 ROLLBACK PLAN SUMMARY');
    console.log('='.repeat(60));
    console.log(`Plan ID: ${plan.plan_id}`);
    console.log(`Created: ${new Date(plan.created_at).toLocaleString()}`);
    console.log(`Scope: ${plan.scope}`);
    console.log(`Affected Products: ${plan.affected_products}`);
    console.log(`Affected Platforms: ${plan.affected_platforms.join(', ')}`);
    console.log(`Estimated Duration: ${plan.estimated_duration}`);
    console.log(`Risk Level: ${plan.risk_assessment.risk_level}`);
    console.log('');
    console.log('📋 ROLLBACK PROCEDURES:');
    plan.rollback_procedures.forEach(procedure => {
      console.log(`   ${procedure.step}. ${procedure.description}`);
      console.log(`      Time: ${procedure.estimated_time}, Risk: ${procedure.risk_level}`);
    });
    console.log('');
    console.log('⚠️  POTENTIAL IMPACTS:');
    plan.risk_assessment.potential_impacts.forEach((impact, index) => {
      console.log(`   ${index + 1}. ${impact}`);
    });
    console.log('');
    console.log('🛡️  MITIGATION STRATEGIES:');
    plan.risk_assessment.mitigation_strategies.forEach((strategy, index) => {
      console.log(`   ${index + 1}. ${strategy}`);
    });

    console.log('\n🎉 Task 8.5: Rollback plan creation - SUCCESS!');
    console.log('Comprehensive rollback procedures and SQL scripts generated');

    return plan;

  } catch (error) {
    console.error('❌ Rollback plan creation failed:', error);
    throw error;
  }
}

// Export for use in other scripts
export { createRollbackPlan, type RollbackPlan };

// Run if called directly
if (require.main === module) {
  createRollbackPlan()
    .then(() => {
      console.log('\n✅ Rollback plan creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Rollback plan creation failed:', error);
      process.exit(1);
    });
}