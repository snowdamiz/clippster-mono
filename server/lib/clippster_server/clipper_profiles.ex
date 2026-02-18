defmodule ClippsterServer.ClipperProfiles do
  @moduledoc """
  Context for managing clipper profiles, channel links, portfolio clips, endorsements, and badges.
  """

  import Ecto.Query
  alias ClippsterServer.Repo
  alias ClippsterServer.ClipperProfiles.{
    ClipperProfile,
    ClipperChannelLink,
    ClipperPortfolioClip,
    ClipperEndorsement,
    ClipperBadge,
    ClipperLeaderboardEntry
  }

  # ============================================================================
  # Profile Functions
  # ============================================================================

  @doc """
  Gets or creates a clipper profile for a user.
  """
  def get_or_create_profile(user_id) do
    case get_profile_by_user_id(user_id) do
      nil ->
        case create_profile(%{user_id: user_id}) do
          {:ok, profile} -> {:ok, profile}
          {:error, %Ecto.Changeset{errors: errors}} ->
            if Keyword.has_key?(errors, :user_id) do
              case get_profile_by_user_id(user_id) do
                nil -> {:error, :profile_not_found}
                profile -> {:ok, profile}
              end
            else
              {:error, :profile_creation_failed}
            end
        end
      profile -> {:ok, profile}
    end
  end

  @doc """
  Gets a profile by user ID.
  """
  def get_profile_by_user_id(user_id) do
    case Repo.get_by(ClipperProfile, user_id: user_id) do
      nil -> nil
      profile -> Repo.preload(profile, [:channel_links, :portfolio_clips, :badges])
    end
  end

  @doc """
  Gets a profile by slug.
  """
  def get_profile_by_slug(slug) do
    Repo.get_by(ClipperProfile, slug: slug)
    |> case do
      nil -> nil
      profile -> Repo.preload(profile, [:user, :channel_links, :portfolio_clips, :badges, endorsements: [:organization]])
    end
  end

  @doc """
  Gets a profile by ID.
  """
  def get_profile(id) do
    case Repo.get(ClipperProfile, id) do
      nil -> nil
      profile -> Repo.preload(profile, [:channel_links, :portfolio_clips, :badges])
    end
  end

  @doc """
  Creates a new clipper profile.
  """
  def create_profile(attrs) do
    %ClipperProfile{}
    |> ClipperProfile.create_changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a clipper profile.
  """
  def update_profile(%ClipperProfile{} = profile, attrs) do
    profile
    |> ClipperProfile.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Lists public profiles with optional filters.
  """
  def list_public_profiles(filters \\ %{}) do
    ClipperProfile
    |> where([p], p.is_public == true)
    |> apply_filters(filters)
    |> order_by([p], [desc: p.is_verified, desc: p.total_campaigns_completed])
    |> Repo.all()
    |> Repo.preload([:user, :channel_links, :portfolio_clips, :badges, endorsements: [:organization]])
  end

  defp apply_filters(query, filters) do
    query
    |> filter_by_looking_for_work(filters[:looking_for_work])
    |> filter_by_experience_level(filters[:experience_level])
    |> filter_by_specialty_tags(filters[:specialty_tags])
    |> filter_by_content_style_tags(filters[:content_style_tags])
    |> filter_by_preferred_platforms(filters[:preferred_platforms])
    |> filter_by_languages(filters[:languages])
    |> filter_by_verified(filters[:verified_only])
  end

  defp filter_by_looking_for_work(query, nil), do: query
  defp filter_by_looking_for_work(query, true), do: where(query, [p], p.looking_for_work == true)
  defp filter_by_looking_for_work(query, _), do: query

  defp filter_by_experience_level(query, nil), do: query
  defp filter_by_experience_level(query, level), do: where(query, [p], p.experience_level == ^level)

  defp filter_by_specialty_tags(query, nil), do: query
  defp filter_by_specialty_tags(query, []), do: query
  defp filter_by_specialty_tags(query, tags) when is_list(tags) do
    where(query, [p], fragment("? && ?", p.specialty_tags, ^tags))
  end

  defp filter_by_content_style_tags(query, nil), do: query
  defp filter_by_content_style_tags(query, []), do: query
  defp filter_by_content_style_tags(query, tags) when is_list(tags) do
    where(query, [p], fragment("? && ?", p.content_style_tags, ^tags))
  end

  defp filter_by_preferred_platforms(query, nil), do: query
  defp filter_by_preferred_platforms(query, []), do: query
  defp filter_by_preferred_platforms(query, platforms) when is_list(platforms) do
    where(query, [p], fragment("? && ?", p.preferred_platforms, ^platforms))
  end

  defp filter_by_languages(query, nil), do: query
  defp filter_by_languages(query, []), do: query
  defp filter_by_languages(query, languages) when is_list(languages) do
    where(query, [p], fragment("? && ?", p.languages, ^languages))
  end

  defp filter_by_verified(query, nil), do: query
  defp filter_by_verified(query, true), do: where(query, [p], p.is_verified == true)
  defp filter_by_verified(query, _), do: query

  @doc """
  Increments profile stats.
  """
  def increment_stats(%ClipperProfile{} = profile, field, amount \\ 1) when field in [:total_campaigns_completed, :total_clips_delivered, :total_endorsements] do
    current_value = Map.get(profile, field) || 0
    update_profile(profile, %{field => current_value + amount})
  end

  # ============================================================================
  # Channel Links Functions
  # ============================================================================

  @doc """
  Lists channel links for a profile.
  """
  def list_channel_links(profile_id) do
    ClipperChannelLink
    |> where([l], l.clipper_profile_id == ^profile_id)
    |> order_by([l], l.display_order)
    |> Repo.all()
  end

  @doc """
  Adds a channel link to a profile.
  """
  def add_channel_link(profile_id, attrs) do
    %ClipperChannelLink{}
    |> ClipperChannelLink.create_changeset(Map.put(attrs, :clipper_profile_id, profile_id))
    |> Repo.insert()
  end

  @doc """
  Updates a channel link.
  """
  def update_channel_link(%ClipperChannelLink{} = link, attrs) do
    link
    |> ClipperChannelLink.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a channel link.
  """
  def delete_channel_link(%ClipperChannelLink{} = link) do
    Repo.delete(link)
  end

  @doc """
  Gets a channel link by ID.
  """
  def get_channel_link(id) do
    Repo.get(ClipperChannelLink, id)
  end

  # ============================================================================
  # Portfolio Clips Functions
  # ============================================================================

  @max_portfolio_clips 3

  @doc """
  Lists portfolio clips for a profile.
  """
  def list_portfolio_clips(profile_id) do
    ClipperPortfolioClip
    |> where([c], c.clipper_profile_id == ^profile_id)
    |> order_by([c], c.display_order)
    |> Repo.all()
  end

  @doc """
  Adds a portfolio clip to a profile (max 3).
  """
  def add_portfolio_clip(profile_id, attrs) do
    current_count =
      ClipperPortfolioClip
      |> where([c], c.clipper_profile_id == ^profile_id)
      |> Repo.aggregate(:count)

    if current_count >= @max_portfolio_clips do
      {:error, :max_clips_reached}
    else
      %ClipperPortfolioClip{}
      |> ClipperPortfolioClip.create_changeset(Map.put(attrs, :clipper_profile_id, profile_id))
      |> Repo.insert()
    end
  end

  @doc """
  Updates a portfolio clip.
  """
  def update_portfolio_clip(%ClipperPortfolioClip{} = clip, attrs) do
    clip
    |> ClipperPortfolioClip.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a portfolio clip.
  """
  def delete_portfolio_clip(%ClipperPortfolioClip{} = clip) do
    Repo.delete(clip)
  end

  @doc """
  Gets a portfolio clip by ID.
  """
  def get_portfolio_clip(id) do
    Repo.get(ClipperPortfolioClip, id)
  end

  # ============================================================================
  # Endorsements Functions
  # ============================================================================

  @doc """
  Lists endorsements for a profile.
  """
  def list_endorsements(profile_id) do
    ClipperEndorsement
    |> where([e], e.clipper_profile_id == ^profile_id)
    |> order_by([e], desc: e.inserted_at)
    |> Repo.all()
    |> Repo.preload([:organization, :endorsed_by_user, :campaign])
  end

  @doc """
  Creates an endorsement from an organization.
  """
  def create_endorsement(profile_id, organization_id, attrs) do
    %ClipperEndorsement{}
    |> ClipperEndorsement.create_changeset(
      attrs
      |> Map.put(:clipper_profile_id, profile_id)
      |> Map.put(:organization_id, organization_id)
    )
    |> Repo.insert()
    |> case do
      {:ok, endorsement} ->
        # Update endorsement count
        if profile = get_profile(profile_id) do
          increment_stats(profile, :total_endorsements)
        end
        {:ok, endorsement}
      error -> error
    end
  end

  @doc """
  Updates an endorsement.
  """
  def update_endorsement(%ClipperEndorsement{} = endorsement, attrs) do
    endorsement
    |> ClipperEndorsement.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Gets an endorsement by ID.
  """
  def get_endorsement(id) do
    case Repo.get(ClipperEndorsement, id) do
      nil -> nil
      endorsement -> Repo.preload(endorsement, [:organization, :endorsed_by_user])
    end
  end

  @doc """
  Checks if an organization can endorse a clipper (must have worked together).
  """
  def can_endorse?(organization_id, clipper_user_id) do
    # Check if clipper has participated in any of the org's campaigns
    alias ClippsterServer.Campaigns.CampaignParticipant
    alias ClippsterServer.Campaigns.Campaign

    from(p in CampaignParticipant,
      join: c in Campaign, on: c.id == p.campaign_id,
      where: c.organization_id == ^organization_id,
      where: p.user_id == ^clipper_user_id,
      where: p.status == "approved"
    )
    |> Repo.exists?()
  end

  # ============================================================================
  # Badges Functions
  # ============================================================================

  @doc """
  Lists badges for a profile.
  """
  def list_badges(profile_id) do
    ClipperBadge
    |> where([b], b.clipper_profile_id == ^profile_id)
    |> where([b], is_nil(b.expires_at) or b.expires_at > ^DateTime.utc_now())
    |> Repo.all()
  end

  @doc """
  Awards a badge to a clipper.
  """
  def award_badge(profile_id, badge_type) do
    %ClipperBadge{}
    |> ClipperBadge.create_changeset(%{
      clipper_profile_id: profile_id,
      badge_type: badge_type,
      earned_at: DateTime.utc_now() |> DateTime.truncate(:second)
    })
    |> Repo.insert()
  end

  @doc """
  Revokes a badge from a clipper.
  """
  def revoke_badge(profile_id, badge_type) do
    ClipperBadge
    |> where([b], b.clipper_profile_id == ^profile_id and b.badge_type == ^badge_type)
    |> Repo.delete_all()
  end

  @doc """
  Checks and awards badges based on clipper's achievements.
  """
  def check_and_award_badges(%ClipperProfile{} = profile) do
    # Verified badge: 3+ campaigns with positive endorsements
    if profile.total_campaigns_completed >= 3 and profile.total_endorsements >= 1 do
      award_badge(profile.id, "verified")
    end

    # Rising star: new clipper (< 3 months) with 5+ campaigns
    profile_age_days = DateTime.diff(DateTime.utc_now(), profile.inserted_at, :day)
    if profile_age_days < 90 and profile.total_campaigns_completed >= 5 do
      award_badge(profile.id, "rising_star")
    end

    :ok
  end

  # ============================================================================
  # Leaderboard Functions
  # ============================================================================

  @doc """
  Gets the leaderboard for a period type.
  """
  def get_leaderboard(period_type, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)

    # Get the most recent period
    case get_latest_period(period_type) do
      nil -> []
      {period_start, _period_end} ->
        ClipperLeaderboardEntry
        |> where([e], e.period_type == ^period_type)
        |> where([e], e.period_start == ^period_start)
        |> order_by([e], e.rank)
        |> limit(^limit)
        |> Repo.all()
        |> Repo.preload(clipper_profile: [:user, :badges])
    end
  end

  defp get_latest_period(period_type) do
    ClipperLeaderboardEntry
    |> where([e], e.period_type == ^period_type)
    |> order_by([e], desc: e.period_start)
    |> limit(1)
    |> select([e], {e.period_start, e.period_end})
    |> Repo.one()
  end

  @doc """
  Gets a clipper's rank for a period.
  """
  def get_clipper_rank(profile_id, period_type) do
    case get_latest_period(period_type) do
      nil -> {:error, :no_leaderboard}
      {period_start, _} ->
        case ClipperLeaderboardEntry
             |> where([e], e.clipper_profile_id == ^profile_id)
             |> where([e], e.period_type == ^period_type)
             |> where([e], e.period_start == ^period_start)
             |> Repo.one() do
          nil -> {:error, :not_ranked}
          entry -> {:ok, entry.rank}
        end
    end
  end

  @doc """
  Creates a leaderboard entry.
  """
  def create_leaderboard_entry(attrs) do
    %ClipperLeaderboardEntry{}
    |> ClipperLeaderboardEntry.create_changeset(attrs)
    |> Repo.insert(on_conflict: :replace_all, conflict_target: [:clipper_profile_id, :period_type, :period_start])
  end

  @doc """
  Lists all public profiles for leaderboard calculation.
  """
  def list_all_public_profiles do
    ClipperProfile
    |> where([p], p.is_public == true)
    |> Repo.all()
  end

  @doc """
  Lists all profiles.
  """
  def list_all_profiles do
    ClipperProfile
    |> Repo.all()
  end

  @doc """
  Counts clips delivered by a user in a period.
  """
  def count_clips_in_period(user_id, period_start, period_end) do
    import Ecto.Query

    start_dt = DateTime.new!(period_start, ~T[00:00:00], "Etc/UTC")
    end_dt = DateTime.new!(period_end, ~T[23:59:59], "Etc/UTC")

    ClippsterServer.Campaigns.CampaignSubmission
    |> where([s], s.user_id == ^user_id)
    |> where([s], s.status in ["verified", "paid"])
    |> where([s], s.inserted_at >= ^start_dt and s.inserted_at <= ^end_dt)
    |> Repo.aggregate(:count)
  end

  @doc """
  Counts campaigns a user participated in during a period.
  """
  def count_campaigns_in_period(user_id, period_start, period_end) do
    import Ecto.Query

    start_dt = DateTime.new!(period_start, ~T[00:00:00], "Etc/UTC")
    end_dt = DateTime.new!(period_end, ~T[23:59:59], "Etc/UTC")

    ClippsterServer.Campaigns.CampaignParticipant
    |> where([p], p.user_id == ^user_id)
    |> where([p], p.status == "approved")
    |> where([p], p.inserted_at >= ^start_dt and p.inserted_at <= ^end_dt)
    |> select([p], p.campaign_id)
    |> distinct(true)
    |> Repo.aggregate(:count)
  end

  @doc """
  Counts endorsements received by a profile in a period.
  """
  def count_endorsements_in_period(profile_id, period_start, period_end) do
    import Ecto.Query

    start_dt = DateTime.new!(period_start, ~T[00:00:00], "Etc/UTC")
    end_dt = DateTime.new!(period_end, ~T[23:59:59], "Etc/UTC")

    ClipperEndorsement
    |> where([e], e.clipper_profile_id == ^profile_id)
    |> where([e], e.inserted_at >= ^start_dt and e.inserted_at <= ^end_dt)
    |> Repo.aggregate(:count)
  end

  @doc """
  Counts total views from verified campaign submissions in a period.
  """
  def count_views_in_period(user_id, period_start, period_end) do
    import Ecto.Query

    start_dt = DateTime.new!(period_start, ~T[00:00:00], "Etc/UTC")
    end_dt = DateTime.new!(period_end, ~T[23:59:59], "Etc/UTC")

    ClippsterServer.Campaigns.CampaignSubmission
    |> where([s], s.user_id == ^user_id)
    |> where([s], s.status in ["verified", "paid"])
    |> where([s], s.inserted_at >= ^start_dt and s.inserted_at <= ^end_dt)
    |> select([s], coalesce(sum(s.view_count), 0))
    |> Repo.one()
  end

  @doc """
  Updates the response time for a profile.
  """
  def update_response_time(profile, hours) do
    profile
    |> ClipperProfile.update_changeset(%{response_time_hours: hours})
    |> Repo.update()
  end
end
