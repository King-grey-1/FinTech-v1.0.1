import { describe, expect, it } from 'vitest';
import {
  applyDeposit,
  applyInvestmentAllocation,
  settleInvestmentAtMaturity,
  validateWithdrawal,
} from '../../apps/api/src/lib/financial-core';

describe('ledger and investment engine', () => {
  it('records deposit and increases available balance', () => {
    const wallet = { availableBalance: '0.00', lockedBalance: '0.00', pendingBalance: '0.00' };
    const result = applyDeposit(wallet, '1000.00');

    expect(result.availableBalance).toBe('1000.00');
    expect(result.pendingBalance).toBe('0.00');
  });

  it('locks funds when an investment is allocated', () => {
    const wallet = { availableBalance: '1000.00', lockedBalance: '0.00', pendingBalance: '0.00' };
    const result = applyInvestmentAllocation(wallet, '1000.00');

    expect(result.availableBalance).toBe('0.00');
    expect(result.lockedBalance).toBe('1000.00');
  });

  it('handles maturity settlement and withdrawal rules', () => {
    const wallet = { availableBalance: '0.00', lockedBalance: '1000.00', pendingBalance: '0.00' };
    const result = settleInvestmentAtMaturity(wallet, '1000.00', '80.00', '10.00');

    expect(result.availableBalance).toBe('1070.00');
    expect(result.lockedBalance).toBe('0.00');
  });

  it('rejects withdrawals beyond the available withdrawable balance', () => {
    const result = validateWithdrawal('200.00', '150.00');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INSUFFICIENT_WITHDRAWABLE_BALANCE');
  });
});
