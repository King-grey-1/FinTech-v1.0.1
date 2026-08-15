import { Router } from 'express';
import { success } from '../lib/api-response';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import { Permission } from '../lib/rbac';

const router = Router();

router.get('/me', requireAuth, requirePermission(Permission.VIEW_OWN_ACCOUNT), (req: AuthenticatedRequest, res) => {
  res.json(success({
    user: {
      id: req.user?.userId,
      email: req.user?.email,
      role: req.user?.role,
    },
    message: 'User profile retrieved from authenticated session.',
  }));
});

export default router;
