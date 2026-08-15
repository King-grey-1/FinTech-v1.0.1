import { Router } from 'express';
import { z } from 'zod';
import { failure, success } from '../lib/api-response';
import { applyInvestmentAllocation, settleInvestmentAtMaturity } from '../lib/financial-core';
import { requireAuth } from '../middleware/auth';

const router = Router();

const investmentSchema = z.object({
  productId: z.string().min(1),
  amount: z.string().refine((value) => Number(value) > 0, 'Investment amount must be positive'),
});

router.get('/', requireAuth, (_req, res) => {
  res.json(success({
    investments: [
      {
        id: 'prod-1',
        name: 'Trading Strategy A',
        principal: '1000.00',
        status: 'ACTIVE',
        targetReturn: '8.50%',
        currentValue: '1080.00',
        realizedProfit: '80.00',
        riskLevel: 'HIGH',
        maturityDate: '2026-08-29T00:00:00.000Z',
      },
    ],
  }));
});

router.post('/allocate', requireAuth, (req, res) => {
  const parsed = investmentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(failure('INVALID_INVESTMENT', 'Investment payload is invalid.'));
  }

  const wallet = { availableBalance: '1000.00', lockedBalance: '0.00', pendingBalance: '0.00' };
  const updated = applyInvestmentAllocation(wallet, parsed.data.amount);

  return res.status(201).json(success({
    investment: {
      productId: parsed.data.productId,
      allocatedAmount: parsed.data.amount,
      status: 'ACTIVE',
      wallet: updated,
      notice: 'Investment allocation is recorded as locked capital. Target return language is configurable and not guaranteed.',
    },
  }));
});

router.post('/mature', requireAuth, (req, res) => {
  const bodySchema = z.object({ principal: z.string(), realizedProfit: z.string(), fee: z.string() });
  const parsed = bodySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(failure('INVALID_MATURITY', 'Maturity payload is invalid.'));
  }

  const wallet = { availableBalance: '0.00', lockedBalance: '1000.00', pendingBalance: '0.00' };
  const updated = settleInvestmentAtMaturity(wallet, parsed.data.principal, parsed.data.realizedProfit, parsed.data.fee);

  return res.json(success({
    maturity: {
      availableBalanceAfter: updated.availableBalance,
      status: 'MATURED',
      notice: 'Settlement reflects principal, realized profit, and fees according to investment terms.',
    },
  }));
});

export default router;
