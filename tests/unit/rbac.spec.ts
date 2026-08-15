import { describe, expect, it } from 'vitest';
import { hasPermission, Permission } from '../../apps/api/src/lib/rbac';

describe('rbac', () => {
  it('allows explicit user permissions', () => {
    expect(hasPermission('USER', Permission.VIEW_OWN_ACCOUNT)).toBe(true);
  });

  it('denies admin-only action to non-admin users', () => {
    expect(hasPermission('USER', Permission.MANAGE_PLATFORM)).toBe(false);
  });

  it('allows admin roles for elevated actions', () => {
    expect(hasPermission('ADMIN', Permission.MANAGE_PLATFORM)).toBe(true);
    expect(hasPermission('SUPER_ADMIN', Permission.SYSTEM_CONFIG)).toBe(true);
  });
});
