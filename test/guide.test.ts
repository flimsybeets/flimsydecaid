import { describe, expect, it } from 'vitest';
import type { BeanBatch, ProfileRecord } from '../src/api/types';
import { canGoBack, parseGuideSetup, pickBag, planBrew, rinseProgress, weighState } from '../src/lib/guide';

const bag = (id: string, beanId: string, roastDate: string, archived = false, extras?: BeanBatch['extras']): BeanBatch => ({
  id, beanId, roastDate, archived, frozen: false, createdAt: roastDate, updatedAt: roastDate, extras,
});
const record = (targetWeight: number | null): ProfileRecord => ({
  id: 'p2', parentId: 'p1', visibility: 'visible', isDefault: false, createdAt: '', updatedAt: '',
  profile: { title: 'P', steps: [], target_volume_count_start: 0, tank_temperature: 0, target_weight: targetWeight },
});

describe('guide setup', () => {
  it('accepts only a complete profile + coffee', () => {
    expect(parseGuideSetup({ profileRoot: 'p1', beanId: 'b1' })).toEqual({ profileRoot: 'p1', beanId: 'b1' });
    expect(parseGuideSetup({ profileRoot: 'p1' })).toBeNull();
    expect(parseGuideSetup(null)).toBeNull();
  });

  it('uses the newest open bag of the coffee', () => {
    const bags = [bag('old', 'b1', '2026-09-01'), bag('new', 'b1', '2026-10-01'), bag('done', 'b1', '2026-10-20', true), bag('other', 'b2', '2026-10-21')];
    expect(pickBag('b1', bags)?.id).toBe('new');
    expect(pickBag('b3', bags)).toBeNull();
  });
});

describe('brew plan', () => {
  it('takes the bag\'s dial-in', () => {
    const b = bag('x', 'b1', '2026-10-01', false, { flimsydecaid: { dialIn: { p1: { grind: '12.5', dose: 18.5, yield: 40, tempOffset: 1 } } } });
    const plan = planBrew(record(36), 'p1', b, [b]);
    expect(plan).toMatchObject({ dose: 18.5, yield: 40, grind: '12.5', tempOffset: 1, source: 'this-bag' });
  });

  it('falls back to the profile\'s target and a default dose, with no grind yet', () => {
    const b = bag('x', 'b1', '2026-10-01');
    expect(planBrew(record(36), 'p1', b, [b])).toMatchObject({ dose: 18, yield: 36, grind: null, source: 'profile-default' });
    expect(planBrew(record(0), 'p1', null, []).yield).toBeNull();
  });
});

describe('weighing', () => {
  it('is green within 0.1 g', () => {
    expect(weighState(18.0, 18).state).toBe('ok');
    expect(weighState(17.9, 18).state).toBe('ok');
    expect(weighState(18.1, 18).state).toBe('ok');
  });

  it('says how much to add or take out', () => {
    expect(weighState(17.6, 18)).toEqual({ state: 'under', delta: 0.4 });
    expect(weighState(18.3, 18)).toEqual({ state: 'over', delta: -0.3 });
  });

  it('treats an empty or missing reading as empty', () => {
    expect(weighState(0.1, 18).state).toBe('empty');
    expect(weighState(null, 18).state).toBe('empty');
  });

  it('does not flicker on readings between scale steps', () => {
    expect(weighState(17.86, 18).state).toBe('ok');
    expect(weighState(17.84, 18).state).toBe('under');
  });
});

describe('guide flow', () => {
  it('lets you go back during prep, not after the shot', () => {
    expect(canGoBack('weigh')).toBe(false);
    expect(canGoBack('tamp')).toBe(true);
    expect(canGoBack('start')).toBe(true);
    expect(canGoBack('knock')).toBe(false);
  });

  it('follows the machine through a rinse', () => {
    expect(rinseProgress(false, 'idle')).toBe('waiting');
    expect(rinseProgress(false, 'flush')).toBe('rinsing');
    expect(rinseProgress(true, 'idle')).toBe('finished');
  });
});
