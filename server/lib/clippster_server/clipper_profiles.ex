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
      nil ->
        nil

      profile ->
        Repo.preload(profile, [
          :user,
          :channel_links,
          :portfolio_clips,
          :badges,
          endorsements: [:organization, :endorsed_by_user]
        ])
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
    |> visible_in_public_directory()
    |> apply_filters(filters)
    |> order_by([p], desc: p.is_verified, desc: p.total_campaigns_completed)
    |> Repo.all()
    |> Repo.preload([
      :user,
      :channel_links,
      :portfolio_clips,
      :badges,
      endorsements: [:organization]
    ])
  end

  @doc """
  Returns true when a profile is public and has the required fields for directory visibility.
  """
  def public_directory_profile?(%ClipperProfile{} = profile) do
    profile.is_public == true and present_string?(profile.display_name) and
      present_string?(profile.slug)
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

  defp filter_by_experience_level(query, level),
    do: where(query, [p], p.experience_level == ^level)

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

  defp visible_in_public_directory(query) do
    query
    |> where([p], p.is_public == true)
    |> where([p], fragment("char_length(trim(coalesce(?, ''))) > 0", p.display_name))
    |> where([p], fragment("char_length(trim(coalesce(?, ''))) > 0", p.slug))
  end

  defp present_string?(value) when is_binary(value), do: String.trim(value) != ""
  defp present_string?(_), do: false

  @doc """
  Increments profile stats.
  """
  def increment_stats(%ClipperProfile{} = profile, field, amount \\ 1)
      when field in [:total_campaigns_completed, :total_clips_delivered, :total_endorsements] do
    current_value = Map.get(profile, field) || 0

    profile
    |> ClipperProfile.stats_changeset(%{field => current_value + amount})
    |> Repo.update()
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
      |> ClipperPortfolioClip.create_changeset(Map.put(attrs, "clipper_profile_id", profile_id))
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

      error ->
        error
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
      join: c in Campaign,
      on: c.id == p.campaign_id,
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
  Gets the leaderboard for a period type and leaderboard type.
  Uses live calculation for current period, snapshots for historical periods.
  """
  def get_leaderboard(period_type, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    leaderboard_type = Keyword.get(opts, :leaderboard_type, "posts")

    {current_period_start, _current_period_end} = get_current_period_range(period_type)

    # Check if we have a snapshot for the current period
    case get_latest_period(period_type, leaderboard_type) do
      nil ->
        # No snapshots exist, calculate live
        get_live_leaderboard(period_type, leaderboard_type, limit)

      {snapshot_start, _snapshot_end} ->
        if snapshot_start == current_period_start do
          # Snapshot exists for current period, but calculate live for real-time updates
          get_live_leaderboard(period_type, leaderboard_type, limit)
        else
          # Historical period, use snapshot
          ClipperLeaderboardEntry
          |> where([e], e.period_type == ^period_type)
          |> where([e], e.leaderboard_type == ^leaderboard_type)
          |> where([e], e.period_start == ^snapshot_start)
          |> order_by([e], e.rank)
          |> limit(^limit)
          |> Repo.all()
          |> Repo.preload(clipper_profile: [:user, :badges])
        end
    end
  end

  defp get_current_period_range(period_type) do
    today = Date.utc_today()

    case period_type do
      "weekly" ->
        days_since_monday = Date.day_of_week(today) - 1
        period_start = Date.add(today, -days_since_monday)
        period_end = Date.add(period_start, 6)
        {period_start, period_end}

      "monthly" ->
        period_start = Date.beginning_of_month(today)
        period_end = Date.end_of_month(today)
        {period_start, period_end}

      _ ->
        {today, today}
    end
  end

  @doc """
  Calculates live leaderboard rankings for the current period.
  Used for real-time updates.
  """
  def get_live_leaderboard(period_type, leaderboard_type, limit \\ 50) do
    {period_start, period_end} = get_current_period_range(period_type)
    profiles = list_all_public_profiles()

    case leaderboard_type do
      "posts" ->
        calculate_live_posts_leaderboard(profiles, period_start, period_end, limit)

      "campaigns" ->
        calculate_live_campaigns_leaderboard(profiles, period_start, period_end, limit)

      _ ->
        []
    end
  end

  defp calculate_live_posts_leaderboard(profiles, period_start, period_end, limit) do
    profiles
    |> Enum.map(fn profile ->
      total_views = count_post_views_in_period(profile.user_id, period_start, period_end)
      posts_count = count_posts_in_period(profile.user_id, period_start, period_end)

      # Create a virtual leaderboard entry
      %{
        profile: profile,
        total_views: total_views,
        posts_count: posts_count,
        score: total_views,
        clips_delivered: 0,
        campaigns_active: 0,
        endorsements_received: 0
      }
    end)
    |> Enum.filter(fn entry -> entry.posts_count > 0 end)
    |> Enum.sort_by(fn entry -> entry.total_views end, :desc)
    |> Enum.take(limit)
    |> Enum.with_index(1)
    |> Enum.map(fn {entry, rank} ->
      # Convert to struct-like map that matches ClipperLeaderboardEntry
      %{
        rank: rank,
        score: entry.score,
        total_views: entry.total_views,
        posts_count: entry.posts_count,
        clips_delivered: entry.clips_delivered,
        campaigns_active: entry.campaigns_active,
        endorsements_received: entry.endorsements_received,
        clipper_profile: Repo.preload(entry.profile, [:user, :badges])
      }
    end)
  end

  defp calculate_live_campaigns_leaderboard(profiles, period_start, period_end, limit) do
    profiles
    |> Enum.map(fn profile ->
      clips_delivered = count_clips_in_period(profile.user_id, period_start, period_end)
      campaigns_active = count_campaigns_in_period(profile.user_id, period_start, period_end)
      endorsements_received = count_endorsements_in_period(profile.id, period_start, period_end)
      total_views = count_views_in_period(profile.user_id, period_start, period_end)

      score = clips_delivered * 10 + div(total_views, 1000) + endorsements_received * 50 + campaigns_active * 25

      %{
        profile: profile,
        clips_delivered: clips_delivered,
        campaigns_active: campaigns_active,
        endorsements_received: endorsements_received,
        total_views: total_views,
        posts_count: 0,
        score: score
      }
    end)
    |> Enum.filter(fn entry -> entry.score > 0 end)
    |> Enum.sort_by(fn entry -> entry.score end, :desc)
    |> Enum.take(limit)
    |> Enum.with_index(1)
    |> Enum.map(fn {entry, rank} ->
      %{
        rank: rank,
        score: entry.score,
        total_views: entry.total_views,
        posts_count: entry.posts_count,
        clips_delivered: entry.clips_delivered,
        campaigns_active: entry.campaigns_active,
        endorsements_received: entry.endorsements_received,
        clipper_profile: Repo.preload(entry.profile, [:user, :badges])
      }
    end)
  end

  defp get_latest_period(period_type, leaderboard_type) do
    ClipperLeaderboardEntry
    |> where([e], e.period_type == ^period_type)
    |> where([e], e.leaderboard_type == ^leaderboard_type)
    |> order_by([e], desc: e.period_start)
    |> limit(1)
    |> select([e], {e.period_start, e.period_end})
    |> Repo.one()
  end

  @doc """
  Gets a clipper's rank for a period and leaderboard type.
  """
  def get_clipper_rank(profile_id, period_type, leaderboard_type \\ "posts") do
    case get_latest_period(period_type, leaderboard_type) do
      nil ->
        {:error, :no_leaderboard}

      {period_start, _} ->
        case ClipperLeaderboardEntry
             |> where([e], e.clipper_profile_id == ^profile_id)
             |> where([e], e.period_type == ^period_type)
             |> where([e], e.leaderboard_type == ^leaderboard_type)
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
    |> Repo.insert(
      on_conflict: :replace_all,
      conflict_target: [:clipper_profile_id, :period_type, :period_start]
    )
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
  Gets total all-time views for a user across published posts and verified campaign submissions.
  """
  def get_total_views_for_user(user_id) do
    import Ecto.Query

    post_views =
      ClippsterServer.Campaigns.UserPost
      |> where([p], p.user_id == ^user_id)
      |> where([p], p.status == "published")
      |> select([p], coalesce(sum(p.view_count), 0))
      |> Repo.one()

    submission_views =
      ClippsterServer.Campaigns.CampaignSubmission
      |> where([s], s.user_id == ^user_id)
      |> where([s], s.status in ["verified", "paid"])
      |> select([s], coalesce(sum(s.view_count), 0))
      |> Repo.one()

    (post_views || 0) + (submission_views || 0)
  end

  @doc """
  Updates the response time for a profile.
  """
  def update_response_time(profile, hours) do
    profile
    |> ClipperProfile.update_changeset(%{response_time_hours: hours})
    |> Repo.update()
  end

  @doc """
  Counts total views from published posts by a user in a period.
  Includes posts from X, Instagram, TikTok, and YouTube.
  Queries both user_posts and post_submissions tables.
  """
  def count_post_views_in_period(user_id, period_start, period_end) do
    import Ecto.Query

    start_dt = DateTime.new!(period_start, ~T[00:00:00], "Etc/UTC")
    end_dt = DateTime.new!(period_end, ~T[23:59:59], "Etc/UTC")

    # Count views from post_submissions (org posts)
    post_submission_views =
      ClippsterServer.Social.PostSubmission
      |> where([p], p.submitted_by_user_id == ^user_id)
      |> where([p], p.status == "published")
      |> where([p], p.posted_at >= ^start_dt and p.posted_at <= ^end_dt)
      |> select([p], coalesce(sum(p.view_count), 0))
      |> Repo.one()

    # Count views from user_posts (personal posts)
    user_post_views =
      ClippsterServer.Campaigns.UserPost
      |> where([p], p.user_id == ^user_id)
      |> where([p], p.status == "published")
      |> where([p], p.inserted_at >= ^start_dt and p.inserted_at <= ^end_dt)
      |> select([p], coalesce(sum(p.view_count), 0))
      |> Repo.one()

    post_submission_views + user_post_views
  end

  @doc """
  Counts number of published posts by a user in a period.
  Includes posts from X, Instagram, TikTok, and YouTube.
  Queries both user_posts and post_submissions tables.
  """
  def count_posts_in_period(user_id, period_start, period_end) do
    import Ecto.Query

    start_dt = DateTime.new!(period_start, ~T[00:00:00], "Etc/UTC")
    end_dt = DateTime.new!(period_end, ~T[23:59:59], "Etc/UTC")

    # Count posts from post_submissions (org posts)
    post_submission_count =
      ClippsterServer.Social.PostSubmission
      |> where([p], p.submitted_by_user_id == ^user_id)
      |> where([p], p.status == "published")
      |> where([p], p.posted_at >= ^start_dt and p.posted_at <= ^end_dt)
      |> Repo.aggregate(:count)

    # Count posts from user_posts (personal posts)
    user_post_count =
      ClippsterServer.Campaigns.UserPost
      |> where([p], p.user_id == ^user_id)
      |> where([p], p.status == "published")
      |> where([p], p.inserted_at >= ^start_dt and p.inserted_at <= ^end_dt)
      |> Repo.aggregate(:count)

    post_submission_count + user_post_count
  end
end
