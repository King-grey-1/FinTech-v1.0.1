import { describe, it, expect, beforeEach } from 'vitest';
import {
  performComplianceCheck,
  screenAgainstSanctions,
  assessAMLRisk,
  isComplianceApproved,
} from '../../apps/api/src/lib/compliance-checks';

describe('compliance checks', () => {
  describe('sanctions screening', () => {
    it('flags user on sanctions list', () => {
      const result = screenAgainstSanctions('user-sanctioned-1');
      expect(result.screened).toBe(true);
      expect(result.flagged).toBe(true);
      expect(result.reason).toContain('sanctions list');
    });

    it('clears user not on sanctions list', () => {
      const result = screenAgainstSanctions('legitimate-user');
      expect(result.screened).toBe(true);
      expect(result.flagged).toBe(false);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('AML risk assessment', () => {
    it('assesses LOW risk for normal withdrawal', () => {
      const result = assessAMLRisk('user-1', 1000, 0, 2000);
      expect(result.riskLevel).toBe('LOW');
      expect(result.riskScore).toBeLessThan(30);
      expect(result.concerns).toHaveLength(0);
    });

    it('assesses MEDIUM risk for large withdrawal', () => {
      const result = assessAMLRisk('user-1', 60000, 1, 65000);
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
      expect(result.concerns).toContain('Large single withdrawal over $50,000');
    });

    it('assesses HIGH risk for frequent withdrawals', () => {
      const result = assessAMLRisk('user-1', 60000, 6, 110000);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.riskScore).toBeGreaterThanOrEqual(60);
      expect(result.concerns.length).toBeGreaterThan(0);
    });

    it('assesses HIGH risk for exceeding monthly total', () => {
      const result = assessAMLRisk('user-1', 60000, 6, 110000);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.concerns.some((c) => c.includes('frequency') || c.includes('monthly'))).toBe(true);
    });

    it('includes multiple concerns when applicable', () => {
      const result = assessAMLRisk('user-1', 60000, 6, 120000);
      expect(result.concerns.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('comprehensive compliance check', () => {
    it('approves compliant withdrawal', () => {
      const result = performComplianceCheck('legitimate-user', 5000, 1, 10000);
      expect(result.compliant).toBe(true);
      expect(result.sanctions.flagged).toBe(false);
      expect(result.aml.riskLevel).toBe('LOW');
      expect(isComplianceApproved(result)).toBe(true);
    });

    it('blocks sanctioned user withdrawal', () => {
      const result = performComplianceCheck('user-sanctioned-1', 1000, 0, 1000);
      expect(result.compliant).toBe(false);
      expect(result.sanctions.flagged).toBe(true);
      expect(result.actions.some((a) => a.includes('BLOCK'))).toBe(true);
    });

    it('flags high-risk AML withdrawal', () => {
      const result = performComplianceCheck('user-1', 60000, 6, 110000);
      expect(result.compliant).toBe(false);
      expect(result.aml.riskLevel).toBe('HIGH');
      expect(result.actions.some((a) => a.includes('REVIEW'))).toBe(true);
    });

    it('provides recommendations for medium-risk withdrawal', () => {
      const result = performComplianceCheck('user-1', 60000, 2, 50000);
      expect(result.aml.riskLevel).toBe('MEDIUM');
      expect(result.actions.some((a) => a.includes('MONITOR'))).toBe(true);
    });

    it('generates actionable compliance recommendations', () => {
      const result = performComplianceCheck('user-1', 60000, 1, 70000);
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions.some((a) => a.includes('REVIEW') || a.includes('MONITOR'))).toBe(true);
    });
  });
});
