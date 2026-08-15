/**
 * Compliance Checks Module
 * Handles sanctions screening, AML risk assessment, and regulatory compliance.
 */

export interface ComplianceResult {
  compliant: boolean;
  sanctions: {
    screened: boolean;
    flagged: boolean;
    reason?: string;
  };
  aml: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskScore: number; // 0-100
    concerns: string[];
  };
  actions: string[]; // Recommended actions
}

/**
 * Simulated sanctions list for demo purposes.
 * In production, this would connect to OFAC, EU sanctions, UN lists, etc.
 */
const DEMO_SANCTIONS_LIST = [
  'user-sanctioned-1',
  'user-sanctioned-2',
  'sanctioned-account-xyz',
];

/**
 * Screen user against sanctions lists (OFAC, EU, UN, etc.)
 * @param userId - User ID to screen
 * @returns Sanctions check result
 */
export function screenAgainstSanctions(userId: string): {
  screened: boolean;
  flagged: boolean;
  reason?: string;
} {
  const flagged = DEMO_SANCTIONS_LIST.includes(userId);
  return {
    screened: true,
    flagged,
    reason: flagged ? `User ${userId} found on sanctions list` : undefined,
  };
}

/**
 * Assess AML (Anti-Money Laundering) risk based on withdrawal patterns.
 * @param userId - User ID
 * @param amount - Withdrawal amount in numeric form
 * @param recentWithdrawalCount - Number of withdrawals in the last 30 days
 * @param totalMonthlyWithdrawn - Total amount withdrawn this month
 * @returns AML risk assessment
 */
export function assessAMLRisk(
  userId: string,
  amount: number,
  recentWithdrawalCount: number,
  totalMonthlyWithdrawn: number
): {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  concerns: string[];
} {
  const concerns: string[] = [];
  let riskScore = 0;

  // Large single withdrawal
  if (amount > 50000) {
    riskScore += 25;
    concerns.push('Large single withdrawal over $50,000');
  }

  // Frequency concerns (many withdrawals in short period)
  if (recentWithdrawalCount > 5) {
    riskScore += 20;
    concerns.push(`High withdrawal frequency: ${recentWithdrawalCount} in last 30 days`);
  }

  // Monthly total concern (structuring detection)
  if (totalMonthlyWithdrawn > 100000) {
    riskScore += 20;
    concerns.push(`High monthly total: $${totalMonthlyWithdrawn} withdrawn this month`);
  }

  // Unusual timing patterns (would be more sophisticated in production)
  if (recentWithdrawalCount > 0 && amount > 10000) {
    riskScore += 10;
    concerns.push('Withdrawal amount elevated relative to account activity');
  }

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (riskScore >= 60) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 30) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return {
    riskLevel,
    riskScore: Math.min(riskScore, 100), // Cap at 100
    concerns,
  };
}

/**
 * Perform comprehensive compliance check on a withdrawal.
 * @param userId - User ID requesting withdrawal
 * @param amount - Withdrawal amount
 * @param recentWithdrawalCount - Number of recent withdrawals
 * @param totalMonthlyWithdrawn - Total monthly withdrawal amount
 * @returns Compliance assessment result
 */
export function performComplianceCheck(
  userId: string,
  amount: number,
  recentWithdrawalCount: number,
  totalMonthlyWithdrawn: number
): ComplianceResult {
  // Screen against sanctions lists
  const sanctionsResult = screenAgainstSanctions(userId);

  // Assess AML risk
  const amlResult = assessAMLRisk(
    userId,
    amount,
    recentWithdrawalCount,
    totalMonthlyWithdrawn
  );

  const actions: string[] = [];

  // Determine overall compliance
  const compliant = !sanctionsResult.flagged && amlResult.riskLevel !== 'HIGH';

  // Recommend actions based on results
  if (sanctionsResult.flagged) {
    actions.push('BLOCK: User on sanctions list - escalate to legal/compliance team');
  } else if (amlResult.riskLevel === 'HIGH') {
    actions.push('REVIEW: High AML risk - require manual review before approval');
    actions.push('COLLECT: Request additional documentation from user');
  } else if (amlResult.riskLevel === 'MEDIUM') {
    actions.push('MONITOR: Medium AML risk - track this user for patterns');
    if (amlResult.riskScore >= 40) {
      actions.push('ESCALATE: Consider requesting identity verification');
    }
  }

  return {
    compliant,
    sanctions: sanctionsResult,
    aml: amlResult,
    actions,
  };
}

/**
 * Check if compliance result allows approval (convenience method).
 */
export function isComplianceApproved(result: ComplianceResult): boolean {
  return result.compliant;
}
