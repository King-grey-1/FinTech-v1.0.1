/**
 * Idempotency enforcement for withdrawal requests.
 * Prevents duplicate processing of the same withdrawal request
 * using idempotencyKey (user-provided or system-generated UUID).
 * 
 * Persisted to database with TTL: 24 hours.
 */

import {
  recordIdempotencyAttempt as dbRecordAttempt,
  getIdempotencyRecord as dbGetRecord,
  markIdempotencyCompleted as dbMarkCompleted,
  markIdempotencyFailed as dbMarkFailed,
} from './idempotency-repository';

export interface IdempotencyRecord {
  key: string;
  withdrawalId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  result?: string;
  errorReason?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Idempotency cache with database persistence.
 * Maintains in-memory cache for fast lookups, backed by database for durability.
 * TTL: 24 hours
 */
class IdempotencyCache {
  private cache: Map<string, IdempotencyRecord> = new Map();

  /**
   * Record a withdrawal request attempt.
   * Writes to cache immediately and asynchronously to database.
   * Returns the cached result if key already exists and is within TTL.
   */
  recordAttempt(key: string, withdrawalId: string): { isCached: boolean; cachedRecord?: IdempotencyRecord } {
    const existing = this.cache.get(key);
    if (existing) {
      const now = new Date();
      if (now < new Date(existing.expiresAt)) {
        return { isCached: true, cachedRecord: existing };
      }
      // TTL expired; allow retry
      this.cache.delete(key);
    }

    // New or expired entry
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const record: IdempotencyRecord = {
      key,
      withdrawalId,
      status: 'PENDING',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.cache.set(key, record);

    // Fire async database write without blocking
    dbRecordAttempt(key, 24 * 60 * 60 * 1000).catch((error) => {
      console.error('Failed to persist idempotency record to database:', error);
    });

    return { isCached: false };
  }

  /**
   * Mark idempotency record as completed with optional result.
   * Updates both cache and database.
   */
  markCompleted(key: string, result: string): void {
    const record = this.cache.get(key);
    if (record) {
      record.status = 'COMPLETED';
      record.result = result;

      // Fire async database update
      dbMarkCompleted(key, { withdrawalId: record.withdrawalId, result }).catch((error) => {
        console.error('Failed to update idempotency record in database:', error);
      });
    }
  }

  /**
   * Mark idempotency record as failed with reason.
   * Updates both cache and database.
   */
  markFailed(key: string, reason: string): void {
    const record = this.cache.get(key);
    if (record) {
      record.status = 'FAILED';
      record.errorReason = reason;

      // Fire async database update
      dbMarkFailed(key, reason).catch((error) => {
        console.error('Failed to update idempotency record in database:', error);
      });
    }
  }

  /**
   * Retrieve record by key (for testing/debugging).
   */
  get(key: string): IdempotencyRecord | undefined {
    return this.cache.get(key);
  }

  /**
   * Clear cache (for testing).
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global singleton cache instance
export const idempotencyCache = new IdempotencyCache();
