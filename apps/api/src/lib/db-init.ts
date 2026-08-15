/**
 * Database initialization and schema setup.
 * Runs all table creation and migration scripts.
 */

import { initializeWithdrawalTable } from './withdrawal-repository';
import { initializeWithdrawalHistoryTable } from './rate-limiting-repository';
import { initializeAuditLogTable } from './audit-log-repository';
import { initializeIdempotencyTable } from './idempotency-repository';

/**
 * Initialize all database tables.
 * Should be called during application startup.
 */
export async function initializeDatabase(): Promise<void> {
  console.log('Initializing database schema...');

  try {
    await initializeWithdrawalTable();
    console.log('✓ Withdrawal table initialized');

    await initializeWithdrawalHistoryTable();
    console.log('✓ Withdrawal history table initialized');

    await initializeAuditLogTable();
    console.log('✓ Audit log table initialized');

    await initializeIdempotencyTable();
    console.log('✓ Idempotency table initialized');

    console.log('✓ Database schema initialization complete');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}
