import { describe, it, expect } from 'vitest';
import { assessWithdrawalRisk, RiskLevel } from '../../apps/api/src/lib/withdrawal-risk';

describe('withdrawal risk assessment', () => {
  it('returns LOW risk for small withdrawals on established accounts', () => {
    const risk = assessWithdrawalRisk('100.00', {
      walletBalance: '5000.00',
      previousWithdrawalCount: 0,
      accountAgeInDays: 180,
      previousWithdrawalTotalInPeriod: '0.00',
    });

    expect(risk.level).toBe(RiskLevel.LOW);
    expect(risk.requiresManualReview).toBe(false);
    expect(risk.score).toBeLessThan(30);
  });

  it('returns MEDIUM risk for large withdrawals on moderately-established accounts', () => {
    const risk = assessWithdrawalRisk('1000.00', {
      walletBalance: '2000.00',
      previousWithdrawalCount: 2,
      accountAgeInDays: 60,
      previousWithdrawalTotalInPeriod: '300.00',
    });

    expect(risk.level).toBe(RiskLevel.MEDIUM);
    expect(risk.score).toBeGreaterThanOrEqual(30);
    expect(risk.score).toBeLessThan(60);
  });

  it('returns HIGH risk for large withdrawals on new accounts', () => {
    const risk = assessWithdrawalRisk('1200.00', {
      walletBalance: '2000.00',
      previousWithdrawalCount: 2,
      accountAgeInDays: 15,
      previousWithdrawalTotalInPeriod: '500.00',
    });

    expect(risk.level).toBe(RiskLevel.HIGH);
    expect(risk.requiresManualReview).toBe(true);
    expect(risk.score).toBeGreaterThanOrEqual(60);
  });

  it('includes reason for HIGH risk (large withdrawal)', () => {
    const risk = assessWithdrawalRisk('1500.00', {
      walletBalance: '2000.00',
      previousWithdrawalCount: 0,
      accountAgeInDays: 365,
      previousWithdrawalTotalInPeriod: '0.00',
    });

    expect(risk.reasons).toContain('Withdrawal exceeds 50% of available balance.');
  });

  it('includes reason for HIGH risk (new account)', () => {
    const risk = assessWithdrawalRisk('100.00', {
      walletBalance: '10000.00',
      previousWithdrawalCount: 0,
      accountAgeInDays: 10,
      previousWithdrawalTotalInPeriod: '0.00',
    });

    expect(risk.reasons).toContain('Account is very new (<30 days).');
  });
});
