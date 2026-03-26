# IMMEDIATE ACTION REQUIRED - Before Deploying Fix

**CRITICAL:** These steps MUST be completed before deploying the code fix.

---

## 1. AUDIT CANCELLED SUBSCRIPTIONS (Run These SQL Queries)

Connect to your production database and run these queries:

### Query 1: Find Cancelled Users
```sql
SELECT 
  id, 
  email, 
  subscription_status, 
  stripe_subscription_id, 
  subscription_end_date, 
  subscription_tier,
  subscription_start_date
FROM users
WHERE subscription_status = 'cancelled'
  AND stripe_subscription_id IS NOT NULL
  AND subscription_renewal_method = 'stripe'
ORDER BY subscription_end_date DESC;
```

### Query 2: Find Cancelled Organizations
```sql
SELECT 
  id, 
  name, 
  subscription_status, 
  stripe_subscription_id,
  subscription_end_date, 
  subscription_tier,
  subscription_start_date
FROM organizations
WHERE subscription_status = 'cancelled'
  AND stripe_subscription_id IS NOT NULL
  AND subscription_renewal_method = 'stripe'
ORDER BY subscription_end_date DESC;
```

### Query 3: Find Cancelled Add-ons
```sql
SELECT 
  a.id, 
  a.organization_id, 
  o.name as org_name, 
  a.addon_tier, 
  a.stripe_subscription_id, 
  a.status,
  a.end_date
FROM organization_subscription_addons a
JOIN organizations o ON o.id = a.organization_id
WHERE a.status = 'cancelled'
  AND a.stripe_subscription_id IS NOT NULL
ORDER BY a.end_date DESC;
```

**Save the results to CSV files for your records!**

---

## 2. MANUAL STRIPE CLEANUP

For EACH result from the queries above:

1. **Log into Stripe Dashboard** → https://dashboard.stripe.com/

2. **Search for Subscription:**
   - Use the search bar
   - Search for the `stripe_subscription_id` from your query results
   - Example: `sub_1ABC123xyz...`

3. **Check Subscription Status:**
   - Is it showing as "Active"?
   - Is it showing as "Scheduled to cancel at period end"?
   - Is it already cancelled/expired?

4. **If Active or Scheduled to Cancel:**
   - Click on the subscription
   - Click "Cancel subscription" button
   - **SELECT: "Cancel immediately"** (NOT "Cancel at period end")
   - Add note: "Cancelled due to billing bug - user already requested cancellation"
   - Confirm cancellation

5. **Document Each Cancellation:**
   Create a spreadsheet with:
   - Date cancelled
   - User email / Org name
   - Subscription ID
   - Whether it was still active
   - Any charges made after cancellation date

---

## 3. IDENTIFY USERS WHO WERE CHARGED AFTER CANCELLATION

Run this query to find users charged after their cancellation:

```sql
-- This finds users where subscription_end_date has already passed
-- but they're marked as cancelled (meaning they were likely charged)
SELECT 
  id,
  email,
  subscription_status,
  stripe_subscription_id,
  subscription_end_date,
  subscription_tier,
  EXTRACT(EPOCH FROM (NOW() - subscription_end_date))/86400 as days_past_end_date
FROM users
WHERE subscription_status = 'cancelled'
  AND stripe_subscription_id IS NOT NULL
  AND subscription_renewal_method = 'stripe'
  AND subscription_end_date < NOW()
ORDER BY subscription_end_date DESC;
```

For organizations:
```sql
SELECT 
  id,
  name,
  subscription_status,
  stripe_subscription_id,
  subscription_end_date,
  subscription_tier,
  EXTRACT(EPOCH FROM (NOW() - subscription_end_date))/86400 as days_past_end_date
FROM organizations
WHERE subscription_status = 'cancelled'
  AND stripe_subscription_id IS NOT NULL
  AND subscription_renewal_method = 'stripe'
  AND subscription_end_date < NOW()
ORDER BY subscription_end_date DESC;
```

---

## 4. CALCULATE REFUNDS

For each user/org identified in step 3:

1. **Go to Stripe Dashboard → Invoices**

2. **Find invoices for this customer after their cancellation date**

3. **Calculate total amount charged after cancellation:**
   - Look at invoice dates
   - Compare to the date they cancelled (check database or logs)
   - Sum up all charges that occurred AFTER cancellation

4. **Create refund spreadsheet:**
   ```
   | Email/Org | Subscription ID | Cancellation Date | Charges After Cancel | Refund Amount | Status |
   |-----------|-----------------|-------------------|---------------------|---------------|--------|
   | user@example.com | sub_123 | 2026-02-15 | 2 months x $49.99 | $99.98 | Pending |
   ```

