/**
 * Webhook reconciliation handler.
 * Processes payment provider webhook callbacks and updates withdrawal status.
 * Handles transaction status updates: SUCCESS, FAILED, REFUNDED, PENDING.
 */

import { WebhookPayload } from './webhook-verification';
import { auditLog, AuditEventType } from './audit-log';
import { WithdrawalRequest, WithdrawalState, transitionWithdrawal } from './withdrawal-flow';
import { finalizeSettlement, rejectSettlement } from './settlement-finalization';
import { DemoPaymentProvider, PaymentProvider } from './payment-provider';

export interface WebhookReconciliationResult {
  success: boolean;
  withdrawalId?: string;
  message: string;
  newStatus?: WithdrawalState;
  auditId?: string;
}

/**
 * In-memory store for provider transaction ID to withdrawal ID mapping.
 * In production, query database for this mapping.
 */
const providerTxnToWithdrawalMap = new Map<string, string>();

/**
 * Map a provider transaction ID to withdrawal ID.
 * Called during settlement initiation to establish the relationship.
 * In production, this relationship would be persisted in the database.
 *
 * @param providerTxnId - Payment provider transaction ID
 * @param withdrawalId - Internal withdrawal ID
 */
export function mapProviderTransaction(providerTxnId: string, withdrawalId: string): void {
  providerTxnToWithdrawalMap.set(providerTxnId, withdrawalId);
}

/**
 * Get withdrawal ID for a provider transaction ID.
 * In production, query database for this mapping.
 *
 * @param providerTxnId - Payment provider transaction ID
 * @returns Withdrawal ID or undefined if not found
 */
export function getWithdrawalIdByProvider(providerTxnId: string): string | undefined {
  return providerTxnToWithdrawalMap.get(providerTxnId);
}

/**
 * Clear all provider transaction mappings (mainly for testing).
 */
export function clearProviderMappings(): void {
  providerTxnToWithdrawalMap.clear();
}

/**
 * In-memory withdrawal store for demo.
 * In production, query and update database.
 */
const withdrawalStore = new Map<string, WithdrawalRequest>();

/**
 * Store withdrawal for reconciliation (demo only).
 * In production, store in database.
 *
 * @param withdrawal - Withdrawal request to store
 */
export function storeWithdrawal(withdrawal: WithdrawalRequest): void {
  withdrawalStore.set(withdrawal.id, withdrawal);
}

/**
 * Retrieve withdrawal by ID (demo only).
 * In production, query database.
 *
 * @param withdrawalId - Withdrawal ID
 * @returns Withdrawal request or undefined
 */
export function getWithdrawal(withdrawalId: string): WithdrawalRequest | undefined {
  return withdrawalStore.get(withdrawalId);
}

/**
 * Process webhook payload and update withdrawal status.
 * Handles SUCCESS, FAILED, REFUNDED, PENDING statuses.
 *
 * @param payload - Parsed webhook payload
 * @param paymentProvider - Payment provider instance (for state validation)
 * @returns Reconciliation result with new status or error
 */
