import { describe, it, expect, beforeEach } from 'vitest';
import {
  WebhookVerifier,
  generateTestWebhookSignature,
  type WebhookPayload,
} from '../../apps/api/src/lib/webhook-verification';
import {
  handleWebhookReconciliation,
  mapProviderTransaction,
  getWithdrawalIdByProvider,
  getWithdrawal,
  storeWithdrawal,
  clearProviderMappings,
} from '../../apps/api/src/lib/webhook-handler';
import { createWithdrawalRequest, WithdrawalState, transitionWithdrawal } from '../../apps/api/src/lib/withdrawal-flow';
import { DemoPaymentProvider } from '../../apps/api/src/lib/payment-provider';
import { auditLog } from '../../apps/api/src/lib/audit-log';

describe('webhook verification', () => {
  const verifier = new WebhookVerifier('test-webhook-secret');
  const webhookSecret = 'test-webhook-secret';

  it('verifies valid HMAC-SHA256 signature', () => {
    const payload = { event: 'payment.completed', transactionId: 'txn-123', status: 'SUCCESS', timestamp: new Date().toISOString() };
    const rawPayload = JSON.stringify(payload);
    const signature = generateTestWebhookSignature(payload, webhookSecret);

    const isValid = verifier.verifySignature(rawPayload, signature);
    expect(isValid).toBe(true);
  });

  it('rejects invalid HMAC-SHA256 signature', () => {
    const payload = { event: 'payment.completed', transactionId: 'txn-123', status: 'SUCCESS', timestamp: new Date().toISOString() };
    const rawPayload = JSON.stringify(payload);
    const invalidSignature = 'invalid-signature-abc123';

    const isValid = verifier.verifySignature(rawPayload, invalidSignature);
    expect(isValid).toBe(false);
  });

  it('validates webhook payload structure', () => {
    const validPayload: WebhookPayload = {
      event: 'payment.completed',
      transactionId: 'txn-123',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };

    const result = verifier.validatePayload(validPayload);
    expect(result.valid).toBe(true);
  });

  it('rejects payload missing transactionId', () => {
    const invalidPayload = {
      event: 'payment.completed',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };

    const result = verifier.validatePayload(invalidPayload);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Transaction ID');
  });

  it('rejects payload with invalid status', () => {
    const invalidPayload = {
      event: 'payment.completed',
      transactionId: 'txn-123',
      status: 'UNKNOWN_STATUS',
      timestamp: new Date().toISOString(),
    };

    const result = verifier.validatePayload(invalidPayload);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid status');
  });

  it('rejects payload with timestamp older than 5 minutes', () => {
    const oldTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 minutes ago
    const invalidPayload = {
      event: 'payment.completed',
      transactionId: 'txn-123',
      status: 'SUCCESS',
      timestamp: oldTimestamp,
    };

    const result = verifier.validatePayload(invalidPayload);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('timestamp is too old');
  });

  it('parses and verifies webhook payload end-to-end', () => {
    const payload: WebhookPayload = {
      event: 'payment.completed',
      transactionId: 'txn-456',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };

    const rawPayload = JSON.stringify(payload);
    const signature = generateTestWebhookSignature(payload, webhookSecret);

    const parsed = verifier.parseAndVerify(rawPayload, signature);
    expect(parsed.transactionId).toBe('txn-456');
    expect(parsed.status).toBe('SUCCESS');
  });

  it('throws error on invalid signature during parseAndVerify', () => {
    const payload: WebhookPayload = {
      event: 'payment.completed',
      transactionId: 'txn-789',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };

    const rawPayload = JSON.stringify(payload);
    const invalidSignature = 'invalid-sig';

    expect(() => verifier.parseAndVerify(rawPayload, invalidSignature)).toThrow('signature verification failed');
  });
});

