import { describe, expect, it } from 'vitest';
import {
  WithdrawalState,
  createWithdrawalRequest,
  transitionWithdrawal,
  validateWithdrawalState,
} from '../../apps/api/src/lib/withdrawal-flow';

describe('withdrawal flow', () => {
  it('starts in requested state and validates positive amounts', () => {
    const request = createWithdrawalRequest('user-1', '150.00', 'USD', 'idempotency-1');

    expect(request.status).toBe(WithdrawalState.REQUESTED);
    expect(request.idempotencyKey).toBe('idempotency-1');
  });

  it('allows a valid state transition through review before approval', () => {
    const request = createWithdrawalRequest('user-1', '150.00', 'USD', 'idempotency-2');
    const underReview = transitionWithdrawal(request, WithdrawalState.UNDER_REVIEW);
    const approved = transitionWithdrawal(underReview, WithdrawalState.APPROVED);

    expect(underReview.status).toBe(WithdrawalState.UNDER_REVIEW);
    expect(approved.status).toBe(WithdrawalState.APPROVED);
  });

  it('rejects invalid transitions', () => {
    const request = createWithdrawalRequest('user-1', '150.00', 'USD', 'idempotency-3');
    const result = validateWithdrawalState(request, WithdrawalState.COMPLETED);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not a valid transition');
  });
});
