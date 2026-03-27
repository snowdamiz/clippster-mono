# SUBSCRIPTION CANCELLATION AUDIT REPORT
**Date:** March 26, 2026
**Severity:** CRITICAL - Financial Impact
**Status:** Active Issue - Users Being Charged After Admin Cancellation

## EXECUTIVE SUMMARY

Two users who had their subscriptions cancelled by an admin were charged for another month. The root cause is that the admin cancellation function only schedules cancellation at period end (`cancel_at_period_end: true`) rather than immediately cancelling the Stripe subscription.

## ROOT CAUSE ANALYSIS

### Location of Issue
**File:** `server/lib/clippster_server/subscriptions.ex`
**Function:** `cancel_subscription/1` (lines 300-350)

### The Problem

When an admin cancels a user's subscription via the admin dashboard:

1. Admin calls: `POST /admin/subscriptions/cancel` with `user_id`
2. This calls: `Subscriptions.cancel_subscription(user_id)`
3. The function calls Stripe with: `Stripe.Subscription.update(subscription_id, %{cancel_at_period_end: true})`

**This is WRONG for admin-initiated cancellations.**

`cancel_at_period_end: true` tells Stripe:
- ✅ Mark the subscription as "will cancel"
- ❌ **CONTINUE CHARGING THE CUSTOMER** at each renewal period
- ❌ Only stop billing when the current period ends

### Expected Behavior for Admin Cancellation

When an admin cancels a subscription, it should:
1. **IMMEDIATELY cancel the subscription in Stripe** (no more charges)
2. Update the local database to reflect cancellation
3. Optionally allow the user to retain access until the current period end

### What Actually Happened

1. Admin cancelled subscriptions for 2 users
2. Database was updated to status: "cancelled"
3. Stripe subscription was set to `cancel_at_period_end: true`
4. **Stripe continued to charge the users at the next billing cycle**
5. Users were charged another month despite admin cancellation

## CODE REVIEW

### Current Implementation (BROKEN)

```elixir:server/lib/clippster_server/subscriptions.ex
def cancel_subscription(user_id) do
  Repo.transaction(fn ->
    user = Repo.get!(User, user_id)

    # Cancel in Stripe if it's a Stripe subscription
    if user.stripe_subscription_id && user.subscription_renewal_method == "stripe" do
      # ❌ PROBLEM: This schedules cancellation but doesn't stop billing
      case Stripe.Subscription.update(user.stripe_subscription_id, %{cancel_at_period_end: true}) do
        {:ok, _} ->
          IO.puts("[Subscriptions] Cancelled Stripe subscription...")
        {:error, _} ->
          IO.puts("[Subscriptions] Failed to cancel...")
          # Continue anyway to mark as cancelled in DB
      end
    end

    # Update database
    {:ok, updated_user} =
      user
      |> User.subscription_changeset(%{subscription_status: "cancelled"})
      |> Repo.update()

    updated_user
  end)
end
```

### Affected Functions

1. **`Subscriptions.cancel_subscription/1`** - Used by both:
   - Admin cancellation: `AdminController.cancel_user_subscription/2`
   - User self-cancellation: `SubscriptionController.cancel/2`

2. **Both paths have the same issue** - they don't immediately cancel in Stripe

## ADDITIONAL FINDINGS

### Webhook Handler Partially Correct

The webhook handler at `server/lib/clippster_server_web/controllers/stripe_controller.ex` DOES handle proper cancellation:

```elixir:server/lib/clippster_server_web/controllers/stripe_controller.ex
# Handle subscription update (tier change)
defp handle_event(%{type: "customer.subscription.updated", data: %{object: subscription}}) do
  cancel_at_period_end = safe_get(subscription, "cancel_at_period_end")
  
  cond do
    cancel_at_period_end == true ->
      # Mark as cancelled when Stripe sends this event
      case Subscriptions.cancel_subscription(user.id) do
        {:ok, _} ->
          IO.puts("[Stripe Webhook] Marked subscription as cancelled for user...")
      end
    # ...
  end
end
```

However, this creates a circular dependency - the function that's supposed to cancel in Stripe is being called BY the Stripe webhook!

### The Real Issue: Two Different Cancellation Scenarios

There are TWO different cancellation scenarios that need different handling:

#### Scenario 1: User-Initiated Cancellation (Current Behavior is OK)
- User cancels their own subscription
- They should retain access until period end
- Stripe should be set to `cancel_at_period_end: true`
- Stripe stops charging at end of current period

