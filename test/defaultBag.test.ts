import { describe, expect, it } from 'vitest';
import type { BeanBatch } from '../src/api/types';
import { lastUsedBag, parseDefaultBags, startBag } from '../src/lib/defaultBag';

const bag = (id: string, dialAt?: string): BeanBatch => ({
  id, beanId: 'b', createdAt: '2026-10-01',
  extras: dialAt ? { flimsydecaid: { dialIn: { p: { grind: 12, updatedAt: dialAt } } } } : undefined,
} as unknown as BeanBatch);

describe('default bag', () => {
  const open = [bag('new'), bag('old', '2026-10-20T08:00:00Z'), bag('older', '2026-10-10T08:00:00Z')];
  it('prefers what was asked for, then the default, then the last used, then the machine, then the newest', () => {
    expect(startBag({ open, profileRoot: 'p', requested: 'older', defaults: { p: 'new' } })).toBe('older');
    expect(startBag({ open, profileRoot: 'p', defaults: { p: 'new' } })).toBe('new');
    expect(startBag({ open, profileRoot: 'p', defaults: {} })).toBe('old');
    expect(startBag({ open, profileRoot: 'q', defaults: {}, onMachine: 'older' })).toBe('older');
    expect(startBag({ open, profileRoot: 'q', defaults: {} })).toBe('new');
  });
  it('skips a default or request that is no longer open', () => {
    expect(startBag({ open, profileRoot: 'p', requested: 'gone', defaults: { p: 'finished' } })).toBe('old');
  });
  it('finds the bag last used with a profile', () => {
    expect(lastUsedBag(open, 'p')).toBe('old');
    expect(lastUsedBag(open, 'none')).toBeNull();
  });
  it('parses the stored map defensively', () => {
    expect(parseDefaultBags({ p: 'a', q: 3, r: '' })).toEqual({ p: 'a' });
    expect(parseDefaultBags(null)).toEqual({});
    expect(parseDefaultBags([])).toEqual({});
  });
});
