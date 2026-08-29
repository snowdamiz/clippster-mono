import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bypassesPersonalSubscription,
  hasValidSubscription,
  needsSubscription,
  requiresPlanSelectionGate,
} from './subscriptionAccess';
import type { AuthUser, SubscriptionStatus } from '@clippster/shared-types';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    email: 'user@example.com',
    name: 'User',
    is_admin: false,
    created_by_organization_id: null,
    owned_organization_id: null,
    account_type: 'personal',
    ...overrides,
  } as AuthUser;
}

function status(overrides: Partial<SubscriptionStatus> = {}): SubscriptionStatus {
  return {
    status: 'none',
    needs_subscription: true,
    ...overrides,
  } as SubscriptionStatus;
}

describe('subscriptionAccess', () => {
  it('treats active and still-current cancelled subscriptions as valid', () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    assert.equal(hasValidSubscription(status({ status: 'active' })), true);
    assert.equal(hasValidSubscription(status({ status: 'cancelled', end_date: nextWeek, days_remaining: 7 })), true);
    assert.equal(hasValidSubscription(status({ status: 'cancelled', end_date: yesterday, days_remaining: 0 })), false);
    assert.equal(hasValidSubscription(status({ status: 'expired' })), false);
  });

  it('defaults to needing a subscription when status is missing', () => {
    assert.equal(needsSubscription(null), true);
    assert.equal(needsSubscription(status({ needs_subscription: false })), false);
  });

  it('bypasses personal subscription for admin and org accounts', () => {
    assert.equal(bypassesPersonalSubscription(user({ is_admin: true })), true);
    assert.equal(bypassesPersonalSubscription(user({ owned_organization_id: 9 })), true);
    assert.equal(bypassesPersonalSubscription(user()), false);
  });

  it('requires a first-run plan choice only for ungated personal users', () => {
    assert.equal(requiresPlanSelectionGate(user(), status(), false), true);
    assert.equal(requiresPlanSelectionGate(user(), status({ status: 'expired' }), false), true);
    assert.equal(requiresPlanSelectionGate(user(), status({ status: 'active' }), false), false);
    assert.equal(requiresPlanSelectionGate(user({ is_admin: true }), status(), false), false);
    assert.equal(requiresPlanSelectionGate(user(), status(), true), false);
    assert.equal(requiresPlanSelectionGate(user(), status({ status: 'expired' }), true), false);
  });
});
