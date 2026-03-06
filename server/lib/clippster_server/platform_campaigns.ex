defmodule ClippsterServer.PlatformCampaigns do
  @moduledoc """
  The PlatformCampaigns context handles platform-owned campaigns with various payment models.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.PlatformCampaigns.{RewardTier, RewardGrant, RevenueAllocationSettings, RevenueAllocationTransaction}
  alias ClippsterServer.Campaigns.{Campaign, CampaignSubmission}
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Credits
  alias ClippsterServer.Subscriptions

  ## Revenue Allocation Settings

  @doc """
  Gets or creates the revenue allocation settings (singleton).
  """
  def get_revenue_allocation_settings do
    case Repo.one(RevenueAllocationSettings) do
      nil ->
        %RevenueAllocationSettings{}
        |> RevenueAllocationSettings.changeset(%{
          enabled: false,
          allocation_percentage: Decimal.new("0.00"),
          current_balance: Decimal.new("0.00"),
          total_allocated: Decimal.new("0.00"),
          total_spent: Decimal.new("0.00")
        })
        |> Repo.insert!()

      settings ->
        settings
    end
  end

  @doc """
  Updates revenue allocation settings.
  """
  def update_revenue_allocation_settings(attrs) do
    settings = get_revenue_allocation_settings()

    settings
    |> RevenueAllocationSettings.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Allocates revenue from a subscription payment to the platform fund.
  """
  def allocate_subscription_revenue(subscription_id, payment_amount) do
    settings = get_revenue_allocation_settings()

    if settings.enabled do
      allocation_amount = 
        Decimal.mult(payment_amount, Decimal.div(settings.allocation_percentage, Decimal.new("100")))
        |> Decimal.round(2)

      new_balance = Decimal.add(settings.current_balance, allocation_amount)
      new_total = Decimal.add(settings.total_allocated, allocation_amount)

      Repo.transaction(fn ->
        # Update settings
        {:ok, updated_settings} =
          settings
          |> RevenueAllocationSettings.changeset(%{
            current_balance: new_balance,
            total_allocated: new_total
          })
          |> Repo.update()

        # Create transaction record
        %RevenueAllocationTransaction{}
        |> RevenueAllocationTransaction.changeset(%{
          transaction_type: "allocation",
          amount: allocation_amount,
          balance_after: new_balance,
          subscription_id: subscription_id,
          description: "Automatic allocation from subscription payment"
        })
        |> Repo.insert!()

        updated_settings
      end)
    else
      {:ok, settings}
    end
  end

  @doc """
  Records campaign spending from the platform fund.
  """
  def record_campaign_spend(campaign_id, amount, description \\ nil) do
    settings = get_revenue_allocation_settings()
    
    new_balance = Decimal.sub(settings.current_balance, amount)
    new_total_spent = Decimal.add(settings.total_spent, amount)

    if Decimal.compare(new_balance, Decimal.new("0")) == :lt do
      {:error, :insufficient_funds}
    else
      Repo.transaction(fn ->
        # Update settings
        {:ok, updated_settings} =
          settings
          |> RevenueAllocationSettings.changeset(%{
            current_balance: new_balance,
            total_spent: new_total_spent
          })
          |> Repo.update()

        # Create transaction record
        %RevenueAllocationTransaction{}
        |> RevenueAllocationTransaction.changeset(%{
          transaction_type: "campaign_spend",
          amount: Decimal.negate(amount),
          balance_after: new_balance,
          campaign_id: campaign_id,
          description: description || "Campaign payment"
        })
        |> Repo.insert!()

        updated_settings
      end)
    end
  end

  @doc """
  Lists all revenue allocation transactions.
  """
  def list_revenue_allocation_transactions(opts \\ []) do
    limit = Keyword.get(opts, :limit, 100)
    offset = Keyword.get(opts, :offset, 0)

    RevenueAllocationTransaction
    |> order_by([t], desc: t.inserted_at)
    |> limit(^limit)
    |> offset(^offset)
    |> preload([:campaign, :subscription, :created_by_user])
    |> Repo.all()
  end

  ## Reward Tiers

  @doc """
  Creates a reward tier for a campaign.
  """
  def create_reward_tier(attrs) do
    %RewardTier{}
    |> RewardTier.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a reward tier.
  """
  def update_reward_tier(%RewardTier{} = tier, attrs) do
    tier
    |> RewardTier.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a reward tier.
  """
  def delete_reward_tier(%RewardTier{} = tier) do
    Repo.delete(tier)
  end

  @doc """
  Lists reward tiers for a campaign.
  """
  def list_reward_tiers(campaign_id) do
    RewardTier
    |> where([t], t.campaign_id == ^campaign_id)
    |> order_by([t], asc: t.tier_number)
    |> Repo.all()
  end

  @doc """
  Gets a single reward tier.
  """
  def get_reward_tier(id) do
    Repo.get(RewardTier, id)
  end

  ## Reward Grants

  @doc """
  Checks if a submission has reached any reward milestones and grants rewards.
  """
  def check_and_grant_rewards(submission_id) do
    submission = 
      CampaignSubmission
      |> where([s], s.id == ^submission_id)
      |> preload([:campaign, :user])
      |> Repo.one()

    if submission && submission.campaign.is_platform_campaign && 
       submission.campaign.platform_payment_model == "milestone_rewards" do
      
      tiers = list_reward_tiers(submission.campaign_id)
      total_views = submission.total_views || 0

      Enum.each(tiers, fn tier ->
        if total_views >= tier.views_required do
          grant_tier_rewards(submission, tier)
        end
      end)
    end

    :ok
  end

  defp grant_tier_rewards(submission, tier) do
    # Check if already granted (for non-recurring rewards)
    existing_grant = 
      RewardGrant
      |> where([g], g.submission_id == ^submission.id and g.reward_tier_id == ^tier.id)
      |> Repo.one()

    should_grant = case existing_grant do
      nil -> true
      _grant -> 
        # For recurring rewards, check if any are enabled and recurring
        tier.discount_recurring || tier.free_months_recurring || tier.ai_credits_recurring
    end

    if should_grant do
      Repo.transaction(fn ->
        grant_attrs = %{
          campaign_id: submission.campaign_id,
          submission_id: submission.id,
          user_id: submission.user_id,
          reward_tier_id: tier.id,
          granted_at: DateTime.utc_now()
        }

        # Grant discount
        grant_attrs = if tier.discount_enabled do
          coupon_id = create_stripe_coupon(tier, submission.user)
          Map.put(grant_attrs, :stripe_coupon_id, coupon_id)
        else
          grant_attrs
        end

        # Grant free months
        grant_attrs = if tier.free_months_enabled do
          extend_subscription(submission.user, tier)
          Map.put(grant_attrs, :free_months_granted, tier.free_months_count)
        else
          grant_attrs
        end

        # Grant AI credits
        grant_attrs = if tier.ai_credits_enabled do
          Credits.add_credits(submission.user_id, tier.ai_credits_amount, "Platform campaign reward")
          Map.put(grant_attrs, :ai_credits_granted, tier.ai_credits_amount)
        else
          grant_attrs
        end

        %RewardGrant{}
        |> RewardGrant.changeset(grant_attrs)
        |> Repo.insert!()
      end)
    end
  end

  defp create_stripe_coupon(tier, user) do
    # Check if user's tier is eligible
    user_tier = user.subscription_tier || "free"
    
    applies_to_tiers = if Enum.empty?(tier.discount_applies_to_tiers) do
      ["starter", "creator", "pro"]
    else
      tier.discount_applies_to_tiers
    end

    if user_tier in applies_to_tiers do
      # Create Stripe coupon
      duration = if tier.discount_recurring, do: "repeating", else: "once"
      
      coupon_params = %{
        percent_off: tier.discount_percent,
        duration: duration,
        name: "Platform Campaign Reward - #{tier.discount_percent}% off"
      }

      coupon_params = if tier.discount_recurring do
        Map.put(coupon_params, :duration_in_months, tier.discount_duration_months)
      else
        coupon_params
      end

      case Stripe.Coupon.create(coupon_params) do
        {:ok, coupon} ->
          # Apply coupon to user's subscription
          apply_coupon_to_user(user, coupon.id)
          coupon.id

        {:error, _} ->
          nil
      end
    else
      nil
    end
  end

  defp apply_coupon_to_user(user, coupon_id) do
    if user.stripe_customer_id do
      # Update customer's default coupon
      Stripe.Customer.update(user.stripe_customer_id, %{coupon: coupon_id})
    end
  end

  defp extend_subscription(user, tier) do
    user_tier = user.subscription_tier || "free"
    
    applies_to_tiers = if Enum.empty?(tier.free_months_applies_to_tiers) do
      ["starter", "creator", "pro"]
    else
      tier.free_months_applies_to_tiers
    end

    if user_tier in applies_to_tiers && user.subscription_end_date do
      new_end_date = 
        user.subscription_end_date
        |> DateTime.from_naive!("Etc/UTC")
        |> DateTime.add(tier.free_months_count * 30 * 24 * 60 * 60, :second)
        |> DateTime.to_naive()

      user
      |> Ecto.Changeset.change(%{subscription_end_date: new_end_date})
      |> Repo.update!()
    end
  end

  @doc """
  Lists reward grants for a user.
  """
  def list_user_reward_grants(user_id) do
    RewardGrant
    |> where([g], g.user_id == ^user_id)
    |> order_by([g], desc: g.granted_at)
    |> preload([:campaign, :submission, :reward_tier])
    |> Repo.all()
  end

  @doc """
  Lists reward grants for a campaign.
  """
  def list_campaign_reward_grants(campaign_id) do
    RewardGrant
    |> where([g], g.campaign_id == ^campaign_id)
    |> order_by([g], desc: g.granted_at)
    |> preload([:user, :submission, :reward_tier])
    |> Repo.all()
  end

  ## Platform Campaign Helpers

  @doc """
  Checks if a campaign is a platform campaign.
  """
  def platform_campaign?(%Campaign{is_platform_campaign: true}), do: true
  def platform_campaign?(_), do: false

  @doc """
  Gets platform campaign statistics.
  """
  def get_platform_campaign_stats do
    total_campaigns = 
      Campaign
      |> where([c], c.is_platform_campaign == true)
      |> Repo.aggregate(:count)

    active_campaigns = 
      Campaign
      |> where([c], c.is_platform_campaign == true and c.status == "active")
      |> Repo.aggregate(:count)

    total_rewards_granted = 
      RewardGrant
      |> Repo.aggregate(:count)

    total_budget_spent = 
      Campaign
      |> where([c], c.is_platform_campaign == true)
      |> select([c], sum(c.spent_budget))
      |> Repo.one() || Decimal.new("0")

    %{
      total_campaigns: total_campaigns,
      active_campaigns: active_campaigns,
      total_rewards_granted: total_rewards_granted,
      total_budget_spent: total_budget_spent
    }
  end
end
