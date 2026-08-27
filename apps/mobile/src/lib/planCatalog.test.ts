import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayPrice,
  effectiveMonthlyPrice,
  featuresForTier,
  mergeDisplayTiers,
  shouldResetPlanSelectionAfterRefresh,
  shouldResetPlanSelectionOnStatusChange,
  yearlyPrice,
} from './planCatalog';

describe('planCatalog', () => {
  it('uses 11 months for yearly pricing like desktop', () => {
    assert.equal(yearlyPrice(12.99), 142.89);
    assert.equal(effectiveMonthlyPrice(12.99), 11.91);
    assert.equal(displayPrice({ id: 'basic', name: 'Basic', monthly_credits: 0, price_usd: 12.99 }, 'yearly'), '142.89');
  });

  it('always shows Free plus paid tiers in desktop order', () => {
    const tiers = mergeDisplayTiers([{ id: 'creator', name: 'Creator', monthly_credits: 1800, price_usd: 49.99 }]);
    assert.deepEqual(tiers.map((tier) => tier.id), ['free', 'basic', 'starter', 'creator', 'pro']);
    assert.equal(tiers.find((tier) => tier.id === 'creator')?.price_usd, 49.99);
  });

  it('reopens the login gate when a paid plan expires', () => {
    assert.equal(shouldResetPlanSelectionOnStatusChange('active', 'expired'), true);
    assert.equal(shouldResetPlanSelectionOnStatusChange('cancelled', 'expired'), true);
    assert.equal(shouldResetPlanSelectionOnStatusChange('none', 'expired'), false);
    assert.equal(shouldResetPlanSelectionOnStatusChange('expired', 'expired'), false);
    assert.equal(shouldResetPlanSelectionAfterRefresh(true, false), true);
    assert.equal(shouldResetPlanSelectionAfterRefresh(false, false), false);
  });

  it('lists Mobile App on every tier', () => {
    for (const id of ['free', 'basic', 'starter', 'creator', 'pro']) {
      assert.equal(
        featuresForTier(id).some((feature) => feature.label === 'Mobile App' && feature.included),
        true,
        `${id} should include Mobile App`,
      );
    }
  });
});
