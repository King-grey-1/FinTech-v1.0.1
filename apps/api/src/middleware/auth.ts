import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/security';
import { hasPermission, Permission } from '../lib/rbac';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
  }

  const token = authHeader.replace('Bearer ', '');
  const payload = verifyToken<{ userId: string; email: string; role: string }>(token, process.env.JWT_SECRET || 'dev-secret');

  if (!payload) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired.' } });
  }

  req.user = payload;
  return next();
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this action.' } });
    }

    return next();
  };
}
