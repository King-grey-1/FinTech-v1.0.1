/**
 * Admin/compliance routes for withdrawal approval workflow.
 * Requires ADMIN role for sensitive operations.
 * Handles approval decisions, audit trail retrieval, and metrics.
 */

import { Router } from 'express';
import { z } from 'zod';
import { failure, success } from '../lib/api-response';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { hasPermission, Permission } from '../lib/rbac';
import { approveWithdrawal, ApprovalDecision } from '../lib/approval-workflow';
import { initiateSettlement, finalizeSettlement } from '../lib/settlement-finalization';
import { auditLog } from '../lib/audit-log';
import { DemoPaymentProvider } from '../lib/payment-provider';
import { WithdrawalState } from '../lib/withdrawal-flow';
import { storeWithdrawal } from '../lib/webhook-handler';
import { getWithdrawalById, updateWithdrawal, getWithdrawalsByStatus } from '../lib/withdrawal-repository';
import { getAuditLogByWithdrawalId, getAuditLogByUserId } from '../lib/audit-log-repository';

const router = Router();

const approvalSchema = z.object({
  withdrawalId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().min(5),
});

/**
 * POST /api/admin/withdrawals/approve
 * Review and approve/reject a withdrawal request.
 * Requires MANAGE_PLATFORM permission.
 */
router.post('/withdrawals/approve', requireAuth, async (req: AuthenticatedRequest, res) => {
  // Verify MANAGE_PLATFORM permission
  if (!req.user || !hasPermission(req.user.role, Permission.MANAGE_PLATFORM)) {
    return res.status(403).json(failure('FORBIDDEN', 'You do not have permission to approve withdrawals.'));
  }

  const parsed = approvalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(failure('INVALID_APPROVAL_REQUEST', 'Approval request is invalid.'));
  }

  try {
    // Retrieve withdrawal from database
    const withdrawal = await getWithdrawalById(parsed.data.withdrawalId);
    if (!withdrawal) {
      return res.status(404).json(failure('NOT_FOUND', 'Withdrawal not found.'));
    }

    const result = approveWithdrawal(withdrawal, {
      withdrawalId: parsed.data.withdrawalId,
      decision: parsed.data.decision as ApprovalDecision,
      reviewedBy: req.user.userId,
      reason: parsed.data.reason,
    });

    // Persist to database and webhook storage
    await updateWithdrawal(result.withdrawal);
    storeWithdrawal(result.withdrawal);

    return res.status(200).json(success({
      approval: {
        withdrawalId: result.withdrawal.id,
        decision: result.decision,
        status: result.withdrawal.status,
        reason: result.reason,
        auditId: result.auditId,
        message: `Withdrawal ${result.decision.toLowerCase()} and logged to audit trail.`,
      },
    }));
  } catch (error) {
    return res.status(400).json(failure('APPROVAL_FAILED', error instanceof Error ? error.message : 'Approval processing failed.'));
  }
});

/**
 * POST /api/admin/withdrawals/settle
 * Initiate settlement for an approved withdrawal.
 * Transitions APPROVED → PROCESSING.
 * Requires MANAGE_PLATFORM permission.
 */
router.post('/withdrawals/settle', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.role, Permission.MANAGE_PLATFORM)) {
    return res.status(403).json(failure('FORBIDDEN', 'You do not have permission to settle withdrawals.'));
  }

  const schema = z.object({
    withdrawalId: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(failure('INVALID_REQUEST', 'Withdrawal ID is required.'));
  }

  try {
    // Retrieve withdrawal from database
    const withdrawal = await getWithdrawalById(parsed.data.withdrawalId);
    if (!withdrawal) {
      return res.status(404).json(failure('NOT_FOUND', 'Withdrawal not found.'));
    }

    const result = await initiateSettlement(withdrawal, {
      paymentProvider: new DemoPaymentProvider(),
      bankAccountDetails: withdrawal.bankAccountDetails ?? 'account-1234',
      userId: withdrawal.userId,
    });

    // Persist to database and webhook storage
    await updateWithdrawal(result.withdrawal);
    storeWithdrawal(result.withdrawal);

    return res.status(200).json(success({
      settlement: {
        withdrawalId: result.withdrawal.id,
        status: result.withdrawal.status,
        providerTxnId: result.providerTxnId,
        message: result.message,
        auditId: result.auditId,
      },
    }));
  } catch (error) {
    return res.status(400).json(failure('SETTLEMENT_FAILED', error instanceof Error ? error.message : 'Settlement initiation failed.'));
  }
});

/**
 * GET /api/admin/withdrawals/pending
 * List all withdrawals pending approval (UNDER_REVIEW state).
 * Requires MANAGE_PLATFORM permission.
 */
router.get('/withdrawals/pending', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.role, Permission.MANAGE_PLATFORM)) {
    return res.status(403).json(failure('FORBIDDEN', 'You do not have permission to view pending withdrawals.'));
  }

  try {
    // Get pending and under-review withdrawals from database
    const pending = await Promise.all([
      getWithdrawalsByStatus(WithdrawalState.UNDER_REVIEW, 1000),
      getWithdrawalsByStatus(WithdrawalState.REQUESTED, 1000),
    ]);
    const allPending = [...pending[0], ...pending[1]];

    return res.status(200).json(success({
      withdrawals: allPending.map((w) => ({
        id: w.id,
        userId: w.userId,
        amount: w.amount,
        currency: w.currency,
        status: w.status,
        riskLevel: w.riskLevel,
        riskScore: w.riskScore,
        createdAt: w.createdAt,
      })),
      count: allPending.length,
    }));
  } catch (error) {
    return res.status(500).json(failure('DATABASE_ERROR', error instanceof Error ? error.message : 'Failed to retrieve pending withdrawals.'));
  }
});

/**
 * GET /api/admin/audit/withdrawal/:withdrawalId
 * Retrieve audit trail for a specific withdrawal.
 * Requires MANAGE_PLATFORM permission.
 */
router.get('/audit/withdrawal/:withdrawalId', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.role, Permission.MANAGE_PLATFORM)) {
    return res.status(403).json(failure('FORBIDDEN', 'You do not have permission to view audit logs.'));
  }

  try {
    const entries = await getAuditLogByWithdrawalId(req.params.withdrawalId as string);

    return res.status(200).json(success({
      withdrawalId: req.params.withdrawalId as string,
      auditEntries: entries.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        action: e.action,
        reason: e.reason,
        reviewedBy: e.reviewedBy,
        timestamp: e.timestamp,
        metadata: e.metadata,
      })),
      count: entries.length,
    }));
  } catch (error) {
    return res.status(500).json(failure('DATABASE_ERROR', error instanceof Error ? error.message : 'Failed to retrieve audit entries.'));
  }
});

/**
 * GET /api/admin/audit/user/:userId
 * Retrieve audit trail for all withdrawals by a user.
 * Requires MANAGE_PLATFORM permission.
 */
router.get('/audit/user/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.role, Permission.MANAGE_PLATFORM)) {
    return res.status(403).json(failure('FORBIDDEN', 'You do not have permission to view audit logs.'));
  }

  try {
    const entries = await getAuditLogByUserId(req.params.userId as string);

    return res.status(200).json(success({
      userId: req.params.userId as string,
      auditEntries: entries.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        withdrawalId: e.withdrawalId,
        action: e.action,
        timestamp: e.timestamp,
      })),
      count: entries.length,
    }));
  } catch (error) {
    return res.status(500).json(failure('DATABASE_ERROR', error instanceof Error ? error.message : 'Failed to retrieve audit entries.'));
  }
});

export default router;
