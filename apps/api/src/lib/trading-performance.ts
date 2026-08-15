export type TradingAccountType = 'DEMO' | 'BROKER' | 'PROP_FIRM' | 'INTERNAL_STRATEGY';

export function isNotionalCapital(accountType: TradingAccountType): boolean {
  return accountType === 'PROP_FIRM' || accountType === 'INTERNAL_STRATEGY';
}

export function getTradingAccountEquity(balance: string, unrealizedPnl: string): string {
  return (Number(balance) + Number(unrealizedPnl)).toFixed(2);
}

export function calculatePerformanceStats(input: {
  dailyPnl?: string;
  weeklyPnl?: string;
  monthlyPnl?: string;
  totalPnl?: string;
  roi?: string;
  winRate?: string;
  averageWin?: string;
  averageLoss?: string;
  maxDrawdown?: string;
  profitFactor?: string;
}) {
  return {
    dailyPnl: Number(input.dailyPnl ?? '0').toFixed(2),
    weeklyPnl: Number(input.weeklyPnl ?? '0').toFixed(2),
    monthlyPnl: Number(input.monthlyPnl ?? '0').toFixed(2),
    totalPnl: Number(input.totalPnl ?? '0').toFixed(2),
    roi: Number(input.roi ?? '0').toFixed(2),
    winRate: Number(input.winRate ?? '0').toFixed(2),
    averageWin: Number(input.averageWin ?? '0').toFixed(2),
    averageLoss: Number(input.averageLoss ?? '0').toFixed(2),
    maxDrawdown: Number(input.maxDrawdown ?? '0').toFixed(2),
    profitFactor: Number(input.profitFactor ?? '0').toFixed(2),
  };
}
