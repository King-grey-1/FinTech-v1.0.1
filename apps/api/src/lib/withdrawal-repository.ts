/**
 * Withdrawal repository.
 * Provides persistence layer for withdrawal requests.
 * Abstracts database operations from business logic.
 */

import { dbPool } from './database';
import { WithdrawalRequest, WithdrawalState } from './withdrawal-flow';

/**
 * Create withdrawal table if it doesn't exist.
 * Run this during application startup or migrations.
 */
export async function initializeWithdrawalTable(): Promise<void> {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      amount NUMERIC(18,2) NOT NULL,
      currency VARCHAR(8) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
      idempotency_key VARCHAR(255) NOT NULL UNIQUE,
      risk_level VARCHAR(16),
      risk_score INTEGER,
      provider_txn_id VARCHAR(255),
      bank_account_details TEXT,
      webhook_processed BOOLEAN DEFAULT FALSE,
      reviewed_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_withdrawal_user_id ON withdrawal_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_provider_txn ON withdrawal_requests(provider_txn_id);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_idempotency ON withdrawal_requests(idempotency_key);
  `;

  try {
    await dbPool.query(createTableSQL);
  } catch (error) {
    console.error('Failed to initialize withdrawal_requests table:', error);
    throw error;
  }
}

/**
 * Insert a new withdrawal request.
 * @param withdrawal - Withdrawal request to insert
 * @returns The inserted withdrawal
 */
export async function createWithdrawal(withdrawal: WithdrawalRequest): Promise<WithdrawalRequest> {
  const insertSQL = `
    INSERT INTO withdrawal_requests (
      id, user_id, amount, currency, status, idempotency_key,
      risk_level, risk_score, bank_account_details, reviewed_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    RETURNING *;
  `;

  const values = [
    withdrawal.id,
    withdrawal.userId,
    withdrawal.amount,
    withdrawal.currency,
    withdrawal.status,
    withdrawal.idempotencyKey,
    withdrawal.riskLevel || null,
    withdrawal.riskScore || null,
    withdrawal.bankAccountDetails || null,
    withdrawal.reviewedBy || null,
  ];

  try {
    const result = await dbPool.query<any>(insertSQL, values);
    return mapRowToWithdrawal(result.rows[0]);
  } catch (error) {
    console.error('Failed to create withdrawal:', error);
    throw error;
  }
}

/**
 * Get withdrawal by ID.
 * @param withdrawalId - Withdrawal ID
 * @returns Withdrawal or undefined if not found
 */
export async function getWithdrawalById(withdrawalId: string): Promise<WithdrawalRequest | undefined> {
  const selectSQL = 'SELECT * FROM withdrawal_requests WHERE id = $1;';

  try {
    const result = await dbPool.query<any>(selectSQL, [withdrawalId]);
    return result.rows.length > 0 ? mapRowToWithdrawal(result.rows[0]) : undefined;
  } catch (error) {
    console.error('Failed to get withdrawal:', error);
    throw error;
  }
}

/**
 * Get withdrawal by idempotency key.
 * @param idempotencyKey - Idempotency key
 * @returns Withdrawal or undefined if not found
 */
export async function getWithdrawalByIdempotencyKey(idempotencyKey: string): Promise<WithdrawalRequest | undefined> {
  const selectSQL = 'SELECT * FROM withdrawal_requests WHERE idempotency_key = $1;';

  try {
    const result = await dbPool.query<any>(selectSQL, [idempotencyKey]);
    return result.rows.length > 0 ? mapRowToWithdrawal(result.rows[0]) : undefined;
  } catch (error) {
    console.error('Failed to get withdrawal by idempotency key:', error);
    throw error;
  }
}

/**
 * Get withdrawal by provider transaction ID.
 * @param providerTxnId - Provider transaction ID
 * @returns Withdrawal or undefined if not found
 */
export async function getWithdrawalByProviderTxnId(providerTxnId: string): Promise<WithdrawalRequest | undefined> {
  const selectSQL = 'SELECT * FROM withdrawal_requests WHERE provider_txn_id = $1;';

  try {
    const result = await dbPool.query<any>(selectSQL, [providerTxnId]);
    return result.rows.length > 0 ? mapRowToWithdrawal(result.rows[0]) : undefined;
  } catch (error) {
    console.error('Failed to get withdrawal by provider txn ID:', error);
    throw error;
  }
}

/**
 * Get all withdrawals by user ID.
 * @param userId - User ID
 * @param limit - Result limit (default 100)
 * @param offset - Result offset (default 0)
 * @returns Array of withdrawals
 */
export async function getWithdrawalsByUserId(userId: string, limit = 100, offset = 0): Promise<WithdrawalRequest[]> {
  const selectSQL = `
    SELECT * FROM withdrawal_requests
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [userId, limit, offset]);
    return result.rows.map(mapRowToWithdrawal);
  } catch (error) {
    console.error('Failed to get withdrawals by user:', error);
    throw error;
  }
}

/**
 * Get withdrawals by status.
 * @param status - Withdrawal status
 * @param limit - Result limit (default 100)
 * @returns Array of withdrawals
 */
export async function getWithdrawalsByStatus(status: WithdrawalState, limit = 100): Promise<WithdrawalRequest[]> {
  const selectSQL = `
    SELECT * FROM withdrawal_requests
    WHERE status = $1
    ORDER BY created_at ASC
    LIMIT $2;
  `;

  try {
    const result = await dbPool.query<any>(selectSQL, [status, limit]);
    return result.rows.map(mapRowToWithdrawal);
  } catch (error) {
    console.error('Failed to get withdrawals by status:', error);
    throw error;
  }
}

/**
 * Update withdrawal.
 * @param withdrawal - Updated withdrawal request
 * @returns The updated withdrawal
 */
export async function updateWithdrawal(withdrawal: WithdrawalRequest): Promise<WithdrawalRequest> {
  const updateSQL = `
    UPDATE withdrawal_requests SET
      status = $1,
      risk_level = $2,
      risk_score = $3,
      provider_txn_id = $4,
      bank_account_details = $5,
      webhook_processed = $6,
      reviewed_by = $7,
      updated_at = NOW()
    WHERE id = $8
    RETURNING *;
  `;

  const values = [
    withdrawal.status,
    withdrawal.riskLevel || null,
    withdrawal.riskScore || null,
    withdrawal.providerTxnId || null,
    withdrawal.bankAccountDetails || null,
    withdrawal.webhookProcessed || false,
    withdrawal.reviewedBy || null,
    withdrawal.id,
  ];

  try {
    const result = await dbPool.query<any>(updateSQL, values);
    if (result.rows.length === 0) {
      throw new Error(`Withdrawal ${withdrawal.id} not found.`);
    }
    return mapRowToWithdrawal(result.rows[0]);
  } catch (error) {
    console.error('Failed to update withdrawal:', error);
    throw error;
  }
}

/**
 * Map database row to WithdrawalRequest.
 * @param row - Database row
 * @returns WithdrawalRequest
 */
function mapRowToWithdrawal(row: any): WithdrawalRequest {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount.toString(),
    currency: row.currency,
    status: row.status as WithdrawalState,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(),
    reviewedBy: row.reviewed_by,
    riskLevel: row.risk_level,
    riskScore: row.risk_score,
    providerTxnId: row.provider_txn_id,
    bankAccountDetails: row.bank_account_details,
    webhookProcessed: row.webhook_processed,
  };
}
