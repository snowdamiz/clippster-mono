defmodule ClippsterServerWeb.ClipperProfilesController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.ClipperProfiles
  alias ClippsterServer.ClipperProfiles.{ClipperProfile, ClipperChannelLink, ClipperPortfolioClip}

  # ============================================================================
  # Own Profile Endpoints
  # ============================================================================

  @doc """
  GET /api/user/clipper-profile
  Get or create the current user's clipper profile.
  """
  def show_own(conn, _params) do
    user = conn.assigns.current_user

    case ClipperProfiles.get_or_create_profile(user.id) do
      {:ok, profile} ->
        profile = ClippsterServer.Repo.preload(profile, [:channel_links, :portfolio_clips, :badges])
        json(conn, %{success: true, profile: serialize_profile(profile)})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  @doc """
  PUT /api/user/clipper-profile
  Update the current user's clipper profile.
  """
  def update_own(conn, params) do
    user = conn.assigns.current_user

    with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
         {:ok, updated_profile} <- ClipperProfiles.update_profile(profile, params) do
      updated_profile = ClippsterServer.Repo.preload(updated_profile, [:channel_links, :portfolio_clips, :badges])
      json(conn, %{success: true, profile: serialize_profile(updated_profile)})
    else
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  # ============================================================================
  # Channel Links Endpoints
  # ============================================================================

  @doc """
  GET /api/user/clipper-profile/channel-links
  List channel links for the current user's profile.
  """
  def list_channel_links(conn, _params) do
    user = conn.assigns.current_user

    case ClipperProfiles.get_or_create_profile(user.id) do
      {:ok, profile} ->
        links = ClipperProfiles.list_channel_links(profile.id)
        json(conn, %{success: true, channel_links: Enum.map(links, &serialize_channel_link/1)})

      {:error, _} ->
        json(conn, %{success: true, channel_links: []})
    end
  end

  @doc """
  POST /api/user/clipper-profile/channel-links
  Add a channel link.
  """
  def create_channel_link(conn, params) do
    user = conn.assigns.current_user

    with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
         {:ok, link} <- ClipperProfiles.add_channel_link(profile.id, params) do
      conn
      |> put_status(:created)
      |> json(%{success: true, channel_link: serialize_channel_link(link)})
    else
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  @doc """
  PUT /api/user/clipper-profile/channel-links/:id
  Update a channel link.
  """
  def update_channel_link(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
         %ClipperChannelLink{} = link <- ClipperProfiles.get_channel_link(id),
         true <- link.clipper_profile_id == profile.id,
         {:ok, updated_link} <- ClipperProfiles.update_channel_link(link, params) do
      json(conn, %{success: true, channel_link: serialize_channel_link(updated_link)})
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "Channel link not found"})
      false ->
        conn |> put_status(:forbidden) |> json(%{success: false, error: "Not authorized"})
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  @doc """
  DELETE /api/user/clipper-profile/channel-links/:id
  Delete a channel link.
  """
  def delete_channel_link(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
         %ClipperChannelLink{} = link <- ClipperProfiles.get_channel_link(id),
         true <- link.clipper_profile_id == profile.id,
         {:ok, _} <- ClipperProfiles.delete_channel_link(link) do
      json(conn, %{success: true})
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "Channel link not found"})
      false ->
        conn |> put_status(:forbidden) |> json(%{success: false, error: "Not authorized"})
      {:error, _} ->
        conn |> put_status(:unprocessable_entity) |> json(%{success: false, error: "Failed to delete"})
    end
  end

  # ============================================================================
  # Portfolio Clips Endpoints
  # ============================================================================

  @doc """
  GET /api/user/clipper-profile/portfolio-clips
  List portfolio clips for the current user's profile.
  """
  def list_portfolio_clips(conn, _params) do
    user = conn.assigns.current_user

    case ClipperProfiles.get_or_create_profile(user.id) do
      {:ok, profile} ->
        clips = ClipperProfiles.list_portfolio_clips(profile.id)
        json(conn, %{success: true, portfolio_clips: Enum.map(clips, &serialize_portfolio_clip/1)})

      {:error, _} ->
        json(conn, %{success: true, portfolio_clips: []})
    end
  end

  @doc """
  POST /api/user/clipper-profile/portfolio-clips
  Add a portfolio clip (max 3).
  """
  def create_portfolio_clip(conn, params) do
    user = conn.assigns.current_user

    with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
         {:ok, clip} <- ClipperProfiles.add_portfolio_clip(profile.id, params) do
      conn
      |> put_status(:created)
      |> json(%{success: true, portfolio_clip: serialize_portfolio_clip(clip)})
    else
      {:error, :max_clips_reached} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: "Maximum of 3 portfolio clips allowed"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  @doc """
  PUT /api/user/clipper-profile/portfolio-clips/:id
  Update a portfolio clip.
  """
  def update_portfolio_clip(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
         %ClipperPortfolioClip{} = clip <- ClipperProfiles.get_portfolio_clip(id),
         true <- clip.clipper_profile_id == profile.id,
         {:ok, updated_clip} <- ClipperProfiles.update_portfolio_clip(clip, params) do
      json(conn, %{success: true, portfolio_clip: serialize_portfolio_clip(updated_clip)})
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "Portfolio clip not found"})
      false ->
        conn |> put_status(:forbidden) |> json(%{success: false, error: "Not authorized"})
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  @doc """
  DELETE /api/user/clipper-profile/portfolio-clips/:id
  Delete a portfolio clip.
  """
  def delete_portfolio_clip(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
         %ClipperPortfolioClip{} = clip <- ClipperProfiles.get_portfolio_clip(id),
         true <- clip.clipper_profile_id == profile.id,
         {:ok, _} <- ClipperProfiles.delete_portfolio_clip(clip) do
      json(conn, %{success: true})
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "Portfolio clip not found"})
      false ->
        conn |> put_status(:forbidden) |> json(%{success: false, error: "Not authorized"})
      {:error, _} ->
        conn |> put_status(:unprocessable_entity) |> json(%{success: false, error: "Failed to delete"})
    end
  end

  # ============================================================================
  # Public Directory Endpoints
  # ============================================================================

  @doc """
  GET /api/clippers
  List public clipper profiles with filters.
  """
  def index(conn, params) do
    filters = %{
      looking_for_work: parse_bool(params["looking_for_work"]),
      experience_level: params["experience_level"],
      specialty_tags: parse_array(params["specialty_tags"]),
      content_style_tags: parse_array(params["content_style_tags"]),
      preferred_platforms: parse_array(params["preferred_platforms"]),
      languages: parse_array(params["languages"]),
      verified_only: parse_bool(params["verified_only"])
    }

    profiles = ClipperProfiles.list_public_profiles(filters)
    json(conn, %{success: true, profiles: Enum.map(profiles, &serialize_public_profile/1)})
  end

  @doc """
  GET /api/clippers/:slug
  Get a public clipper profile by slug.
  """
  def show(conn, %{"slug" => slug}) do
    case ClipperProfiles.get_profile_by_slug(slug) do
      nil ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "Profile not found"})

      profile ->
        if profile.is_public do
          json(conn, %{success: true, profile: serialize_public_profile(profile)})
        else
          conn |> put_status(:not_found) |> json(%{success: false, error: "Profile not found"})
        end
    end
  end

  @doc """
  GET /api/clippers/leaderboard
  Get the clipper leaderboard.
  """
  def leaderboard(conn, params) do
    period_type = params["period"] || "weekly"
    entries = ClipperProfiles.get_leaderboard(period_type)

    json(conn, %{
      success: true,
      period_type: period_type,
      entries: Enum.map(entries, &serialize_leaderboard_entry/1)
    })
  end

  # ============================================================================
  # Organization Endpoints (Endorsements)
  # ============================================================================

  @doc """
  POST /api/clippers/:slug/endorsements
  Create an endorsement for a clipper.
  """
  def create_endorsement(conn, %{"slug" => slug} = params) do
    user = conn.assigns.current_user
    organization_id = params["organization_id"]

    with %ClipperProfile{} = profile <- ClipperProfiles.get_profile_by_slug(slug),
         true <- ClipperProfiles.can_endorse?(organization_id, profile.user_id),
         {:ok, endorsement} <- ClipperProfiles.create_endorsement(profile.id, organization_id, %{
           endorsed_by_user_id: user.id,
           campaign_id: params["campaign_id"],
           content: params["content"],
           rating: params["rating"]
         }) do
      endorsement = ClippsterServer.Repo.preload(endorsement, [:organization, :endorsed_by_user])
      conn
      |> put_status(:created)
      |> json(%{success: true, endorsement: serialize_endorsement(endorsement)})
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "Profile not found"})
      false ->
        conn |> put_status(:forbidden) |> json(%{success: false, error: "Cannot endorse - no working relationship"})
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  # ============================================================================
  # Helpers
  # ============================================================================

  defp serialize_profile(profile) do
    %{
      id: profile.id,
      user_id: profile.user_id,
      display_name: profile.display_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      slug: profile.slug,
      is_public: profile.is_public,
      looking_for_work: profile.looking_for_work,
      experience_level: profile.experience_level,
      specialty_tags: profile.specialty_tags || [],
      content_style_tags: profile.content_style_tags || [],
      preferred_platforms: profile.preferred_platforms || [],
      languages: profile.languages || [],
      timezone: profile.timezone,
      response_time_hours: profile.response_time_hours,
      is_verified: profile.is_verified,
      total_campaigns_completed: profile.total_campaigns_completed,
      total_clips_delivered: profile.total_clips_delivered,
      total_endorsements: profile.total_endorsements,
      channel_links: Enum.map(profile.channel_links || [], &serialize_channel_link/1),
      portfolio_clips: Enum.map(profile.portfolio_clips || [], &serialize_portfolio_clip/1),
      badges: Enum.map(profile.badges || [], &serialize_badge/1),
      inserted_at: profile.inserted_at,
      updated_at: profile.updated_at
    }
  end

  defp serialize_public_profile(profile) do
    base = serialize_profile(profile)
    
    Map.merge(base, %{
      user: if(profile.user, do: %{
        id: profile.user.id,
        name: profile.user.name,
        email: profile.user.email
      }, else: nil),
      endorsements: Enum.map(profile.endorsements || [], &serialize_endorsement/1)
    })
  end

  defp serialize_channel_link(link) do
    %{
      id: link.id,
      platform: link.platform,
      url: link.url,
      username: link.username,
      display_order: link.display_order
    }
  end

  defp serialize_portfolio_clip(clip) do
    %{
      id: clip.id,
      title: clip.title,
      video_url: clip.video_url,
      thumbnail_url: clip.thumbnail_url,
      duration: clip.duration,
      file_size: clip.file_size,
      display_order: clip.display_order
    }
  end

  defp serialize_badge(badge) do
    %{
      id: badge.id,
      badge_type: badge.badge_type,
      earned_at: badge.earned_at,
      expires_at: badge.expires_at
    }
  end

  defp serialize_endorsement(endorsement) do
    %{
      id: endorsement.id,
      content: endorsement.content,
      rating: endorsement.rating,
      organization: if(endorsement.organization, do: %{
        id: endorsement.organization.id,
        name: endorsement.organization.name
      }, else: nil),
      endorsed_by: if(endorsement.endorsed_by_user, do: %{
        id: endorsement.endorsed_by_user.id,
        name: endorsement.endorsed_by_user.name
      }, else: nil),
      inserted_at: endorsement.inserted_at
    }
  end

  defp serialize_leaderboard_entry(entry) do
    %{
      rank: entry.rank,
      score: entry.score,
      clips_delivered: entry.clips_delivered,
      campaigns_active: entry.campaigns_active,
      endorsements_received: entry.endorsements_received,
      profile: if(entry.clipper_profile, do: %{
        id: entry.clipper_profile.id,
        display_name: entry.clipper_profile.display_name,
        avatar_url: entry.clipper_profile.avatar_url,
        slug: entry.clipper_profile.slug,
        is_verified: entry.clipper_profile.is_verified,
        badges: Enum.map(entry.clipper_profile.badges || [], &serialize_badge/1)
      }, else: nil)
    }
  end

  defp parse_bool(nil), do: nil
  defp parse_bool("true"), do: true
  defp parse_bool("false"), do: false
  defp parse_bool(val) when is_boolean(val), do: val
  defp parse_bool(_), do: nil

  defp parse_array(nil), do: nil
  defp parse_array(val) when is_list(val), do: val
  defp parse_array(val) when is_binary(val), do: String.split(val, ",")
  defp parse_array(_), do: nil

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end
end
