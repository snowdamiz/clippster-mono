defmodule ClippsterServer.OrganizationSubscriptions do
  @moduledoc """
  The OrganizationSubscriptions context - manages organization subscriptions, add-ons, and seat limits.

  Base Subscription Tiers:
  - Enterprise Base: $300/month, 5 seats
  - Enterprise AI: $500/month, 5 seats + 20,000 credits

  Add-ons (require base subscription):
  - With AI: 5/10/20 seats + credits
  - Without AI: 5/10/20 seats only

  Business Rules:
  - Organizations must have a base subscription before purchasing add-ons
  - Add-ons stack on top of base subscriptions
  - Credits are granted on subscription start and each renewal
  - Legacy organizations (created before subscriptions) have unlimited seats
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Organizations
  alias ClippsterServer.Organizations.Organization

  alias ClippsterServer.OrganizationSubscriptions.{
    OrganizationSubscription,
    OrganizationSubscriptionAddon
  }

  # Subscription duration: 30 days
  @subscription_days 30

  # Base subscription tiers
  @org_subscription_tiers %{
    "solo" => %{name: "Solo", seats: 0, monthly_credits: 0, usd: 149.99},
    "enterprise_base" => %{name: "Enterprise Base", seats: 5, monthly_credits: 0, usd: 349.99},
    "enterprise_ai" => %{name: "Enterprise AI", seats: 5, monthly_credits: 20_000, usd: 549.99},
    "enterprise_unlimited" => %{
      name: "Enterprise Unlimited",
      seats: nil,
      monthly_credits: 100_000,
      usd: 2199.99
    },
    "custom" => %{name: "Custom", seats: nil, monthly_credits: 0, usd: 0}
  }

  # Add-on tiers (require base subscription)
  @org_addon_tiers %{
    # With AI
    "seats_5_ai" => %{
      name: "5 Seats + AI",
      seats: 5,
      monthly_credits: 10_000,
      usd: 299,
      requires_ai: true
    },
    "seats_10_ai" => %{
      name: "10 Seats + AI",
      seats: 10,
      monthly_credits: 20_000,
      usd: 479,
      requires_ai: true
    },
    "seats_20_ai" => %{
      name: "20 Seats + AI",
      seats: 20,
      monthly_credits: 40_000,
      usd: 689,
      requires_ai: true
    },
    # Without AI
    "seats_5" => %{name: "5 Seats", seats: 5, monthly_credits: 0, usd: 179, requires_ai: false},
    "seats_10" => %{name: "10 Seats", seats: 10, monthly_credits: 0, usd: 239, requires_ai: false},
    "seats_20" => %{name: "20 Seats", seats: 20, monthly_credits: 0, usd: 419, requires_ai: false}
  }

  @doc """
  Gets the base subscription tier configurations.
  """
  def get_subscription_tiers, do: @org_subscription_tiers

  @doc """
  Gets the add-on tier configurations.
  """
  def get_addon_tiers, do: @org_addon_tiers

  @doc """
  Gets info for a specific base subscription tier.
  """
  def get_tier_info(tier) when is_binary(tier) do
    Map.get(@org_subscription_tiers, tier)
  end

  @doc """
  Gets info for a specific add-on tier.
  """
  def get_addon_info(tier) when is_binary(tier) do
    Map.get(@org_addon_tiers, tier)
  end

  @doc """
  Gets the subscription days duration.
  """
  def get_subscription_days, do: @subscription_days

  # ============================================================================
  # Base Subscription Creation
  # ============================================================================

  @doc """
  Creates a new base subscription for an organization via Stripe.
  Grants the tier's monthly credits and activates subscription.
  """
  def create_stripe_subscription(
        organization_id,
        tier,
        stripe_subscription_id,
        stripe_customer_id \\ nil
      ) do
    tier_info = get_tier_info(tier)

    unless tier_info do
      {:error, :invalid_tier}
    else
      Repo.transaction(fn ->
        org = Repo.get!(Organization, organization_id)

        start_date = DateTime.utc_now() |> DateTime.truncate(:second)
        end_date = DateTime.add(start_date, @subscription_days, :day)

        # Update organization subscription fields
        {:ok, updated_org} =
          org
          |> Organization.subscription_changeset(%{
            subscription_status: "active",
            subscription_tier: tier,
            subscription_start_date: start_date,
            subscription_end_date: end_date,
            subscription_renewal_method: "stripe",
            stripe_subscription_id: stripe_subscription_id,
            stripe_customer_id: stripe_customer_id || org.stripe_customer_id,
            max_seats: tier_info.seats,
            monthly_credits: tier_info.monthly_credits
          })
          |> Repo.update()

        # Create subscription history record
        {:ok, subscription} =
          %OrganizationSubscription{}
          |> OrganizationSubscription.create_changeset(%{
            organization_id: organization_id,
            subscription_type: "base",
            tier: tier,
            status: "active",
            start_date: start_date,
            end_date: end_date,
            seats: tier_info.seats,
            credits_granted: Decimal.new(to_string(tier_info.monthly_credits)),
            payment_method: "stripe",
            stripe_subscription_id: stripe_subscription_id,
            amount_usd: Decimal.new(to_string(tier_info.usd))
          })
          |> Repo.insert()

        # Grant monthly credits to organization pool
        if tier_info.monthly_credits > 0 do
          {:ok, _} =
            Organizations.add_organization_credits(organization_id, tier_info.monthly_credits)
        end

        IO.puts(
          "[OrgSubscriptions] Created #{tier} subscription for org #{organization_id}, granted #{tier_info.monthly_credits} credits"
        )

        %{organization: updated_org, subscription: subscription}
      end)
    end
  end

  @doc """
  Creates a base subscription via crypto payment.
  """
  def create_crypto_subscription(organization_id, tier, tx_signature) do
    tier_info = get_tier_info(tier)

    unless tier_info do
      {:error, :invalid_tier}
    else
      Repo.transaction(fn ->
        org = Repo.get!(Organization, organization_id)

        start_date = DateTime.utc_now() |> DateTime.truncate(:second)
        end_date = DateTime.add(start_date, @subscription_days, :day)

        # Update organization subscription fields
        {:ok, updated_org} =
          org
          |> Organization.subscription_changeset(%{
            subscription_status: "active",
            subscription_tier: tier,
            subscription_start_date: start_date,
            subscription_end_date: end_date,
            subscription_renewal_method: "crypto",
            max_seats: tier_info.seats,
            monthly_credits: tier_info.monthly_credits
          })
          |> Repo.update()

        # Create subscription history record
        {:ok, subscription} =
          %OrganizationSubscription{}
          |> OrganizationSubscription.create_changeset(%{
            organization_id: organization_id,
            subscription_type: "base",
            tier: tier,
            status: "active",
            start_date: start_date,
            end_date: end_date,
            seats: tier_info.seats,
            credits_granted: Decimal.new(to_string(tier_info.monthly_credits)),
            payment_method: "crypto",
            stripe_subscription_id: "crypto_#{tx_signature}",
            amount_usd: Decimal.new(to_string(tier_info.usd))
          })
          |> Repo.insert()

        # Grant monthly credits
        if tier_info.monthly_credits > 0 do
          {:ok, _} =
            Organizations.add_organization_credits(organization_id, tier_info.monthly_credits)
        end

        IO.puts(
          "[OrgSubscriptions] Created #{tier} crypto subscription for org #{organization_id}"
        )

        %{organization: updated_org, subscription: subscription}
      end)
    end
  end

  # ============================================================================
  # Add-on Management
  # ============================================================================

  @doc """
  Adds an add-on subscription to an organization.
  Requires an active base subscription.
  """
  def add_addon_stripe(organization_id, addon_tier, stripe_subscription_id) do
    addon_info = get_addon_info(addon_tier)
    org = Repo.get!(Organization, organization_id)

    cond do
      is_nil(addon_info) ->
        {:error, :invalid_addon_tier}

      org.subscription_status != "active" ->
        {:error, :no_active_base_subscription}

      true ->
        Repo.transaction(fn ->
          start_date = DateTime.utc_now() |> DateTime.truncate(:second)
          # Align with base subscription
          end_date = org.subscription_end_date

          # Create addon record
          {:ok, addon} =
            %OrganizationSubscriptionAddon{}
            |> OrganizationSubscriptionAddon.create_changeset(%{
              organization_id: organization_id,
              addon_tier: addon_tier,
              status: "active",
              stripe_subscription_id: stripe_subscription_id,
              start_date: start_date,
              end_date: end_date,
              seats: addon_info.seats,
              monthly_credits: addon_info.monthly_credits
            })
            |> Repo.insert()

          # Update organization's max_seats and monthly_credits
          new_max_seats = (org.max_seats || 0) + addon_info.seats
          new_monthly_credits = (org.monthly_credits || 0) + addon_info.monthly_credits

          {:ok, updated_org} =
            org
            |> Organization.subscription_changeset(%{
              max_seats: new_max_seats,
              monthly_credits: new_monthly_credits
            })
            |> Repo.update()

          # Create history record
          {:ok, history} =
            %OrganizationSubscription{}
            |> OrganizationSubscription.create_changeset(%{
              organization_id: organization_id,
              subscription_type: "addon",
              tier: addon_tier,
              status: "active",
              start_date: start_date,
              end_date: end_date,
              seats: addon_info.seats,
              credits_granted: Decimal.new(to_string(addon_info.monthly_credits)),
              payment_method: "stripe",
              stripe_subscription_id: stripe_subscription_id,
              amount_usd: Decimal.new(to_string(addon_info.usd))
            })
            |> Repo.insert()

          # Grant credits immediately
          if addon_info.monthly_credits > 0 do
            {:ok, _} =
              Organizations.add_organization_credits(organization_id, addon_info.monthly_credits)
          end

          IO.puts("[OrgSubscriptions] Added #{addon_tier} addon for org #{organization_id}")

          %{addon: addon, organization: updated_org, history: history}
        end)
    end
  end

  @doc """
  Adds an add-on via crypto payment.
  """
  def add_addon_crypto(organization_id, addon_tier, tx_signature) do
    addon_info = get_addon_info(addon_tier)
    org = Repo.get!(Organization, organization_id)

    cond do
      is_nil(addon_info) ->
        {:error, :invalid_addon_tier}

      org.subscription_status != "active" ->
        {:error, :no_active_base_subscription}

      true ->
        Repo.transaction(fn ->
          start_date = DateTime.utc_now() |> DateTime.truncate(:second)
          end_date = org.subscription_end_date

          # Create addon record
          {:ok, addon} =
            %OrganizationSubscriptionAddon{}
            |> OrganizationSubscriptionAddon.create_changeset(%{
              organization_id: organization_id,
              addon_tier: addon_tier,
              status: "active",
              start_date: start_date,
              end_date: end_date,
              seats: addon_info.seats,
              monthly_credits: addon_info.monthly_credits
            })
            |> Repo.insert()

          # Update totals
          new_max_seats = (org.max_seats || 0) + addon_info.seats
          new_monthly_credits = (org.monthly_credits || 0) + addon_info.monthly_credits

          {:ok, updated_org} =
            org
            |> Organization.subscription_changeset(%{
              max_seats: new_max_seats,
              monthly_credits: new_monthly_credits
            })
            |> Repo.update()

          # Create history
          {:ok, history} =
            %OrganizationSubscription{}
            |> OrganizationSubscription.create_changeset(%{
              organization_id: organization_id,
              subscription_type: "addon",
              tier: addon_tier,
              status: "active",
              start_date: start_date,
              end_date: end_date,
              seats: addon_info.seats,
              credits_granted: Decimal.new(to_string(addon_info.monthly_credits)),
              payment_method: "crypto",
              stripe_subscription_id: "crypto_#{tx_signature}",
              amount_usd: Decimal.new(to_string(addon_info.usd))
            })
            |> Repo.insert()

          # Grant credits
          if addon_info.monthly_credits > 0 do
            {:ok, _} =
              Organizations.add_organization_credits(organization_id, addon_info.monthly_credits)
          end

          %{addon: addon, organization: updated_org, history: history}
        end)
    end
  end

  # ============================================================================
  # Subscription Renewal
  # ============================================================================

  @doc """
  Renews organization subscription (called from Stripe webhook).
  Extends end_date and grants monthly credits for base + addons.
  """
  def renew_subscription(organization_id) do
    Repo.transaction(fn ->
      org = Repo.get!(Organization, organization_id) |> Repo.preload(:members)
      tier = org.subscription_tier
      tier_info = get_tier_info(tier)

      unless tier_info do
        Repo.rollback(:invalid_tier)
      end

      # Calculate new end date
      current_end = org.subscription_end_date || DateTime.utc_now()

      new_start =
        if DateTime.compare(DateTime.utc_now(), current_end) == :gt do
          DateTime.utc_now() |> DateTime.truncate(:second)
        else
          current_end
        end

      new_end = DateTime.add(new_start, @subscription_days, :day)

      # Update organization
      {:ok, updated_org} =
        org
        |> Organization.subscription_changeset(%{
          subscription_status: "active",
          subscription_end_date: new_end
        })
        |> Repo.update()

      # Create history for base subscription renewal
      {:ok, _subscription} =
        %OrganizationSubscription{}
        |> OrganizationSubscription.create_changeset(%{
          organization_id: organization_id,
          subscription_type: "base",
          tier: tier,
          status: "active",
          start_date: new_start,
          end_date: new_end,
          seats: tier_info.seats,
          credits_granted: Decimal.new(to_string(tier_info.monthly_credits)),
          payment_method: org.subscription_renewal_method || "stripe",
          stripe_subscription_id: org.stripe_subscription_id,
          amount_usd: Decimal.new(to_string(tier_info.usd))
        })
        |> Repo.insert()

      # Grant base subscription credits
      total_credits = tier_info.monthly_credits

      # Renew and grant credits for active addons
      active_addons =
        OrganizationSubscriptionAddon
        |> where([a], a.organization_id == ^organization_id and a.status == "active")
        |> Repo.all()

      total_credits =
        Enum.reduce(active_addons, total_credits, fn addon, acc ->
          addon_info = get_addon_info(addon.addon_tier)

          if addon_info do
            # Update addon end date
            addon
            |> OrganizationSubscriptionAddon.update_status_changeset(%{end_date: new_end})
            |> Repo.update()

            # Create history
            %OrganizationSubscription{}
            |> OrganizationSubscription.create_changeset(%{
              organization_id: organization_id,
              subscription_type: "addon",
              tier: addon.addon_tier,
              status: "active",
              start_date: new_start,
              end_date: new_end,
              seats: addon_info.seats,
              credits_granted: Decimal.new(to_string(addon_info.monthly_credits)),
              payment_method: org.subscription_renewal_method || "stripe",
              stripe_subscription_id: addon.stripe_subscription_id,
              amount_usd: Decimal.new(to_string(addon_info.usd))
            })
            |> Repo.insert()

            acc + addon_info.monthly_credits
          else
            acc
          end
        end)

      # Grant total credits to org pool
      if total_credits > 0 do
        {:ok, _} = Organizations.add_organization_credits(organization_id, total_credits)
      end

      IO.puts(
        "[OrgSubscriptions] Renewed subscription for org #{organization_id}, granted #{total_credits} credits"
      )

      updated_org
    end)
  end

  # ============================================================================
  # Subscription Cancellation & Expiration
  # ============================================================================

  @doc """
  Cancels organization subscription (user-initiated or owner-initiated).
  IMMEDIATELY cancels in Stripe (base + all add-ons) to prevent future charges.
  Organization retains access until end_date.
  """
  def cancel_subscription(organization_id) do
    Repo.transaction(fn ->
      org = Repo.get!(Organization, organization_id)

      unless org.subscription_status in ["active", "cancelled"] do
        Repo.rollback(:not_active)
      end

      # IMMEDIATELY cancel base subscription in Stripe to stop future charges
      if org.stripe_subscription_id && org.subscription_renewal_method == "stripe" do
        case Stripe.Subscription.cancel(org.stripe_subscription_id) do
          {:ok, _} ->
            IO.puts(
              "[OrgSubscriptions] IMMEDIATELY cancelled Stripe base subscription #{org.stripe_subscription_id} for org #{organization_id} - no future charges"
            )

          {:error, %Stripe.Error{message: message}} ->
            IO.puts(
              "[OrgSubscriptions] Failed to cancel Stripe base subscription for org #{organization_id}: #{message}"
            )
            # Continue anyway to mark as cancelled in DB

          {:error, reason} ->
            IO.puts(
              "[OrgSubscriptions] Failed to cancel Stripe base subscription for org #{organization_id}: #{inspect(reason)}"
            )
            # Continue anyway to mark as cancelled in DB
        end
      end

      # IMMEDIATELY cancel ALL add-ons in Stripe
      active_addons =
        OrganizationSubscriptionAddon
        |> where([a], a.organization_id == ^organization_id and a.status == "active")
        |> Repo.all()

      Enum.each(active_addons, fn addon ->
        if addon.stripe_subscription_id do
          case Stripe.Subscription.cancel(addon.stripe_subscription_id) do
            {:ok, _} ->
              IO.puts(
                "[OrgSubscriptions] IMMEDIATELY cancelled Stripe add-on subscription #{addon.stripe_subscription_id} (#{addon.addon_tier}) for org #{organization_id}"
              )

            {:error, %Stripe.Error{message: message}} ->
              IO.puts(
                "[OrgSubscriptions] Failed to cancel Stripe add-on #{addon.addon_tier} for org #{organization_id}: #{message}"
              )
              # Continue with other add-ons

            {:error, reason} ->
              IO.puts(
                "[OrgSubscriptions] Failed to cancel Stripe add-on #{addon.addon_tier} for org #{organization_id}: #{inspect(reason)}"
              )
              # Continue with other add-ons
          end
        end
      end)

      # Update status to cancelled
      {:ok, updated_org} =
        org
        |> Organization.subscription_changeset(%{
          subscription_status: "cancelled"
        })
        |> Repo.update()

      # Cancel active addons in database
      OrganizationSubscriptionAddon
      |> where([a], a.organization_id == ^organization_id and a.status == "active")
      |> Repo.update_all(set: [status: "cancelled"])

      IO.puts(
        "[OrgSubscriptions] Cancelled subscription for org #{organization_id}, access until #{org.subscription_end_date}"
      )

      updated_org
    end)
  end

  @doc """
  Admin-initiated immediate cancellation for organization.
  IMMEDIATELY cancels base subscription and ALL add-ons in Stripe (stops all future charges).
  Organization optionally retains access until period end based on database end_date.
  """
  def admin_cancel_subscription(organization_id) do
    Repo.transaction(fn ->
      org = Repo.get!(Organization, organization_id)

      unless org.subscription_status in ["active", "cancelled"] do
        Repo.rollback(:not_active)
      end

      # IMMEDIATELY cancel base subscription in Stripe - no more charges
      if org.stripe_subscription_id && org.subscription_renewal_method == "stripe" do
        case Stripe.Subscription.cancel(org.stripe_subscription_id) do
          {:ok, _} ->
            IO.puts(
              "[OrgSubscriptions] ADMIN: IMMEDIATELY cancelled Stripe base subscription #{org.stripe_subscription_id} for org #{organization_id} - no future charges"
            )

          {:error, %Stripe.Error{message: message}} ->
            IO.puts(
              "[OrgSubscriptions] ADMIN: Failed to cancel Stripe base subscription for org #{organization_id}: #{message}"
            )
            # For admin cancellations, rollback if Stripe fails
            Repo.rollback({:stripe_error, message})

          {:error, reason} ->
            IO.puts(
              "[OrgSubscriptions] ADMIN: Failed to cancel Stripe base subscription for org #{organization_id}: #{inspect(reason)}"
            )
            Repo.rollback({:stripe_error, reason})
        end
      end

      # IMMEDIATELY cancel ALL add-ons in Stripe
      active_addons =
        OrganizationSubscriptionAddon
        |> where([a], a.organization_id == ^organization_id and a.status == "active")
        |> Repo.all()

      Enum.each(active_addons, fn addon ->
        if addon.stripe_subscription_id do
          case Stripe.Subscription.cancel(addon.stripe_subscription_id) do
            {:ok, _} ->
              IO.puts(
                "[OrgSubscriptions] ADMIN: IMMEDIATELY cancelled Stripe add-on subscription #{addon.stripe_subscription_id} (#{addon.addon_tier}) for org #{organization_id}"
              )

            {:error, %Stripe.Error{message: message}} ->
              IO.puts(
                "[OrgSubscriptions] ADMIN: Failed to cancel Stripe add-on #{addon.addon_tier} for org #{organization_id}: #{message}"
              )
              # For admin, we log but continue with other add-ons

            {:error, reason} ->
              IO.puts(
                "[OrgSubscriptions] ADMIN: Failed to cancel Stripe add-on #{addon.addon_tier} for org #{organization_id}: #{inspect(reason)}"
              )
              # Continue with other add-ons
          end
        end
      end)

      # Update status to cancelled
      {:ok, updated_org} =
        org
        |> Organization.subscription_changeset(%{
          subscription_status: "cancelled"
        })
        |> Repo.update()

      # Cancel active addons in database
      OrganizationSubscriptionAddon
      |> where([a], a.organization_id == ^organization_id and a.status == "active")
      |> Repo.update_all(set: [status: "cancelled"])

      IO.puts(
        "[OrgSubscriptions] ADMIN: Cancelled subscription for org #{organization_id}"
      )

      updated_org
    end)
  end

  @doc """
  Expires organization subscription (called when end_date passes).
  """
  def expire_subscription(organization_id) do
    Repo.transaction(fn ->
      org = Repo.get!(Organization, organization_id)

      {:ok, updated_org} =
        org
        |> Organization.subscription_changeset(%{
          subscription_status: "expired"
        })
        |> Repo.update()

      # Expire addons
      OrganizationSubscriptionAddon
      |> where([a], a.organization_id == ^organization_id and a.status in ["active", "cancelled"])
      |> Repo.update_all(set: [status: "expired"])

      IO.puts("[OrgSubscriptions] Expired subscription for org #{organization_id}")

      updated_org
    end)
  end

  # ============================================================================
  # Subscription Status & Calculations
  # ============================================================================

  @doc """
  Gets the subscription status for an organization.
  Returns comprehensive info including totals from base + addons.
  """
  def get_subscription_status(organization_id) do
    org = Repo.get(Organization, organization_id)

    case org do
      nil ->
        %{
          status: "none",
          tier: nil,
          tier_name: nil,
          has_subscription: false
        }

      org ->
        # Check if expired
        if org.subscription_status in ["active", "cancelled"] and org.subscription_end_date do
          if DateTime.compare(DateTime.utc_now(), org.subscription_end_date) == :gt do
            case expire_subscription(organization_id) do
              {:ok, updated_org} -> build_status_response(updated_org)
              {:error, _} -> build_status_response(org)
            end
          else
            build_status_response(org)
          end
        else
          build_status_response(org)
        end
    end
  end

  defp build_status_response(org) do
    tier_info = if org.subscription_tier, do: get_tier_info(org.subscription_tier), else: nil

    # Get active addons
    active_addons =
      if org.subscription_status == "active" do
        OrganizationSubscriptionAddon
        |> where([a], a.organization_id == ^org.id and a.status == "active")
        |> Repo.all()
        |> Enum.map(fn addon ->
          addon_info = get_addon_info(addon.addon_tier)

          %{
            tier: addon.addon_tier,
            name: addon_info.name,
            seats: addon_info.seats,
            credits: addon_info.monthly_credits
          }
        end)
      else
        []
      end

    # Calculate totals
    base_seats = if tier_info, do: tier_info.seats, else: 0
    base_credits = if tier_info, do: tier_info.monthly_credits, else: 0

    # This is kept in sync
    total_seats = org.max_seats
    # This is kept in sync
    total_monthly_credits = org.monthly_credits

    # Count current members
    current_members = Organizations.count_members(org.id)
    seats_remaining = if total_seats, do: max(0, total_seats - current_members), else: nil

    %{
      status: org.subscription_status || "none",
      tier: org.subscription_tier,
      tier_name: if(tier_info, do: tier_info.name, else: nil),
      start_date: org.subscription_start_date,
      end_date: org.subscription_end_date,
      renewal_method: org.subscription_renewal_method,
      days_remaining: calculate_days_remaining(org.subscription_end_date),
      has_subscription: org.subscription_status in ["active", "cancelled"],
      base_seats: base_seats,
      base_credits: base_credits,
      addons: active_addons,
      total_seats: total_seats,
      total_monthly_credits: total_monthly_credits,
      current_members: current_members,
      seats_remaining: seats_remaining,
      pending_subscription_tier: org.pending_subscription_tier,
      admin_price_cents: org.admin_price_cents,
      created_by_admin: org.created_by_admin_id != nil,
      setup_completed: org.setup_completed
    }
  end

  defp calculate_days_remaining(nil), do: 0

  defp calculate_days_remaining(end_date) do
    diff = DateTime.diff(end_date, DateTime.utc_now(), :day)
    max(0, diff)
  end

  @doc """
  Gets total seats available for an organization.
  Returns nil for legacy orgs (unlimited).
  """
  def get_total_seats(organization_id) do
    org = Repo.get(Organization, organization_id)
    # nil = unlimited (legacy)
    org.max_seats
  end

  @doc """
  Checks if organization can add a new member.
  Returns {:ok, seats_remaining} or {:error, :seat_limit_reached}.
  """
  def can_add_member?(organization_id) do
    org = Repo.get(Organization, organization_id)

    case org.max_seats do
      nil ->
        # Legacy org, unlimited seats
        {:ok, nil}

      max_seats ->
        current_count = Organizations.count_members(organization_id)

        if current_count < max_seats do
          {:ok, max_seats - current_count}
        else
          {:error, :seat_limit_reached}
        end
    end
  end

  @doc """
  Lists subscription history for an organization.
  """
  def list_subscription_history(organization_id) do
    OrganizationSubscription
    |> where([s], s.organization_id == ^organization_id)
    |> order_by([s], desc: s.inserted_at)
    |> Repo.all()
  end

  @doc """
  Gets subscription by Stripe subscription ID.
  """
  def get_by_stripe_subscription(stripe_subscription_id) do
    Repo.get_by(Organization, stripe_subscription_id: stripe_subscription_id)
  end

  @doc """
  Gets subscription by Stripe customer ID.
  """
  def get_by_stripe_customer(stripe_customer_id) do
    Repo.get_by(Organization, stripe_customer_id: stripe_customer_id)
  end

  # ============================================================================
  # Admin Subscription Management
  # ============================================================================

  @doc """
  Admin grants a subscription to an organization.
  Can optionally skip granting credits (grant_credits: false).
  """
  def admin_grant_subscription(organization_id, tier, days \\ 30, grant_credits \\ true) do
    tier_info = get_tier_info(tier)

    unless tier_info do
      {:error, :invalid_tier}
    else
      Repo.transaction(fn ->
        org = Repo.get!(Organization, organization_id)

        start_date = DateTime.utc_now() |> DateTime.truncate(:second)
        end_date = DateTime.add(start_date, days, :day)

        {:ok, updated_org} =
          org
          |> Organization.subscription_changeset(%{
            subscription_status: "active",
            subscription_tier: tier,
            subscription_start_date: start_date,
            subscription_end_date: end_date,
            subscription_renewal_method: "admin",
            max_seats: tier_info.seats,
            monthly_credits: if(grant_credits, do: tier_info.monthly_credits, else: 0)
          })
          |> Repo.update()

        # Create subscription history record
        {:ok, subscription} =
          %OrganizationSubscription{}
          |> OrganizationSubscription.create_changeset(%{
            organization_id: organization_id,
            subscription_type: "base",
            tier: tier,
            status: "active",
            start_date: start_date,
            end_date: end_date,
            seats: tier_info.seats,
            credits_granted:
              Decimal.new(to_string(if(grant_credits, do: tier_info.monthly_credits, else: 0))),
            payment_method: "admin",
            stripe_subscription_id:
              "admin_grant_#{organization_id}_#{System.system_time(:second)}",
            amount_usd: Decimal.new("0")
          })
          |> Repo.insert()

        # Grant credits if requested
        if grant_credits && tier_info.monthly_credits > 0 do
          {:ok, _} =
            Organizations.add_organization_credits(organization_id, tier_info.monthly_credits)
        end

        IO.puts("[OrgSubscriptions] Admin granted #{tier} subscription to org #{organization_id}")

        %{organization: updated_org, subscription: subscription}
      end)
    end
  end

  @doc """
  Admin creates a custom org account with specific settings.
  Sets custom price, seats, credits, and billing cycle.
  The org owner user account is created with email/password.
  setup_completed is set to false so the user can finish setup on first login.
  """
  def admin_create_org_account(attrs) do
    alias ClippsterServer.Accounts.User, as: UserSchema

    %{
      org_name: org_name,
      email: email,
      password: password,
      max_seats: max_seats,
      monthly_credits: monthly_credits,
      price_cents: price_cents,
      admin_id: admin_id
    } = attrs

    tier = Map.get(attrs, :tier, "enterprise_base")
    days = Map.get(attrs, :days, 30)

    # Check if email already exists before starting transaction
    if Repo.get_by(UserSchema, email: email) do
      {:error, :email_already_exists}
    else
      result =
        Repo.transaction(fn ->
          # Create the owner user account via email registration changeset
          case %UserSchema{}
               |> UserSchema.email_registration_changeset(%{
                 email: email,
                 password: password,
                 name: Map.get(attrs, :owner_name, org_name)
               })
               |> Repo.insert() do
            {:ok, user} ->
              # Mark email as verified (admin-created accounts are pre-verified)
              case user
                   |> UserSchema.verify_email_changeset()
                   |> Repo.update() do
                {:ok, user} ->
                  # Set account type to organization
                  case user
                       |> UserSchema.account_type_changeset(%{account_type: "organization"})
                       |> Repo.update() do
                    {:ok, user} ->
                      # Create the organization
                      case %Organization{}
                           |> Organization.create_changeset(%{
                             name: org_name,
                             description: Map.get(attrs, :description, ""),
                             owner_id: user.id
                           })
                           |> Repo.insert() do
                        {:ok, org} ->
                          # Set subscription fields
                          start_date = DateTime.utc_now() |> DateTime.truncate(:second)
                          end_date = DateTime.add(start_date, days, :day)

                          case org
                               |> Organization.subscription_changeset(%{
                                 subscription_status: "active",
                                 subscription_tier: tier,
                                 subscription_start_date: start_date,
                                 subscription_end_date: end_date,
                                 subscription_renewal_method: "admin",
                                 max_seats: if(max_seats == 0, do: nil, else: max_seats),
                                 monthly_credits: monthly_credits,
                                 admin_price_cents: price_cents,
                                 admin_billing_cycle_day: start_date.day,
                                 created_by_admin_id: admin_id,
                                 setup_completed: if(price_cents == 0, do: true, else: false)
                               })
                               |> Repo.update() do
                            {:ok, updated_org} ->
                              # Update user with owned_organization_id
                              case user
                                   |> Ecto.Changeset.change(%{
                                     owned_organization_id: updated_org.id
                                   })
                                   |> Repo.update() do
                                {:ok, _user} ->
                                  # Add owner as member
                                  IO.puts(
                                    "[OrgSubscriptions] Adding owner as member: org_id=#{updated_org.id}, user_id=#{user.id}"
                                  )

                                  case Organizations.add_member(updated_org.id, user.id, "owner") do
                                    {:ok, member} ->
                                      IO.puts(
                                        "[OrgSubscriptions] Successfully added owner as member: #{inspect(member)}"
                                      )

                                      # Grant initial credits if any
                                      if monthly_credits > 0 do
                                        case Organizations.add_organization_credits(
                                               updated_org.id,
                                               monthly_credits
                                             ) do
                                          {:ok, _} ->
                                            :ok

                                          {:error, reason} ->
                                            Repo.rollback({:credits_error, reason})
                                        end
                                      end

                                      # Create subscription history
                                      case %OrganizationSubscription{}
                                           |> OrganizationSubscription.create_changeset(%{
                                             organization_id: updated_org.id,
                                             subscription_type: "base",
                                             tier: tier,
                                             status: "active",
                                             start_date: start_date,
                                             end_date: end_date,
                                             seats: if(max_seats == 0, do: nil, else: max_seats),
                                             credits_granted:
                                               Decimal.new(to_string(monthly_credits)),
                                             payment_method: "admin",
                                             stripe_subscription_id:
                                               "admin_create_#{updated_org.id}_#{System.system_time(:second)}",
                                             amount_usd: Decimal.new(to_string(price_cents / 100))
                                           })
                                           |> Repo.insert() do
                                        {:ok, _sub} ->
                                          IO.puts(
                                            "[OrgSubscriptions] Admin created org account: #{org_name} (org #{updated_org.id})"
                                          )

                                          %{organization: updated_org, user: user}

                                        {:error, changeset} ->
                                          Repo.rollback({:subscription_history_error, changeset})
                                      end

                                    {:error, reason} ->
                                      Repo.rollback({:member_error, reason})
                                  end

                                {:error, changeset} ->
                                  Repo.rollback({:user_org_link_error, changeset})
                              end

                            {:error, changeset} ->
                              Repo.rollback({:org_subscription_error, changeset})
                          end

                        {:error, changeset} ->
                          Repo.rollback({:org_create_error, changeset})
                      end

                    {:error, changeset} ->
                      Repo.rollback({:account_type_error, changeset})
                  end

                {:error, changeset} ->
                  Repo.rollback({:email_verify_error, changeset})
              end

            {:error, changeset} ->
              Repo.rollback({:user_create_error, changeset})
          end
        end)

      case result do
        {:ok, data} ->
          {:ok, data}

        {:error, {error_type, reason}} ->
          IO.puts(
            "[OrgSubscriptions] Error creating org account: #{inspect(error_type)} - #{inspect(reason)}"
          )

          {:error, error_type}

        {:error, reason} ->
          IO.puts("[OrgSubscriptions] Error creating org account: #{inspect(reason)}")
          {:error, reason}
      end
    end
  end

  @doc """
  Admin creates an org and assigns an existing user as owner (by user_id).
  The existing user is NOT modified — their password/email stay the same.
  setup_completed is set to false so the owner is prompted to pay on first login.
  """
  def admin_create_org_account_for_existing_user(attrs) do
    alias ClippsterServer.Accounts.User, as: UserSchema

    %{
      org_name: org_name,
      user_id: user_id,
      max_seats: max_seats,
      monthly_credits: monthly_credits,
      price_cents: price_cents,
      admin_id: admin_id
    } = attrs

    tier = Map.get(attrs, :tier, "enterprise_base")
    days = Map.get(attrs, :days, 30)

    user = Repo.get(UserSchema, user_id)

    cond do
      is_nil(user) ->
        {:error, :user_not_found}

      user.owned_organization_id != nil ->
        {:error, :user_already_owns_org}

      true ->
        result =
          Repo.transaction(fn ->
            # Create the organization
            case %Organization{}
                 |> Organization.create_changeset(%{
                   name: org_name,
                   description: Map.get(attrs, :description, ""),
                   owner_id: user.id
                 })
                 |> Repo.insert() do
              {:ok, org} ->
                start_date = DateTime.utc_now() |> DateTime.truncate(:second)
                end_date = DateTime.add(start_date, days, :day)

                case org
                     |> Organization.subscription_changeset(%{
                       subscription_status: "active",
                       subscription_tier: tier,
                       subscription_start_date: start_date,
                       subscription_end_date: end_date,
                       subscription_renewal_method: "admin",
                       max_seats: if(max_seats == 0, do: nil, else: max_seats),
                       monthly_credits: monthly_credits,
                       admin_price_cents: price_cents,
                       admin_billing_cycle_day: start_date.day,
                       created_by_admin_id: admin_id,
                       setup_completed: if(price_cents == 0, do: true, else: false)
                     })
                     |> Repo.update() do
                  {:ok, updated_org} ->
                    # Link org to user
                    case user
                         |> Ecto.Changeset.change(%{owned_organization_id: updated_org.id})
                         |> Repo.update() do
                      {:ok, _user} ->
                        # Add owner as member
                        case Organizations.add_member(updated_org.id, user.id, "owner") do
                          {:ok, _member} ->
                            # Grant initial credits if any
                            if monthly_credits > 0 do
                              case Organizations.add_organization_credits(
                                     updated_org.id,
                                     monthly_credits
                                   ) do
                                {:ok, _} -> :ok
                                {:error, reason} -> Repo.rollback({:credits_error, reason})
                              end
                            end

                            # Create subscription history
                            case %OrganizationSubscription{}
                                 |> OrganizationSubscription.create_changeset(%{
                                   organization_id: updated_org.id,
                                   subscription_type: "base",
                                   tier: tier,
                                   status: "active",
                                   start_date: start_date,
                                   end_date: end_date,
                                   seats: if(max_seats == 0, do: nil, else: max_seats),
                                   credits_granted: Decimal.new(to_string(monthly_credits)),
                                   payment_method: "admin",
                                   stripe_subscription_id:
                                     "admin_create_existing_#{updated_org.id}_#{System.system_time(:second)}",
                                   amount_usd: Decimal.new(to_string(price_cents / 100))
                                 })
                                 |> Repo.insert() do
                              {:ok, _sub} ->
                                IO.puts(
                                  "[OrgSubscriptions] Admin created org for existing user #{user.id}: #{org_name} (org #{updated_org.id})"
                                )

                                %{organization: updated_org, user: user}

                              {:error, changeset} ->
                                Repo.rollback({:subscription_history_error, changeset})
                            end

                          {:error, reason} ->
                            Repo.rollback({:member_error, reason})
                        end

                      {:error, changeset} ->
                        Repo.rollback({:user_org_link_error, changeset})
                    end

                  {:error, changeset} ->
                    Repo.rollback({:org_subscription_error, changeset})
                end

              {:error, changeset} ->
                Repo.rollback({:org_create_error, changeset})
            end
          end)

        case result do
          {:ok, data} ->
            {:ok, data}

          {:error, {error_type, reason}} ->
            IO.puts(
              "[OrgSubscriptions] Error creating org for existing user: #{inspect(error_type)} - #{inspect(reason)}"
            )

            {:error, error_type}

          {:error, reason} ->
            IO.puts("[OrgSubscriptions] Error creating org for existing user: #{inspect(reason)}")
            {:error, reason}
        end
    end
  end

  @doc """
  Admin updates an existing org's subscription settings.
  Changes take effect at next billing cycle (stored as pending).
  If immediate is true, changes apply immediately.
  """
  def admin_update_org_subscription(organization_id, attrs, immediate \\ false) do
    Repo.transaction(fn ->
      org = Repo.get!(Organization, organization_id)

      changeset_attrs = %{}

      changeset_attrs =
        if Map.has_key?(attrs, :max_seats),
          do: Map.put(changeset_attrs, :max_seats, attrs.max_seats),
          else: changeset_attrs

      changeset_attrs =
        if Map.has_key?(attrs, :monthly_credits),
          do: Map.put(changeset_attrs, :monthly_credits, attrs.monthly_credits),
          else: changeset_attrs

      changeset_attrs =
        if Map.has_key?(attrs, :admin_price_cents),
          do: Map.put(changeset_attrs, :admin_price_cents, attrs.admin_price_cents),
          else: changeset_attrs

      changeset_attrs =
        if Map.has_key?(attrs, :tier),
          do: Map.put(changeset_attrs, :subscription_tier, attrs.tier),
          else: changeset_attrs

      if immediate do
        {:ok, updated_org} =
          org
          |> Organization.subscription_changeset(changeset_attrs)
          |> Repo.update()

        IO.puts(
          "[OrgSubscriptions] Admin updated org #{organization_id} subscription immediately"
        )

        updated_org
      else
        # Store pending changes - they'll be applied at next renewal
        # For now, if admin changes price, it takes effect next cycle
        # We apply seat/credit changes immediately but price changes are stored
        non_price_attrs = Map.drop(changeset_attrs, [:admin_price_cents])

        {:ok, updated_org} =
          org
          |> Organization.subscription_changeset(
            Map.merge(non_price_attrs, %{
              admin_price_cents: Map.get(attrs, :admin_price_cents, org.admin_price_cents)
            })
          )
          |> Repo.update()

        IO.puts(
          "[OrgSubscriptions] Admin updated org #{organization_id} subscription (price change at next cycle)"
        )

        updated_org
      end
    end)
  end

  @doc """
  Admin directly sets the seat count for an organization.
  """
  def admin_set_seats(organization_id, max_seats) do
    org = Repo.get!(Organization, organization_id)

    org
    |> Organization.subscription_changeset(%{max_seats: max_seats})
    |> Repo.update()
  end

  # ============================================================================
  # Subscription Tier Changes (User-initiated)
  # ============================================================================

  @doc """
  Changes an organization's subscription tier.
  Upgrades are applied immediately with proration.
  Downgrades are scheduled for the next billing cycle.
  """
  def change_subscription_tier(organization_id, new_tier) do
    org = Repo.get!(Organization, organization_id)
    new_tier_info = get_tier_info(new_tier)

    current_tier_info =
      if org.subscription_tier, do: get_tier_info(org.subscription_tier), else: nil

    cond do
      is_nil(new_tier_info) ->
        {:error, :invalid_tier}

      org.subscription_status != "active" ->
        {:error, :no_active_subscription}

      org.subscription_tier == new_tier ->
        {:error, :same_tier}

      is_nil(current_tier_info) ->
        {:error, :no_current_tier}

      new_tier_info.usd > current_tier_info.usd ->
        # Upgrade - apply immediately
        apply_tier_upgrade(org, new_tier, new_tier_info)

      true ->
        # Downgrade - schedule for next billing cycle
        schedule_tier_downgrade(org, new_tier)
    end
  end

  defp apply_tier_upgrade(org, new_tier, new_tier_info) do
    if org.stripe_subscription_id && org.subscription_renewal_method == "stripe" do
      # Retrieve current Stripe subscription to get the item ID
      case Stripe.Subscription.retrieve(org.stripe_subscription_id) do
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
                organization_id: to_string(org.id),
                subscription_tier: new_tier,
                subscription_type: "base",
                monthly_credits: to_string(new_tier_info.monthly_credits)
              }
            }

            case Stripe.Subscription.update(org.stripe_subscription_id, update_params) do
              {:ok, _updated_sub} ->
                # Update DB immediately for upgrades
                Repo.transaction(fn ->
                  {:ok, updated_org} =
                    org
                    |> Organization.subscription_changeset(%{
                      subscription_tier: new_tier,
                      max_seats: new_tier_info.seats,
                      monthly_credits: new_tier_info.monthly_credits,
                      pending_subscription_tier: nil
                    })
                    |> Repo.update()

                  # Grant additional credits if upgrading to a tier with more credits
                  current_credits = org.monthly_credits || 0
                  new_credits = new_tier_info.monthly_credits

                  if new_credits > current_credits do
                    credit_diff = new_credits - current_credits
                    {:ok, _} = Organizations.add_organization_credits(org.id, credit_diff)
                  end

                  IO.puts(
                    "[OrgSubscriptions] Upgraded org #{org.id} to #{new_tier} with Stripe proration"
                  )

                  updated_org
                end)

              {:error, %Stripe.Error{message: message}} ->
                IO.puts("[OrgSubscriptions] Stripe upgrade error for org #{org.id}: #{message}")
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
      Repo.transaction(fn ->
        {:ok, updated_org} =
          org
          |> Organization.subscription_changeset(%{
            subscription_tier: new_tier,
            max_seats: new_tier_info.seats,
            monthly_credits: new_tier_info.monthly_credits,
            pending_subscription_tier: nil
          })
          |> Repo.update()

        # Grant additional credits if upgrading to a tier with more credits
        current_credits = org.monthly_credits || 0
        new_credits = new_tier_info.monthly_credits

        if new_credits > current_credits do
          credit_diff = new_credits - current_credits
          {:ok, _} = Organizations.add_organization_credits(org.id, credit_diff)
        end

        IO.puts("[OrgSubscriptions] Upgraded org #{org.id} to #{new_tier} (non-Stripe)")

        updated_org
      end)
    end
  end

  defp schedule_tier_downgrade(org, new_tier) do
    org
    |> Organization.subscription_changeset(%{pending_subscription_tier: new_tier})
    |> Repo.update()
  end

  @doc """
  Applies a pending tier change (called during renewal).
  """
  def apply_pending_tier_change(organization_id) do
    org = Repo.get!(Organization, organization_id)

    if org.pending_subscription_tier do
      new_tier = org.pending_subscription_tier
      tier_info = get_tier_info(new_tier)

      if tier_info do
        org
        |> Organization.subscription_changeset(%{
          subscription_tier: new_tier,
          max_seats: tier_info.seats,
          monthly_credits: tier_info.monthly_credits,
          pending_subscription_tier: nil
        })
        |> Repo.update()
      else
        {:error, :invalid_pending_tier}
      end
    else
      {:ok, org}
    end
  end
end