---

## 5. PROCESS REFUNDS

For each refund:

1. **In Stripe Dashboard:**
   - Go to Payments
   - Find the incorrect charge
   - Click "Refund"
   - Select "Full refund" or enter partial amount
   - Add reason: "Charged after cancellation due to system error"
   - Process refund

2. **Send Apology Email:**

```
Subject: Apology and Refund for Billing Error

Dear [Customer Name],

We discovered a technical issue in our billing system that resulted in you being 
charged for your subscription after you cancelled it on [DATE].

We sincerely apologize for this error. We have:
1. Fixed the technical issue to prevent this from happening again
2. Cancelled your subscription in our payment processor
3. Processed a full refund of $[AMOUNT] for the incorrect charges

The refund should appear in your account within 5-10 business days depending on 
your bank.

Again, we deeply apologize for this error and any inconvenience it may have caused.

If you have any questions or concerns, please don't hesitate to reach out.

Best regards,
[Your Name]
Clippster Team
```

3. **Update your refund spreadsheet with "Completed" status**

---

## 6. CHECKLIST BEFORE DEPLOYING

- [ ] SQL queries run and results saved to CSV
- [ ] All active Stripe subscriptions manually cancelled
- [ ] Refund spreadsheet created with all affected users/orgs
- [ ] All refunds processed in Stripe
- [ ] Apology emails sent to all affected customers
- [ ] Documentation completed (who was affected, amounts, dates)
- [ ] Team briefed on the fix and testing plan

---

## 7. AFTER DEPLOYMENT - TESTING

Immediately after deploying the fix:

### Test 1: User Self-Cancellation
```
1. Create test user with Stripe subscription
2. User cancels their subscription
3. Check Stripe dashboard - subscription should be "Cancelled" immediately
4. Verify NO "scheduled to cancel" status
5. Check database - status = "cancelled"
6. User should still have access until end_date
```

### Test 2: Admin User Cancellation
```
1. Create test user with Stripe subscription
2. Admin cancels user subscription via admin dashboard
3. Check Stripe dashboard - subscription should be "Cancelled" immediately
4. Verify NO "scheduled to cancel" status
5. Check database - status = "cancelled"
```

### Test 3: Org Owner Cancellation
```
1. Create test org with Stripe subscription + 2 add-ons
2. Org owner cancels subscription
3. Check Stripe dashboard:
   - Base subscription = "Cancelled" immediately
   - Add-on 1 subscription = "Cancelled" immediately
   - Add-on 2 subscription = "Cancelled" immediately
4. Verify NO "scheduled to cancel" statuses
5. Check database - all marked as cancelled
```

### Test 4: Admin Org Cancellation
```
1. Create test org with Stripe subscription + add-ons
2. Admin cancels org subscription via admin dashboard
3. Check Stripe dashboard - all subscriptions cancelled immediately
4. Check database - all marked as cancelled
```

---

## 8. MONITORING AFTER DEPLOYMENT

For the first week after deployment:

1. **Daily Check:**
   - Run the SQL queries to see if any new subscriptions are marked "cancelled"
   - Verify those subscriptions are actually cancelled in Stripe

2. **Check Stripe Events:**
   - Monitor for `customer.subscription.deleted` events
   - Verify they match your cancellations

3. **Check Error Logs:**
   - Look for any Stripe API errors
   - Investigate any failures immediately

---

## ESTIMATED TIME

- SQL queries: 10 minutes
- Stripe manual cleanup: 5-10 minutes per subscription
- Refund calculation: 15-30 minutes
- Process refunds: 5 minutes per refund
- Send emails: 5 minutes per customer
- Testing after deploy: 30 minutes

**Total: 2-4 hours depending on number of affected subscriptions**

---

## QUESTIONS TO ANSWER BEFORE PROCEEDING

1. **How many users/orgs are in "cancelled" status?**
   - Run Query 1 and 2 above

2. **How many were actually charged after cancellation?**
   - Run Query 3 above
   - Check Stripe invoices

3. **What's the total refund amount?**
   - Calculate from Stripe invoices

4. **Who will handle the manual Stripe cleanup?**
   - Assign to team member with Stripe access

5. **Who will process refunds?**
   - Assign to team member with Stripe access

6. **Who will send apology emails?**
   - Assign to customer support or founder

---

## READY TO DEPLOY?

✅ All SQL queries run  
✅ All Stripe subscriptions manually cancelled  
✅ All refunds calculated  
✅ All refunds processed  
✅ All apology emails sent  
✅ Team briefed and ready to test  

**If all checkboxes are ticked, you're ready to deploy the fix!**

---

**This document should be completed BEFORE deploying the code changes.**
