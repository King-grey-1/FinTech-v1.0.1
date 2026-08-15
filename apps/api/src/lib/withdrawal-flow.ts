import { assessWithdrawalRisk, RiskLevel, WithdrawalContext } from './withdrawal-risk';

export enum WithdrawalState {
  REQUESTED = 'REQUESTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  status: WithdrawalState;
  idempotencyKey: string;
  createdAt: string;
  reviewedBy?: string;
  riskLevel?: RiskLevel;
  riskScore?: number;
  providerTxnId?: string;
  bankAccountDetails?: string;
  webhookProcessed?: boolean;
}

export function createWithdrawalRequest(
  userId: string,
  amount: string,
  currency: string,
  idempotencyKey: string,
): WithdrawalRequest {
  return {
    id: `wdr-${Date.now()}`,
    userId,
    amount,
    currency,
    status: WithdrawalState.REQUESTED,
    idempotencyKey,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create withdrawal request with risk assessment.
 * Evaluates risk based on wallet context and automatically
 * moves high-risk withdrawals to manual review.
 */
export function createWithdrawalRequestWithRisk(
  userId: string,
  amount: string,
  currency: string,
  idempotencyKey: string,
  riskContext: WithdrawalContext,
  bankAccountDetails?: string,
): WithdrawalRequest {
  const request = createWithdrawalRequest(userId, amount, currency, idempotencyKey);
  const risk = assessWithdrawalRisk(amount, riskContext);

  request.riskLevel = risk.level;
  request.riskScore = risk.score;
  request.bankAccountDetails = bankAccountDetails;

  // High-risk withdrawals skip directly to UNDER_REVIEW
  if (risk.requiresManualReview) {
    request.status = WithdrawalState.UNDER_REVIEW;
  }

  return request;
}

export function validateWithdrawalState(request: WithdrawalRequest, nextState: WithdrawalState): { valid: boolean; reason?: string } {
  const validTransitions: Record<WithdrawalState, WithdrawalState[]> = {
    [WithdrawalState.REQUESTED]: [WithdrawalState.UNDER_REVIEW, WithdrawalState.REJECTED],
    [WithdrawalState.UNDER_REVIEW]: [WithdrawalState.APPROVED, WithdrawalState.REJECTED],
    [WithdrawalState.APPROVED]: [WithdrawalState.PROCESSING, WithdrawalState.REJECTED],
    [WithdrawalState.PROCESSING]: [WithdrawalState.COMPLETED, WithdrawalState.REJECTED],
    [WithdrawalState.COMPLETED]: [],
    [WithdrawalState.REJECTED]: [],
  };

  const allowed = validTransitions[request.status] ?? [];
  if (!allowed.includes(nextState)) {
    return { valid: false, reason: `${request.status} -> ${nextState} is not a valid transition.` };
  }

  return { valid: true };
}

export function transitionWithdrawal(request: WithdrawalRequest, nextState: WithdrawalState): WithdrawalRequest {
  const result = validateWithdrawalState(request, nextState);
  if (!result.valid) {
    throw new Error(result.reason ?? 'Invalid withdrawal state transition.');
  }

  return {
    ...request,
    status: nextState,
  };
}
