import { Router } from 'express';
import { z } from 'zod';
import { failure, success } from '../lib/api-response';
import { validateWithdrawal } from '../lib/financial-core';
import { createWithdrawalRequest, transitionWithdrawal, WithdrawalState, createWithdrawalRequestWithRisk } from '../lib/withdrawal-flow';
import { requireAuth } from '../middleware/auth';
import { idempotencyCache } from '../lib/idempotency';
import { RiskLevel, WithdrawalContext } from '../lib/withdrawal-risk';
import { createWithdrawal as persistWithdrawal } from '../lib/withdrawal-repository';

const router = Router();

const withdrawalSchema = z.object({
  amount: z.string().refine((value) => Number(value) > 0, 'Amount must be positive'),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  idempotencyKey: z.string().min(1),
  bankAccount: z.string().optional(),
});

/**
 * POST /api/withdrawals
 * Create a new withdrawal request.
 * Enforces idempotency and risk-based approval routing.
 */
router.post('/', requireAuth, async (req, res) => {
  const parsed = withdrawalSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(failure('INVALID_WITHDRAWAL_REQUEST', 'Withdrawal request is invalid.'));
  }

  // Check idempotency: if request with this key was already processed, return cached result
  const cachedCheck = idempotencyCache.recordAttempt(parsed.data.idempotencyKey, '');
  if (cachedCheck.isCached && cachedCheck.cachedRecord) {
    return res.status(200).json(success({
      withdrawal: {
        id: cachedCheck.cachedRecord.withdrawalId,
        idempotencyKey: parsed.data.idempotencyKey,
        message: 'Withdrawal request already processed. Returning cached result.',
        status: cachedCheck.cachedRecord.status,
      },
    }));
  }

  const withdrawableBalance = '1500.00';
  const balanceCheck = validateWithdrawal(parsed.data.amount, withdrawableBalance);
  if (!balanceCheck.valid) {
    idempotencyCache.markFailed(parsed.data.idempotencyKey, balanceCheck.reason ?? 'WITHDRAWAL_REJECTED');
    return res.status(400).json(failure(balanceCheck.reason ?? 'WITHDRAWAL_REJECTED', 'The requested withdrawal exceeds the withdrawable balance.'));
  }

  // Demo context: assume new account (10 days old), no previous withdrawals
  const riskContext: WithdrawalContext = {
    walletBalance: withdrawableBalance,
    previousWithdrawalCount: 0,
    accountAgeInDays: 10,
    previousWithdrawalTotalInPeriod: '0.00',
  };

  // Create request with risk assessment
  const request = createWithdrawalRequestWithRisk(
    'user-1',
    parsed.data.amount,
    parsed.data.currency,
    parsed.data.idempotencyKey,
    riskContext,
    parsed.data.bankAccount,
  );

  try {
    // Persist withdrawal to database
    await persistWithdrawal(request);

    // For demo, HIGH_RISK still goes to UNDER_REVIEW automatically
    const statusMessage = request.riskLevel === RiskLevel.HIGH
      ? 'High-risk withdrawal automatically routed to manual review.'
      : 'Withdrawal request entered review. Large withdrawals may require additional verification.';

    idempotencyCache.markCompleted(parsed.data.idempotencyKey, request.id);

    return res.status(201).json(success({
      withdrawal: {
        id: request.id,
        amount: request.amount,
        currency: request.currency,
        status: request.status,
        riskLevel: request.riskLevel,
        idempotencyKey: request.idempotencyKey,
        message: statusMessage,
      },
    }));
  } catch (error) {
    idempotencyCache.markFailed(parsed.data.idempotencyKey, 'DATABASE_ERROR');
    return res.status(500).json(failure('DATABASE_ERROR', error instanceof Error ? error.message : 'Failed to create withdrawal request.'));
  }
});

/**
 * GET /api/withdrawals
 * List withdrawals for authenticated user.
 */
router.get('/', requireAuth, (_req, res) => {
  res.json(success({
    withdrawals: [
      {
        id: 'wdr-1',
        amount: '250.00',
        currency: 'USD',
        status: 'REQUESTED',
      },
    ],
  }));
});

export default router;
