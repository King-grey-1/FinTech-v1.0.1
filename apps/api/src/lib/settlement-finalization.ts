/**
 * Withdrawal settlement finalization.
 * Handles transitions from APPROVED to PROCESSING to COMPLETED.
 * Integrates with payment provider for actual fund transfer.
 */

import { WithdrawalRequest, WithdrawalState, transitionWithdrawal } from './withdrawal-flow';
import { DemoPaymentProvider, PaymentProvider } from './payment-provider';
import { auditLog, AuditEventType } from './audit-log';
import { mapProviderTransaction } from './webhook-handler';

export interface SettlementContext {
  paymentProvider: PaymentProvider;
  bankAccountDetails: string;
  userId: string;
}

export interface SettlementResult {
  success: boolean;
  withdrawal: WithdrawalRequest;
  providerTxnId: string;
  message: string;
  auditId: string;
}

/**
 * Initiate settlement for an approved withdrawal.
 * Transitions APPROVED → PROCESSING and creates payment provider transaction.
 */
export async function initiateSettlement(
  withdrawal: WithdrawalRequest,
  context: SettlementContext,
): Promise<SettlementResult> {
  // Validate withdrawal is in APPROVED state
  if (withdrawal.status !== WithdrawalState.APPROVED) {
    throw new Error(`Cannot settle withdrawal in state ${withdrawal.status}. Expected APPROVED.`);
  }

  // Require bank account details
  if (!withdrawal.bankAccountDetails || withdrawal.bankAccountDetails.length === 0) {
    throw new Error('Bank account details required for settlement.');
  }

  // Create payment provider transaction
  const providerResult = await context.paymentProvider.createWithdrawal({
    amount: withdrawal.amount,
    currency: withdrawal.currency,
    userId: withdrawal.userId,
    accountDetails: withdrawal.bankAccountDetails,
  });

  // Transition to PROCESSING state
  const updated = transitionWithdrawal(withdrawal, WithdrawalState.PROCESSING);
  updated.providerTxnId = providerResult.providerTxnId;

  // Map provider transaction ID to withdrawal ID for webhook reconciliation
  mapProviderTransaction(providerResult.providerTxnId, withdrawal.id);

  // Log settlement initiation
  const auditEntry = auditLog.log({
    eventType: AuditEventType.WITHDRAWAL_PROCESSING,
    withdrawalId: withdrawal.id,
    userId: withdrawal.userId,
    reason: `Settlement initiated with payment provider (${providerResult.providerTxnId}).`,
    action: 'Withdrawal transitioned to PROCESSING state.',
    metadata: {
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      providerTxnId: providerResult.providerTxnId,
      providerStatus: providerResult.status,
    },
  });

  return {
    success: true,
    withdrawal: updated,
    providerTxnId: providerResult.providerTxnId,
    message: 'Settlement initiated. Funds will be transferred within 1-2 business days.',
    auditId: auditEntry.id,
  };
}

/**
 * Finalize settlement by verifying payment completion.
 * Transitions PROCESSING → COMPLETED once provider confirms success.
 */
export async function finalizeSettlement(
  withdrawal: WithdrawalRequest,
  context: SettlementContext,
): Promise<SettlementResult> {
  // Validate withdrawal is in PROCESSING state
  if (withdrawal.status !== WithdrawalState.PROCESSING) {
    throw new Error(`Cannot finalize withdrawal in state ${withdrawal.status}. Expected PROCESSING.`);
  }

  if (!withdrawal.providerTxnId || withdrawal.providerTxnId.length === 0) {
    throw new Error('Provider transaction ID required for settlement finalization.');
  }

  // Verify payment completion with provider
  const completed = await context.paymentProvider.verifyWithdrawalCompletion(withdrawal.providerTxnId);

  if (!completed.completed) {
    throw new Error(`Payment provider reports withdrawal not yet complete (status: ${completed.finalStatus}).`);
  }

  // Transition to COMPLETED state
  const updated = transitionWithdrawal(withdrawal, WithdrawalState.COMPLETED);

  // Log settlement completion
  const auditEntry = auditLog.log({
    eventType: AuditEventType.WITHDRAWAL_COMPLETED,
    withdrawalId: withdrawal.id,
    userId: withdrawal.userId,
    reason: `Settlement completed successfully (provider status: ${completed.finalStatus}).`,
    action: 'Withdrawal transitioned to COMPLETED state.',
    metadata: {
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      providerTxnId: withdrawal.providerTxnId,
      finalStatus: completed.finalStatus,
    },
  });

  return {
    success: true,
    withdrawal: updated,
    providerTxnId: withdrawal.providerTxnId,
    message: 'Withdrawal settlement completed successfully.',
    auditId: auditEntry.id,
  };
}

/**
 * Handle settlement failure (e.g., payment provider error).
 * Transitions PROCESSING → REJECTED with detailed reason.
 */
export async function rejectSettlement(
  withdrawal: WithdrawalRequest,
  reason: string,
): Promise<SettlementResult> {
  // Validate withdrawal is in PROCESSING state
  if (withdrawal.status !== WithdrawalState.PROCESSING) {
    throw new Error(`Cannot reject withdrawal in state ${withdrawal.status}. Expected PROCESSING.`);
  }

  // Transition to REJECTED state
  const updated = transitionWithdrawal(withdrawal, WithdrawalState.REJECTED);

  // Log settlement failure
  const auditEntry = auditLog.log({
    eventType: AuditEventType.WITHDRAWAL_FAILED,
    withdrawalId: withdrawal.id,
    userId: withdrawal.userId,
    reason: `Settlement failed: ${reason}. Funds will be returned to wallet.`,
    action: 'Withdrawal transitioned to REJECTED state.',
    metadata: {
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      providerTxnId: withdrawal.providerTxnId,
      failureReason: reason,
    },
  });

  return {
    success: false,
    withdrawal: updated,
    providerTxnId: withdrawal.providerTxnId ?? '',
    message: `Withdrawal settlement failed. Reason: ${reason}. Funds returned to wallet.`,
    auditId: auditEntry.id,
  };
}
