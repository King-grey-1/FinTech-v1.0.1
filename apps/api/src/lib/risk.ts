type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskScoreResult {
  level: RiskLevel;
  score: number;
}

export function calculateRiskScore(flags: string[]): RiskScoreResult {
  const map: Record<string, number> = {
    'multiple failed logins': 12,
    'suspicious login location': 18,
    'unusual deposits': 14,
    'rapid deposit withdrawal': 20,
    'large withdrawal': 16,
    'account takeover indicators': 28,
    'multiple accounts': 10,
  };

  const total = flags.reduce((sum, flag) => sum + (map[flag.toLowerCase()] ?? 5), 0);
  const score = Math.min(total, 100);

  if (score >= 80) return { level: 'CRITICAL', score };
  if (score >= 60) return { level: 'HIGH', score };
  if (score >= 35) return { level: 'MEDIUM', score };
  return { level: 'LOW', score };
}
