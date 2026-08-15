/**
 * Idempotency repository.
 * Provides persistence layer for idempotency key tracking.
 * Prevents duplicate processing of withdrawal requests.
 */

import { dbPool } from './database';

export interface IdempotencyRecord {
  idempotencyKey: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  result?: Record<string, unknown>;
  error?: string;
  recordedAt: Date;
  expiresAt: Date;
}

/**
 * Create idempotency key table if it doesn't exist.
 * Run this during application startup or migrations.
 */
export async function initializeIdempotencyTable(): Promise<void> {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      idempotency_key VARCHAR(255) PRIMARY KEY,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      result JSONB,
      error TEXT,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_idempotency_key_expires ON idempotency_keys(expires_at);
    CREATE INDEX IF NOT EXISTS idx_idempotency_key_status ON idempotency_keys(status);
  `;

  try {
    await dbPool.query(createTableSQL);
  } catch (error) {
    console.error('Failed to initialize idempotency_keys table:', error);
    throw error;
  }
}

/**
 * Record an idempotency key attempt.
 * @param idempotencyKey - Idempotency key
 * @param expirationMs - Expiration time in milliseconds (default 24 hours)
 * @returns The recorded idempotency record
 */
export async function recordIdempotencyAttempt(
  idempotencyKey: string,
  expirationMs: number = 24 * 60 * 60 * 1000
): Promise<IdempotencyRecord> {
  const expiresAt = new Date(Date.now() + expirationMs);

  const insertSQL = `
    INSERT INTO idempotency_keys (idempotency_key, status, expires_at)
    VALUES ($1, 'PENDING', $2)
    ON CONFLICT (idempotency_key) DO UPDATE
    SET recorded_at = NOW()
    RETURNING idempotency_key, status, result, error, recorded_at, expires_at;
  `;

  try {
    const result = await dbPool.query<any>(insertSQL, [idempotencyKey, expiresAt]);
    const row = result.rows[0];
    return {
      idempotencyKey: row.idempotency_key,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      recordedAt: row.recorded_at,
      expiresAt: row.expires_at,
    };
  } catch (error) {
    console.error('Failed to record idempotency attempt:', error);
    throw error;
  }
}

/**
 * Mark idempotency key as completed.
 * @param idempotencyKey - Idempotency key
 * @param result - Completion result
 * @returns The updated idempotency record
 */
export async function markIdempotencyCompleted(
  idempotencyKey: string,
  result: Record<string, unknown>
): Promise<IdempotencyRecord> {
  const updateSQL = `
    UPDATE idempotency_keys
    SET status = 'COMPLETED', result = $1
    WHERE idempotency_key = $2
    RETURNING idempotency_key, status, result, error, recorded_at, expires_at;
  `;

  try {
    const queryResult = await dbPool.query<any>(updateSQL, [JSON.stringify(result), idempotencyKey]);
    if (queryResult.rows.length === 0) {
      throw new Error(`Idempotency key ${idempotencyKey} not found.`);
    }

    const row = queryResult.rows[0];
    return {
      idempotencyKey: row.idempotency_key,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      recordedAt: row.recorded_at,
      expiresAt: row.expires_at,
    };
  } catch (error) {
    console.error('Failed to mark idempotency as completed:', error);
    throw error;
  }
}

/**
 * Mark idempotency key as failed.
 * @param idempotencyKey - Idempotency key
 * @param error - Error message
 * @returns The updated idempotency record
 */
export async function markIdempotencyFailed(
  idempotencyKey: string,
  error: string
): Promise<IdempotencyRecord> {
  const updateSQL = `
    UPDATE idempotency_keys
    SET status = 'FAILED', error = $1
    WHERE idempotency_key = $2
    RETURNING idempotency_key, status, result, error, recorded_at, expires_at;
  `;

  try {
    const result = await dbPool.query<any>(updateSQL, [error, idempotencyKey]);
    if (result.rows.length === 0) {
      throw new Error(`Idempotency key ${idempotencyKey} not found.`);
    }

    const row = result.rows[0];
    return {
      idempotencyKey: row.idempotency_key,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      recordedAt: row.recorded_at,
      expiresAt: row.expires_at,
    };
  } catch (error) {
    console.error('Failed to mark idempotency as failed:', error);
    throw error;
  }
}

/**
 * Get idempotency record.
 * @param idempotencyKey - Idempotency key
 * @returns Idempotency record or undefined if not found or expired
 */
export async function getIdempotencyRecord(idempotencyKey: string): Promise<IdempotencyRecord | undefined> {
  const selectSQL = `
    SELECT idempotency_key, status, result, error, recorded_at, expires_at
    FROM idempotency_keys
    WHERE idempotency_key = $1 AND expires_at > NOW();
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [idempotencyKey]);
    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows[0];
    return {
      idempotencyKey: row.idempotency_key,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      recordedAt: row.recorded_at,
      expiresAt: row.expires_at,
    };
  } catch (error) {
    console.error('Failed to get idempotency record:', error);
    throw error;
  }
}

/**
 * Clean up expired idempotency keys.
 * Run this periodically to manage database size.
 * @returns Number of deleted records
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const deleteSQL = `
    DELETE FROM idempotency_keys
    WHERE expires_at < NOW();
  `;

  try {
    const result = await dbPool.query(deleteSQL);
    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Failed to cleanup expired idempotency keys:', error);
    throw error;
  }
}
