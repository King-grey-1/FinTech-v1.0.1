/**
 * Rate Limiting Module
 * Enforces per-user and per-account withdrawal limits.
 * Persists withdrawal history to database for accuracy across restarts.
 */

import {
  recordWithdrawalHistory as dbRecordWithdrawal,
  getWithdrawalHistoryInWindow as dbGetHistoryInWindow,
  countWithdrawalsInWindow as dbCountInWindow,
  getTotalWithdrawalInWindow as dbGetTotalInWindow,
} from './rate-limiting-repository';

export interface WithdrawalLimit {
  maxPerDay: number; // Maximum amount per day
  maxPerWeek: number; // Maximum amount per week
  maxPerMonth: number; // Maximum amount per month
  maxFrequencyPerDay: number; // Maximum number of withdrawals per day
}

export interface RateLimitCheckResult {
  allowed: boolean;
  violations: string[];
  remainingLimits: {
    dailyRemaining: number;
    weeklyRemaining: number;
    monthlyRemaining: number;
    dailyWithdrawalsRemaining: number;
  };
}

/**
 * Default withdrawal limits for standard users.
 * Can be customized per user tier, account type, or compliance status.
 */
export const DEFAULT_WITHDRAWAL_LIMITS: WithdrawalLimit = {
  maxPerDay: 25000,
  maxPerWeek: 75000,
  maxPerMonth: 250000,
  maxFrequencyPerDay: 5, // Max 5 withdrawals per day
};

/**
 * In-memory cache for withdrawal history (user-scoped).
 * Used for fast synchronous checks, backed by database for persistence.
 */
const withdrawalHistoryCache = new Map<string, Array<{ timestamp: number; amount: number }>>();

/**
 * Record a withdrawal in history.
 * Writes to in-memory cache immediately and asynchronously to database.
 * @param userId - User ID
 * @param amount - Withdrawal amount
 */
export function recordWithdrawal(userId: string, amount: number): void {
  if (!withdrawalHistoryCache.has(userId)) {
    withdrawalHistoryCache.set(userId, []);
  }
  const history = withdrawalHistoryCache.get(userId)!;
  const now = Date.now();
  history.push({ timestamp: now, amount });

  // Clean up in-memory cache: withdrawals older than 30 days
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const filtered = history.filter((w) => w.timestamp > thirtyDaysAgo);
  withdrawalHistoryCache.set(userId, filtered);

  // Fire async database write without blocking
  dbRecordWithdrawal(userId, amount, now).catch((error) => {
    console.error('Failed to persist withdrawal history to database:', error);
  });
}

/**
 * Get withdrawal history for a user within a time window.
 * Uses in-memory cache for fast synchronous access.
 * @param userId - User ID
 * @param windowMs - Time window in milliseconds
 * @returns Array of withdrawals within the window
 */
function getWithdrawalsInWindow(userId: string, windowMs: number): Array<{ amount: number; timestamp: number }> {
  const history = withdrawalHistoryCache.get(userId) || [];
  const cutoff = Date.now() - windowMs;
  return history.filter((w) => w.timestamp > cutoff);
}

/**
 * Check if a withdrawal violates rate limits.
 * @param userId - User ID
 * @param amount - Proposed withdrawal amount
 * @param userLimits - Custom limits for user (defaults to standard limits)
 * @returns Rate limit check result with violations and remaining limits
 */
export function checkRateLimit(
  userId: string,
  amount: number,
  userLimits: WithdrawalLimit = DEFAULT_WITHDRAWAL_LIMITS
): RateLimitCheckResult {
  const violations: string[] = [];

  // Get withdrawal history
  const dailyWithdrawals = getWithdrawalsInWindow(userId, 24 * 60 * 60 * 1000); // Last 24 hours
  const weeklyWithdrawals = getWithdrawalsInWindow(userId, 7 * 24 * 60 * 60 * 1000); // Last 7 days
  const monthlyWithdrawals = getWithdrawalsInWindow(userId, 30 * 24 * 60 * 60 * 1000); // Last 30 days

  // Calculate totals
  const dailyTotal = dailyWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const weeklyTotal = weeklyWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const monthlyTotal = monthlyWithdrawals.reduce((sum, w) => sum + w.amount, 0);

  // Check daily amount limit
  if (dailyTotal + amount > userLimits.maxPerDay) {
    violations.push(
      `Daily limit exceeded: $${dailyTotal + amount} exceeds $${userLimits.maxPerDay}`
    );
  }

  // Check weekly amount limit
  if (weeklyTotal + amount > userLimits.maxPerWeek) {
    violations.push(
      `Weekly limit exceeded: $${weeklyTotal + amount} exceeds $${userLimits.maxPerWeek}`
    );
  }

  // Check monthly amount limit
  if (monthlyTotal + amount > userLimits.maxPerMonth) {
    violations.push(
      `Monthly limit exceeded: $${monthlyTotal + amount} exceeds $${userLimits.maxPerMonth}`
    );
  }

  // Check daily frequency limit
  if (dailyWithdrawals.length >= userLimits.maxFrequencyPerDay) {
    violations.push(
      `Daily frequency limit exceeded: ${dailyWithdrawals.length} withdrawals (max ${userLimits.maxFrequencyPerDay})`
    );
  }

  // Calculate remaining limits
  const remainingLimits = {
    dailyRemaining: Math.max(0, userLimits.maxPerDay - dailyTotal),
    weeklyRemaining: Math.max(0, userLimits.maxPerWeek - weeklyTotal),
    monthlyRemaining: Math.max(0, userLimits.maxPerMonth - monthlyTotal),
    dailyWithdrawalsRemaining: Math.max(0, userLimits.maxFrequencyPerDay - dailyWithdrawals.length),
  };

  return {
    allowed: violations.length === 0,
    violations,
    remainingLimits,
  };
}

/**
 * Clear withdrawal history for a user (mainly for testing).
 * @param userId - User ID to clear
 */
export function clearWithdrawalHistory(userId: string): void {
  withdrawalHistoryCache.delete(userId);
}

/**
 * Clear all withdrawal history (mainly for testing).
 */
export function clearAllHistory(): void {
  withdrawalHistoryCache.clear();
}

/**
 * Get withdrawal history for a user (for auditing/reporting).
 * @param userId - User ID
 * @param days - Number of days to include (default 30)
 * @returns Withdrawal history
 */
export function getWithdrawalHistory(userId: string, days: number = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const history = withdrawalHistoryCache.get(userId) || [];
  return history.filter((w: { amount: number; timestamp: number }) => w.timestamp > cutoff);
}
