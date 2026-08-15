/**
 * Withdrawal risk assessment for approval workflows.
 * Scores withdrawals based on amount, frequency, and account age.
 * Higher risk withdrawals trigger additional review/verification.
 */

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  reasons: string[];
  requiresManualReview: boolean;
}

export interface WithdrawalContext {
  walletBalance: string;
  previousWithdrawalCount: number;
  accountAgeInDays: number;
  previousWithdrawalTotalInPeriod: string;
}

/**
 * Calculate withdrawal risk level and required review level.
 * Returns HIGH for:
 * - Amounts >50% of wallet balance
 * - New accounts (< 30 days)
 * - Frequent withdrawals (>3 in past 7 days)
 * - Total withdrawal >$10,000 in period
 */
export function assessWithdrawalRisk(amount: string, context: WithdrawalContext): RiskAssessment {
  const reasons: string[] = [];
  let score = 0;

  const amountNum = Number(amount);
  const balanceNum = Number(context.walletBalance);
  const previousTotalNum = Number(context.previousWithdrawalTotalInPeriod);

  // Rule 1: Large withdrawal relative to balance
  if (amountNum > balanceNum * 0.5) {
    reasons.push('Withdrawal exceeds 50% of available balance.');
    score += 30;
  } else if (amountNum > balanceNum * 0.25) {
    reasons.push('Withdrawal exceeds 25% of available balance.');
    score += 15;
  }

  // Rule 2: New account age
  if (context.accountAgeInDays < 30) {
    reasons.push('Account is very new (<30 days).');
    score += 25;
  } else if (context.accountAgeInDays < 90) {
    reasons.push('Account is relatively new (<90 days).');
    score += 10;
  }

  // Rule 3: Withdrawal frequency
  if (context.previousWithdrawalCount > 3) {
    reasons.push('Frequent withdrawals detected (>3 in recent period).');
    score += 20;
  } else if (context.previousWithdrawalCount > 1) {
    reasons.push('Multiple withdrawals in recent period.');
    score += 10;
  }

  // Rule 4: Total withdrawal amount in period
  if (previousTotalNum + amountNum > 10000) {
    reasons.push('Total withdrawals exceed $10,000 in period.');
    score += 25;
  }

  // Determine risk level and manual review requirement
  let level = RiskLevel.LOW;
  let requiresManualReview = false;

  if (score >= 60) {
    level = RiskLevel.HIGH;
    requiresManualReview = true;
  } else if (score >= 30) {
    level = RiskLevel.MEDIUM;
    requiresManualReview = score > 40;
  }

  return {
    level,
    score,
    reasons,
    requiresManualReview,
  };
}
