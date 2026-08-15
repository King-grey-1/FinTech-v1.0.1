import { Router } from 'express';
import { z } from 'zod';
import { failure, success } from '../lib/api-response';
import { applyDeposit } from '../lib/financial-core';
import { requireAuth } from '../middleware/auth';

const router = Router();

const depositSchema = z.object({
  amount: z.string().refine((value) => Number(value) > 0, 'Amount must be positive'),
  currency: z.enum(['USD', 'EUR', 'GBP']),
});

router.post('/', requireAuth, (req, res) => {
  const parsed = depositSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(failure('INVALID_DEPOSIT', 'Deposit payload is invalid.'));
  }

  const wallet = { availableBalance: '0.00', lockedBalance: '0.00', pendingBalance: '0.00' };
  const updated = applyDeposit(wallet, parsed.data.amount);

  return res.status(201).json(success({
    deposit: {
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      status: 'PENDING_VERIFICATION',
      availableBalanceAfter: updated.availableBalance,
      message: 'Deposit is accepted in demo mode pending server-side verification and provider confirmation.',
    },
  }));
});

export default router;
