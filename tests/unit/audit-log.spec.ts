import { describe, it, expect, beforeEach } from 'vitest';
import { auditLog, AuditEventType } from '../../apps/api/src/lib/audit-log';

describe('audit log', () => {
  beforeEach(() => {
    auditLog.clear();
  });

  it('logs an audit entry with timestamp and ID', () => {
    const entry = auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_REQUESTED,
      withdrawalId: 'wdr-123',
      userId: 'user-1',
      action: 'Withdrawal request created.',
      metadata: { amount: '100.00' },
    });

    expect(entry.id).toBeDefined();
    expect(entry.id.startsWith('audit-')).toBe(true);
    expect(entry.timestamp).toBeDefined();
    expect(entry.eventType).toBe(AuditEventType.WITHDRAWAL_REQUESTED);
    expect(entry.withdrawalId).toBe('wdr-123');
  });

  it('retrieves entries by withdrawal ID', async () => {
    auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_REQUESTED,
      withdrawalId: 'wdr-123',
      userId: 'user-1',
      action: 'Requested.',
      metadata: {},
    });

    auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_APPROVED,
      withdrawalId: 'wdr-123',
      userId: 'user-1',
      reviewedBy: 'admin-1',
      reason: 'Approved',
      action: 'Approved.',
      metadata: {},
    });

    auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_REQUESTED,
      withdrawalId: 'wdr-456',
      userId: 'user-2',
      action: 'Requested.',
      metadata: {},
    });

    const entriesForWdr123 = await auditLog.getByWithdrawalId('wdr-123');
    expect(entriesForWdr123).toHaveLength(2);
    expect(entriesForWdr123[0].eventType).toBe(AuditEventType.WITHDRAWAL_REQUESTED);
    expect(entriesForWdr123[1].eventType).toBe(AuditEventType.WITHDRAWAL_APPROVED);
  });

  it('retrieves entries by user ID', async () => {
    auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_REQUESTED,
      withdrawalId: 'wdr-1',
      userId: 'user-1',
      action: 'Requested.',
      metadata: {},
    });

    auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_REQUESTED,
      withdrawalId: 'wdr-2',
      userId: 'user-1',
      action: 'Requested.',
      metadata: {},
    });

    auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_REQUESTED,
      withdrawalId: 'wdr-3',
      userId: 'user-2',
      action: 'Requested.',
      metadata: {},
    });

    const entriesForUser1 = await auditLog.getByUserId('user-1');
    expect(entriesForUser1).toHaveLength(2);
    expect(entriesForUser1.every((e) => e.userId === 'user-1')).toBe(true);
  });

  it('includes reviewer and reason for approval events', () => {
    const entry = auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_APPROVED,
      withdrawalId: 'wdr-123',
      userId: 'user-1',
      reviewedBy: 'admin-reviewer-1',
      reason: 'Low risk, approved for immediate processing.',
      action: 'Approved.',
      metadata: { riskLevel: 'LOW' },
    });

    expect(entry.reviewedBy).toBe('admin-reviewer-1');
    expect(entry.reason).toContain('Low risk');
  });
});
