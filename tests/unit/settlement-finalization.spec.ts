import { describe, it, expect } from 'vitest';
import { initiateSettlement, finalizeSettlement, rejectSettlement } from '../../apps/api/src/lib/settlement-finalization';
import { createWithdrawalRequest, WithdrawalState, transitionWithdrawal } from '../../apps/api/src/lib/withdrawal-flow';
import { DemoPaymentProvider } from '../../apps/api/src/lib/payment-provider';

describe('settlement finalization', () => {
  const paymentProvider = new DemoPaymentProvider();
  const settlementContext = {
    paymentProvider,
    bankAccountDetails: 'account-1234',
    userId: 'user-1',
  };

  it('initiates settlement for approved withdrawal', async () => {
    const request = createWithdrawalRequest('user-1', '200.00', 'USD', 'idempotency-1');
    request.bankAccountDetails = 'account-5678';
    // Follow proper state transition: REQUESTED → UNDER_REVIEW → APPROVED
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);

    const result = await initiateSettlement(approved, settlementContext);

    expect(result.success).toBe(true);
    expect(result.withdrawal.status).toBe(WithdrawalState.PROCESSING);
    expect(result.providerTxnId).toBeDefined();
    expect(result.providerTxnId.startsWith('demo-wdr-')).toBe(true);
    expect(result.message).toContain('1-2 business days');
  });

  it('throws error when settling withdrawal not in APPROVED state', async () => {
    const request = createWithdrawalRequest('user-1', '100.00', 'USD', 'idempotency-2');
    request.bankAccountDetails = 'account-5678';

    await expect(async () => {
      await initiateSettlement(request, settlementContext);
    }).rejects.toThrow('Cannot settle withdrawal in state REQUESTED');
  });

  it('throws error when settling without bank account details', async () => {
    const request = createWithdrawalRequest('user-1', '100.00', 'USD', 'idempotency-3');
    // Follow proper state transition: REQUESTED → UNDER_REVIEW → APPROVED
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);
    // Don't set bankAccountDetails

    await expect(async () => {
      await initiateSettlement(approved, settlementContext);
    }).rejects.toThrow('Bank account details required');
  });

  it('finalizes settlement for processing withdrawal', async () => {
    const request = createWithdrawalRequest('user-1', '300.00', 'USD', 'idempotency-4');
    request.bankAccountDetails = 'account-5678';
    // Follow proper state transition: REQUESTED → UNDER_REVIEW → APPROVED
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);

    const initResult = await initiateSettlement(approved, settlementContext);
    const finalized = await finalizeSettlement(initResult.withdrawal, settlementContext);

    expect(finalized.success).toBe(true);
    expect(finalized.withdrawal.status).toBe(WithdrawalState.COMPLETED);
    expect(finalized.message).toContain('completed successfully');
  });

  it('throws error when finalizing withdrawal not in PROCESSING state', async () => {
    const request = createWithdrawalRequest('user-1', '100.00', 'USD', 'idempotency-5');
    request.bankAccountDetails = 'account-5678';

    await expect(async () => {
      await finalizeSettlement(request, settlementContext);
    }).rejects.toThrow('Cannot finalize withdrawal in state REQUESTED');
  });

  it('rejects settlement on payment provider failure', async () => {
    const request = createWithdrawalRequest('user-1', '400.00', 'USD', 'idempotency-6');
    request.bankAccountDetails = 'account-5678';
    // Follow proper state transition: REQUESTED → UNDER_REVIEW → APPROVED
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);

    const initResult = await initiateSettlement(approved, settlementContext);
    const rejected = await rejectSettlement(initResult.withdrawal, 'Payment provider API timeout');

    expect(rejected.success).toBe(false);
    expect(rejected.withdrawal.status).toBe(WithdrawalState.REJECTED);
    expect(rejected.message).toContain('Payment provider API timeout');
    expect(rejected.message).toContain('Funds returned to wallet');
  });

  it('creates audit entries for settlement initiation and completion', async () => {
    const request = createWithdrawalRequest('user-1', '250.00', 'USD', 'idempotency-7');
    request.bankAccountDetails = 'account-5678';
    // Follow proper state transition: REQUESTED → UNDER_REVIEW → APPROVED
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);

    const initResult = await initiateSettlement(approved, settlementContext);
    expect(initResult.auditId).toBeDefined();

    const finalResult = await finalizeSettlement(initResult.withdrawal, settlementContext);
    expect(finalResult.auditId).toBeDefined();
  });
});