describe('webhook reconciliation', () => {
  const paymentProvider = new DemoPaymentProvider();

  beforeEach(() => {
    auditLog.clear();
    clearProviderMappings();
  });

  it('maps provider transaction to withdrawal ID', () => {
    mapProviderTransaction('provider-txn-123', 'withdrawal-abc');

    const withdrawalId = getWithdrawalIdByProvider('provider-txn-123');
    expect(withdrawalId).toBe('withdrawal-abc');
  });

  it('returns undefined for unmapped provider transaction', () => {
    const withdrawalId = getWithdrawalIdByProvider('unmapped-txn-xyz');
    expect(withdrawalId).toBeUndefined();
  });

  it('handles successful payment webhook', async () => {
    // Setup
    const request = createWithdrawalRequest('user-1', '100.00', 'USD', 'idempotency-1');
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);
    const processing = transitionWithdrawal(approved, WithdrawalState.PROCESSING);
    processing.providerTxnId = 'provider-txn-123';

    storeWithdrawal(processing);
    mapProviderTransaction('provider-txn-123', processing.id);

    const payload: WebhookPayload = {
      event: 'payment.completed',
      transactionId: 'provider-txn-123',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };

    const result = await handleWebhookReconciliation(payload, paymentProvider);

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe(WithdrawalState.COMPLETED);
    expect(result.message).toContain('completed successfully');
  });

  it('handles failed payment webhook', async () => {
    // Setup
    const request = createWithdrawalRequest('user-1', '100.00', 'USD', 'idempotency-2');
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);
    const processing = transitionWithdrawal(approved, WithdrawalState.PROCESSING);
    processing.providerTxnId = 'provider-txn-456';

    storeWithdrawal(processing);
    mapProviderTransaction('provider-txn-456', processing.id);

    const payload: WebhookPayload = {
      event: 'payment.failed',
      transactionId: 'provider-txn-456',
      status: 'FAILED',
      timestamp: new Date().toISOString(),
      metadata: { failureReason: 'Insufficient funds' },
    };

    const result = await handleWebhookReconciliation(payload, paymentProvider);

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe(WithdrawalState.REJECTED);
    expect(result.message).toContain('rejected');
  });

  it('handles refunded payment webhook', async () => {
    // Setup
    const request = createWithdrawalRequest('user-1', '100.00', 'USD', 'idempotency-3');
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);
    const processing = transitionWithdrawal(approved, WithdrawalState.PROCESSING);
    processing.providerTxnId = 'provider-txn-789';

    storeWithdrawal(processing);
    mapProviderTransaction('provider-txn-789', processing.id);

    const payload: WebhookPayload = {
      event: 'payment.refunded',
      transactionId: 'provider-txn-789',
      status: 'REFUNDED',
      timestamp: new Date().toISOString(),
      metadata: { refundReason: 'User requested cancellation' },
    };

    const result = await handleWebhookReconciliation(payload, paymentProvider);

    expect(result.success).toBe(true);
    expect(result.message).toContain('refunded');
  });

  it('rejects webhook for non-existent provider transaction', async () => {
    const payload: WebhookPayload = {
      event: 'payment.completed',
      transactionId: 'non-existent-txn',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };

    const result = await handleWebhookReconciliation(payload, paymentProvider);

    expect(result.success).toBe(false);
    expect(result.message).toContain('No withdrawal found');
  });

  it('prevents duplicate webhook processing', async () => {
    // Setup
    const request = createWithdrawalRequest('user-1', '100.00', 'USD', 'idempotency-4');
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);
    const processing = transitionWithdrawal(approved, WithdrawalState.PROCESSING);
    processing.providerTxnId = 'provider-txn-dup';
    processing.webhookProcessed = true; // Mark as already processed

    storeWithdrawal(processing);
    mapProviderTransaction('provider-txn-dup', processing.id);

    const payload: WebhookPayload = {
      event: 'payment.completed',
      transactionId: 'provider-txn-dup',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };

    const result = await handleWebhookReconciliation(payload, paymentProvider);

    expect(result.success).toBe(false);
    expect(result.message).toContain('already processed');
  });

  it('logs audit entries for webhook processing', async () => {
    // Setup
    const request = createWithdrawalRequest('user-1', '100.00', 'USD', 'idempotency-5');
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);
    const processing = transitionWithdrawal(approved, WithdrawalState.PROCESSING);
    processing.providerTxnId = 'provider-txn-audit';

    storeWithdrawal(processing);
    mapProviderTransaction('provider-txn-audit', processing.id);

    const payload: WebhookPayload = {
      event: 'payment.completed',
      transactionId: 'provider-txn-audit',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };

    await handleWebhookReconciliation(payload, paymentProvider);

    const auditEntries = await auditLog.getByWithdrawalId(processing.id);
    expect(auditEntries.length).toBeGreaterThan(0);
    expect(auditEntries[auditEntries.length - 1].metadata.webhookEvent).toBe('payment.completed');
  });

  it('stores withdrawal for retrieval', () => {
    const request = createWithdrawalRequest('user-1', '100.00', 'USD', 'idempotency-6');
    storeWithdrawal(request);

    const retrieved = getWithdrawal(request.id);
    expect(retrieved).toEqual(request);
  });
});
