defmodule ClippsterServer.Campaigns do
  @moduledoc """
  The Campaigns context - manages clipping campaigns, participants, submissions, and payments.
  """

  import Ecto.Query, warn: false
  require Logger
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Organizations
  alias ClippsterServer.Organizations.{Organization, OrganizationProfileAssignment}

  alias ClippsterServer.Campaigns.{
    Campaign,
    CampaignCreatorProfile,
    CampaignParticipant,
    CampaignSubmission,
    CampaignPayment,
    ClipperSocialAccount,
    ClipperPaymentMethod
  }

  alias ClippsterServer.Social.Platforms.Twitter

  # ============================================================================
  # Campaign CRUD
  # ============================================================================

  @doc """
  Creates a new campaign for an organization.
  """
  def create_campaign(%Organization{} = organization, attrs, %User{} = user) do
    if Organizations.is_admin?(organization.id, user.id) do
      %Campaign{}
      |> Campaign.create_changeset(Map.put(attrs, :organization_id, organization.id))
      |> Repo.insert()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Gets a campaign by ID.
  """
  def get_campaign(id) do
    Repo.get(Campaign, id)
  end

  @doc """
  Gets a campaign by ID with preloaded associations.
  """
  def get_campaign_with_details(id) do
    Campaign
    |> where([c], c.id == ^id)
    |> preload([
      :organization,
      :creator_profile,
      :global_intro,
      :global_outro,
      participants: :user,
      creator_profiles: :platform_links
    ])
    |> Repo.one()
  end

  @doc """
  Updates a campaign.
  """
  def update_campaign(%Campaign{} = campaign, attrs, %User{} = user) do
    if Organizations.is_admin?(campaign.organization_id, user.id) do
      campaign
      |> Campaign.update_changeset(attrs)
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Deletes a campaign.
  """
  def delete_campaign(%Campaign{} = campaign, %User{} = user) do
    if Organizations.is_admin?(campaign.organization_id, user.id) do
      Repo.delete(campaign)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Lists all active campaigns (for marketplace).
  """
  def list_active_campaigns(opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    offset = Keyword.get(opts, :offset, 0)

    Campaign
    |> where([c], c.status == "active")
    |> where([c], is_nil(c.ends_at) or c.ends_at > ^DateTime.utc_now())
    |> order_by([c], desc: c.inserted_at)
    |> limit(^limit)
    |> offset(^offset)
    |> preload([
      :organization,
      :creator_profile,
      :global_intro,
      :global_outro,
      creator_profiles: :platform_links
    ])
    |> Repo.all()
  end

  @doc """
  Gets a campaign with all creator profiles and global assets.
  """
  def get_campaign_with_assets(id) do
    Campaign
    |> where([c], c.id == ^id)
    |> preload([
      :organization,
      :creator_profile,
      :global_intro,
      :global_outro,
      creator_profiles: [:intro, :outro, :watermark, :platform_links]
    ])
    |> Repo.one()
  end

  @doc """
  Lists campaigns for an organization.
  """
  def list_organization_campaigns(organization_id, opts \\ []) do
    status = Keyword.get(opts, :status)

    query =
      from c in Campaign,
        where: c.organization_id == ^organization_id,
        order_by: [desc: c.inserted_at],
        preload: [:creator_profile]

    query =
      if status do
        where(query, [c], c.status == ^status)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Pauses a campaign.
  """
  def pause_campaign(%Campaign{} = campaign, %User{} = user) do
    update_campaign(campaign, %{status: "paused"}, user)
  end

  @doc """
  Activates a campaign.
  """
  def activate_campaign(%Campaign{} = campaign, %User{} = user) do
    update_campaign(campaign, %{status: "active"}, user)
  end

  @doc """
  Completes a campaign and revokes all profile access.
  """
  def complete_campaign(%Campaign{} = campaign, %User{} = user) do
    if Organizations.is_admin?(campaign.organization_id, user.id) do
      Repo.transaction(fn ->
        # Get all profile assignment IDs from participants
        assignment_ids =
          from(p in CampaignParticipant,
            where: p.campaign_id == ^campaign.id and not is_nil(p.profile_assignment_id),
            select: p.profile_assignment_id
          )
          |> Repo.all()

        # Delete all profile assignments (revoke access)
        if length(assignment_ids) > 0 do
          from(a in OrganizationProfileAssignment, where: a.id in ^assignment_ids)
          |> Repo.delete_all()
        end

        # Clear profile_assignment_id from all participants
        from(p in CampaignParticipant, where: p.campaign_id == ^campaign.id)
        |> Repo.update_all(set: [profile_assignment_id: nil])

        # Update campaign status
        {:ok, updated_campaign} =
          campaign
          |> Campaign.update_changeset(%{status: "completed"})
          |> Repo.update()

        updated_campaign
      end)
    else
      {:error, :unauthorized}
    end
  end

  # ============================================================================
  # Campaign Creator Profiles
  # ============================================================================

  @doc """
  Adds a creator profile to a campaign.
  """
  def add_creator_profile_to_campaign(%Campaign{} = campaign, creator_profile_id, %User{} = user) do
    if Organizations.is_admin?(campaign.organization_id, user.id) do
      %CampaignCreatorProfile{}
      |> CampaignCreatorProfile.create_changeset(%{
        campaign_id: campaign.id,
        creator_profile_id: creator_profile_id
      })
      |> Repo.insert()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Removes a creator profile from a campaign.
  """
  def remove_creator_profile_from_campaign(
        %Campaign{} = campaign,
        creator_profile_id,
        %User{} = user
      ) do
    if Organizations.is_admin?(campaign.organization_id, user.id) do
      from(ccp in CampaignCreatorProfile,
        where: ccp.campaign_id == ^campaign.id and ccp.creator_profile_id == ^creator_profile_id
      )
      |> Repo.delete_all()

      {:ok, :removed}
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Sets the creator profiles for a campaign (replaces all existing).
  """
  def set_campaign_creator_profiles(%Campaign{} = campaign, creator_profile_ids, %User{} = user) do
    if Organizations.is_admin?(campaign.organization_id, user.id) do
      Repo.transaction(fn ->
        # Remove all existing
        from(ccp in CampaignCreatorProfile, where: ccp.campaign_id == ^campaign.id)
        |> Repo.delete_all()

        # Add new ones
        Enum.each(creator_profile_ids, fn profile_id ->
          %CampaignCreatorProfile{}
          |> CampaignCreatorProfile.create_changeset(%{
            campaign_id: campaign.id,
            creator_profile_id: profile_id
          })
          |> Repo.insert!()
        end)

        :ok
      end)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Lists creator profiles for a campaign.
  """
  def list_campaign_creator_profiles(campaign_id) do
    from(ccp in CampaignCreatorProfile,
      where: ccp.campaign_id == ^campaign_id,
      preload: [creator_profile: [:intro, :outro, :watermark, :platform_links]]
    )
    |> Repo.all()
  end

  # ============================================================================
  # Participant Management
  # ============================================================================

  @doc """
  Applies to join a campaign.
  For open campaigns, automatically approves.
  """
  def apply_to_campaign(%Campaign{} = campaign, %User{} = user, application_note \\ nil) do
    cond do
      campaign.status != "active" ->
        {:error, :campaign_not_active}

      already_participant?(campaign.id, user.id) ->
        {:error, :already_participating}

      true ->
        status = if campaign.join_type == "open", do: "approved", else: "pending"

        Repo.transaction(fn ->
          {:ok, participant} =
            %CampaignParticipant{}
            |> CampaignParticipant.create_changeset(%{
              campaign_id: campaign.id,
              user_id: user.id,
              status: status,
              application_note: application_note
            })
            |> Repo.insert()

          # For open campaigns, auto-grant profile access
          if status == "approved" and campaign.creator_profile_id do
            {:ok, participant} = grant_profile_access(participant, campaign, user.id)
            participant
          else
            participant
          end
        end)
    end
  end

  @doc """
  Approves a participant application.
  """
  def approve_participant(%CampaignParticipant{} = participant, %User{} = approver) do
    campaign = get_campaign(participant.campaign_id)

    if Organizations.is_admin?(campaign.organization_id, approver.id) do
      Repo.transaction(fn ->
        {:ok, participant} =
          participant
          |> CampaignParticipant.approve_changeset(%{approved_by_user_id: approver.id})
          |> Repo.update()

        # Grant profile access if campaign has a creator profile
        participant =
          if campaign.creator_profile_id do
            {:ok, participant} = grant_profile_access(participant, campaign, approver.id)
            participant
          else
            participant
          end

        # Send notification
        participant = Repo.preload(participant, [:campaign, :user])
        ClippsterServer.Notifications.notify_campaign_approved(participant)

        participant
      end)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Rejects a participant application.
  """
  def reject_participant(%CampaignParticipant{} = participant, %User{} = rejector) do
    campaign = get_campaign(participant.campaign_id)

    if Organizations.is_admin?(campaign.organization_id, rejector.id) do
      case participant
           |> CampaignParticipant.reject_changeset()
           |> Repo.update() do
        {:ok, updated_participant} ->
          # Send notification
          updated_participant = Repo.preload(updated_participant, [:campaign, :user])
          ClippsterServer.Notifications.notify_campaign_rejected(updated_participant)
          {:ok, updated_participant}

        error ->
          error
      end
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Removes a participant from a campaign.
  """
  def remove_participant(%CampaignParticipant{} = participant, %User{} = remover) do
    campaign = get_campaign(participant.campaign_id)

    if Organizations.is_admin?(campaign.organization_id, remover.id) do
      Repo.transaction(fn ->
        # Revoke profile access if exists
        if participant.profile_assignment_id do
          Repo.delete_all(
            from a in OrganizationProfileAssignment,
              where: a.id == ^participant.profile_assignment_id
          )
        end

        {:ok, updated} =
          participant
          |> CampaignParticipant.remove_changeset()
          |> Repo.update()

        updated
      end)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Lists participants for a campaign.
  """
  def list_campaign_participants(campaign_id, opts \\ []) do
    status = Keyword.get(opts, :status)

    query =
      from p in CampaignParticipant,
        where: p.campaign_id == ^campaign_id,
        order_by: [desc: p.inserted_at],
        preload: [:user, :approved_by_user]

    query =
      if status do
        where(query, [p], p.status == ^status)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Gets a participant by ID.
  """
  def get_participant(id) do
    CampaignParticipant
    |> preload([:user, :campaign])
    |> Repo.get(id)
  end

  @doc """
  Gets a participant by campaign and user.
  """
  def get_participant_by_campaign_and_user(campaign_id, user_id) do
    Repo.get_by(CampaignParticipant, campaign_id: campaign_id, user_id: user_id)
  end

  @doc """
  Lists campaigns a user has joined.
  """
  def list_user_campaigns(user_id, opts \\ []) do
    status = Keyword.get(opts, :status)

    query =
      from p in CampaignParticipant,
        where: p.user_id == ^user_id and p.status == "approved",
        join: c in Campaign,
        on: c.id == p.campaign_id,
        order_by: [desc: p.inserted_at],
        preload: [
          campaign: [
            :organization,
            :creator_profile,
            :global_intro,
            :global_outro,
            creator_profiles: :platform_links
          ]
        ]

    query =
      if status do
        where(query, [p, c], c.status == ^status)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Lists campaigns a user has joined that include a specific creator profile.
  """
  def list_user_campaigns_by_creator_profile(user_id, creator_profile_id) do
    from(p in CampaignParticipant,
      where: p.user_id == ^user_id and p.status == "approved",
      join: c in Campaign,
      on: c.id == p.campaign_id,
      join: ccp in CampaignCreatorProfile,
      on: ccp.campaign_id == c.id,
      where: ccp.creator_profile_id == ^creator_profile_id,
      where: c.status == "active",
      order_by: [desc: p.inserted_at],
      preload: [
        campaign: [
          :organization,
          :creator_profile,
          :global_intro,
          :global_outro,
          creator_profiles: :platform_links
        ]
      ],
      distinct: true
    )
    |> Repo.all()
  end

  defp already_participant?(campaign_id, user_id) do
    CampaignParticipant
    |> where([p], p.campaign_id == ^campaign_id and p.user_id == ^user_id)
    |> where([p], p.status in ["pending", "approved"])
    |> Repo.exists?()
  end

  defp grant_profile_access(participant, campaign, approver_id) do
    # Create profile assignment
    {:ok, assignment} =
      %OrganizationProfileAssignment{}
      |> OrganizationProfileAssignment.changeset(%{
        organization_creator_profile_id: campaign.creator_profile_id,
        user_id: participant.user_id
      })
      |> Repo.insert(on_conflict: :nothing)

    # Get the assignment (might already exist)
    assignment =
      if assignment.id do
        assignment
      else
        Repo.get_by!(OrganizationProfileAssignment,
          organization_creator_profile_id: campaign.creator_profile_id,
          user_id: participant.user_id
        )
      end

    # Update participant with assignment reference
    participant
    |> CampaignParticipant.approve_changeset(%{
      approved_by_user_id: approver_id,
      profile_assignment_id: assignment.id
    })
    |> Repo.update()
  end

  # ============================================================================
  # Submissions
  # ============================================================================

  @doc """
  Submits a clip to a campaign.
  """
  def submit_clip(%Campaign{} = campaign, %User{} = user, attrs) do
    participant = get_participant_by_campaign_and_user(campaign.id, user.id)

    cond do
      is_nil(participant) or participant.status != "approved" ->
        {:error, :not_a_participant}

      campaign.status != "active" ->
        {:error, :campaign_not_active}

      true ->
        clip_url = Map.get(attrs, :clip_url) || Map.get(attrs, "clip_url")
        platform = detect_platform_from_url(clip_url)

        if platform && platform not in campaign.allowed_platforms do
          {:error, :platform_not_allowed}
        else
          result =
            %CampaignSubmission{}
            |> CampaignSubmission.create_changeset(
              Map.merge(attrs, %{
                campaign_id: campaign.id,
                participant_id: participant.id,
                user_id: user.id,
                platform: platform || Map.get(attrs, :platform) || Map.get(attrs, "platform")
              })
            )
            |> Repo.insert()

          # Fetch platform metadata asynchronously after successful insert
          case result do
            {:ok, submission} ->
              Task.start(fn -> fetch_and_update_submission_metadata(submission) end)
              {:ok, submission}

            error ->
              error
          end
        end
    end
  end

  @doc """
  Fetches platform metadata for a submission and updates it.
  """
  def fetch_and_update_submission_metadata(%CampaignSubmission{} = submission) do
    case submission.platform do
      platform when platform in ["x", "twitter"] ->
        fetch_twitter_metadata(submission)

      # Add other platforms as needed
      _ ->
        Logger.debug("[Campaigns] No metadata fetcher for platform: #{submission.platform}")
        {:ok, submission}
    end
  end

  defp fetch_twitter_metadata(%CampaignSubmission{} = submission) do
    case Twitter.extract_tweet_id(submission.clip_url) do
      {:ok, tweet_id} ->
        case Twitter.get_tweet_analytics(tweet_id) do
          {:ok, analytics} ->
            update_submission_metadata(submission, %{
              view_count: analytics[:view_count] || 0,
              like_count: analytics[:like_count] || 0,
              comment_count: analytics[:comment_count] || 0,
              author_username: analytics[:author_username],
              author_name: analytics[:author_name],
              author_profile_image: analytics[:author_profile_image],
              caption: analytics[:text],
              platform_post_id: tweet_id
            })

          {:error, reason} ->
            Logger.warning("[Campaigns] Failed to fetch Twitter metadata: #{inspect(reason)}")
            {:error, reason}
        end

      {:error, reason} ->
        Logger.warning("[Campaigns] Failed to extract tweet ID: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Updates a submission with metadata from the platform.
  """
  def update_submission_metadata(%CampaignSubmission{} = submission, attrs) do
    submission
    |> Ecto.Changeset.change(attrs)
    |> Repo.update()
  end

  @doc """
  Gets a submission by ID.
  """
  def get_submission(id) do
    CampaignSubmission
    |> preload([:campaign, :participant, :user, :social_account])
    |> Repo.get(id)
  end

  @doc """
  Verifies a submission.
  """
  def verify_submission(%CampaignSubmission{} = submission, %User{} = verifier) do
    campaign = get_campaign(submission.campaign_id)

    if Organizations.is_admin?(campaign.organization_id, verifier.id) do
      case submission
           |> CampaignSubmission.verify_changeset(%{verified_by_user_id: verifier.id})
           |> Repo.update() do
        {:ok, updated_submission} ->
          # Send notification
          updated_submission = Repo.preload(updated_submission, [:campaign, :user])
          ClippsterServer.Notifications.notify_submission_verified(updated_submission)
          {:ok, updated_submission}

        error ->
          error
      end
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Rejects a submission.
  """
  def reject_submission(%CampaignSubmission{} = submission, reason, %User{} = verifier) do
    campaign = get_campaign(submission.campaign_id)

    if Organizations.is_admin?(campaign.organization_id, verifier.id) do
      case submission
           |> CampaignSubmission.reject_changeset(%{rejection_reason: reason})
           |> Repo.update() do
        {:ok, updated_submission} ->
          # Send notification
          updated_submission = Repo.preload(updated_submission, [:campaign, :user])
          ClippsterServer.Notifications.notify_submission_rejected(updated_submission, reason)
          {:ok, updated_submission}

        error ->
          error
      end
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Updates view count for a submission.
  """
  def update_submission_views(%CampaignSubmission{} = submission, view_count) do
    submission
    |> CampaignSubmission.update_views_changeset(%{view_count: view_count})
    |> Repo.update()
  end

  @doc """
  Lists submissions for a campaign.
  """
  def list_campaign_submissions(campaign_id, opts \\ []) do
    status = Keyword.get(opts, :status)

    query =
      from s in CampaignSubmission,
        where: s.campaign_id == ^campaign_id,
        order_by: [desc: s.inserted_at],
        preload: [:user, :social_account]

    query =
      if status do
        where(query, [s], s.status == ^status)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Lists all submissions for an organization (across all campaigns).
  """
  def list_organization_submissions(organization_id, opts \\ []) do
    org_id =
      if is_binary(organization_id), do: String.to_integer(organization_id), else: organization_id

    status = Keyword.get(opts, :status)
    platform = Keyword.get(opts, :platform)
    campaign_id = Keyword.get(opts, :campaign_id)
    limit_val = Keyword.get(opts, :limit, 100)
    offset_val = Keyword.get(opts, :offset, 0)

    query =
      from s in CampaignSubmission,
        join: c in Campaign,
        on: s.campaign_id == c.id,
        where: c.organization_id == ^org_id,
        order_by: [desc: s.inserted_at],
        preload: [:user, :social_account, campaign: [:creator_profile, :creator_profiles]]

    query = if status, do: where(query, [s], s.status == ^status), else: query
    query = if platform, do: where(query, [s], s.platform == ^platform), else: query
    query = if campaign_id, do: where(query, [s], s.campaign_id == ^campaign_id), else: query

    total = Repo.aggregate(query, :count, :id)
    submissions = query |> limit(^limit_val) |> offset(^offset_val) |> Repo.all()

    {:ok, %{submissions: submissions, total: total}}
  end

  @doc """
  Lists submissions for a user.
  """
  def list_user_submissions(user_id, opts \\ []) do
    campaign_id = Keyword.get(opts, :campaign_id)

    query =
      from s in CampaignSubmission,
        where: s.user_id == ^user_id,
        order_by: [desc: s.inserted_at],
        preload: [:campaign, :social_account]

    query =
      if campaign_id do
        where(query, [s], s.campaign_id == ^campaign_id)
      else
        query
      end

    Repo.all(query)
  end

  defp detect_platform_from_url(nil), do: nil
  defp detect_platform_from_url(url), do: CampaignSubmission.detect_platform(url)

  # ============================================================================
  # Payments
  # ============================================================================

  @doc """
  Calculate payment amount based on CPM formula.
  """
  defp calculate_payment_amount(%CampaignSubmission{} = submission, %Campaign{} = campaign) do
    views = submission.view_count
    cpm = Decimal.to_float(campaign.cpm)
    cpm_views = campaign.cpm_views || 1000

    amount = (views / cpm_views) * cpm
    Decimal.from_float(amount) |> Decimal.round(2)
  end

  @doc """
  Calculate and create pending payments for all verified submissions.
  Only creates payments for submissions that:
  - Have status 'verified'
  - Meet minimum view threshold
  - Don't already have a payment record
  """
  def calculate_campaign_payments(%Campaign{} = campaign, %User{} = creator) do
    if Organizations.is_admin?(campaign.organization_id, creator.id) do
      Repo.transaction(fn ->
        # Get eligible submissions
        submissions =
          from(s in CampaignSubmission,
            as: :submission,
            where: s.campaign_id == ^campaign.id,
            where: s.status == "verified",
            where: s.view_count >= ^campaign.min_views_for_payment,
            where:
              not exists(
                from(p in CampaignPayment,
                  where: p.submission_id == parent_as(:submission).id
                )
              ),
            preload: [:user]
          )
          |> Repo.all()

        # Calculate and create payments
        payments =
          Enum.map(submissions, fn submission ->
            amount = calculate_payment_amount(submission, campaign)

            {:ok, payment} =
              %CampaignPayment{}
              |> CampaignPayment.create_changeset(%{
                campaign_id: campaign.id,
                submission_id: submission.id,
                user_id: submission.user_id,
                amount: amount,
                views_at_payment: submission.view_count,
                status: "pending"
              })
              |> Repo.insert()

            payment
          end)

        {:ok, payments}
      end)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Creates a payment for a submission.
  """
  def create_payment(%CampaignSubmission{} = submission, amount, %User{} = creator) do
    campaign = get_campaign(submission.campaign_id)

    if Organizations.is_admin?(campaign.organization_id, creator.id) do
      %CampaignPayment{}
      |> CampaignPayment.create_changeset(%{
        campaign_id: submission.campaign_id,
        submission_id: submission.id,
        user_id: submission.user_id,
        amount: amount,
        views_at_payment: submission.view_count
      })
      |> Repo.insert()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Submit payment verification proof.
  Uploads screenshot, stores transaction details, notifies clipper.
  """
  def verify_payment_completion(%CampaignPayment{} = payment, attrs, %User{} = verifier) do
    campaign = get_campaign(payment.campaign_id)

    if Organizations.is_admin?(campaign.organization_id, verifier.id) do
      Repo.transaction(fn ->
        # Update payment with verification details
        {:ok, updated_payment} =
          payment
          |> CampaignPayment.verification_changeset(
            Map.merge(attrs, %{
              paid_by_user_id: verifier.id,
              payment_date: attrs[:payment_date] || Date.utc_today()
            })
          )
          |> Repo.update()

        # Update campaign spent
        campaign
        |> Campaign.update_spent_changeset(%{
          spent: Decimal.add(campaign.spent || Decimal.new(0), payment.amount)
        })
        |> Repo.update()

        # Mark submission as paid
        submission = Repo.get!(CampaignSubmission, payment.submission_id)

        submission
        |> CampaignSubmission.mark_paid_changeset()
        |> Repo.update()

        # Send in-app notification + email
        updated_payment = Repo.preload(updated_payment, [:campaign, :user])
        ClippsterServer.Notifications.notify_payment_verified(updated_payment)

        ClippsterServer.Emails.payment_verified_email(updated_payment)
        |> ClippsterServer.Mailer.deliver()

        updated_payment
      end)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Marks a payment as completed.
  """
  def complete_payment(%CampaignPayment{} = payment, attrs, %User{} = payer) do
    campaign = get_campaign(payment.campaign_id)

    if Organizations.is_admin?(campaign.organization_id, payer.id) do
      Repo.transaction(fn ->
        # Update payment status
        {:ok, updated_payment} =
          payment
          |> CampaignPayment.complete_changeset(Map.put(attrs, :paid_by_user_id, payer.id))
          |> Repo.update()

        # Update campaign spent amount
        campaign
        |> Campaign.update_spent_changeset(%{
          spent: Decimal.add(campaign.spent || Decimal.new(0), payment.amount)
        })
        |> Repo.update()

        # Mark submission as paid
        submission = Repo.get!(CampaignSubmission, payment.submission_id)

        submission
        |> CampaignSubmission.mark_paid_changeset()
        |> Repo.update()

        updated_payment
      end)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Lists payments for a campaign.
  """
  def list_campaign_payments(campaign_id, opts \\ []) do
    status = Keyword.get(opts, :status)

    query =
      from p in CampaignPayment,
        where: p.campaign_id == ^campaign_id,
        order_by: [desc: p.inserted_at],
        preload: [:user, :submission, :payment_method]

    query =
      if status do
        where(query, [p], p.status == ^status)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Lists payments for a user (earnings).
  """
  def list_user_payments(user_id) do
    from(p in CampaignPayment,
      where: p.user_id == ^user_id,
      order_by: [desc: p.inserted_at],
      preload: [:campaign, :submission]
    )
    |> Repo.all()
  end

  @doc """
  Gets earnings summary for a user.
  """
  def get_user_earnings_summary(user_id) do
    total_earned =
      from(p in CampaignPayment,
        where: p.user_id == ^user_id and p.status == "completed",
        select: coalesce(sum(p.amount), 0)
      )
      |> Repo.one()

    pending =
      from(p in CampaignPayment,
        where: p.user_id == ^user_id and p.status in ["pending", "processing"],
        select: coalesce(sum(p.amount), 0)
      )
      |> Repo.one()

    total_submissions =
      from(s in CampaignSubmission,
        where: s.user_id == ^user_id,
        select: count(s.id)
      )
      |> Repo.one()

    verified_submissions =
      from(s in CampaignSubmission,
        where: s.user_id == ^user_id and s.status in ["verified", "paid"],
        select: count(s.id)
      )
      |> Repo.one()

    %{
      total_earned: total_earned,
      pending: pending,
      total_submissions: total_submissions,
      verified_submissions: verified_submissions
    }
  end

  # ============================================================================
  # Clipper Social Accounts
  # ============================================================================

  @doc """
  Creates a social account for a user.
  """
  def create_social_account(%User{} = user, attrs) do
    %ClipperSocialAccount{}
    |> ClipperSocialAccount.create_changeset(Map.put(attrs, :user_id, user.id))
    |> Repo.insert()
  end

  @doc """
  Gets a social account by ID.
  """
  def get_social_account(id) do
    Repo.get(ClipperSocialAccount, id)
  end

  @doc """
  Gets a social account by provider + provider account ID for a user.
  """
  def get_social_account_by_provider(user_id, provider, provider_account_id) do
    from(a in ClipperSocialAccount,
      where:
        a.user_id == ^user_id and a.provider == ^provider and
          a.provider_account_id == ^provider_account_id
    )
    |> Repo.one()
  end

  @doc """
  Updates a social account.
  """
  def update_social_account(%ClipperSocialAccount{} = account, attrs, %User{} = user) do
    if account.user_id == user.id do
      account
      |> ClipperSocialAccount.update_changeset(attrs)
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Deletes a social account.
  """
  def delete_social_account(%ClipperSocialAccount{} = account, %User{} = user) do
    if account.user_id == user.id do
      Repo.delete(account)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Updates social account tokens (for token refresh).
  Used by the scheduled post worker to refresh tokens before publishing.
  """
  def update_social_account_tokens(%ClipperSocialAccount{} = account, attrs) do
    account
    |> ClipperSocialAccount.update_tokens_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Lists social accounts for a user.
  """
  def list_user_social_accounts(user_id) do
    from(a in ClipperSocialAccount,
      where: a.user_id == ^user_id,
      order_by: [asc: a.platform]
    )
    |> Repo.all()
  end

  # ============================================================================
  # User Posts
  # ============================================================================

  alias ClippsterServer.Campaigns.UserPost

  @doc """
  Creates a user post.
  """
  def create_user_post(%User{} = user, attrs) do
    %UserPost{}
    |> UserPost.create_changeset(Map.put(attrs, :user_id, user.id))
    |> Repo.insert()
  end

  @doc """
  Gets a user post by ID.
  """
  def get_user_post(id) do
    Repo.get(UserPost, id)
  end

  @doc """
  Lists all posts for a user.
  """
  def list_user_posts(user_id) do
    from(p in UserPost,
      where: p.user_id == ^user_id,
      order_by: [desc: p.inserted_at]
    )
    |> Repo.all()
  end

  @doc """
  Lists posts for a user filtered by account.
  """
  def list_user_posts_by_account(user_id, account_id) do
    from(p in UserPost,
      where: p.user_id == ^user_id and p.clipper_social_account_id == ^account_id,
      order_by: [desc: p.inserted_at]
    )
    |> Repo.all()
  end

  @doc """
  Gets analytics summary for a user's posts.
  """
  def get_user_analytics_summary(user_id, opts \\ []) do
    days = Keyword.get(opts, :days, 30)
    account_id = Keyword.get(opts, :account_id)

    since = DateTime.utc_now() |> DateTime.add(-days, :day)

    query =
      from p in UserPost,
        where: p.user_id == ^user_id,
        where: p.status == "published",
        where: p.inserted_at >= ^since,
        select: %{
          total_posts: count(p.id),
          total_views: sum(p.view_count),
          total_likes: sum(p.like_count),
          total_comments: sum(p.comment_count),
          total_saves: sum(p.save_count),
          total_reach: sum(p.reach_count),
          total_impressions: sum(p.impressions_count)
        }

    query =
      if account_id,
        do: where(query, [p], p.clipper_social_account_id == ^account_id),
        else: query

    Repo.one(query)
  end

  @doc """
  Updates user post analytics.
  """
  def update_user_post_analytics(%UserPost{} = post, analytics) do
    post
    |> UserPost.analytics_changeset(analytics)
    |> Repo.update()
  end

  @doc """
  Updates user post fields like post_url.
  """
  def update_user_post(%UserPost{} = post, attrs) do
    post
    |> UserPost.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Gets posts needing analytics sync (for background worker).
  """
  def get_user_posts_needing_sync(opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)

    # Get posts that haven't been synced in the last hour
    one_hour_ago = DateTime.utc_now() |> DateTime.add(-3600, :second)

    from(p in UserPost,
      where: p.status == "published",
      where: is_nil(p.synced_at) or p.synced_at < ^one_hour_ago,
      order_by: [asc: p.synced_at],
      limit: ^limit,
      preload: [:clipper_social_account]
    )
    |> Repo.all()
  end

  # ============================================================================
  # Clipper Payment Methods
  # ============================================================================

  @doc """
  Creates a payment method for a user.
  """
  def create_payment_method(%User{} = user, attrs) do
    Repo.transaction(fn ->
      # If setting as default, unset other defaults
      if Map.get(attrs, :is_default) || Map.get(attrs, "is_default") do
        from(m in ClipperPaymentMethod, where: m.user_id == ^user.id)
        |> Repo.update_all(set: [is_default: false])
      end

      {:ok, method} =
        %ClipperPaymentMethod{}
        |> ClipperPaymentMethod.create_changeset(Map.put(attrs, :user_id, user.id))
        |> Repo.insert()

      method
    end)
  end

  @doc """
  Gets a payment method by ID.
  """
  def get_payment_method(id) do
    Repo.get(ClipperPaymentMethod, id)
  end

  @doc """
  Updates a payment method.
  """
  def update_payment_method(%ClipperPaymentMethod{} = method, attrs, %User{} = user) do
    if method.user_id == user.id do
      Repo.transaction(fn ->
        # If setting as default, unset other defaults
        if Map.get(attrs, :is_default) || Map.get(attrs, "is_default") do
          from(m in ClipperPaymentMethod, where: m.user_id == ^user.id and m.id != ^method.id)
          |> Repo.update_all(set: [is_default: false])
        end

        {:ok, updated} =
          method
          |> ClipperPaymentMethod.update_changeset(attrs)
          |> Repo.update()

        updated
      end)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Deletes a payment method.
  """
  def delete_payment_method(%ClipperPaymentMethod{} = method, %User{} = user) do
    if method.user_id == user.id do
      Repo.delete(method)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Lists payment methods for a user.
  """
  def list_user_payment_methods(user_id) do
    from(m in ClipperPaymentMethod,
      where: m.user_id == ^user_id,
      order_by: [desc: m.is_default, asc: m.method_type]
    )
    |> Repo.all()
  end

  @doc """
  Gets the default payment method for a user.
  """
  def get_default_payment_method(user_id) do
    from(m in ClipperPaymentMethod,
      where: m.user_id == ^user_id and m.is_default == true,
      limit: 1
    )
    |> Repo.one()
  end

  # ============================================================================
  # Statistics
  # ============================================================================

  @doc """
  Gets campaign statistics.
  """
  def get_campaign_stats(campaign_id) do
    participants_count =
      from(p in CampaignParticipant,
        where: p.campaign_id == ^campaign_id and p.status == "approved",
        select: count(p.id)
      )
      |> Repo.one()

    submissions_count =
      from(s in CampaignSubmission,
        where: s.campaign_id == ^campaign_id,
        select: count(s.id)
      )
      |> Repo.one()

    verified_count =
      from(s in CampaignSubmission,
        where: s.campaign_id == ^campaign_id and s.status in ["verified", "paid"],
        select: count(s.id)
      )
      |> Repo.one()

    total_views =
      from(s in CampaignSubmission,
        where: s.campaign_id == ^campaign_id and s.status in ["verified", "paid"],
        select: coalesce(sum(s.view_count), 0)
      )
      |> Repo.one()

    total_paid =
      from(p in CampaignPayment,
        where: p.campaign_id == ^campaign_id and p.status == "completed",
        select: coalesce(sum(p.amount), 0)
      )
      |> Repo.one()

    %{
      participants_count: participants_count,
      submissions_count: submissions_count,
      verified_count: verified_count,
      total_views: total_views,
      total_paid: total_paid
    }
  end
end
