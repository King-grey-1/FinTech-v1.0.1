import { describe, expect, it } from 'vitest';
import {
  calculatePerformanceStats,
  getTradingAccountEquity,
  isNotionalCapital,
} from '../../apps/api/src/lib/trading-performance';

describe('trading and performance engine', () => {
  it('shows notional capital as different from real cash', () => {
    expect(isNotionalCapital('PROP_FIRM')).toBe(true);
    expect(isNotionalCapital('BROKER')).toBe(false);
  });

  it('calculates trading performance metrics correctly', () => {
    const stats = calculatePerformanceStats({
      dailyPnl: '120',
      weeklyPnl: '540',
      monthlyPnl: '1800',
      totalPnl: '4200',
      roi: '8.5',
      winRate: '62.5',
      averageWin: '210',
      averageLoss: '120',
      maxDrawdown: '15.0',
      profitFactor: '2.1',
    });

    expect(stats.totalPnl).toBe('4200.00');
    expect(stats.profitFactor).toBe('2.10');
    expect(stats.winRate).toBe('62.50');
  });

  it('calculates account equity from balance and unrealized P/L', () => {
    expect(getTradingAccountEquity('10000.00', '800.00')).toBe('10800.00');
  });
});
