defmodule ClippsterServer.Subscriptions do
  @moduledoc """
  The Subscriptions context - manages user subscriptions.

  Subscription Tiers (1 credit = 1 minute):
  - Starter: $24.99/month, 600 credits (10 hours)
  - Creator: $49.99/month, 1800 credits (30 hours)
  - Pro: $199.99/month, 9000 credits (150 hours)

  Business Rules:
  - Users must have an active subscription to use the app
  - Credits are granted on subscription start and each renewal
  - Credits roll over (don't expire with subscription)
  - Org-created users don't need personal subscriptions
  - Admins have unlimited access
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Credits
  alias ClippsterServer.Subscriptions.Subscription

  # Subscription duration: 30 days
  @subscription_days 30

  # Subscription tiers with pricing and credits (1 credit = 1 minute)
  @subscription_tiers %{
    "basic" => %{monthly_credits: 0, usd: 12.99, name: "Basic"},
    "starter" => %{monthly_credits: 600, usd: 24.99, name: "Starter"},
    "creator" => %{monthly_credits: 1800, usd: 49.99, name: "Creator"},
    "pro" => %{monthly_credits: 9000, usd: 199.99, name: "Pro"}
  }

  @doc """
  Gets the subscription tier configurations.
  """
  def get_subscription_tiers, do: @subscription_tiers

  @doc """
  Gets info for a specific subscription tier.
  """
  def get_tier_info(tier) when is_binary(tier) do
    Map.get(@subscription_tiers, tier)
  end

  @doc """
  Gets the subscription days duration.
  """
  def get_subscription_days, do: @subscription_days

  # ============================================================================
  # Subscription Creation
  # ============================================================================

  @doc """
  Creates a new subscription for a user via Stripe.
  Grants the tier's monthly credits and activates subscription.
  """
  def create_stripe_subscription(
        user_id,
        tier,
        stripe_subscription_id,
        stripe_customer_id \\ nil,
        billing_interval \\ "monthly"
      ) do
    tier_info = get_tier_info(tier)

    unless tier_info do
      {:error, :invalid_tier}
    else
      Repo.transaction(fn ->
        user = Repo.get!(User, user_id)

        # Cancel any pre-existing Stripe subscription to prevent duplicate recurring charges.
        # This handles the case where a user subscribed multiple times during testing or
        # re-subscribed after a failed attempt — the old subscription must be killed in Stripe
        # or it will keep billing silently (the DB no longer tracks it after this update).
        if user.stripe_subscription_id && user.subscription_renewal_method == "stripe" &&
             user.stripe_subscription_id != stripe_subscription_id do
          case Stripe.Subscription.cancel(user.stripe_subscription_id) do
            {:ok, _} ->
              IO.puts(
                "[Subscriptions] Cancelled previous Stripe subscription #{user.stripe_subscription_id} for user #{user_id} before creating new one"
              )

            {:error, reason} ->
              IO.puts(
                "[Subscriptions] Warning: Could not cancel previous Stripe subscription #{user.stripe_subscription_id} for user #{user_id}: #{inspect(reason)}"
              )
          end
        end

        start_date = DateTime.utc_now() |> DateTime.truncate(:second)
        subscription_days = if billing_interval == "yearly", do: 365, else: @subscription_days
        end_date = DateTime.add(start_date, subscription_days, :day)

        # Yearly subscribers get 12 months of credits upfront; monthly gets 1 month
        credits_to_grant =
          if billing_interval == "yearly",
            do: tier_info.monthly_credits * 12,
            else: tier_info.monthly_credits

        amount_usd = if billing_interval == "yearly", do: tier_info.usd * 11, else: tier_info.usd

        # Update user subscription fields
        {:ok, updated_user} =
          user
          |> User.subscription_changeset(%{
            subscription_status: "active",
            subscription_tier: tier,
            subscription_start_date: start_date,
            subscription_end_date: end_date,
            subscription_renewal_method: "stripe",
            stripe_subscription_id: stripe_subscription_id,
            stripe_customer_id: stripe_customer_id || user.stripe_customer_id
          })
          |> Repo.update()

        # Create subscription history record
        {:ok, subscription} =
          %Subscription{}
          |> Subscription.create_changeset(%{
            user_id: user_id,
            status: "active",
            subscription_tier: tier,
            start_date: start_date,
            end_date: end_date,
            hours_included: Decimal.new("0"),
            credits_granted: Decimal.new(to_string(credits_to_grant)),
            payment_method: "stripe",
            stripe_subscription_id: stripe_subscription_id,
            amount_usd: Decimal.new(to_string(amount_usd))
          })
          |> Repo.insert()

        # Grant credits
        {:ok, _} = Credits.add_credits(user_id, credits_to_grant)

        IO.puts(
          "[Subscriptions] Created #{tier} (#{billing_interval}) subscription for user #{user_id}, granted #{credits_to_grant} credits"
        )

        %{user: updated_user, subscription: subscription}
      end)
    end
  end

  @doc """
  Creates a subscription via crypto payment.
  Similar to Stripe but with crypto payment method.
  """
  def create_crypto_subscription(user_id, tier, tx_signature, billing_interval \\ "monthly") do
    tier_info = get_tier_info(tier)

    unless tier_info do
      {:error, :invalid_tier}
    else
      Repo.transaction(fn ->
        user = Repo.get!(User, user_id)

        start_date = DateTime.utc_now() |> DateTime.truncate(:second)
        subscription_days = if billing_interval == "yearly", do: 365, else: @subscription_days
        end_date = DateTime.add(start_date, subscription_days, :day)

        # Yearly subscribers get 12 months of credits upfront; monthly gets 1 month
        credits_to_grant =
          if billing_interval == "yearly",
            do: tier_info.monthly_credits * 12,
            else: tier_info.monthly_credits

        amount_usd = if billing_interval == "yearly", do: tier_info.usd * 11, else: tier_info.usd

        # Update user subscription fields
        {:ok, updated_user} =
          user
          |> User.subscription_changeset(%{
            subscription_status: "active",
            subscription_tier: tier,
            subscription_start_date: start_date,
            subscription_end_date: end_date,
            subscription_renewal_method: "crypto"
          })
          |> Repo.update()

        # Create subscription history record
        {:ok, subscription} =
          %Subscription{}
          |> Subscription.create_changeset(%{
            user_id: user_id,
            status: "active",
            subscription_tier: tier,
            start_date: start_date,
            end_date: end_date,
            hours_included: Decimal.new("0"),
            credits_granted: Decimal.new(to_string(credits_to_grant)),
            payment_method: "crypto",
            stripe_subscription_id: "crypto_#{tx_signature}",
            amount_usd: Decimal.new(to_string(amount_usd))
          })
          |> Repo.insert()

        # Grant credits
        {:ok, _} = Credits.add_credits(user_id, credits_to_grant)

        IO.puts(
          "[Subscriptions] Created #{tier} (#{billing_interval}) crypto subscription for user #{user_id}, granted #{credits_to_grant} credits"
        )

        %{user: updated_user, subscription: subscription}
      end)
    end
  end

  # ============================================================================
  # Subscription Renewal
  # ============================================================================

  @doc """
  Renews a subscription (called from Stripe webhook on invoice.payment_succeeded).
  Extends end_date and grants monthly credits.

  Options:
    * `:period_start_unix` - Unix seconds for the new period start (from invoice
      line item). Used as an idempotency anchor: if a history row already exists
      with `start_date` within ±1h of this timestamp, returns `{:ok, :already_renewed}`
      so resent/retried webhooks don't double-grant credits.
  """
  def renew_subscription(user_id, opts \\ []) do
    period_start_unix = Keyword.get(opts, :period_start_unix)

    if period_start_unix && already_renewed_for_period?(user_id, period_start_unix) do
      IO.puts(
        "[Subscriptions] User #{user_id} already renewed for period_start_unix=#{period_start_unix}, skipping"
      )

      {:ok, :already_renewed}
    else
      do_renew_subscription(user_id, period_start_unix)
    end
  end

  defp do_renew_subscription(user_id, period_start_unix) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)
      tier = user.subscription_tier
      tier_info = get_tier_info(tier)

      unless tier_info do
        Repo.rollback(:invalid_tier)
      end

      # Prefer Stripe's actual period_start over our local +30d math so DB stays
      # aligned with Stripe's billing cycle even if a webhook is delayed.
      current_end = user.subscription_end_date || DateTime.utc_now()

      new_start =
        cond do
          is_integer(period_start_unix) ->
            DateTime.from_unix!(period_start_unix)

          DateTime.compare(DateTime.utc_now(), current_end) == :gt ->
            # Subscription was expired, start fresh
            DateTime.utc_now() |> DateTime.truncate(:second)

          true ->
            # Still active, use current end as new start
            current_end
        end

      new_end = DateTime.add(new_start, @subscription_days, :day)

      # Decrement admin discount counter and clear when exhausted
      discount_updates =
        case user.admin_discount_months_remaining do
          nil ->
            %{}

          n when n <= 1 ->
            # Last discounted month just renewed — clear all discount fields
            IO.puts(
              "[Subscriptions] Admin discount exhausted for user #{user_id}, clearing discount fields"
            )

            %{
              admin_discount_months_remaining: nil,
              admin_discount_percent: nil,
              admin_discount_applied_at: nil,
              admin_discount_stripe_coupon_id: nil
            }

          n ->
            %{admin_discount_months_remaining: n - 1}
        end

      # Update user subscription
      {:ok, updated_user} =
        user
        |> User.subscription_changeset(
          Map.merge(
            %{
              subscription_status: "active",
              subscription_end_date: new_end
            },
            discount_updates
          )
        )
        |> Repo.update()

      # Create subscription history record
      {:ok, subscription} =
        %Subscription{}
        |> Subscription.create_changeset(%{
          user_id: user_id,
          status: "active",
          subscription_tier: tier,
          start_date: new_start,
          end_date: new_end,
          hours_included: Decimal.new("0"),
          credits_granted: Decimal.new(to_string(tier_info.monthly_credits)),
          payment_method: user.subscription_renewal_method || "stripe",
          stripe_subscription_id: user.stripe_subscription_id,
          amount_usd: Decimal.new(to_string(tier_info.usd))
        })
        |> Repo.insert()

      # Grant monthly credits
      {:ok, _} = Credits.add_credits(user_id, tier_info.monthly_credits)

      IO.puts(
        "[Subscriptions] Renewed #{tier} subscription for user #{user_id}, granted #{tier_info.monthly_credits} credits"
      )

      %{user: updated_user, subscription: subscription}
    end)
  end

  # Returns true if a subscription history row already exists with start_date
  # close to the given period_start (within ±1h). Used to make renewal idempotent
  # against webhook retries / dashboard "Resend" actions.
  defp already_renewed_for_period?(user_id, period_start_unix)
       when is_integer(period_start_unix) do
    target = DateTime.from_unix!(period_start_unix)
    lower = DateTime.add(target, -3600, :second)
    upper = DateTime.add(target, 3600, :second)

    Subscription
    |> where([s], s.user_id == ^user_id)
    |> where([s], s.start_date >= ^lower and s.start_date <= ^upper)
    |> Repo.exists?()
  end

  defp already_renewed_for_period?(_user_id, _period_start_unix), do: false

  # ============================================================================
  # Subscription Cancellation & Expiration
  # ============================================================================

  @doc """
  Cancels a subscription (user-initiated).
  IMMEDIATELY cancels billing in Stripe to prevent future charges.
  User retains access until end_date.
  """
  def cancel_subscription(user_id) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)

      unless user.subscription_status in ["active", "cancelled"] do
        Repo.rollback(:not_active)
      end

      # IMMEDIATELY cancel in Stripe to stop all future charges
      if user.stripe_subscription_id && user.subscription_renewal_method == "stripe" do
        case Stripe.Subscription.cancel(user.stripe_subscription_id) do
          {:ok, _} ->
            IO.puts(
              "[Subscriptions] IMMEDIATELY cancelled Stripe subscription #{user.stripe_subscription_id} for user #{user_id} - no future charges"
            )

          {:error, %Stripe.Error{message: message}} ->
            IO.puts(
              "[Subscriptions] Failed to cancel Stripe subscription for user #{user_id}: #{message}"
            )

          # Continue anyway to mark as cancelled in DB

          {:error, reason} ->
            IO.puts(
              "[Subscriptions] Failed to cancel Stripe subscription for user #{user_id}: #{inspect(reason)}"
            )

            # Continue anyway to mark as cancelled in DB
        end
      end

      # Update user status to cancelled
      {:ok, updated_user} =
        user
        |> User.subscription_changeset(%{
          subscription_status: "cancelled"
        })
        |> Repo.update()

      # Update active subscription record
      Subscription
      |> where([s], s.user_id == ^user_id)
      |> where([s], s.status == "active")
      |> Repo.update_all(set: [status: "cancelled"])

      IO.puts(
        "[Subscriptions] Cancelled subscription for user #{user_id}, access until #{user.subscription_end_date}"
      )

      updated_user
    end)
  end

  @doc """
  Admin-initiated immediate cancellation.
  IMMEDIATELY cancels the subscription in Stripe (stops all future charges).
  User optionally retains access until period end based on database end_date.
  """
  def admin_cancel_subscription(user_id) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)

      unless user.subscription_status in ["active", "cancelled"] do
        Repo.rollback(:not_active)
      end

      # IMMEDIATELY cancel in Stripe - no more charges
      if user.stripe_subscription_id && user.subscription_renewal_method == "stripe" do
        case Stripe.Subscription.cancel(user.stripe_subscription_id) do
          {:ok, _} ->
            IO.puts(
              "[Subscriptions] ADMIN: IMMEDIATELY cancelled Stripe subscription #{user.stripe_subscription_id} for user #{user_id} - no future charges"
            )

          {:error, %Stripe.Error{message: message}} ->
            IO.puts(
              "[Subscriptions] ADMIN: Failed to cancel Stripe subscription for user #{user_id}: #{message}"
            )

            # For admin cancellations, we should rollback if Stripe fails
            # to ensure database doesn't get out of sync
            Repo.rollback({:stripe_error, message})

          {:error, reason} ->
            IO.puts(
              "[Subscriptions] ADMIN: Failed to cancel Stripe subscription for user #{user_id}: #{inspect(reason)}"
            )

            Repo.rollback({:stripe_error, reason})
        end
      end

      # Update user status to cancelled
      {:ok, updated_user} =
        user
        |> User.subscription_changeset(%{
          subscription_status: "cancelled"
        })
        |> Repo.update()

      # Update active subscription record
      Subscription
      |> where([s], s.user_id == ^user_id)
      |> where([s], s.status == "active")
      |> Repo.update_all(set: [status: "cancelled"])

      IO.puts("[Subscriptions] ADMIN: Cancelled subscription for user #{user_id}")

      updated_user
    end)
  end

  @doc """
  Reactivates an expired or cancelled subscription.
  Called when payment succeeds but subscription was marked expired/cancelled.
  Extends end_date from now and sets status to active.
  """
  def reactivate_subscription(user_id) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)
      tier = user.subscription_tier
      tier_info = get_tier_info(tier)

      unless tier_info do
        Repo.rollback(:invalid_tier)
      end

      start_date = DateTime.utc_now() |> DateTime.truncate(:second)
      end_date = DateTime.add(start_date, @subscription_days, :day)

      # Update user subscription to active
      {:ok, updated_user} =
        user
        |> User.subscription_changeset(%{
          subscription_status: "active",
          subscription_start_date: start_date,
          subscription_end_date: end_date
        })
        |> Repo.update()

      # Create subscription history record
      {:ok, _subscription} =
        %Subscription{}
        |> Subscription.create_changeset(%{
          user_id: user_id,
          status: "active",
          subscription_tier: tier,
          start_date: start_date,
          end_date: end_date,
          hours_included: Decimal.new("0"),
          credits_granted: Decimal.new(to_string(tier_info.monthly_credits)),
          payment_method: user.subscription_renewal_method || "stripe",
          stripe_subscription_id: user.stripe_subscription_id,
          amount_usd: Decimal.new(to_string(tier_info.usd))
        })
        |> Repo.insert()

      # Grant monthly credits
      {:ok, _} = Credits.add_credits(user_id, tier_info.monthly_credits)

      IO.puts(
        "[Subscriptions] Reactivated #{tier} subscription for user #{user_id}, granted #{tier_info.monthly_credits} credits"
      )

      updated_user
    end)
  end

  @doc """
  Expires a subscription (called when end_date passes or payment fails).
  """
  def expire_subscription(user_id) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)

      # Update user status to expired
      {:ok, updated_user} =
        user
        |> User.subscription_changeset(%{
          subscription_status: "expired"
        })
        |> Repo.update()

      # Update subscription records
      Subscription
      |> where([s], s.user_id == ^user_id)
      |> where([s], s.status in ["active", "cancelled"])
      |> Repo.update_all(set: [status: "expired"])

      IO.puts("[Subscriptions] Expired subscription for user #{user_id}")

      updated_user
    end)
  end

  # ============================================================================
  # Subscription Status & Access Checks
  # ============================================================================

  @doc """
  Gets the subscription status for a user.
  Also checks for and updates expired subscriptions.
  """
  def get_subscription_status(user_id) do
    case Repo.get(User, user_id) do
      nil ->
        # User not found - return default status
        %{
          status: "none",
          tier: nil,
          tier_name: nil,
          start_date: nil,
          end_date: nil,
          renewal_method: nil,
          needs_subscription: true,
          days_remaining: 0
        }

      user ->
        # Check if subscription has expired
        subscription_status = user.subscription_status || "none"

        if subscription_status in ["active", "cancelled"] and user.subscription_end_date do
          if DateTime.compare(DateTime.utc_now(), user.subscription_end_date) == :gt do
            # Subscription has expired - try to update status
            case expire_subscription(user_id) do
              {:ok, updated_user} -> build_status_response(updated_user)
              {:error, _reason} -> build_status_response(user)
            end
          else
            build_status_response(user)
          end
        else
          build_status_response(user)
        end
    end
  end

  defp build_status_response(user) do
    tier = user.subscription_tier
    tier_info = if tier, do: get_tier_info(tier), else: nil
    pending = user.pending_subscription_tier
    pending_info = if pending, do: get_tier_info(pending), else: nil

    %{
      status: user.subscription_status || "none",
      tier: tier,
      tier_name: if(tier_info, do: tier_info.name, else: nil),
      start_date: user.subscription_start_date,
      end_date: user.subscription_end_date,
      renewal_method: user.subscription_renewal_method,
      needs_subscription: needs_subscription?(user),
      days_remaining: calculate_days_remaining(user.subscription_end_date),
      pending_subscription_tier: pending,
      pending_subscription_tier_name: if(pending_info, do: pending_info.name, else: nil),
      organization_id: user.created_by_organization_id
    }
  end

  defp calculate_days_remaining(nil), do: 0

  defp calculate_days_remaining(end_date) do
    diff = DateTime.diff(end_date, DateTime.utc_now(), :day)
    max(0, diff)
  end

  @doc """
  Checks if a user has a valid (active or cancelled but not expired) subscription.
  """
  def has_valid_subscription?(user_id) do
    user = Repo.get(User, user_id)

    cond do
      # User not found
      is_nil(user) ->
        false

      # Admins always have access
      user.is_admin ->
        true

      # Org-created users don't need personal subscription
      not is_nil(user.created_by_organization_id) ->
        true

      # Org owners access via organization subscription / billing
      not is_nil(user.owned_organization_id) ->
        true

      # Check subscription status and expiry
      user.subscription_status in ["active", "cancelled"] ->
        if user.subscription_end_date do
          DateTime.compare(DateTime.utc_now(), user.subscription_end_date) != :gt
        else
          false
        end

      # No valid subscription
      true ->
        false
    end
  end

  @doc """
  Checks if a user needs a personal subscription.
  Returns false for admins, org-created users, org owners, and users with active subscriptions.
  """
  def needs_subscription?(user) when is_map(user) do
    cond do
      user.is_admin -> false
      not is_nil(user.created_by_organization_id) -> false
      not is_nil(user.owned_organization_id) -> false
      user.subscription_status in ["active", "cancelled"] -> false
      true -> true
    end
  end

  def needs_subscription?(user_id) when is_integer(user_id) do
    user = Repo.get(User, user_id)
    if user, do: needs_subscription?(user), else: true
  end

  # ============================================================================
  # Subscription History
  # ============================================================================

  @doc """
  Lists subscription history for a user.
  """
  def list_user_subscriptions(user_id) do
    Subscription
    |> where([s], s.user_id == ^user_id)
    |> order_by([s], desc: s.inserted_at)
    |> Repo.all()
  end

  @doc """
  Gets the current active subscription record for a user.
  """
  def get_active_subscription(user_id) do
    Subscription
    |> where([s], s.user_id == ^user_id)
    |> where([s], s.status == "active")
    |> order_by([s], desc: s.end_date)
    |> limit(1)
    |> Repo.one()
  end

  # ============================================================================
  # Subscription Tier Changes
  # ============================================================================

  @tier_price_hierarchy %{"basic" => 0.5, "starter" => 1, "creator" => 2, "pro" => 3}

  @doc """
  Changes subscription tier (upgrade/downgrade) for a user with an active Stripe subscription.

  - **Upgrade** (new tier price > current): Updates Stripe subscription immediately with proration.
    Stripe charges the prorated difference. Updates DB tier, credits difference granted immediately.
  - **Downgrade** (new tier price < current): Schedules the change at period end.
    Sets `pending_subscription_tier` on user. Actual change applied when webhook fires at renewal.

  Returns `{:ok, %{type: "upgrade" | "downgrade", user: user}}` or `{:error, reason}`.
  """
  def change_subscription_tier(user_id, new_tier) do
    new_tier_info = get_tier_info(new_tier)

    unless new_tier_info do
      {:error, :invalid_tier}
    else
      user = Repo.get!(User, user_id)

      cond do
        user.subscription_status not in ["active"] ->
          {:error, :no_active_subscription}

        user.subscription_tier == new_tier ->
          {:error, :same_tier}

        true ->
          current_level = Map.get(@tier_price_hierarchy, user.subscription_tier, 0)
          new_level = Map.get(@tier_price_hierarchy, new_tier, 0)

          if new_level > current_level do
            do_upgrade(user, new_tier, new_tier_info)
          else
            do_downgrade(user, new_tier)
          end
      end
    end
  end

  @doc """
  Applies a pending downgrade tier change. Called from webhook at renewal.
  """
  def apply_pending_tier_change(user_id) do
    user = Repo.get!(User, user_id)

    case user.pending_subscription_tier do
      nil ->
        {:ok, user}

      pending_tier ->
        tier_info = get_tier_info(pending_tier)

        if tier_info do
          {:ok, updated_user} =
            user
            |> User.subscription_changeset(%{
              subscription_tier: pending_tier,
              pending_subscription_tier: nil
            })
            |> Repo.update()

          # If downgrading to basic tier, wipe all credits
          if pending_tier == "basic" do
            {:ok, _} = Credits.set_credits(user_id, 0)
            IO.puts("[Subscriptions] Wiped all credits for user #{user_id} (downgraded to Basic)")
          else
            # Grant the new tier's credits
            {:ok, _} = Credits.add_credits(user_id, tier_info.monthly_credits)
          end

          IO.puts(
            "[Subscriptions] Applied pending downgrade for user #{user_id}: #{user.subscription_tier} -> #{pending_tier}"
          )

          {:ok, %{type: "downgrade_applied", user: updated_user}}
        else
          # Invalid pending tier, clear it
          {:ok, updated_user} =
            user
            |> User.subscription_changeset(%{pending_subscription_tier: nil})
            |> Repo.update()

          {:ok, %{type: "cleared_invalid", user: updated_user}}
        end
    end
  end

  @doc """
  Cancels a pending downgrade (user changed their mind).
  """
  def cancel_pending_tier_change(user_id) do
    user = Repo.get!(User, user_id)

    {:ok, updated_user} =
      user
      |> User.subscription_changeset(%{pending_subscription_tier: nil})
      |> Repo.update()

    {:ok, updated_user}
  end

  # Upgrade: update Stripe subscription immediately with proration, update DB tier now
  defp do_upgrade(user, new_tier, new_tier_info) do
    if user.stripe_subscription_id && user.subscription_renewal_method == "stripe" do
      # Retrieve current Stripe subscription to get the item ID
      case Stripe.Subscription.retrieve(user.stripe_subscription_id) do
        {:ok, stripe_sub} ->
          item = List.first(stripe_sub.items.data)

          if item do
            new_amount_cents = trunc(new_tier_info.usd * 100)

            # Update the subscription item with new price, prorate immediately
            update_params = %{
              items: [
                %{
                  id: item.id,
                  price_data: %{
                    currency: "usd",
                    product: item.price.product,
                    unit_amount: new_amount_cents,
                    recurring: %{interval: item.price.recurring.interval}
                  }
                }
              ],
              proration_behavior: "create_prorations",
              metadata: %{
                subscription_tier: new_tier,
                monthly_credits: to_string(new_tier_info.monthly_credits)
              }
            }

            case Stripe.Subscription.update(user.stripe_subscription_id, update_params) do
              {:ok, _updated_sub} ->
                # Update DB immediately for upgrades
                {:ok, updated_user} =
                  user
                  |> User.subscription_changeset(%{
                    subscription_tier: new_tier,
                    pending_subscription_tier: nil
                  })
                  |> Repo.update()

                # Grant the difference in credits immediately
                current_tier_info = get_tier_info(user.subscription_tier)

                credit_diff =
                  new_tier_info.monthly_credits -
                    ((current_tier_info && current_tier_info.monthly_credits) || 0)

                if credit_diff > 0 do
                  {:ok, _} = Credits.add_credits(user.id, credit_diff)
                end

                IO.puts(
                  "[Subscriptions] Upgraded user #{user.id}: #{user.subscription_tier} -> #{new_tier} (prorated)"
                )

                {:ok, %{type: "upgrade", user: updated_user}}

              {:error, %Stripe.Error{message: message}} ->
                IO.puts("[Subscriptions] Stripe upgrade error for user #{user.id}: #{message}")
                {:error, "Stripe error: #{message}"}
            end
          else
            {:error, :no_subscription_items}
          end

        {:error, %Stripe.Error{message: message}} ->
          {:error, "Failed to retrieve subscription: #{message}"}
      end
    else
      # Non-Stripe subscription (admin/crypto) — just update tier directly
      {:ok, updated_user} =
        user
        |> User.subscription_changeset(%{
          subscription_tier: new_tier,
          pending_subscription_tier: nil
        })
        |> Repo.update()

      {:ok, %{type: "upgrade", user: updated_user}}
    end
  end

  # Downgrade: schedule at period end, set pending_subscription_tier
  defp do_downgrade(user, new_tier) do
    if user.stripe_subscription_id && user.subscription_renewal_method == "stripe" do
      # For Stripe, we update the subscription to the new price at period end
      new_tier_info = get_tier_info(new_tier)
      new_amount_cents = trunc(new_tier_info.usd * 100)

      case Stripe.Subscription.retrieve(user.stripe_subscription_id) do
        {:ok, stripe_sub} ->
          item = List.first(stripe_sub.items.data)

          if item do
            # Schedule the price change at period end (no proration)
            update_params = %{
              items: [
                %{
                  id: item.id,
                  price_data: %{
                    currency: "usd",
                    product: item.price.product,
                    unit_amount: new_amount_cents,
                    recurring: %{interval: item.price.recurring.interval}
                  }
                }
              ],
              proration_behavior: "none",
              metadata: %{
                subscription_tier: new_tier,
                monthly_credits: to_string(new_tier_info.monthly_credits),
                pending_downgrade: "true",
                wipe_credits_on_apply: if(new_tier == "basic", do: "true", else: "false")
              }
            }

            case Stripe.Subscription.update(user.stripe_subscription_id, update_params) do
              {:ok, _updated_sub} ->
                # Don't change tier yet — store as pending
                {:ok, updated_user} =
                  user
                  |> User.subscription_changeset(%{
                    pending_subscription_tier: new_tier
                  })
                  |> Repo.update()

                IO.puts(
                  "[Subscriptions] Scheduled downgrade for user #{user.id}: #{user.subscription_tier} -> #{new_tier} at period end"
                )

                {:ok, %{type: "downgrade", user: updated_user}}

              {:error, %Stripe.Error{message: message}} ->
                IO.puts("[Subscriptions] Stripe downgrade error for user #{user.id}: #{message}")
                {:error, "Stripe error: #{message}"}
            end
          else
            {:error, :no_subscription_items}
          end

        {:error, %Stripe.Error{message: message}} ->
          {:error, "Failed to retrieve subscription: #{message}"}
      end
    else
      # Non-Stripe subscription — set pending, will be applied at renewal
      {:ok, updated_user} =
        user
        |> User.subscription_changeset(%{
          pending_subscription_tier: new_tier
        })
        |> Repo.update()

      {:ok, %{type: "downgrade", user: updated_user}}
    end
  end

  @doc """
  Redeems a bundle promo code after one-time payment.
  Grants platform access for the configured months and total credits immediately.
  """
  def redeem_promo_bundle(user_id, tier, access_months, total_credits, amount_usd, opts \\ []) do
    tier_info = get_tier_info(tier)

    unless tier_info do
      {:error, :invalid_tier}
    else
      stripe_customer_id = Keyword.get(opts, :stripe_customer_id)
      payment_intent = Keyword.get(opts, :payment_intent)
      payment_method = Keyword.get(opts, :payment_method, "stripe")

      Repo.transaction(fn ->
        user = Repo.get!(User, user_id)

        start_date = DateTime.utc_now() |> DateTime.truncate(:second)
        access_days = trunc(access_months * 365 / 12)
        end_date = DateTime.add(start_date, access_days, :day)

        {:ok, updated_user} =
          user
          |> User.subscription_changeset(%{
            subscription_status: "active",
            subscription_tier: tier,
            subscription_start_date: start_date,
            subscription_end_date: end_date,
            subscription_renewal_method: "promo_bundle",
            stripe_customer_id: stripe_customer_id || user.stripe_customer_id
          })
          |> Repo.update()

        stripe_ref =
          case payment_intent do
            nil -> nil
            ref when is_binary(ref) -> "promo_#{ref}"
            _ -> nil
          end

        {:ok, subscription} =
          %Subscription{}
          |> Subscription.create_changeset(%{
            user_id: user_id,
            status: "active",
            subscription_tier: tier,
            start_date: start_date,
            end_date: end_date,
            hours_included: Decimal.new("0"),
            credits_granted: Decimal.new(to_string(total_credits)),
            payment_method: payment_method,
            stripe_subscription_id: stripe_ref,
            amount_usd: Decimal.new(to_string(amount_usd))
          })
          |> Repo.insert()

        if total_credits > 0 do
          {:ok, _} = Credits.add_credits(user_id, total_credits)
        end

        IO.puts(
          "[Subscriptions] Redeemed bundle promo for user #{user_id}: #{tier} for #{access_months} months, granted #{total_credits} credits"
        )

        %{user: updated_user, subscription: subscription}
      end)
    end
  end

  # ============================================================================
  # Admin Subscription Management
  # ============================================================================

  @doc """
  Admin-initiated subscription grant.
  Creates a new subscription for a user without payment.
  Optionally grants monthly credits.
  """
  def admin_grant_subscription(user_id, tier, days \\ 30, grant_credits \\ false) do
    tier_info = get_tier_info(tier)

    unless tier_info do
      {:error, :invalid_tier}
    else
      Repo.transaction(fn ->
        user = Repo.get!(User, user_id)

        start_date = DateTime.utc_now() |> DateTime.truncate(:second)
        end_date = DateTime.add(start_date, days, :day)

        # Update user subscription fields
        {:ok, updated_user} =
          user
          |> User.subscription_changeset(%{
            subscription_status: "active",
            subscription_tier: tier,
            subscription_start_date: start_date,
            subscription_end_date: end_date,
            subscription_renewal_method: "admin"
          })
          |> Repo.update()

        # Create subscription history record
        {:ok, subscription} =
          %Subscription{}
          |> Subscription.create_changeset(%{
            user_id: user_id,
            status: "active",
            subscription_tier: tier,
            start_date: start_date,
            end_date: end_date,
            hours_included: Decimal.new("0"),
            credits_granted:
              if(grant_credits,
                do: Decimal.new(to_string(tier_info.monthly_credits)),
                else: Decimal.new("0")
              ),
            payment_method: "admin",
            amount_usd: Decimal.new("0")
          })
          |> Repo.insert()

        # Optionally grant monthly credits
        if grant_credits do
          {:ok, _} = Credits.add_credits(user_id, tier_info.monthly_credits)
        end

        IO.puts(
          "[Subscriptions] Admin granted #{tier} subscription to user #{user_id} for #{days} days"
        )

        %{user: updated_user, subscription: subscription}
      end)
    end
  end

  @doc """
  Admin-initiated subscription extension.
  Extends the subscription end date by the specified number of days.
  If the subscription is already expired, days are added from now (not the past end date).
  Optionally grants monthly credits.
  """
  def admin_extend_subscription(user_id, days, grant_credits \\ false) do
    Repo.transaction(fn ->
      user = Repo.get!(User, user_id)
      tier = user.subscription_tier

      unless tier do
        Repo.rollback(:no_tier)
      end

      tier_info = get_tier_info(tier)

      unless tier_info do
        Repo.rollback(:invalid_tier)
      end

      now = DateTime.utc_now() |> DateTime.truncate(:second)
      current_end = user.subscription_end_date
      expired? = subscription_period_expired?(user, now)

      # Active subs extend from current end; expired/missing ends start from now
      period_start =
        cond do
          is_nil(current_end) -> now
          expired? -> now
          true -> current_end
        end

      new_end = DateTime.add(period_start, days, :day)

      changeset_attrs =
        %{
          subscription_status: "active",
          subscription_end_date: new_end
        }
        |> then(fn attrs ->
          if expired? do
            Map.merge(attrs, %{
              subscription_start_date: period_start,
              subscription_renewal_method: user.subscription_renewal_method || "admin"
            })
          else
            attrs
          end
        end)

      {:ok, updated_user} =
        user
        |> User.subscription_changeset(changeset_attrs)
        |> Repo.update()

      # Create subscription history record for extension
      {:ok, subscription} =
        %Subscription{}
        |> Subscription.create_changeset(%{
          user_id: user_id,
          status: "active",
          subscription_tier: tier,
          start_date: period_start,
          end_date: new_end,
          hours_included: Decimal.new("0"),
          credits_granted:
            if(grant_credits,
              do: Decimal.new(to_string(tier_info.monthly_credits)),
              else: Decimal.new("0")
            ),
          payment_method: "admin",
          amount_usd: Decimal.new("0")
        })
        |> Repo.insert()

      # Optionally grant monthly credits
      if grant_credits do
        {:ok, _} = Credits.add_credits(user_id, tier_info.monthly_credits)
      end

      IO.puts("[Subscriptions] Admin extended subscription for user #{user_id} by #{days} days")

      %{user: updated_user, subscription: subscription}
    end)
  end

  @doc """
  Admin-initiated tier change.
  Changes the subscription tier for a user.
  If the subscription is expired, starts a fresh period from now.
  Optionally grants monthly credits for the new tier.
  """
  def admin_change_tier(user_id, new_tier, grant_credits \\ false) do
    tier_info = get_tier_info(new_tier)

    unless tier_info do
      {:error, :invalid_tier}
    else
      Repo.transaction(fn ->
        user = Repo.get!(User, user_id)
        now = DateTime.utc_now() |> DateTime.truncate(:second)
        expired? = subscription_period_expired?(user, now)

        # Keep remaining time for active subs; expired/missing ends start a new period
        {start_date, end_date} =
          if expired? or is_nil(user.subscription_end_date) do
            {now, DateTime.add(now, @subscription_days, :day)}
          else
            {
              user.subscription_start_date || now,
              user.subscription_end_date
            }
          end

        # Update user's tier and ensure subscription is active
        {:ok, updated_user} =
          user
          |> User.subscription_changeset(%{
            subscription_tier: new_tier,
            subscription_status: "active",
            subscription_start_date: start_date,
            subscription_end_date: end_date,
            subscription_renewal_method: user.subscription_renewal_method || "admin"
          })
          |> Repo.update()

        credits_granted =
          if grant_credits,
            do: Decimal.new(to_string(tier_info.monthly_credits)),
            else: Decimal.new("0")

        if grant_credits do
          {:ok, _} = Credits.add_credits(user_id, tier_info.monthly_credits)
        end

        {:ok, subscription} =
          %Subscription{}
          |> Subscription.create_changeset(%{
            user_id: user_id,
            status: "active",
            subscription_tier: new_tier,
            start_date: start_date,
            end_date: end_date,
            hours_included: Decimal.new("0"),
            credits_granted: credits_granted,
            payment_method: "admin",
            amount_usd: Decimal.new("0")
          })
          |> Repo.insert()

        %{user: updated_user, subscription: subscription}
      end)
    end
  end

  defp subscription_period_expired?(user, now) do
    cond do
      user.subscription_status == "expired" ->
        true

      is_nil(user.subscription_end_date) ->
        false

      true ->
        DateTime.compare(now, user.subscription_end_date) == :gt
    end
  end

  # ============================================================================
  # Stripe Customer Management
  # ============================================================================

  @doc """
  Updates user's Stripe customer ID.
  """
  def update_stripe_customer(user_id, stripe_customer_id) do
    user = Repo.get!(User, user_id)

    user
    |> User.subscription_changeset(%{stripe_customer_id: stripe_customer_id})
    |> Repo.update()
  end

  @doc """
  Gets user by Stripe subscription ID.
  """
  def get_user_by_stripe_subscription(stripe_subscription_id) do
    Repo.get_by(User, stripe_subscription_id: stripe_subscription_id)
  end

  @doc """
  Gets user by Stripe customer ID.
  """
  def get_user_by_stripe_customer(stripe_customer_id) do
    Repo.get_by(User, stripe_customer_id: stripe_customer_id)
  end
end
