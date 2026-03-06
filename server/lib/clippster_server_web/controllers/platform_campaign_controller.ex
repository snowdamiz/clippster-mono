defmodule ClippsterServerWeb.PlatformCampaignController do
  use ClippsterServerWeb, :controller
  
  alias ClippsterServer.PlatformCampaigns
  alias ClippsterServer.Campaigns
  alias ClippsterServer.Repo
  
  require Logger

  # Admin-only actions
  plug :require_admin

  defp require_admin(conn, _opts) do
    user = conn.assigns[:current_user]

    if user && user.is_admin do
      conn
    else
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Admin access required"})
      |> halt()
    end
  end

  @doc """
  Get revenue allocation settings
  """
  def get_revenue_settings(conn, _params) do
    settings = PlatformCampaigns.get_revenue_allocation_settings()

    json(conn, %{
      success: true,
      settings: %{
        enabled: settings.enabled,
        allocation_percentage: Decimal.to_float(settings.allocation_percentage),
        current_balance: Decimal.to_float(settings.current_balance),
        total_allocated: Decimal.to_float(settings.total_allocated),
        total_spent: Decimal.to_float(settings.total_spent)
      }
    })
  end

  @doc """
  Update revenue allocation settings
  """
  def update_revenue_settings(conn, params) do
    attrs = %{
      enabled: params["enabled"],
      allocation_percentage: params["allocation_percentage"]
    }

    case PlatformCampaigns.update_revenue_allocation_settings(attrs) do
      {:ok, settings} ->
        json(conn, %{
          success: true,
          settings: %{
            enabled: settings.enabled,
            allocation_percentage: Decimal.to_float(settings.allocation_percentage),
            current_balance: Decimal.to_float(settings.current_balance),
            total_allocated: Decimal.to_float(settings.total_allocated),
            total_spent: Decimal.to_float(settings.total_spent)
          }
        })

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, errors: format_errors(changeset)})
    end
  end

  @doc """
  Get revenue allocation transactions
  """
  def get_revenue_transactions(conn, params) do
    limit = Map.get(params, "limit", "100") |> String.to_integer()
    offset = Map.get(params, "offset", "0") |> String.to_integer()

    transactions = PlatformCampaigns.list_revenue_allocation_transactions(limit: limit, offset: offset)

    transactions_data = Enum.map(transactions, fn t ->
      %{
        id: t.id,
        type: t.transaction_type,
        amount: Decimal.to_float(t.amount),
        balance_after: Decimal.to_float(t.balance_after),
        description: t.description,
        campaign_id: t.campaign_id,
        subscription_id: t.subscription_id,
        created_at: t.inserted_at
      }
    end)

    json(conn, %{
      success: true,
      transactions: transactions_data
    })
  end

  @doc """
  Create a platform campaign
  """
  def create_campaign(conn, params) do
    _user = conn.assigns.current_user

    # Build campaign attributes
    campaign_attrs = %{
      title: params["title"],
      description: params["description"],
      budget: params["budget"] || 0,
      starts_at: params["start_date"],
      ends_at: params["end_date"],
      join_type: params["join_type"] || "open",
      allowed_platforms: params["allowed_platforms"] || [],
      payment_model: params["payment_model"] || "cpm",
      cpm: params["cpm_rate"] || 0,
      per_clip_amount: params["per_clip_amount"],
      is_platform_campaign: true,
      platform_payment_model: params["platform_payment_model"],
      status: params["status"] || "active"
    }

    # Create campaign directly via changeset (no org required for platform campaigns)
    changeset = Campaigns.Campaign.create_changeset(%Campaigns.Campaign{}, campaign_attrs)
    
    case Repo.insert(changeset) do
      {:ok, campaign} ->
        # Create reward tiers if milestone_rewards model
        if params["platform_payment_model"] == "milestone_rewards" && params["reward_tiers"] do
          create_reward_tiers(campaign.id, params["reward_tiers"])
        end

        campaign = Repo.preload(campaign, [:reward_tiers])

        json(conn, %{
          success: true,
          campaign: format_campaign(campaign)
        })

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, errors: format_errors(changeset)})
    end
  end

  defp create_reward_tiers(campaign_id, tiers) when is_list(tiers) do
    Enum.each(tiers, fn tier_params ->
      attrs = Map.put(tier_params, "campaign_id", campaign_id)
      PlatformCampaigns.create_reward_tier(attrs)
    end)
  end

  @doc """
  Update a platform campaign
  """
  def update_campaign(conn, %{"id" => campaign_id} = params) do
    campaign = Campaigns.get_campaign(campaign_id)

    if campaign && campaign.is_platform_campaign do
      # Update campaign directly via changeset (no org check for platform campaigns)
      changeset = Campaigns.Campaign.update_changeset(campaign, params)
      
      case Repo.update(changeset) do
        {:ok, updated_campaign} ->
          # Update reward tiers if provided
          if params["reward_tiers"] do
            # Delete existing tiers
            existing_tiers = PlatformCampaigns.list_reward_tiers(campaign_id)
            Enum.each(existing_tiers, &PlatformCampaigns.delete_reward_tier/1)
            
            # Create new tiers
            create_reward_tiers(campaign_id, params["reward_tiers"])
          end

          updated_campaign = Repo.preload(updated_campaign, [:reward_tiers], force: true)

          json(conn, %{
            success: true,
            campaign: format_campaign(updated_campaign)
          })

        {:error, changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, errors: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{success: false, error: "Platform campaign not found"})
    end
  end

  @doc """
  List all platform campaigns
  """
  def list_campaigns(conn, _params) do
    import Ecto.Query
    
    campaigns = 
      from(c in Campaigns.Campaign,
        where: c.is_platform_campaign == true,
        order_by: [desc: c.inserted_at],
        preload: [:reward_tiers]
      )
      |> Repo.all()

    campaigns_data = Enum.map(campaigns, &format_campaign/1)

    json(conn, %{
      success: true,
      campaigns: campaigns_data
    })
  end

  @doc """
  Get a single platform campaign
  """
  def get_campaign(conn, %{"id" => campaign_id}) do
    campaign = 
      Campaigns.Campaign
      |> Repo.get(campaign_id)
      |> Repo.preload([:reward_tiers])

    if campaign && campaign.is_platform_campaign do
      json(conn, %{
        success: true,
        campaign: format_campaign(campaign)
      })
    else
      conn
      |> put_status(:not_found)
      |> json(%{success: false, error: "Platform campaign not found"})
    end
  end

  @doc """
  Delete a platform campaign
  """
  def delete_campaign(conn, %{"id" => campaign_id}) do
    campaign = Campaigns.get_campaign(campaign_id)

    if campaign && campaign.is_platform_campaign do
      # Delete campaign directly (no org check for platform campaigns)
      case Repo.delete(campaign) do
        {:ok, _} ->
          json(conn, %{success: true})

        {:error, changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, errors: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{success: false, error: "Platform campaign not found"})
    end
  end

  @doc """
  Get platform campaign statistics
  """
  def get_stats(conn, _params) do
    stats = PlatformCampaigns.get_platform_campaign_stats()

    json(conn, %{
      success: true,
      stats: %{
        total_campaigns: stats.total_campaigns,
        active_campaigns: stats.active_campaigns,
        total_rewards_granted: stats.total_rewards_granted,
        total_budget_spent: Decimal.to_float(stats.total_budget_spent)
      }
    })
  end

  @doc """
  Get reward grants for a campaign
  """
  def get_campaign_rewards(conn, %{"campaign_id" => campaign_id}) do
    grants = PlatformCampaigns.list_campaign_reward_grants(campaign_id)

    grants_data = Enum.map(grants, fn grant ->
      %{
        id: grant.id,
        user_id: grant.user_id,
        user_email: grant.user.email,
        submission_id: grant.submission_id,
        tier_number: grant.reward_tier.tier_number,
        views_required: grant.reward_tier.views_required,
        granted_at: grant.granted_at,
        stripe_coupon_id: grant.stripe_coupon_id,
        free_months_granted: grant.free_months_granted,
        ai_credits_granted: grant.ai_credits_granted
      }
    end)

    json(conn, %{
      success: true,
      grants: grants_data
    })
  end

  # Helper functions

  defp format_campaign(campaign) do
    reward_tiers = if Ecto.assoc_loaded?(campaign.reward_tiers) do
      Enum.map(campaign.reward_tiers, &format_reward_tier/1)
    else
      []
    end

    %{
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      budget: campaign.budget && Decimal.to_float(campaign.budget),
      spent_budget: campaign.spent_budget && Decimal.to_float(campaign.spent_budget),
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      status: campaign.status,
      join_type: campaign.join_type,
      allowed_platforms: campaign.allowed_platforms,
      payment_model: campaign.payment_model,
      cpm_rate: campaign.cpm_rate && Decimal.to_float(campaign.cpm_rate),
      platform_payment_model: campaign.platform_payment_model,
      is_platform_campaign: campaign.is_platform_campaign,
      reward_tiers: reward_tiers,
      created_at: campaign.inserted_at,
      updated_at: campaign.updated_at
    }
  end

  defp format_reward_tier(tier) do
    %{
      id: tier.id,
      tier_number: tier.tier_number,
      views_required: tier.views_required,
      discount_enabled: tier.discount_enabled,
      discount_percent: tier.discount_percent,
      discount_duration_months: tier.discount_duration_months,
      discount_recurring: tier.discount_recurring,
      discount_applies_to_tiers: tier.discount_applies_to_tiers,
      free_months_enabled: tier.free_months_enabled,
      free_months_count: tier.free_months_count,
      free_months_recurring: tier.free_months_recurring,
      free_months_applies_to_tiers: tier.free_months_applies_to_tiers,
      ai_credits_enabled: tier.ai_credits_enabled,
      ai_credits_amount: tier.ai_credits_amount,
      ai_credits_recurring: tier.ai_credits_recurring
    }
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
