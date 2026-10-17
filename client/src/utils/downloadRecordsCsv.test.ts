import { describe, expect, it } from 'vitest';
import { buildRecordsCsv } from './downloadRecordsCsv';

describe('buildRecordsCsv', () => {
  it('exports nested user details and retains accounts without emails', () => {
    const csv = buildRecordsCsv([
      { id: 1, email: null, wallet_address: 'wallet', is_admin: true,
        credits: { hours_remaining: 'unlimited', hours_used: 0 },
        subscription: { tier: null, status: 'none' } },
      { id: 2, email: 'user@example.com', wallet_address: null, is_admin: false,
        credits: { hours_remaining: 8, hours_used: 2 },
        subscription: { tier: 'creator', status: 'active', end_date: '2026-11-01' } },
    ]);
    expect(csv).toBe('\uFEFFid,email,wallet_address,is_admin,credits.hours_remaining,credits.hours_used,subscription.tier,subscription.status,subscription.end_date\r\n'
      + '1,,wallet,true,unlimited,0,,none,\r\n'
      + '2,user@example.com,,false,8,2,creator,active,2026-11-01\r\n');
  });

  it('preserves waitlist details and escapes commas, quotes, newlines and Unicode', () => {
    expect(buildRecordsCsv([{ id: 1, email: 'user@example.com', created_at: '2026-10-09',
      invited_at: null, beta_code: 'BETA', discount_code: 'SAVE',
      email_delivery_error: 'Delivery, "failed"\r\nRétry' }])).toBe(
      '\uFEFFid,email,created_at,invited_at,beta_code,discount_code,email_delivery_error\r\n'
      + '1,user@example.com,2026-10-09,,BETA,SAVE,"Delivery, ""failed""\r\nRétry"\r\n',
    );
  });
});
