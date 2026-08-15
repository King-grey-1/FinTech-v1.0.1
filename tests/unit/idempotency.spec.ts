import { describe, it, expect, beforeEach } from 'vitest';
import { idempotencyCache } from '../../apps/api/src/lib/idempotency';

describe('idempotency cache', () => {
  beforeEach(() => {
    idempotencyCache.clear();
  });

  it('returns isCached=false for new idempotency key', () => {
    const result = idempotencyCache.recordAttempt('key-1', 'wdr-123');
    expect(result.isCached).toBe(false);
    expect(result.cachedRecord).toBeUndefined();
  });

  it('returns isCached=true for duplicate key within TTL', () => {
    const key = 'key-duplicate';
    idempotencyCache.recordAttempt(key, 'wdr-123');
    idempotencyCache.markCompleted(key, 'wdr-123');

    const result = idempotencyCache.recordAttempt(key, 'wdr-456');
    expect(result.isCached).toBe(true);
    expect(result.cachedRecord?.withdrawalId).toBe('wdr-123');
  });

  it('marks record as completed with result', () => {
    const key = 'key-complete';
    idempotencyCache.recordAttempt(key, 'wdr-789');
    idempotencyCache.markCompleted(key, 'wdr-789');

    const record = idempotencyCache.get(key);
    expect(record?.status).toBe('COMPLETED');
    expect(record?.result).toBe('wdr-789');
  });

  it('marks record as failed with reason', () => {
    const key = 'key-failed';
    idempotencyCache.recordAttempt(key, 'wdr-fail');
    idempotencyCache.markFailed(key, 'Insufficient balance');

    const record = idempotencyCache.get(key);
    expect(record?.status).toBe('FAILED');
    expect(record?.errorReason).toBe('Insufficient balance');
  });
});
