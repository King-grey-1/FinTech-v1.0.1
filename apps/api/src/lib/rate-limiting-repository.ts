/**
 * Rate limiting repository.
 * Provides persistence layer for withdrawal history.
 * Enables accurate rate limit enforcement across restarts.
 */

import { dbPool } from './database';

export interface WithdrawalHistoryRecord {
  id?: string;
  userId: string;
  amount: number;
  timestamp: number;
  recordedAt?: Date;
}

/**
 * Create withdrawal history table if it doesn't exist.
 * Run this during application startup or migrations.
 */
export async function initializeWithdrawalHistoryTable(): Promise<void> {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS withdrawal_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      amount NUMERIC(18,2) NOT NULL,
      withdrawal_timestamp BIGINT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_withdrawal_history_user_id ON withdrawal_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_history_timestamp ON withdrawal_history(withdrawal_timestamp);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_history_user_time 
      ON withdrawal_history(user_id, withdrawal_timestamp);
  `;

  try {
    await dbPool.query(createTableSQL);
  } catch (error) {
    console.error('Failed to initialize withdrawal_history table:', error);
    throw error;
  }
}

/**
 * Record a withdrawal in history.
 * @param userId - User ID
 * @param amount - Withdrawal amount
 * @param timestamp - Withdrawal timestamp (default: now)
 * @returns The recorded withdrawal history
 */
export async function recordWithdrawalHistory(
  userId: string,
  amount: number,
  timestamp: number = Date.now()
): Promise<WithdrawalHistoryRecord> {
  const insertSQL = `
    INSERT INTO withdrawal_history (user_id, amount, withdrawal_timestamp)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, amount, withdrawal_timestamp;
  `;

  try {
    const result = await dbPool.query<any>(insertSQL, [userId, amount, timestamp]);
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      amount: parseFloat(row.amount),
      timestamp: row.withdrawal_timestamp,
      recordedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to record withdrawal history:', error);
    throw error;
  }
}

/**
 * Get withdrawal history within a time window.
 * @param userId - User ID
 * @param windowMs - Time window in milliseconds
 * @returns Array of withdrawal history records
 */
export async function getWithdrawalHistoryInWindow(
  userId: string,
  windowMs: number
): Promise<WithdrawalHistoryRecord[]> {
  const cutoffTime = Date.now() - windowMs;

  const selectSQL = `
    SELECT id, user_id, amount, withdrawal_timestamp, recorded_at
    FROM withdrawal_history
    WHERE user_id = $1 AND withdrawal_timestamp > $2
    ORDER BY withdrawal_timestamp DESC;
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [userId, cutoffTime]);
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      amount: parseFloat(row.amount),
      timestamp: row.withdrawal_timestamp,
      recordedAt: row.recorded_at,
    }));
  } catch (error) {
    console.error('Failed to get withdrawal history:', error);
    throw error;
  }
}

/**
 * Get total withdrawal amount in a time window.
 * @param userId - User ID
 * @param windowMs - Time window in milliseconds
 * @returns Total withdrawal amount
 */
export async function getTotalWithdrawalInWindow(userId: string, windowMs: number): Promise<number> {
  const cutoffTime = Date.now() - windowMs;

  const selectSQL = `
    SELECT COALESCE(SUM(amount), 0) as total
    FROM withdrawal_history
    WHERE user_id = $1 AND withdrawal_timestamp > $2;
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [userId, cutoffTime]);
    return parseFloat(result.rows[0].total);
  } catch (error) {
    console.error('Failed to get total withdrawal:', error);
    throw error;
  }
}

/**
 * Count withdrawals in a time window.
 * @param userId - User ID
 * @param windowMs - Time window in milliseconds
 * @returns Number of withdrawals
 */
export async function countWithdrawalsInWindow(userId: string, windowMs: number): Promise<number> {
  const cutoffTime = Date.now() - windowMs;

  const selectSQL = `
    SELECT COUNT(*) as count
    FROM withdrawal_history
    WHERE user_id = $1 AND withdrawal_timestamp > $2;
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [userId, cutoffTime]);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Failed to count withdrawals:', error);
    throw error;
  }
}

/**
 * Clean up withdrawal history older than a certain date.
 * Run this periodically to manage database size.
 * @param olderThanDays - Delete records older than this many days
 * @returns Number of deleted records
 */
export async function cleanupWithdrawalHistory(olderThanDays: number = 90): Promise<number> {
  const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const deleteSQL = `
    DELETE FROM withdrawal_history
    WHERE withdrawal_timestamp < $1;
  `;

  try {
    const result = await dbPool.query(deleteSQL, [cutoffTime]);
    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Failed to cleanup withdrawal history:', error);
    throw error;
  }
}
