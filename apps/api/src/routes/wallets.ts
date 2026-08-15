import { Router } from 'express';
import { success } from '../lib/api-response';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/me', requireAuth, (_req, res) => {
  res.json(success({
    wallet: {
      currency: 'USD',
      availableBalance: '12000.00',
      lockedBalance: '5000.00',
      pendingBalance: '0.00',
      totalEquity: '17000.00',
    },
    message: 'Wallet summary retrieved from secure session.',
  }));
});

export default router;
