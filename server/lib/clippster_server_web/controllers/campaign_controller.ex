defmodule ClippsterServerWeb.CampaignController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Organizations
  alias ClippsterServer.Storage

  plug ClippsterServerWeb.AuthPlug

  # ============================================================================
  # Public Campaign Routes (for marketplace)
  # ============================================================================

  @doc """
  List all active campaigns (marketplace view).
  """
  def index(conn, params) do
    limit = Map.get(params, "limit", "50") |> String.to_integer()
    offset = Map.get(params, "offset", "0") |> String.to_integer()

    campaigns = Campaigns.list_active_campaigns(limit: limit, offset: offset)

    json(conn, %{
      success: true,
      campaigns: Enum.map(campaigns, &serialize_campaign/1)
    })
  end

  @doc """
  Get a single campaign by ID.
  """
  def show(conn, %{"id" => id}) do
    case Campaigns.get_campaign_with_details(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Campaign not found"})

      campaign ->
        user = conn.assigns.current_user
        participant = Campaigns.get_participant_by_campaign_and_user(campaign.id, user.id)
        stats = Campaigns.get_campaign_stats(campaign.id)

        json(conn, %{
          success: true,
          campaign: serialize_campaign_with_details(campaign),
          participation: serialize_participation(participant),
          stats: stats
        })
    end
  end

  @doc """
  Apply to join a campaign.
  """
  def apply(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    # Free tier users cannot apply to campaigns
    if is_free_tier?(user) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Campaign participation requires a paid subscription"})
    else
      application_note = Map.get(params, "application_note")

      case Campaigns.get_campaign(id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Campaign not found"})

        campaign ->
          case Campaigns.apply_to_campaign(campaign, user, application_note) do
            {:ok, participant} ->
              json(conn, %{
                success: true,
                participant: serialize_participant(participant),
                message: if(campaign.join_type == "open", do: "Joined campaign", else: "Application submitted")
              })

            {:error, :campaign_not_active} ->
              conn
              |> put_status(400)
              |> json(%{success: false, error: "Campaign is not active"})

            {:error, :already_participating} ->
              conn
              |> put_status(400)
              |> json(%{success: false, error: "Already participating in this campaign"})

            {:error, changeset} ->
              conn
              |> put_status(422)
              |> json(%{success: false, error: format_errors(changeset)})
          end
      end
    end
  end

  # ============================================================================
  # User Campaign Routes
  # ============================================================================

  @doc """
  List campaigns the current user has joined.
  """
  def my_campaigns(conn, params) do
    user = conn.assigns.current_user
    status = Map.get(params, "status")

    participants = Campaigns.list_user_campaigns(user.id, status: status)

    json(conn, %{
      success: true,
      campaigns: Enum.map(participants, fn p ->
        serialize_campaign(p.campaign)
        |> Map.put(:joined_at, p.inserted_at)
      end)
    })
  end

  @doc """
  List campaigns the current user has joined that include a specific creator profile.
  Used by LiveClip to check if a creator is part of any campaigns.
  """
  def campaigns_by_creator_profile(conn, %{"creator_profile_id" => creator_profile_id}) do
    user = conn.assigns.current_user

    participants = Campaigns.list_user_campaigns_by_creator_profile(user.id, creator_profile_id)

    json(conn, %{
      success: true,
      campaigns: Enum.map(participants, fn p ->
        serialize_campaign(p.campaign)
        |> Map.put(:joined_at, p.inserted_at)
      end)
    })
  end

  @doc """
  List submissions for the current user.
  """
  def my_submissions(conn, params) do
    user = conn.assigns.current_user
    campaign_id = Map.get(params, "campaign_id")

    submissions = Campaigns.list_user_submissions(user.id, campaign_id: campaign_id)

    json(conn, %{
      success: true,
      submissions: Enum.map(submissions, &serialize_submission/1)
    })
  end

  @doc """
  Get earnings summary for the current user.
  """
  def my_earnings(conn, _params) do
    user = conn.assigns.current_user

    summary = Campaigns.get_user_earnings_summary(user.id)
    payments = Campaigns.list_user_payments(user.id)

    json(conn, %{
      success: true,
      summary: summary,
      payments: Enum.map(payments, &serialize_payment/1)
    })
  end

  @doc """
  Submit a clip to a campaign.
  """
  def submit_clip(conn, %{"id" => campaign_id} = params) do
    user = conn.assigns.current_user

    if is_free_tier?(user) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Campaign submissions require a paid subscription"})
    else
      case Campaigns.get_campaign(campaign_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Campaign not found"})

        campaign ->
          attrs = %{
            clip_url: Map.get(params, "clip_url"),
            platform: Map.get(params, "platform"),
            social_account_id: Map.get(params, "social_account_id")
          }

          case Campaigns.submit_clip(campaign, user, attrs) do
            {:ok, submission} ->
              json(conn, %{
                success: true,
                submission: serialize_submission(submission)
              })

            {:error, :not_a_participant} ->
              conn
              |> put_status(403)
              |> json(%{success: false, error: "You must join the campaign first"})

            {:error, :campaign_not_active} ->
              conn
              |> put_status(400)
              |> json(%{success: false, error: "Campaign is not active"})

            {:error, :platform_not_allowed} ->
              conn
              |> put_status(400)
              |> json(%{success: false, error: "Platform not allowed for this campaign"})

            {:error, changeset} ->
              conn
              |> put_status(422)
              |> json(%{success: false, error: format_errors(changeset)})
          end
      end
    end
  end

  # ============================================================================
  # Organization Campaign Management
  # ============================================================================

  @doc """
  List campaigns for an organization.
  """
  def org_index(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user
    status = Map.get(params, "status")

    if Organizations.is_member?(org_id, user.id) do
      campaigns = Campaigns.list_organization_campaigns(org_id, status: status)

      json(conn, %{
        success: true,
        campaigns: Enum.map(campaigns, &serialize_campaign/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Create a new campaign for an organization.
  """
  def create(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    case Organizations.get_organization(org_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found"})

      organization ->
        attrs = %{
          title: Map.get(params, "title"),
          description: Map.get(params, "description"),
          cover_image_url: strip_query_params(Map.get(params, "cover_image_url")),
          creator_profile_id: Map.get(params, "creator_profile_id"),
          budget: Map.get(params, "budget"),
          cpm: Map.get(params, "cpm"),
          cpm_views: Map.get(params, "cpm_views"),
          min_views_for_payment: Map.get(params, "min_views_for_payment"),
          join_type: Map.get(params, "join_type", "open"),
          allowed_platforms: Map.get(params, "allowed_platforms", []),
          payment_methods: Map.get(params, "payment_methods", []),
          status: Map.get(params, "status", "draft"),
          starts_at: parse_datetime(Map.get(params, "starts_at")),
          ends_at: parse_datetime(Map.get(params, "ends_at")),
          global_intro_id: Map.get(params, "global_intro_id"),
          global_outro_id: Map.get(params, "global_outro_id"),
          global_watermarks: Map.get(params, "global_watermarks"),
          require_watermark: Map.get(params, "require_watermark"),
          require_intro: Map.get(params, "require_intro"),
          require_outro: Map.get(params, "require_outro")
        }

        case Campaigns.create_campaign(organization, attrs, user) do
          {:ok, campaign} ->
            json(conn, %{
              success: true,
              campaign: serialize_campaign(campaign)
            })

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized to create campaigns"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  Update a campaign.
  """
  def update(conn, %{"organization_id" => org_id, "id" => id} = params) do
    user = conn.assigns.current_user

    with campaign when not is_nil(campaign) <- Campaigns.get_campaign(id),
         true <- campaign.organization_id == String.to_integer(org_id) do
      attrs = params
        |> Map.take(["title", "description", "cover_image_url", "creator_profile_id",
                     "budget", "cpm", "min_views_for_payment", "join_type",
                     "allowed_platforms", "payment_methods", "status",
                     "global_watermarks", "global_intro_id", "global_outro_id",
                     "require_watermark", "require_intro", "require_outro"])
        |> maybe_add_dates(params)
        |> maybe_strip_cover_image_url()

      case Campaigns.update_campaign(campaign, attrs, user) do
        {:ok, updated} ->
          json(conn, %{
            success: true,
            campaign: serialize_campaign(updated)
          })

        {:error, :unauthorized} ->
          conn
          |> put_status(403)
          |> json(%{success: false, error: "Not authorized to update this campaign"})

        {:error, changeset} ->
          conn
          |> put_status(422)
          |> json(%{success: false, error: format_errors(changeset)})
      end
    else
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Campaign not found"})

      false ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Campaign does not belong to this organization"})
    end
  end

  @doc """
  Delete a campaign.
  """
  def delete(conn, %{"organization_id" => org_id, "id" => id}) do
    user = conn.assigns.current_user

    with campaign when not is_nil(campaign) <- Campaigns.get_campaign(id),
         true <- campaign.organization_id == String.to_integer(org_id) do
      case Campaigns.delete_campaign(campaign, user) do
        {:ok, _} ->
          json(conn, %{success: true})

        {:error, :unauthorized} ->
          conn
          |> put_status(403)
          |> json(%{success: false, error: "Not authorized to delete this campaign"})
      end
    else
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Campaign not found"})

      false ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Campaign does not belong to this organization"})
    end
  end

  @doc """
  Pause a campaign.
  """
  def pause(conn, %{"organization_id" => _org_id, "id" => id}) do
    user = conn.assigns.current_user

    case Campaigns.get_campaign(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Campaign not found"})

      campaign ->
        case Campaigns.pause_campaign(campaign, user) do
          {:ok, updated} ->
            json(conn, %{success: true, campaign: serialize_campaign(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  @doc """
  Activate a campaign.
  """
  def activate(conn, %{"organization_id" => _org_id, "id" => id}) do
    user = conn.assigns.current_user

    case Campaigns.get_campaign(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Campaign not found"})

      campaign ->
        case Campaigns.activate_campaign(campaign, user) do
          {:ok, updated} ->
            json(conn, %{success: true, campaign: serialize_campaign(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  @doc """
  Complete a campaign.
  """
  def complete(conn, %{"organization_id" => _org_id, "id" => id}) do
    user = conn.assigns.current_user

    case Campaigns.get_campaign(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Campaign not found"})

      campaign ->
        case Campaigns.complete_campaign(campaign, user) do
          {:ok, updated} ->
            json(conn, %{success: true, campaign: serialize_campaign(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  # ============================================================================
  # Campaign Creator Profiles
  # ============================================================================

  @doc """
  List creator profiles assigned to a campaign.
  """
  def list_creator_profiles(conn, %{"organization_id" => org_id, "id" => campaign_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      campaign_profiles = Campaigns.list_campaign_creator_profiles(campaign_id)

      json(conn, %{
        success: true,
        creator_profiles: Enum.map(campaign_profiles, fn ccp ->
          serialize_creator_profile(ccp.creator_profile)
        end)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Add a creator profile to a campaign.
  """
  def add_creator_profile(conn, %{"organization_id" => _org_id, "id" => campaign_id, "creator_profile_id" => profile_id}) do
    user = conn.assigns.current_user

    case Campaigns.get_campaign(campaign_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Campaign not found"})

      campaign ->
        case Campaigns.add_creator_profile_to_campaign(campaign, profile_id, user) do
          {:ok, _} ->
            json(conn, %{success: true, message: "Creator profile added to campaign"})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  Remove a creator profile from a campaign.
  """
  def remove_creator_profile(conn, %{"organization_id" => _org_id, "id" => campaign_id, "creator_profile_id" => profile_id}) do
    user = conn.assigns.current_user

    case Campaigns.get_campaign(campaign_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Campaign not found"})

      campaign ->
        case Campaigns.remove_creator_profile_from_campaign(campaign, profile_id, user) do
          {:ok, _} ->
            json(conn, %{success: true, message: "Creator profile removed from campaign"})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  @doc """
  Set all creator profiles for a campaign (replaces existing).
  """
  def set_creator_profiles(conn, %{"organization_id" => _org_id, "id" => campaign_id, "creator_profile_ids" => profile_ids}) do
    user = conn.assigns.current_user

    case Campaigns.get_campaign(campaign_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Campaign not found"})

      campaign ->
        case Campaigns.set_campaign_creator_profiles(campaign, profile_ids, user) do
          {:ok, _} ->
            json(conn, %{success: true, message: "Creator profiles updated"})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  # ============================================================================
  # Participant Management
  # ============================================================================

  @doc """
  List participants for a campaign.
  """
  def list_participants(conn, %{"organization_id" => org_id, "id" => campaign_id} = params) do
    user = conn.assigns.current_user
    status = Map.get(params, "status")

    if Organizations.is_member?(org_id, user.id) do
      try do
        participants = Campaigns.list_campaign_participants(campaign_id, status: status)

        json(conn, %{
          success: true,
          participants: Enum.map(participants, &serialize_participant/1)
        })
      rescue
        e ->
          require Logger
          Logger.error("Failed to list participants: #{inspect(e)}")
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to load participants: #{inspect(e)}"})
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Approve a participant.
  """
  def approve_participant(conn, %{"organization_id" => _org_id, "id" => _campaign_id, "participant_id" => participant_id}) do
    user = conn.assigns.current_user

    case Campaigns.get_participant(participant_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Participant not found"})

      participant ->
        case Campaigns.approve_participant(participant, user) do
          {:ok, updated} ->
            json(conn, %{success: true, participant: serialize_participant(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  @doc """
  Reject a participant.
  """
  def reject_participant(conn, %{"organization_id" => _org_id, "id" => _campaign_id, "participant_id" => participant_id}) do
    user = conn.assigns.current_user

    case Campaigns.get_participant(participant_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Participant not found"})

      participant ->
        case Campaigns.reject_participant(participant, user) do
          {:ok, updated} ->
            json(conn, %{success: true, participant: serialize_participant(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  @doc """
  Remove a participant.
  """
  def remove_participant(conn, %{"organization_id" => _org_id, "id" => _campaign_id, "participant_id" => participant_id}) do
    user = conn.assigns.current_user

    case Campaigns.get_participant(participant_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Participant not found"})

      participant ->
        case Campaigns.remove_participant(participant, user) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  # ============================================================================
  # Submission Management
  # ============================================================================

  @doc """
  List all submissions for an organization (across all campaigns).
  GET /organizations/:organization_id/campaign-submissions
  """
  def list_organization_submissions(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      opts = [
        status: Map.get(params, "status"),
        platform: Map.get(params, "platform"),
        campaign_id: Map.get(params, "campaign_id"),
        limit: (Map.get(params, "limit") || "100") |> String.to_integer(),
        offset: (Map.get(params, "offset") || "0") |> String.to_integer()
      ] |> Enum.reject(fn {_, v} -> is_nil(v) end)

      {:ok, %{submissions: submissions, total: total}} = Campaigns.list_organization_submissions(org_id, opts)

      json(conn, %{
        success: true,
        submissions: Enum.map(submissions, &serialize_submission/1),
        total: total
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  List submissions for a campaign.
  """
  def list_submissions(conn, %{"organization_id" => org_id, "id" => campaign_id} = params) do
    user = conn.assigns.current_user
    status = Map.get(params, "status")

    if Organizations.is_member?(org_id, user.id) do
      submissions = Campaigns.list_campaign_submissions(campaign_id, status: status)

      json(conn, %{
        success: true,
        submissions: Enum.map(submissions, &serialize_submission/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Verify a submission.
  """
  def verify_submission(conn, %{"organization_id" => _org_id, "submission_id" => submission_id}) do
    user = conn.assigns.current_user

    case Campaigns.get_submission(submission_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Submission not found"})

      submission ->
        case Campaigns.verify_submission(submission, user) do
          {:ok, updated} ->
            json(conn, %{success: true, submission: serialize_submission(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  @doc """
  Reject a submission.
  """
  def reject_submission(conn, %{"organization_id" => _org_id, "submission_id" => submission_id} = params) do
    user = conn.assigns.current_user
    reason = Map.get(params, "reason", "No reason provided")

    case Campaigns.get_submission(submission_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Submission not found"})

      submission ->
        case Campaigns.reject_submission(submission, reason, user) do
          {:ok, updated} ->
            json(conn, %{success: true, submission: serialize_submission(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  Update view count for a submission.
  """
  def update_views(conn, %{"organization_id" => org_id, "submission_id" => submission_id} = params) do
    user = conn.assigns.current_user
    view_count = Map.get(params, "view_count", 0)

    if Organizations.is_admin?(org_id, user.id) do
      case Campaigns.get_submission(submission_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Submission not found"})

        submission ->
          case Campaigns.update_submission_views(submission, view_count) do
            {:ok, updated} ->
              json(conn, %{success: true, submission: serialize_submission(updated)})

            {:error, changeset} ->
              conn
              |> put_status(422)
              |> json(%{success: false, error: format_errors(changeset)})
          end
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not authorized"})
    end
  end

  # ============================================================================
  # Payment Management
  # ============================================================================

  @doc """
  Create a payment for a submission.
  """
  def create_payment(conn, %{"organization_id" => _org_id, "submission_id" => submission_id} = params) do
    user = conn.assigns.current_user
    amount = Map.get(params, "amount")

    case Campaigns.get_submission(submission_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Submission not found"})

      submission ->
        case Campaigns.create_payment(submission, amount, user) do
          {:ok, payment} ->
            json(conn, %{success: true, payment: serialize_payment(payment)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  Mark a payment as completed.
  """
  def complete_payment(conn, %{"organization_id" => _org_id, "payment_id" => payment_id} = params) do
    user = conn.assigns.current_user

    case Campaigns.get_payment_method(payment_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Payment not found"})

      payment ->
        attrs = Map.take(params, ["external_transaction_id"])

        case Campaigns.complete_payment(payment, attrs, user) do
          {:ok, updated} ->
            json(conn, %{success: true, payment: serialize_payment(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  @doc """
  List payments for a campaign.
  """
  def list_payments(conn, %{"organization_id" => org_id, "id" => campaign_id} = params) do
    user = conn.assigns.current_user
    status = Map.get(params, "status")

    if Organizations.is_member?(org_id, user.id) do
      payments = Campaigns.list_campaign_payments(campaign_id, status: status)

      json(conn, %{
        success: true,
        payments: Enum.map(payments, &serialize_payment/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  # ============================================================================
  # Serializers
  # ============================================================================

  defp serialize_campaign(campaign) do
    %{
      id: campaign.id,
      organization_id: campaign.organization_id,
      creator_profile_id: campaign.creator_profile_id,
      title: campaign.title,
      description: campaign.description,
      cover_image_url: presign_url(campaign.cover_image_url),
      budget: campaign.budget,
      spent: campaign.spent,
      cpm: campaign.cpm,
      min_views_for_payment: campaign.min_views_for_payment,
      join_type: campaign.join_type,
      allowed_platforms: campaign.allowed_platforms,
      payment_methods: campaign.payment_methods,
      status: campaign.status,
      starts_at: campaign.starts_at,
      ends_at: campaign.ends_at,
      global_watermarks: campaign.global_watermarks,
      global_intro_id: campaign.global_intro_id,
      global_outro_id: campaign.global_outro_id,
      require_watermark: campaign.require_watermark,
      require_intro: campaign.require_intro,
      require_outro: campaign.require_outro,
      inserted_at: campaign.inserted_at,
      updated_at: campaign.updated_at,
      organization: if(Ecto.assoc_loaded?(campaign.organization), do: %{
        id: campaign.organization.id,
        name: campaign.organization.name,
        logo_url: maybe_presign_url(campaign.organization.logo_url)
      }, else: nil),
      creator_profile: if(campaign.creator_profile_id && Ecto.assoc_loaded?(campaign.creator_profile) && campaign.creator_profile, do: %{
        id: campaign.creator_profile.id,
        name: campaign.creator_profile.name,
        profile_image_url: maybe_presign_url(campaign.creator_profile.profile_image_url)
      }, else: nil),
      global_intro: if(campaign.global_intro_id && Ecto.assoc_loaded?(campaign.global_intro) && campaign.global_intro, do: serialize_asset(campaign.global_intro), else: nil),
      global_outro: if(campaign.global_outro_id && Ecto.assoc_loaded?(campaign.global_outro) && campaign.global_outro, do: serialize_asset(campaign.global_outro), else: nil),
      creator_profiles: if(Ecto.assoc_loaded?(campaign.creator_profiles), do: Enum.map(campaign.creator_profiles, &serialize_creator_profile/1), else: [])
    }
  end

  defp serialize_campaign_with_details(campaign) do
    serialize_campaign(campaign)
    |> Map.put(:participants_count, length(campaign.participants || []))
  end

  defp serialize_participant(nil), do: nil
  defp serialize_participant(participant) do
    clipper_profile = if Ecto.assoc_loaded?(participant.user) do
      ClippsterServer.ClipperProfiles.get_profile_by_user_id(participant.user_id)
    else
      nil
    end

    %{
      id: participant.id,
      campaign_id: participant.campaign_id,
      user_id: participant.user_id,
      status: participant.status,
      application_note: participant.application_note,
      approved_at: participant.approved_at,
      inserted_at: participant.inserted_at,
      user: if(Ecto.assoc_loaded?(participant.user), do: %{
        id: participant.user.id,
        email: participant.user.email,
        display_name: participant.user.name
      }, else: nil),
      clipper_profile: serialize_clipper_profile_summary(clipper_profile)
    }
  end

  defp serialize_clipper_profile_summary(nil), do: nil
  defp serialize_clipper_profile_summary(profile) do
    badges = if Ecto.assoc_loaded?(profile.badges) do
      Enum.map(profile.badges || [], fn badge ->
        %{badge_type: badge.badge_type, earned_at: badge.earned_at}
      end)
    else
      []
    end

    %{
      id: profile.id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      slug: profile.slug,
      bio: profile.bio,
      is_verified: profile.is_verified,
      experience_level: profile.experience_level,
      specialty_tags: profile.specialty_tags || [],
      content_style_tags: profile.content_style_tags || [],
      preferred_platforms: profile.preferred_platforms || [],
      total_campaigns_completed: profile.total_campaigns_completed,
      total_clips_delivered: profile.total_clips_delivered,
      total_endorsements: profile.total_endorsements,
      badges: badges
    }
  end

  defp serialize_participation(nil), do: nil
  defp serialize_participation(participant) do
    %{
      status: participant.status,
      joined_at: participant.inserted_at,
      approved_at: participant.approved_at
    }
  end

  defp serialize_submission(submission) do
    # Get creator profile from campaign (single or first from many)
    creator_profile = if Ecto.assoc_loaded?(submission.campaign) do
      cond do
        # Single creator profile on campaign
        Ecto.assoc_loaded?(submission.campaign.creator_profile) and submission.campaign.creator_profile ->
          submission.campaign.creator_profile
        # Multiple creator profiles - use first one
        Ecto.assoc_loaded?(submission.campaign.creator_profiles) and length(submission.campaign.creator_profiles) > 0 ->
          hd(submission.campaign.creator_profiles)
        true ->
          nil
      end
    else
      nil
    end

    %{
      id: submission.id,
      campaign_id: submission.campaign_id,
      user_id: submission.user_id,
      clip_url: submission.clip_url,
      platform: submission.platform,
      platform_post_id: submission.platform_post_id,
      view_count: submission.view_count,
      views_last_updated_at: submission.views_last_updated_at,
      status: submission.status,
      rejection_reason: submission.rejection_reason,
      verified_at: submission.verified_at,
      inserted_at: submission.inserted_at,
      # Analytics fields
      like_count: submission.like_count,
      comment_count: submission.comment_count,
      share_count: submission.share_count,
      save_count: submission.save_count,
      # Author metadata from platform
      author_username: submission.author_username,
      author_name: submission.author_name,
      author_profile_image: submission.author_profile_image,
      caption: submission.caption,
      media_type: submission.media_type,
      user: if(Ecto.assoc_loaded?(submission.user), do: %{
        id: submission.user.id,
        email: submission.user.email,
        display_name: submission.user.name
      }, else: nil),
      campaign: if(Ecto.assoc_loaded?(submission.campaign), do: %{
        id: submission.campaign.id,
        title: submission.campaign.title
      }, else: nil),
      creator_profile: if(creator_profile, do: %{
        id: creator_profile.id,
        name: creator_profile.name,
        profile_image_url: creator_profile.profile_image_url
      }, else: nil)
    }
  end

  defp serialize_payment(payment) do
    %{
      id: payment.id,
      campaign_id: payment.campaign_id,
      submission_id: payment.submission_id,
      user_id: payment.user_id,
      amount: payment.amount,
      views_at_payment: payment.views_at_payment,
      status: payment.status,
      external_transaction_id: payment.external_transaction_id,
      paid_at: payment.paid_at,
      inserted_at: payment.inserted_at,
      campaign: if(Ecto.assoc_loaded?(payment.campaign), do: %{
        id: payment.campaign.id,
        title: payment.campaign.title
      }, else: nil)
    }
  end

  defp serialize_creator_profile(nil), do: nil
  defp serialize_creator_profile(profile) do
    # Get profile image from platform links if not set directly on profile
    platform_links = if Ecto.assoc_loaded?(profile.platform_links), do: profile.platform_links, else: []

    # Find first platform link with a profile image
    platform_image = Enum.find_value(platform_links, fn link -> link.profile_image_url end)

    %{
      id: profile.id,
      name: profile.name,
      description: profile.description,
      profile_image_url: maybe_presign_url(profile.profile_image_url || platform_image),
      watermark_settings: profile.watermark_settings,
      intro: if(Ecto.assoc_loaded?(profile.intro) && profile.intro, do: serialize_asset(profile.intro), else: nil),
      outro: if(Ecto.assoc_loaded?(profile.outro) && profile.outro, do: serialize_asset(profile.outro), else: nil),
      watermark: if(Ecto.assoc_loaded?(profile.watermark) && profile.watermark, do: serialize_asset(profile.watermark), else: nil),
      platform_links: Enum.map(platform_links, &serialize_platform_link/1)
    }
  end

  defp serialize_platform_link(link) do
    %{
      id: link.id,
      platform: link.platform,
      platform_id: link.platform_id,
      display_name: link.display_name,
      profile_image_url: link.profile_image_url,
      is_primary: link.is_primary
    }
  end

  defp serialize_asset(nil), do: nil
  defp serialize_asset(asset) do
    %{
      id: asset.id,
      asset_type: asset.asset_type,
      name: asset.name,
      url: presign_url(asset.url),
      thumbnail_url: presign_url(asset.thumbnail_url),
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      file_size: asset.file_size,
      mime_type: asset.mime_type
    }
  end

  # ============================================================================
  # Helpers
  # ============================================================================

  defp format_errors(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end

  defp format_errors(error) when is_binary(error), do: error
  defp format_errors(error), do: inspect(error)

  defp parse_datetime(nil), do: nil
  defp parse_datetime(datetime_string) when is_binary(datetime_string) do
    case DateTime.from_iso8601(datetime_string) do
      {:ok, datetime, _} -> datetime
      _ -> nil
    end
  end
  defp parse_datetime(_), do: nil

  defp maybe_add_dates(attrs, params) do
    attrs
    |> maybe_put("starts_at", parse_datetime(Map.get(params, "starts_at")))
    |> maybe_put("ends_at", parse_datetime(Map.get(params, "ends_at")))
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  # Strip query params from cover_image_url if present in the map
  defp maybe_strip_cover_image_url(attrs) do
    case Map.get(attrs, "cover_image_url") do
      nil -> attrs
      url -> Map.put(attrs, "cover_image_url", strip_query_params(url))
    end
  end

  # ============================================================================
  # URL Presigning Helpers
  # ============================================================================

  # Strip query parameters from a URL (removes presigning params before storing)
  defp strip_query_params(nil), do: nil
  defp strip_query_params(url) when is_binary(url) do
    case URI.parse(url) do
      %URI{query: nil} -> url
      %URI{} = uri -> URI.to_string(%{uri | query: nil})
    end
  end

  # Presign a URL that is definitely from R2 storage
  defp presign_url(nil), do: nil
  defp presign_url(url), do: Storage.presigned_url!(url)

  # Presign a URL only if it's from R2 storage (not external URLs)
  defp maybe_presign_url(nil), do: nil
  defp maybe_presign_url(url) when is_binary(url) do
    if is_r2_storage_url?(url) do
      Storage.presigned_url!(url)
    else
      url
    end
  end

  # Check if a URL is from R2 storage
  defp is_r2_storage_url?(url) do
    base = Storage.public_url_base()
    cond do
      base && String.starts_with?(url, base) -> true
      String.contains?(url, ".r2.cloudflarestorage.com/") -> true
      String.starts_with?(url, "org-assets/") -> true  # Storage key format
      true -> false
    end
  end

  defp is_free_tier?(user) do
    if user.is_admin, do: false, else: user.subscription_status in [nil, "none", "expired"]
  end
end
