/**
 * Audit log repository.
 * Provides persistence layer for audit trail entries.
 * Ensures compliance and regulatory audit trails are preserved.
 */

import { dbPool } from './database';
import { AuditLogEntry, AuditEventType } from './audit-log';

/**
 * Create audit log table if it doesn't exist.
 * Run this during application startup or migrations.
 */
export async function initializeAuditLogTable(): Promise<void> {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(255) PRIMARY KEY,
      event_type VARCHAR(64) NOT NULL,
      withdrawal_id VARCHAR(255),
      user_id VARCHAR(255) NOT NULL,
      reviewed_by VARCHAR(255),
      reason TEXT,
      risk_score INTEGER,
      action TEXT NOT NULL,
      metadata JSONB,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address VARCHAR(45)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_withdrawal ON audit_logs(withdrawal_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_logs(timestamp);
  `;

  try {
    await dbPool.query(createTableSQL);
  } catch (error) {
    console.error('Failed to initialize audit_logs table:', error);
    throw error;
  }
}

/**
 * Insert an audit log entry.
 * @param entry - Audit log entry to insert
 * @returns The inserted entry
 */
export async function createAuditLogEntry(entry: AuditLogEntry): Promise<AuditLogEntry> {
  const insertSQL = `
    INSERT INTO audit_logs (
      id, event_type, withdrawal_id, user_id, reviewed_by,
      reason, risk_score, action, metadata, timestamp, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;

  const values = [
    entry.id,
    entry.eventType,
    entry.withdrawalId,
    entry.userId,
    entry.reviewedBy || null,
    entry.reason || null,
    entry.riskScore || null,
    entry.action,
    JSON.stringify(entry.metadata),
    entry.timestamp,
    entry.ipAddress || null,
  ];

  try {
    const result = await dbPool.query<any>(insertSQL, values);
    return mapRowToAuditLogEntry(result.rows[0]);
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    throw error;
  }
}

/**
 * Get audit log entries by withdrawal ID.
 * @param withdrawalId - Withdrawal ID
 * @param limit - Result limit (default 100)
 * @returns Array of audit log entries
 */
export async function getAuditLogByWithdrawalId(
  withdrawalId: string,
  limit = 100
): Promise<AuditLogEntry[]> {
  const selectSQL = `
    SELECT * FROM audit_logs
    WHERE withdrawal_id = $1
    ORDER BY timestamp DESC
    LIMIT $2;
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [withdrawalId, limit]);
    return result.rows.map(mapRowToAuditLogEntry);
  } catch (error) {
    console.error('Failed to get audit log by withdrawal ID:', error);
    throw error;
  }
}

/**
 * Get audit log entries by user ID.
 * @param userId - User ID
 * @param limit - Result limit (default 100)
 * @param offset - Result offset (default 0)
 * @returns Array of audit log entries
 */
export async function getAuditLogByUserId(
  userId: string,
  limit = 100,
  offset = 0
): Promise<AuditLogEntry[]> {
  const selectSQL = `
    SELECT * FROM audit_logs
    WHERE user_id = $1
    ORDER BY timestamp DESC
    LIMIT $2 OFFSET $3;
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [userId, limit, offset]);
    return result.rows.map(mapRowToAuditLogEntry);
  } catch (error) {
    console.error('Failed to get audit log by user ID:', error);
    throw error;
  }
}

/**
 * Get audit log entries by event type.
 * @param eventType - Event type
 * @param limit - Result limit (default 100)
 * @returns Array of audit log entries
 */
export async function getAuditLogByEventType(
  eventType: AuditEventType,
  limit = 100
): Promise<AuditLogEntry[]> {
  const selectSQL = `
    SELECT * FROM audit_logs
    WHERE event_type = $1
    ORDER BY timestamp DESC
    LIMIT $2;
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [eventType, limit]);
    return result.rows.map(mapRowToAuditLogEntry);
  } catch (error) {
    console.error('Failed to get audit log by event type:', error);
    throw error;
  }
}

/**
 * Get audit log entries in a time range.
 * @param startTime - Start timestamp
 * @param endTime - End timestamp
 * @param limit - Result limit (default 1000)
 * @returns Array of audit log entries
 */
export async function getAuditLogInTimeRange(
  startTime: Date,
  endTime: Date,
  limit = 1000
): Promise<AuditLogEntry[]> {
  const selectSQL = `
    SELECT * FROM audit_logs
    WHERE timestamp >= $1 AND timestamp <= $2
    ORDER BY timestamp DESC
    LIMIT $3;
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [startTime, endTime, limit]);
    return result.rows.map(mapRowToAuditLogEntry);
  } catch (error) {
    console.error('Failed to get audit log in time range:', error);
    throw error;
  }
}

/**
 * Clean up audit log entries older than a certain date.
 * Run this periodically to manage database size.
 * @param olderThanDays - Delete records older than this many days
 * @returns Number of deleted records
 */
export async function cleanupAuditLog(olderThanDays: number = 365): Promise<number> {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const deleteSQL = `
    DELETE FROM audit_logs
    WHERE timestamp < $1;
  `;

  try {
    const result = await dbPool.query(deleteSQL, [cutoffDate]);
    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Failed to cleanup audit log:', error);
    throw error;
  }
}

/**
 * Map database row to AuditLogEntry.
 * @param row - Database row
 * @returns AuditLogEntry
 */
function mapRowToAuditLogEntry(row: any): AuditLogEntry {
  return {
    id: row.id,
    eventType: row.event_type as AuditEventType,
    withdrawalId: row.withdrawal_id,
    userId: row.user_id,
    reviewedBy: row.reviewed_by,
    reason: row.reason,
    riskScore: row.risk_score,
    action: row.action,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    timestamp: row.timestamp.toISOString(),
    ipAddress: row.ip_address,
  };
}
