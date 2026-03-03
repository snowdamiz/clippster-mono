# User to Organization Subscription Migration

## Overview

This document outlines the subscription flow when a user with an existing personal subscription (Starter/Creator/Pro) applies for and is approved to create an organization.

---

## Current Pricing Structure

### Personal Subscription Tiers
- **Starter**: $29.99/month, 600 credits (10 hours)
- **Creator**: $54.99/month, 1,800 credits (30 hours)
- **Pro**: $204.99/month, 9,000 credits (150 hours)

### Organization Subscription Tiers
- **Solo**: $149.99/month, 0 seats, 0 credits
- **Enterprise Base**: $349.99/month, 5 seats, 0 credits
- **Enterprise AI**: $549.99/month, 5 seats, 20,000 credits
- **Enterprise Unlimited**: $2,199.99/month, unlimited seats, 100,000 credits

### Organization Add-ons (require base subscription)

**With AI:**
- 5 Seats + AI: $299/month, 10,000 credits
- 10 Seats + AI: $479/month, 20,000 credits
- 20 Seats + AI: $689/month, 40,000 credits

**Without AI:**
- 5 Seats: $179/month
- 10 Seats: $239/month
- 20 Seats: $419/month

---

## Current Behavior (Problem)

When a Creator tier user applies and gets approved for an organization:

1. **Personal subscription remains active** - They continue paying for their personal tier
2. **Organization starts with NO subscription** - Prompted to select an org plan
3. **Result: Double billing** - User pays for BOTH subscriptions

### Example:
- Personal subscription: $54.99/month (Creator tier)
- Organization subscription: $349.99/month (Enterprise Base)
- **Total: $404.98/month** ❌

This creates a poor user experience where users are unexpectedly charged for two separate subscriptions.

---

## Proposed Solution: Automatic Migration with Proration

### Step-by-Step Flow

#### 1. User Initiates Organization Subscription
- User with active Creator tier ($54.99/month) selects Enterprise Base plan ($349.99/month)
- System detects they have an active personal subscription

#### 2. Calculate Proration Credit
```
Personal subscription: $54.99/month (paid on 1st of month)
Today's date: March 15th (15 days into billing cycle)
Days remaining: 16 days out of 30
Unused credit: ($54.99 / 30) × 16 = $29.33
```

#### 3. Cancel Personal Subscription
- Immediately cancel the personal Stripe subscription
- Mark as `cancel_at_period_end: false` (cancel now, not at period end)
- No refund issued - credit is applied forward

#### 4. Create Organization Subscription with Credit
```
Organization Enterprise Base plan: $349.99/month
Applied credit: -$29.33
First charge: $320.66

Next month (April 1st): Full $349.99/month charge
```

#### 5. Stripe Implementation
Using Stripe's built-in proration:
- Create new org subscription with `proration_behavior: 'create_prorations'`
- Add invoice item for the credit: `amount: -2933` (in cents)
- Stripe automatically calculates the prorated first payment

---

## Technical Implementation

### Backend Logic Flow

1. **Check for existing personal subscription**
   - Query `subscriptions` table for active user subscription
   - Get Stripe subscription ID and current period dates

2. **Calculate unused time value**
   - Get days remaining in current billing period
   - Calculate prorated amount: `(monthly_price / days_in_month) × days_remaining`

3. **Cancel personal subscription**
   - Call Stripe API: `Stripe.Subscription.delete(subscription_id)`
   - Update local DB: set `status: "canceled"`, `canceled_at: now()`

4. **Create org subscription with credit**
   - Create Stripe subscription for organization
   - Add invoice item with negative amount (the credit)
   - Stripe automatically applies credit to first invoice

5. **Handle edge cases**
   - If personal sub is yearly: calculate remaining months × monthly equivalent
   - If personal sub is higher tier than org: full credit still applies
   - If cancellation fails: rollback and show error, don't create org sub

### Database Changes Needed

Track the migration:
- Add `upgraded_from_personal_subscription_id` to `organization_subscriptions` table
- Add `upgraded_to_organization_id` to `subscriptions` table
- This creates an audit trail of the migration

---

## User Experience

### Confirmation Dialog
```
Upgrade to Enterprise Base Plan

Your current Creator plan ($54.99/month) will be canceled.
You have 16 days remaining in your billing cycle.

Credit applied: $29.33
Enterprise Base plan (first month): $349.99
You pay today: $320.66

Starting April 1st: $349.99/month

[Cancel] [Confirm Upgrade]
```

---

## Example Scenarios

### Scenario 1: Creator → Enterprise Base
**Current Subscription:**
- Creator tier: $54.99/month
- Paid on March 1st
- Today: March 15th (halfway through cycle)

**Calculation:**
```
Days remaining: 16 out of 30
Unused credit: ($54.99 / 30) × 16 = $29.33

Organization Enterprise Base: $349.99/month
Applied credit: -$29.33
First charge: $320.66

Next month (April 1st): Full $349.99/month
```

### Scenario 2: Pro → Enterprise AI
**Current Subscription:**
- Pro tier: $204.99/month
- Paid on March 1st
- Today: March 15th

**Calculation:**
```
Days remaining: 16 out of 30
Unused credit: ($204.99 / 30) × 16 = $109.33

Organization Enterprise AI: $549.99/month
Applied credit: -$109.33
First charge: $440.66

Next month: Full $549.99/month
```

### Scenario 3: Starter → Solo (Yearly Subscription)
**Current Subscription:**
- Starter tier: $204.99/year (yearly plan, 11 months paid upfront)
- Paid on January 1st
- Today: July 1st (6 months remaining)

**Calculation:**
```
Months remaining: 6 out of 12
Monthly equivalent: $204.99 / 11 = $18.64/month
Unused credit: $18.64 × 6 = $111.82

Organization Solo: $149.99/month
Applied credit: -$111.82
First charge: $38.17

Next month: Full $149.99/month
```

---

## Important Considerations

### 1. Credits vs Features
After canceling personal sub, user loses personal tier features immediately. Organization subscription must grant equivalent or better features.

### 2. Stripe Customer
Personal and org subscriptions likely use the same Stripe customer ID (the user's email). This makes proration tracking easier.

### 3. Yearly Subscriptions
If user has yearly personal sub, credit could be substantial and may cover the first month of org plan entirely or partially.

### 4. Downgrade Prevention
Don't allow "upgrading" to org if it would reduce their effective tier. Consider feature parity when determining valid migrations.

### 5. Optional: Keep Both Subscriptions
Give user option to keep both subscriptions if they want (some users might want personal + org access separately). This should be an explicit choice, not the default.

---

## Implementation Files

### Backend (Elixir)
- `server/lib/clippster_server/subscriptions.ex` - Personal subscription management
- `server/lib/clippster_server/organization_subscriptions.ex` - Org subscription management
- `server/lib/clippster_server_web/controllers/organization_subscription_controller.ex` - Org subscription API
- `server/lib/clippster_server_web/controllers/stripe_controller.ex` - Stripe webhook handling

### Frontend (Vue/TypeScript)
- `client/src/composables/useOrganizationSelector.ts` - Organization selection logic
- Billing/subscription UI components

### Database Migrations
- Add migration tracking columns to both subscription tables

---

## Key Principle

**One subscription per user/org entity, with automatic migration and credit application when upgrading from personal to organization tier.**
