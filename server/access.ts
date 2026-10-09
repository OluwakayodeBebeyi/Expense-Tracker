import type { RequestHandler } from 'express';
import { getPrisma } from './db.js';
import { isTransactionManagerRole } from './roles.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId: string;
  accessLevel: number;
  isSuperAdmin: boolean;
  permissions: string[];
}

export function requirePermission(permission: string): RequestHandler {
  return (req, res, next) => {
    const user = res.locals.authUser as AuthenticatedUser | undefined;
    const transactionWrite = permission.startsWith('transactions.') && permission !== 'transactions.view';
    if (user && (!transactionWrite || isTransactionManagerRole(user.role, user.isSuperAdmin))
      && (user.isSuperAdmin || user.permissions.includes(permission))) {
      next();
      return;
    }
    if (user) {
      void getPrisma().auditLog.create({
        data: {
          userId: user.id,
          action: 'AUTHORIZATION_DENIED',
          entity: req.baseUrl || req.path,
          outcome: 'DENIED',
          ipAddress: req.ip,
          device: req.get('user-agent')?.slice(0, 500),
        },
      }).catch((error: unknown) => console.error('Authorization denial audit event could not be saved:', error));
    }
    res.status(403).json({ message: 'You do not have permission to perform this action.' });
  };
}

export function canManageAccessLevel(actor: AuthenticatedUser, targetLevel: number): boolean {
  return actor.isSuperAdmin || targetLevel < actor.accessLevel;
}

export function canGrantPermissions(actor: AuthenticatedUser, requested: readonly string[]): boolean {
  return actor.isSuperAdmin || requested.every((key) => actor.permissions.includes(key));
}
