import assert from 'node:assert/strict';
import test from 'node:test';

import { canAccessCampaigns } from './featureAccess';

test('campaigns are hidden from ordinary users until globally enabled', () => {
  assert.equal(canAccessCampaigns({ id: 1 }, false), false);
  assert.equal(canAccessCampaigns({ id: 1 }, true), true);
});

test('admins and individually enabled users retain early access', () => {
  assert.equal(canAccessCampaigns({ id: 1, is_admin: true }, false), true);
  assert.equal(canAccessCampaigns({ id: 1, campaigns_enabled: true }, false), true);
});
