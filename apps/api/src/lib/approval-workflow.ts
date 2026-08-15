/**
 * Withdrawal approval workflow and reviewer decision logic.
 * Manages transitions from UNDER_REVIEW to APPROVED/REJECTED.
 * Integrates compliance checks and rate limiting.
 * Requires ADMIN/COMPLIANCE reviewer role.
 */

import { WithdrawalRequest, WithdrawalState, transitionWithdrawal } from './withdrawal-flow';
import { auditLog, AuditEventType } from './audit-log';
import {
  performComplianceCheck,
  isComplianceApproved,
  type ComplianceResult,
} from './compliance-checks';
import {
  checkRateLimit,
  recordWithdrawal,
  getWithdrawalHistory,
  type RateLimitCheckResult,
} from './rate-limiting';

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface ApprovalRequest {
  withdrawalId: string;
  decision: ApprovalDecision;
  reviewedBy: string;
  reason: string;
}

export interface ApprovalResult {
  success: boolean;
  withdrawal: WithdrawalRequest;
  decision: ApprovalDecision;
  reason: string;
  auditId: string;
  complianceCheck?: ComplianceResult;
  rateLimitCheck?: RateLimitCheckResult;
}

/**
 * Validate approval request has all required fields and proper context.
 */
export function validateApprovalRequest(request: ApprovalRequest): { valid: boolean; reason?: string } {
  if (!request.withdrawalId || request.withdrawalId.length === 0) {
    return { valid: false, reason: 'Withdrawal ID is required.' };
  }

  if (!request.reviewedBy || request.reviewedBy.length === 0) {
    return { valid: false, reason: 'Reviewer ID is required.' };
  }

  if (!request.reason || request.reason.length === 0) {
    return { valid: false, reason: 'Approval reason is required for audit trail.' };
  }

  if (!Object.values(ApprovalDecision).includes(request.decision)) {
    return { valid: false, reason: 'Invalid approval decision.' };
  }

  return { valid: true };
}

/**
 * Process approval decision for a withdrawal in UNDER_REVIEW state.
 * Performs compliance checks and rate limit validation before approval.
 * Transitions to APPROVED or REJECTED and logs to audit trail.
 */
