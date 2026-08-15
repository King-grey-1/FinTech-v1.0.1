/**
 * Audit logging for withdrawal approval workflow.
 * Tracks all approval/rejection decisions with full context.
 * Persisted to database for compliance and audit trails.
 * Falls back to in-memory cache when database is unavailable (e.g., in tests).
 */

import { createAuditLogEntry as dbCreateAuditLogEntry, getAuditLogByWithdrawalId as dbGetByWithdrawalId, getAuditLogByUserId as dbGetByUserId } from './audit-log-repository';

export enum AuditEventType {
  WITHDRAWAL_REQUESTED = 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_UNDER_REVIEW = 'WITHDRAWAL_UNDER_REVIEW',
  WITHDRAWAL_APPROVED = 'WITHDRAWAL_APPROVED',
  WITHDRAWAL_REJECTED = 'WITHDRAWAL_REJECTED',
  WITHDRAWAL_PROCESSING = 'WITHDRAWAL_PROCESSING',
  WITHDRAWAL_COMPLETED = 'WITHDRAWAL_COMPLETED',
  WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED',
}

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  withdrawalId: string;
  userId: string;
  reviewedBy?: string;
  reason?: string;
  riskScore?: number;
  action: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}

/**
 * Audit log with database persistence and in-memory fallback.
 * Writes to database asynchronously while maintaining backward compatibility.
 * For tests: Use in-memory cache when database is unavailable.
 */
class AuditLog {
  private entries: AuditLogEntry[] = [];

  /**
   * Log an audit entry.
   * Writes synchronously to in-memory cache and asynchronously to database.
   * @param entry - Audit entry to log
   * @returns Audit log entry
   */
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const logEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    this.entries.push(logEntry);

    // Fire async database write without blocking
    dbCreateAuditLogEntry(logEntry).catch((error) => {
      console.error('Failed to persist audit log entry to database:', error);
    });

    return logEntry;
  }

  /**
   * Get audit entries by withdrawal ID.
   * Tries database first, falls back to in-memory cache for tests.
   * @param withdrawalId - Withdrawal ID
   * @returns Promise resolving to audit entries
   */
  async getByWithdrawalId(withdrawalId: string): Promise<AuditLogEntry[]> {
    try {
      return await dbGetByWithdrawalId(withdrawalId);
    } catch (error) {
      // Fallback to in-memory cache (for tests or when DB is unavailable)
      if (error instanceof Error && error.message.includes('not initialized')) {
        console.debug('Database unavailable, using in-memory cache for audit log');
        return this.entries.filter((e) => e.withdrawalId === withdrawalId);
      }
      throw error;
    }
  }

  /**
   * Get audit entries by user ID.
   * Tries database first, falls back to in-memory cache for tests.
   * @param userId - User ID
   * @returns Promise resolving to audit entries
   */
  async getByUserId(userId: string): Promise<AuditLogEntry[]> {
    try {
      return await dbGetByUserId(userId);
    } catch (error) {
      // Fallback to in-memory cache (for tests or when DB is unavailable)
      if (error instanceof Error && error.message.includes('not initialized')) {
        console.debug('Database unavailable, using in-memory cache for audit log');
        return this.entries.filter((e) => e.userId === userId);
      }
      throw error;
    }
  }

  /**
   * Get all entries from in-memory cache (for backward compatibility).
   * Note: This only returns entries logged since app startup.
   * @returns All in-memory entries
   */
  getAll(): AuditLogEntry[] {
    return [...this.entries];
  }

  /**
   * Clear in-memory cache (for testing only).
   */
  clear(): void {
    this.entries = [];
  }
}

// Global singleton audit log instance
export const auditLog = new AuditLog();
