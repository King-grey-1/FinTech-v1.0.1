import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  recordWithdrawal,
  getWithdrawalHistory,
  clearWithdrawalHistory,
  clearAllHistory,
  DEFAULT_WITHDRAWAL_LIMITS,
  type WithdrawalLimit,
} from '../../apps/api/src/lib/rate-limiting';

describe('rate limiting', () => {
  beforeEach(() => {
    clearAllHistory();
  });

  describe('basic rate limit checking', () => {
    it('allows withdrawal within limits', () => {
      const result = checkRateLimit('user-1', 5000);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('blocks withdrawal exceeding daily limit', () => {
      recordWithdrawal('user-1', 20000);
      const result = checkRateLimit('user-1', 10000); // 30k total > 25k daily limit
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('Daily limit'))).toBe(true);
    });

    it('blocks withdrawal exceeding weekly limit', () => {
      recordWithdrawal('user-1', 50000);
      const result = checkRateLimit('user-1', 30000); // 80k total > 75k weekly limit
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('Weekly limit'))).toBe(true);
    });

    it('blocks withdrawal exceeding monthly limit', () => {
      recordWithdrawal('user-1', 200000);
      const result = checkRateLimit('user-1', 60000); // 260k total > 250k monthly limit
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('Monthly limit'))).toBe(true);
    });
  });

  describe('withdrawal frequency limiting', () => {
    it('allows normal withdrawal frequency', () => {
      for (let i = 0; i < 3; i++) {
        recordWithdrawal('user-1', 1000);
      }
      const result = checkRateLimit('user-1', 1000);
      expect(result.allowed).toBe(true);
      expect(result.remainingLimits.dailyWithdrawalsRemaining).toBe(2); // 5 max - 3 used = 2
    });

    it('blocks exceeding daily withdrawal frequency', () => {
      for (let i = 0; i < 5; i++) {
        recordWithdrawal('user-1', 1000);
      }
      const result = checkRateLimit('user-1', 1000); // 6th withdrawal attempt
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('frequency'))).toBe(true);
    });

    it('tracks remaining withdrawal frequency', () => {
      recordWithdrawal('user-1', 1000);
      recordWithdrawal('user-1', 1000);
      const result = checkRateLimit('user-1', 1000);
      expect(result.remainingLimits.dailyWithdrawalsRemaining).toBe(3); // 5 max - 2 used = 3
    });
  });

  describe('remaining limits calculation', () => {
    it('calculates correct daily remaining', () => {
      recordWithdrawal('user-1', 10000);
      const result = checkRateLimit('user-1', 5000);
      expect(result.remainingLimits.dailyRemaining).toBe(15000); // 25k - 10k = 15k
      expect(result.remainingLimits.dailyRemaining).toBeLessThanOrEqual(DEFAULT_WITHDRAWAL_LIMITS.maxPerDay);
    });

    it('calculates correct weekly remaining', () => {
      recordWithdrawal('user-1', 30000);
      const result = checkRateLimit('user-1', 10000);
      expect(result.remainingLimits.weeklyRemaining).toBe(45000); // 75k - 30k = 45k (checkRateLimit doesn't subtract the proposed amount)
    });

    it('calculates correct monthly remaining', () => {
      recordWithdrawal('user-1', 100000);
      const result = checkRateLimit('user-1', 50000);
      expect(result.remainingLimits.monthlyRemaining).toBe(150000); // 250k - 100k = 150k (checkRateLimit doesn't subtract the proposed amount)
    });

    it('returns zero remaining when limit exhausted', () => {
      recordWithdrawal('user-1', 25000); // Daily limit
      const result = checkRateLimit('user-1', 1);
      expect(result.remainingLimits.dailyRemaining).toBe(0);
    });
  });

  describe('custom withdrawal limits', () => {
    it('enforces custom per-user limits', () => {
      const customLimits: WithdrawalLimit = {
        maxPerDay: 5000,
        maxPerWeek: 15000,
        maxPerMonth: 50000,
        maxFrequencyPerDay: 2,
      };

      recordWithdrawal('user-premium', 3000);
      const result = checkRateLimit('user-premium', 3000, customLimits); // 6k > 5k
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('Daily'))).toBe(true);
    });

    it('applies custom frequency limits', () => {
      const customLimits: WithdrawalLimit = {
        maxPerDay: 25000,
        maxPerWeek: 75000,
        maxPerMonth: 250000,
        maxFrequencyPerDay: 2,
      };

      recordWithdrawal('user-restricted', 1000);
      recordWithdrawal('user-restricted', 1000);
      const result = checkRateLimit('user-restricted', 1000, customLimits);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes('frequency'))).toBe(true);
    });
  });

  describe('withdrawal history', () => {
    it('records withdrawals with timestamps', () => {
      recordWithdrawal('user-1', 1000);
      recordWithdrawal('user-1', 2000);
      const history = getWithdrawalHistory('user-1');
      expect(history).toHaveLength(2);
      expect(history[0].amount).toBe(1000);
      expect(history[1].amount).toBe(2000);
    });

    it('clears history for specific user', () => {
      recordWithdrawal('user-1', 1000);
      recordWithdrawal('user-2', 2000);
      clearWithdrawalHistory('user-1');
      const history1 = getWithdrawalHistory('user-1');
      const history2 = getWithdrawalHistory('user-2');
      expect(history1).toHaveLength(0);
      expect(history2).toHaveLength(1);
    });

    it('clears all history', () => {
      recordWithdrawal('user-1', 1000);
      recordWithdrawal('user-2', 2000);
      clearAllHistory();
      const history1 = getWithdrawalHistory('user-1');
      const history2 = getWithdrawalHistory('user-2');
      expect(history1).toHaveLength(0);
      expect(history2).toHaveLength(0);
    });

    it('respects history time window', () => {
      recordWithdrawal('user-1', 1000);
      const history = getWithdrawalHistory('user-1', 1); // Last 1 day
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('independent user limits', () => {
    it('tracks limits per user independently', () => {
      recordWithdrawal('user-1', 20000);
      recordWithdrawal('user-2', 5000);

      const result1 = checkRateLimit('user-1', 6000); // 26k > 25k
      const result2 = checkRateLimit('user-2', 10000); // 15k < 25k

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });
});