#### Scenario 2: Admin-Initiated Cancellation (BROKEN)
- Admin cancels a user's subscription
- Should **immediately stop all future charges in Stripe**
- User may or may not retain access (business decision)
- Stripe subscription should be **fully cancelled** (not scheduled)

## IMPACT ASSESSMENT

### Financial Impact
- **2 users charged incorrectly** (so far identified)
- Amount: Variable based on subscription tier ($24.99 - $199.99/month)
- Potential for more affected users if admin has cancelled other subscriptions

### Compliance/Legal Risk
- Users may dispute charges with credit card companies
- Potential violation of payment processing regulations
- Trust/reputation damage

### Database vs Stripe Mismatch
- Database shows: `subscription_status: "cancelled"`
- Stripe shows: Subscription still active with `cancel_at_period_end: true`
- This mismatch causes the issue

## RECOMMENDED FIXES

### Immediate Actions (Do First)

1. **Audit all "cancelled" subscriptions**
   ```sql
   SELECT id, email, subscription_status, stripe_subscription_id, subscription_end_date
   FROM users
   WHERE subscription_status = 'cancelled'
     AND stripe_subscription_id IS NOT NULL
     AND subscription_renewal_method = 'stripe';
   ```

2. **Manually cancel active Stripe subscriptions** for affected users:
   - Go to Stripe dashboard
   - Find subscription IDs for users with `cancelled` status
   - Check if subscription is still active in Stripe
   - If active, **cancel immediately** (not at period end)

3. **Issue refunds** to the 2 affected users

### Code Changes Required

#### Fix 1: Create Separate Admin Cancellation Function

Create a new function: `admin_cancel_subscription/1`

```elixir
@doc """
Admin-initiated immediate cancellation.
Cancels the subscription immediately in Stripe (stops all future charges).
User loses access immediately or can be configured to retain access until period end.
"""
def admin_cancel_subscription(user_id) do
  Repo.transaction(fn ->
    user = Repo.get!(User, user_id)

    unless user.subscription_status in ["active", "cancelled"] do
      Repo.rollback(:not_active)
    end

    # Immediately cancel in Stripe - no more charges
    if user.stripe_subscription_id && user.subscription_renewal_method == "stripe" do
      case Stripe.Subscription.delete(user.stripe_subscription_id) do
        {:ok, _} ->
          IO.puts(
            "[Subscriptions] IMMEDIATELY cancelled Stripe subscription #{user.stripe_subscription_id} for user #{user_id}"
          )

        {:error, %Stripe.Error{message: message}} ->
          IO.puts(
            "[Subscriptions] Failed to immediately cancel Stripe subscription for user #{user_id}: #{message}"
          )
          # Still rollback - we don't want DB to be out of sync
          Repo.rollback({:stripe_error, message})

        {:error, reason} ->
          IO.puts(
            "[Subscriptions] Failed to immediately cancel Stripe subscription for user #{user_id}: #{inspect(reason)}"
          )
          Repo.rollback({:stripe_error, reason})
      end
    end

    # Update user status to cancelled
    {:ok, updated_user} =
      user
      |> User.subscription_changeset(%{
        subscription_status: "cancelled",
        # Optionally: expire immediately instead of at period end
        # subscription_end_date: DateTime.utc_now()
      })
      |> Repo.update()

    # Update active subscription record
    Subscription
    |> where([s], s.user_id == ^user_id)
    |> where([s], s.status == "active")
    |> Repo.update_all(set: [status: "cancelled"])

    IO.puts(
      "[Subscriptions] Admin cancelled subscription for user #{user_id}"
    )

    updated_user
  end)
end
```

#### Fix 2: Update Admin Controller

```elixir
def cancel_user_subscription(conn, %{"user_id" => user_id_string}) do
  case parse_integer(user_id_string) do
    {:ok, user_id} ->
      # Use admin-specific cancellation that immediately stops Stripe billing
      case Subscriptions.admin_cancel_subscription(user_id) do
        {:ok, _user} ->
          subscription_info = Subscriptions.get_subscription_status(user_id)

          json(conn, %{
            success: true,
            message: "Successfully cancelled subscription for user (immediate - no future charges)",
            subscription: subscription_info
          })

        {:error, :not_active} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "User does not have an active subscription"})

        {:error, {:stripe_error, message}} ->
          conn
          |> put_status(502)
          |> json(%{success: false, error: "Failed to cancel in Stripe: #{message}"})

        {:error, reason} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to cancel subscription: #{inspect(reason)}"})
      end

    {:error, _} ->
      conn
      |> put_status(400)
      |> json(%{success: false, error: "Invalid user ID"})
  end
end
```

