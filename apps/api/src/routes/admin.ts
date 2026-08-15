import { Router } from 'express';
import { success } from '../lib/api-response';
import { Permission } from '../lib/rbac';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/overview', requireAuth, requirePermission(Permission.MANAGE_PLATFORM), (_req, res) => {
  res.json(success({
    totalUsers: 3,
    totalDeposits: 125000,
    totalWithdrawals: 35700,
    totalInvestedCapital: 88000,
    activeInvestments: 2,
    pendingKyc: 1,
    pendingWithdrawals: 1,
    message: 'Admin overview is available in demo mode.',
  }));
});

export default router;
