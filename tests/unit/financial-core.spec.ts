import { describe, expect, it } from 'vitest';
import { calculateFeeAmount, calculateProfit, validateInvestmentProduct } from '../../packages/financial-engine/src';

describe('financial engine', () => {
  it('calculates profit and fees correctly', () => {
    expect(calculateProfit('1000', '80', '10')).toBe('1070.00');
    expect(calculateFeeAmount('1000', '2')).toBe('20.00');
  });

  it('validates investment products', () => {
    const result = validateInvestmentProduct({
      id: 'prod-1',
      name: 'Trading Strategy A',
      minInvestment: '100',
      maxInvestment: '10000',
      durationDays: 14,
      expectedReturn: '8.5',
      performanceFee: '10',
      managementFee: '1.5',
      riskLevel: 'HIGH',
      status: 'ACTIVE',
    });

    expect(result.valid).toBe(true);
  });
});
