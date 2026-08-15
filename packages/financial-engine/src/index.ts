type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface InvestmentProduct {
  id: string;
  name: string;
  minInvestment: string;
  maxInvestment?: string;
  durationDays: number;
  expectedReturn: string;
  performanceFee: string;
  managementFee: string;
  riskLevel: RiskLevel;
  status: 'DRAFT' | 'ACTIVE' | 'DISABLED';
}

export interface FinancialMathConfig {
  currency: 'USD' | 'EUR' | 'GBP';
  rounding: number;
}

export function toDecimal(value: string | number): string {
  const raw = typeof value === 'number' ? value.toString() : value;
  return Number(raw).toFixed(2);
}

export function calculateProfit(
  principal: string | number,
  performance: string | number,
  fees: string | number = 0,
): string {
  return (Number(principal) + Number(performance) - Number(fees)).toFixed(2);
}

export function calculateTargetReturnValue(principal: string | number, expectedReturnRate: string | number): string {
  const principalValue = Number(principal);
  const rate = Number(expectedReturnRate) / 100;
  return (principalValue * rate).toFixed(2);
}

export function calculateFeeAmount(amount: string | number, rate: string | number): string {
  return (Number(amount) * (Number(rate) / 100)).toFixed(2);
}

export function calculateRiskScore(riskLevel: RiskLevel): number {
  const scores: Record<RiskLevel, number> = {
    LOW: 25,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 95,
  };
  return scores[riskLevel];
}

export function validateInvestmentProduct(product: InvestmentProduct): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (Number(product.minInvestment) <= 0) reasons.push('Minimum investment must be greater than zero.');
  if (product.maxInvestment && Number(product.maxInvestment) < Number(product.minInvestment)) {
    reasons.push('Maximum investment cannot be lower than minimum investment.');
  }
  if (Number(product.expectedReturn) < 0) reasons.push('Expected return must not be negative.');
  if (Number(product.performanceFee) < 0 || Number(product.managementFee) < 0) {
    reasons.push('Fees must not be negative.');
  }
  if (product.durationDays <= 0) reasons.push('Investment duration must be greater than zero.');

  return { valid: reasons.length === 0, reasons };
}

export function generateRiskLabel(score: number): RiskLevel {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export function getAccountEquity(
  availableBalance: string | number,
  lockedBalance: string | number,
  unrealizedProfit: string | number,
): string {
  return (Number(availableBalance) + Number(lockedBalance) + Number(unrealizedProfit)).toFixed(2);
}
