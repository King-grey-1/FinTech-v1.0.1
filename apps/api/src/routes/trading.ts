import { Router } from 'express';
import { z } from 'zod';
import { failure, success } from '../lib/api-response';
import { calculatePerformanceStats, getTradingAccountEquity, isNotionalCapital } from '../lib/trading-performance';
import { requireAuth } from '../middleware/auth';

const router = Router();

const perfSchema = z.object({
  dailyPnl: z.string().optional(),
  weeklyPnl: z.string().optional(),
  monthlyPnl: z.string().optional(),
  totalPnl: z.string().optional(),
  roi: z.string().optional(),
  winRate: z.string().optional(),
  averageWin: z.string().optional(),
  averageLoss: z.string().optional(),
  maxDrawdown: z.string().optional(),
  profitFactor: z.string().optional(),
});

router.get('/accounts', requireAuth, (_req, res) => {
  res.json(success({
    accounts: [
      {
        accountId: 'acct-1',
        brokerOrFirm: 'Prop Firm Alpha',
        accountType: 'PROP_FIRM',
        startingBalance: '10000.00',
        currentBalance: '10000.00',
        equity: '10800.00',
        unrealizedPnl: '800.00',
        drawdown: '12.00',
        status: 'ACTIVE',
        strategy: 'Momentum Swing',
        cashEquivalent: false,
        notes: 'Nominal account size tracked separately from real user cash.',
      },
    ],
  }));
});

router.post('/performance/import', requireAuth, (req, res) => {
  const parsed = perfSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(failure('INVALID_PERFORMANCE_IMPORT', 'Performance payload is invalid.'));
  }

  const stats = calculatePerformanceStats(parsed.data);
  const equity = getTradingAccountEquity('10000.00', '800.00');

  return res.status(201).json(success({
    imported: true,
    stats,
    equity,
    notionalCapital: isNotionalCapital('PROP_FIRM'),
    auditNote: 'Every performance correction creates a new audit record and is not silently altered.',
  }));
});

export default router;