export async function handleWebhookReconciliation(
  payload: WebhookPayload,
  paymentProvider: PaymentProvider = new DemoPaymentProvider(),
): Promise<WebhookReconciliationResult> {
  // Find withdrawal by provider transaction ID
  const withdrawalId = getWithdrawalIdByProvider(payload.transactionId);
  if (!withdrawalId) {
    return {
      success: false,
      message: `No withdrawal found for provider transaction ${payload.transactionId}.`,
    };
  }

  // Retrieve withdrawal (in production, from database)
  const withdrawal = getWithdrawal(withdrawalId);
  if (!withdrawal) {
    return {
      success: false,
      message: `Withdrawal ${withdrawalId} not found.`,
    };
  }

  // Prevent duplicate processing
  if (withdrawal.webhookProcessed) {
    return {
      success: false,
      message: `Withdrawal ${withdrawalId} webhook already processed.`,
    };
  }

  try {
    let result: { withdrawal: WithdrawalRequest; auditId: string; message: string };

    // Handle based on webhook status
    switch (payload.status) {
      case 'SUCCESS': {
        // Payment completed successfully
        // Transition from PROCESSING to COMPLETED
        if (withdrawal.status !== WithdrawalState.PROCESSING) {
          return {
            success: false,
            message: `Cannot finalize withdrawal in state ${withdrawal.status}. Expected PROCESSING.`,
          };
        }

        const settledWithdrawal = transitionWithdrawal(withdrawal, WithdrawalState.COMPLETED);
        settledWithdrawal.webhookProcessed = true;

        const auditEntry = auditLog.log({
          eventType: AuditEventType.WITHDRAWAL_COMPLETED,
          withdrawalId: withdrawal.id,
          userId: withdrawal.userId,
          reason: `Webhook notification: Payment completed by provider (txn: ${payload.transactionId}).`,
          action: `Withdrawal marked COMPLETED via webhook.`,
          metadata: {
            amount: withdrawal.amount,
            currency: withdrawal.currency,
            providerTxnId: payload.transactionId,
            webhookEvent: payload.event,
            webhookTimestamp: payload.timestamp,
          },
        });

        result = {
          withdrawal: settledWithdrawal,
          auditId: auditEntry.id,
          message: `Withdrawal completed successfully via webhook.`,
        };
        break;
      }

      case 'FAILED': {
        // Payment failed - reject withdrawal and return funds
        if (withdrawal.status !== WithdrawalState.PROCESSING) {
          return {
            success: false,
            message: `Cannot reject withdrawal in state ${withdrawal.status}. Expected PROCESSING.`,
          };
        }

        const rejectedWithdrawal = transitionWithdrawal(withdrawal, WithdrawalState.REJECTED);
        rejectedWithdrawal.webhookProcessed = true;

        const auditEntry = auditLog.log({
          eventType: AuditEventType.WITHDRAWAL_FAILED,
          withdrawalId: withdrawal.id,
          userId: withdrawal.userId,
          reason: `Webhook notification: Payment failed by provider (txn: ${payload.transactionId}). Funds returned to wallet.`,
          action: `Withdrawal marked REJECTED via webhook.`,
          metadata: {
            amount: withdrawal.amount,
            currency: withdrawal.currency,
            providerTxnId: payload.transactionId,
            webhookEvent: payload.event,
            webhookTimestamp: payload.timestamp,
            failureReason: payload.metadata?.failureReason as string | undefined,
          },
        });

        result = {
          withdrawal: rejectedWithdrawal,
          auditId: auditEntry.id,
          message: `Withdrawal rejected due to payment failure. Funds returned to wallet.`,
        };
        break;
      }

      case 'REFUNDED': {
        // Payment was refunded after initial processing
        // Only transition to REJECTED if not in terminal state
        let refundedWithdrawal = withdrawal;
        if (withdrawal.status !== WithdrawalState.COMPLETED && withdrawal.status !== WithdrawalState.REJECTED) {
          refundedWithdrawal = transitionWithdrawal(withdrawal, WithdrawalState.REJECTED);
        }
        refundedWithdrawal.webhookProcessed = true;

        const auditEntry = auditLog.log({
          eventType: AuditEventType.WITHDRAWAL_FAILED,
          withdrawalId: withdrawal.id,
          userId: withdrawal.userId,
          reason: `Webhook notification: Withdrawal refunded by provider (txn: ${payload.transactionId}). Funds returned to wallet.`,
          action: `Withdrawal marked REJECTED due to refund.`,
          metadata: {
            amount: withdrawal.amount,
            currency: withdrawal.currency,
            providerTxnId: payload.transactionId,
            webhookEvent: payload.event,
            webhookTimestamp: payload.timestamp,
            refundReason: payload.metadata?.refundReason as string | undefined,
          },
        });

        result = {
          withdrawal: refundedWithdrawal,
          auditId: auditEntry.id,
          message: `Withdrawal refunded. Funds returned to wallet.`,
        };
        break;
      }

      case 'PENDING': {
        // Payment still pending - no state change
        const auditEntry = auditLog.log({
          eventType: AuditEventType.WITHDRAWAL_PROCESSING,
          withdrawalId: withdrawal.id,
          userId: withdrawal.userId,
          reason: `Webhook notification: Payment still pending (txn: ${payload.transactionId}).`,
          action: `Webhook received but withdrawal remains in PROCESSING state.`,
          metadata: {
            amount: withdrawal.amount,
            currency: withdrawal.currency,
            providerTxnId: payload.transactionId,
            webhookEvent: payload.event,
            webhookTimestamp: payload.timestamp,
          },
        });

        result = {
          withdrawal,
          auditId: auditEntry.id,
          message: `Withdrawal remains in PROCESSING state. Payment still pending.`,
        };
        break;
      }

      default:
        return {
          success: false,
          message: `Unknown webhook status: ${payload.status}`,
        };
    }

    // Update withdrawal store
    storeWithdrawal(result.withdrawal);

    return {
      success: true,
      withdrawalId: result.withdrawal.id,
      message: result.message,
      newStatus: result.withdrawal.status,
      auditId: result.auditId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during webhook processing.';
    return {
      success: false,
      message: `Webhook reconciliation failed: ${errorMsg}`,
    };
  }
}