export function approveWithdrawal(
  withdrawal: WithdrawalRequest,
  approval: ApprovalRequest,
): ApprovalResult {
  // Validate withdrawal is in UNDER_REVIEW state
  if (withdrawal.status !== WithdrawalState.UNDER_REVIEW) {
    throw new Error(`Cannot review withdrawal in state ${withdrawal.status}. Expected UNDER_REVIEW.`);
  }

  // Validate approval request
  const validation = validateApprovalRequest(approval);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid approval request.');
  }

  // Parse amount for compliance checks
  const amount = parseFloat(withdrawal.amount);

  // Perform compliance checks (sanctions, AML)
  const recentHistory = getWithdrawalHistory(withdrawal.userId, 30);
  const recentWithdrawalCount = recentHistory.length;
  const totalMonthlyWithdrawn = recentHistory.reduce((sum: number, w: { amount: number; timestamp: number }) => sum + w.amount, 0);

  const complianceResult = performComplianceCheck(
    withdrawal.userId,
    amount,
    recentWithdrawalCount,
    totalMonthlyWithdrawn
  );

  // If explicit REJECT decision, proceed with rejection
  if (approval.decision === ApprovalDecision.REJECTED) {
    const updated = transitionWithdrawal(withdrawal, WithdrawalState.REJECTED);
    updated.reviewedBy = approval.reviewedBy;

    const auditEntry = auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_REJECTED,
      withdrawalId: withdrawal.id,
      userId: withdrawal.userId,
      reviewedBy: approval.reviewedBy,
      reason: approval.reason,
      riskScore: withdrawal.riskScore,
      action: `Withdrawal rejected after manual review.`,
      metadata: {
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        decision: ApprovalDecision.REJECTED,
        riskLevel: withdrawal.riskLevel,
      },
    });

    return {
      success: true,
      withdrawal: updated,
      decision: ApprovalDecision.REJECTED,
      reason: approval.reason,
      auditId: auditEntry.id,
      complianceCheck: complianceResult,
    };
  }

  // For APPROVE decision, validate compliance and rate limits
  if (!isComplianceApproved(complianceResult)) {
    // Compliance check failed - auto-reject
    const updated = transitionWithdrawal(withdrawal, WithdrawalState.REJECTED);
    updated.reviewedBy = approval.reviewedBy;

    const complianceReason = complianceResult.sanctions.flagged
      ? `Compliance block: User on sanctions list`
      : `Compliance block: High AML risk (score: ${complianceResult.aml.riskScore})`;

    const auditEntry = auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_REJECTED,
      withdrawalId: withdrawal.id,
      userId: withdrawal.userId,
      reviewedBy: approval.reviewedBy,
      reason: `Auto-rejected by compliance check: ${complianceReason}`,
      riskScore: withdrawal.riskScore,
      action: `Withdrawal auto-rejected due to compliance failure.`,
      metadata: {
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        decision: ApprovalDecision.REJECTED,
        riskLevel: withdrawal.riskLevel,
        complianceReason,
        complianceScore: complianceResult.aml.riskScore,
      },
    });

    return {
      success: false,
      withdrawal: updated,
      decision: ApprovalDecision.REJECTED,
      reason: complianceReason,
      auditId: auditEntry.id,
      complianceCheck: complianceResult,
    };
  }

  // Check rate limits
  const rateLimitResult = checkRateLimit(withdrawal.userId, amount);

  if (!rateLimitResult.allowed) {
    // Rate limit exceeded - auto-reject
    const updated = transitionWithdrawal(withdrawal, WithdrawalState.REJECTED);
    updated.reviewedBy = approval.reviewedBy;

    const rateLimitReason = `Rate limit exceeded: ${rateLimitResult.violations.join('; ')}`;

    const auditEntry = auditLog.log({
      eventType: AuditEventType.WITHDRAWAL_REJECTED,
      withdrawalId: withdrawal.id,
      userId: withdrawal.userId,
      reviewedBy: approval.reviewedBy,
      reason: `Auto-rejected by rate limit check: ${rateLimitReason}`,
      riskScore: withdrawal.riskScore,
      action: `Withdrawal auto-rejected due to rate limit violation.`,
      metadata: {
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        decision: ApprovalDecision.REJECTED,
        riskLevel: withdrawal.riskLevel,
        rateLimitViolations: rateLimitResult.violations,
      },
    });

    return {
      success: false,
      withdrawal: updated,
      decision: ApprovalDecision.REJECTED,
      reason: rateLimitReason,
      auditId: auditEntry.id,
      complianceCheck: complianceResult,
      rateLimitCheck: rateLimitResult,
    };
  }

  // All checks passed - approve withdrawal
  const updated = transitionWithdrawal(withdrawal, WithdrawalState.APPROVED);
  updated.reviewedBy = approval.reviewedBy;

  // Record the withdrawal in rate limit history
  recordWithdrawal(withdrawal.userId, amount);

  const auditEntry = auditLog.log({
    eventType: AuditEventType.WITHDRAWAL_APPROVED,
    withdrawalId: withdrawal.id,
    userId: withdrawal.userId,
    reviewedBy: approval.reviewedBy,
    reason: approval.reason,
    riskScore: withdrawal.riskScore,
    action: `Withdrawal approved after compliance and rate limit validation.`,
    metadata: {
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      decision: ApprovalDecision.APPROVED,
      riskLevel: withdrawal.riskLevel,
      complianceScore: complianceResult.aml.riskScore,
      amlRiskLevel: complianceResult.aml.riskLevel,
    },
  });

  return {
    success: true,
    withdrawal: updated,
    decision: ApprovalDecision.APPROVED,
    reason: approval.reason,
    auditId: auditEntry.id,
    complianceCheck: complianceResult,
    rateLimitCheck: rateLimitResult,
  };
}
