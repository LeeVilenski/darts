import { describe, expect, it } from 'vitest';
import { emptyLifetime } from '../engine/stats/lifetime';
import { planSync } from './sync';

const rec = (matches: number, updatedAt: number) => ({ ...emptyLifetime(), matches, updatedAt });

describe('planSync', () => {
  it('uploads guest data on first sign-in', () => {
    const local = { Me: rec(3, 10) };
    expect(planSync(local, null)).toEqual({ lifetime: local, settings: null, push: true });
  });

  it('merges per player and keeps account settings', () => {
    const plan = planSync(
      { Me: rec(5, 20), Friend: rec(1, 5) },
      {
        settings: { assist: 'pro' },
        lifetime: { Me: rec(4, 10), Other: rec(2, 1) },
        updated_at: '',
      },
    );
    expect(plan.lifetime).toEqual({ Me: rec(5, 20), Friend: rec(1, 5), Other: rec(2, 1) });
    expect(plan.settings).toEqual({ assist: 'pro' });
    expect(plan.push).toBe(true);
  });

  it('does not push when the device has nothing new', () => {
    const cloud = { Me: rec(4, 10) };
    expect(planSync({ Me: rec(3, 5) }, { settings: {}, lifetime: cloud, updated_at: '' })).toEqual({
      lifetime: cloud,
      settings: null,
      push: false,
    });
  });
});