#### Fix 3: Keep User Self-Cancellation as Is

The existing `cancel_subscription/1` function is actually CORRECT for user-initiated cancellation:
- Users should cancel at period end
- They keep access until the end date
- This is standard industry practice

So rename it for clarity:

```elixir
@doc """
User-initiated cancellation at period end.
Access continues until end_date, then no more charges.
"""
def user_cancel_subscription_at_period_end(user_id) do
  # ... existing implementation
end
```

### Testing Plan

1. **Test Admin Immediate Cancellation**
   - Create test user with active Stripe subscription
   - Admin cancels via dashboard
   - Verify Stripe subscription is immediately cancelled
   - Verify no future charges occur

2. **Test User Self-Cancellation**
   - Create test user with active subscription
   - User cancels their own subscription
   - Verify access continues until period end
   - Verify Stripe subscription is set to cancel at period end
   - Verify no charges occur after period end

3. **Test Webhook Handling**
   - Verify `customer.subscription.deleted` webhook properly expires subscription
   - Verify `customer.subscription.updated` webhook handles `cancel_at_period_end` correctly

## MONITORING & PREVENTION

### Add Monitoring

1. **Stripe <-> Database Sync Check**
   - Weekly job to compare Stripe subscription status with database
   - Alert on mismatches

2. **Cancelled Subscription Alert**
   - When admin cancels, verify Stripe cancellation within 1 minute
   - Alert if Stripe still shows active subscription

3. **Charge After Cancellation Alert**
   - Monitor for any charges to users with `cancelled` status
   - Immediate alert for investigation

### Documentation Updates

1. Update admin documentation to clarify:
   - Admin cancellation = immediate, stops all future charges
   - User cancellation = at period end, retains access

2. Add clear UI messaging in admin dashboard:
   - "Cancel Now (stops billing immediately)" vs "Cancel at Period End"

## ACTION ITEMS

### Priority 1 (Immediate - Next 24 hours)
- [ ] Audit all users with `cancelled` status and check Stripe
- [ ] Manually cancel any still-active Stripe subscriptions
- [ ] Refund the 2 affected users
- [ ] Document which users were affected and amounts

### Priority 2 (This Week)
- [ ] Implement `admin_cancel_subscription/1` function
- [ ] Update `AdminController.cancel_user_subscription/2`
- [ ] Add comprehensive tests
- [ ] Deploy to production

### Priority 3 (Next 2 Weeks)
- [ ] Add monitoring for Stripe/DB sync
- [ ] Update admin UI with clearer messaging
- [ ] Document the fix and new behavior

## QUESTIONS FOR BUSINESS DECISION

1. **When admin cancels, should user retain access until period end?**
   - Option A: Immediate loss of access + immediate Stripe cancellation
   - Option B: Keep access until period end + immediate Stripe cancellation
   - **Recommendation:** Option B (user keeps access they've paid for, but no future charges)

2. **Should we offer partial refunds for the current period?**
   - If admin cancels mid-month, refund prorated amount?
   - **Recommendation:** Yes, for goodwill

3. **Should we distinguish between "soft cancel" (at period end) vs "hard cancel" (immediate)?**
   - Add two separate admin actions?
   - **Recommendation:** Default to immediate Stripe cancellation, but allow access until period end

## ADDITIONAL CONTEXT

### Related Files
- `server/lib/clippster_server/subscriptions.ex` - Core subscription logic
- `server/lib/clippster_server_web/controllers/admin_controller.ex` - Admin endpoints
- `server/lib/clippster_server_web/controllers/subscription_controller.ex` - User endpoints
- `server/lib/clippster_server_web/controllers/stripe_controller.ex` - Webhook handlers

### Stripe API References
- `Stripe.Subscription.update(id, %{cancel_at_period_end: true})` - Schedules cancellation (OLD/WRONG)
- `Stripe.Subscription.cancel(id)` - Immediately cancels subscription (NEW/CORRECT)

---

**Report Compiled By:** AI Assistant
**Date:** March 26, 2026
**Status:** Ready for Review & Action
