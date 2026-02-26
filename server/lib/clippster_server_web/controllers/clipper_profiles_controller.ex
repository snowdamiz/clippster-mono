defmodule ClippsterServerWeb.ClipperProfilesController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.ClipperProfiles
  alias ClippsterServer.ClipperProfiles.{ClipperProfile, ClipperChannelLink, ClipperPortfolioClip}
  alias ClippsterServer.Storage
  alias ClippsterServer.Affiliates

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

    # Debug: log incoming is_public value
    require Logger
    Logger.debug("update_own params is_public: #{inspect(params["is_public"])}")

    with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
         {:ok, updated_profile} <- ClipperProfiles.update_profile(profile, params) do
      Logger.debug("update_own result is_public: #{inspect(updated_profile.is_public)}")
      updated_profile = ClippsterServer.Repo.preload(updated_profile, [:channel_links, :portfolio_clips, :badges])
      json(conn, %{success: true, profile: serialize_profile(updated_profile)})
    else
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  @doc """
  POST /api/user/clipper-profile/avatar
  Upload an avatar image to R2 storage (max 5MB).
  """
  @max_avatar_size 5 * 1024 * 1024  # 5MB
  def upload_avatar(conn, %{"file" => %Plug.Upload{} = upload}) do
    user = conn.assigns.current_user

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    content_type = upload.content_type || "image/jpeg"

    if content_type not in allowed_types do
      conn
      |> put_status(:bad_request)
      |> json(%{success: false, error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP"})
    else
      # Check file size
      case File.stat(upload.path) do
        {:ok, %{size: size}} when size > @max_avatar_size ->
          conn
          |> put_status(:request_entity_too_large)
          |> json(%{success: false, error: "File size exceeds 5MB limit"})

        {:ok, %{size: _file_size}} ->
          with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
               {:ok, file_binary} <- File.read(upload.path),
               key <- generate_avatar_key(user.id, upload.filename),
               {:ok, avatar_url} <- Storage.upload_file(file_binary, key, content_type: content_type) do

            # Update the profile with the new avatar URL
            case ClipperProfiles.update_profile(profile, %{"avatar_url" => avatar_url}) do
              {:ok, updated_profile} ->
                updated_profile = ClippsterServer.Repo.preload(updated_profile, [:channel_links, :portfolio_clips, :badges])
                json(conn, %{success: true, profile: serialize_profile(updated_profile), avatar_url: maybe_presign_avatar(avatar_url)})

              {:error, changeset} ->
                # Clean up uploaded file on failure
                Storage.delete_file(key)
                conn
                |> put_status(:unprocessable_entity)
                |> json(%{success: false, error: format_changeset_errors(changeset)})
            end
          else
            {:error, reason} ->
              conn
              |> put_status(:unprocessable_entity)
              |> json(%{success: false, error: "Upload failed: #{inspect(reason)}"})
          end

        {:error, reason} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: "Could not read file: #{inspect(reason)}"})
      end
    end
  end

  def upload_avatar(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{success: false, error: "No file provided"})
  end

  defp generate_avatar_key(user_id, filename) do
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    ext = Path.extname(filename) |> String.downcase()
    ext = if ext == "", do: ".jpg", else: ext
    "avatars/clipper/#{user_id}/#{timestamp}#{ext}"
  end

  defp maybe_presign_avatar(nil), do: nil
  defp maybe_presign_avatar(url) when is_binary(url) do
    Storage.presigned_url!(url)
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
    require Logger
    user = conn.assigns.current_user
    Logger.debug("[ClipperProfiles] create_channel_link params: #{inspect(params)}")

    link_params = Map.take(params, ["platform", "url", "username", "display_order"])

    try do
      Logger.debug("[ClipperProfiles] step 1: getting profile for user #{user.id}")
      profile_result = ClipperProfiles.get_or_create_profile(user.id)
      Logger.debug("[ClipperProfiles] step 2: profile_result=#{inspect(profile_result, limit: 3)}")

      with {:ok, profile} <- profile_result do
        Logger.debug("[ClipperProfiles] step 3: adding channel link, profile.id=#{profile.id}, params=#{inspect(link_params)}")
        link_result = ClipperProfiles.add_channel_link(profile.id, link_params)
        Logger.debug("[ClipperProfiles] step 4: link_result=#{inspect(link_result, limit: 3)}")

        with {:ok, link} <- link_result do
          conn
          |> put_status(:created)
          |> json(%{success: true, channel_link: serialize_channel_link(link)})
        else
          {:error, %Ecto.Changeset{} = changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{success: false, error: format_changeset_errors(changeset)})

          {:error, reason} ->
            Logger.error("[ClipperProfiles] add_channel_link error: #{inspect(reason)}")
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{success: false, error: "Failed to save channel link: #{inspect(reason)}"})
        end
      else
        {:error, %Ecto.Changeset{} = changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: format_changeset_errors(changeset)})

        {:error, reason} ->
          Logger.error("[ClipperProfiles] get_or_create_profile error: #{inspect(reason)}")
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: "Profile error: #{inspect(reason)}"})
      end
    rescue
      e ->
        Logger.error("[ClipperProfiles] create_channel_link exception: #{inspect(e)}\n#{inspect(__STACKTRACE__)}")
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: "Exception: #{inspect(e)}"})
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

  @doc """
  GET /api/user/clipper-profile/portfolio-clips/:id/presigned-url
  Returns a presigned URL for streaming a portfolio clip video (1 hour expiry).
  Works regardless of whether R2_PUBLIC_URL is configured.
  """
  def portfolio_clip_presigned_url(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
         %ClipperPortfolioClip{} = clip <- ClipperProfiles.get_portfolio_clip(id),
         true <- clip.clipper_profile_id == profile.id do
      case Storage.presigned_url(clip.video_url, expires_in: 3600) do
        {:ok, url} ->
          json(conn, %{success: true, url: url})
        {:error, _} ->
          # Fall back to the stored URL if presigning fails
          json(conn, %{success: true, url: clip.video_url})
      end
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{success: false, error: "Portfolio clip not found"})
      false ->
        conn |> put_status(:forbidden) |> json(%{success: false, error: "Not authorized"})
    end
  end

  @doc """
  POST /api/user/clipper-profile/portfolio-clips/upload
  Upload a portfolio clip video file to R2 storage (max 200MB).
  """
  @max_file_size 200 * 1024 * 1024  # 200MB
  def upload_portfolio_clip(conn, %{"file" => %Plug.Upload{} = upload} = params) do
    user = conn.assigns.current_user

    # Check file size
    case File.stat(upload.path) do
      {:ok, %{size: size}} when size > @max_file_size ->
        conn
        |> put_status(:request_entity_too_large)
        |> json(%{success: false, error: "File size exceeds 200MB limit"})

      {:ok, %{size: file_size}} ->
        with {:ok, profile} <- ClipperProfiles.get_or_create_profile(user.id),
             {:ok, file_binary} <- File.read(upload.path),
             key <- generate_portfolio_clip_key(user.id, upload.filename),
             content_type <- upload.content_type || "video/mp4",
             {:ok, video_url} <- Storage.upload_file(file_binary, key, content_type: content_type) do

          # Upload thumbnail if provided
          thumbnail_url =
            case params["thumbnail"] do
              %Plug.Upload{} = thumb ->
                thumb_key = "portfolio-clips/#{user.id}/thumbnails/#{System.unique_integer([:positive])}_thumbnail.jpg"
                case File.read(thumb.path) do
                  {:ok, thumb_binary} ->
                    case Storage.upload_file(thumb_binary, thumb_key, content_type: "image/jpeg") do
                      {:ok, url} -> url
                      _ -> nil
                    end
                  _ -> nil
                end
              _ -> nil
            end

          # Create the portfolio clip record
          clip_params = %{
            "title" => params["title"] || Path.basename(upload.filename, Path.extname(upload.filename)),
            "video_url" => video_url,
            "thumbnail_url" => thumbnail_url,
            "file_size" => file_size
          }

          case ClipperProfiles.add_portfolio_clip(profile.id, clip_params) do
            {:ok, clip} ->
              conn
              |> put_status(:created)
              |> json(%{success: true, portfolio_clip: serialize_portfolio_clip(clip)})

            {:error, :max_clips_reached} ->
              # Clean up uploaded file
              Storage.delete_file(key)
              conn
              |> put_status(:unprocessable_entity)
              |> json(%{success: false, error: "Maximum of 3 portfolio clips allowed"})

            {:error, changeset} ->
              # Clean up uploaded file
              Storage.delete_file(key)
              conn
              |> put_status(:unprocessable_entity)
              |> json(%{success: false, error: format_changeset_errors(changeset)})
          end
        else
          {:error, reason} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{success: false, error: "Upload failed: #{inspect(reason)}"})
        end

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: "Could not read file: #{inspect(reason)}"})
    end
  end

  def upload_portfolio_clip(conn, params) do
    require Logger
    Logger.error("[ClipperProfiles] upload_portfolio_clip fallback - params keys: #{inspect(Map.keys(params))}")
    conn
    |> put_status(:bad_request)
    |> json(%{success: false, error: "No file provided. Expected multipart/form-data with 'file' field."})
  end

  defp generate_portfolio_clip_key(user_id, filename) do
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    sanitized = filename
      |> String.replace(~r/[^\w\-\.]/, "_")
      |> String.slice(0, 50)
    "portfolio-clips/#{user_id}/#{timestamp}_#{sanitized}"
  end

  # ============================================================================
  # Public Directory Endpoints
  # ============================================================================

  @doc """
  GET /api/clippers/:slug/portfolio-clips/:clip_id/presigned-url
  Returns a presigned URL for streaming a portfolio clip video on a public profile.
  No ownership check - clip must belong to the profile identified by slug.
  """
  def public_portfolio_clip_presigned_url(conn, %{"slug" => slug, "clip_id" => clip_id}) do
    with %{} = profile <- ClipperProfiles.get_profile_by_slug(slug),
         %ClipperPortfolioClip{} = clip <- ClipperProfiles.get_portfolio_clip(clip_id),
         true <- clip.clipper_profile_id == profile.id do
      case Storage.presigned_url(clip.video_url, expires_in: 3600) do
        {:ok, url} ->
          json(conn, %{success: true, url: url})
        {:error, _} ->
          json(conn, %{success: true, url: clip.video_url})
      end
    else
      nil -> conn |> put_status(:not_found) |> json(%{success: false, error: "Not found"})
      false -> conn |> put_status(:not_found) |> json(%{success: false, error: "Not found"})
    end
  end

  @doc """
  GET /api/clippers/:slug/portfolio-clips/:clip_id/thumbnail-presigned-url
  Returns a presigned URL for a portfolio clip thumbnail on a public profile.
  No ownership check - clip must belong to the profile identified by slug.
  """
  def public_portfolio_clip_thumbnail_presigned_url(conn, %{"slug" => slug, "clip_id" => clip_id}) do
    with %{} = profile <- ClipperProfiles.get_profile_by_slug(slug),
         %ClipperPortfolioClip{} = clip <- ClipperProfiles.get_portfolio_clip(clip_id),
         true <- clip.clipper_profile_id == profile.id do
      if clip.thumbnail_url do
        case Storage.presigned_url(clip.thumbnail_url, expires_in: 3600) do
          {:ok, url} ->
            json(conn, %{success: true, url: url})
          {:error, _} ->
            json(conn, %{success: true, url: clip.thumbnail_url})
        end
      else
        conn |> put_status(:not_found) |> json(%{success: false, error: "No thumbnail available"})
      end
    else
      nil -> conn |> put_status(:not_found) |> json(%{success: false, error: "Not found"})
      false -> conn |> put_status(:not_found) |> json(%{success: false, error: "Not found"})
    end
  end

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
        if ClipperProfiles.public_directory_profile?(profile) do
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

    # Use provided organization_id, or fall back to the user's own organization
    organization_id =
      case params["organization_id"] do
        nil -> user.owned_organization_id
        0 -> user.owned_organization_id
        id when is_integer(id) and id > 0 -> id
        id when is_binary(id) ->
          case Integer.parse(id) do
            {n, ""} when n > 0 -> n
            _ -> user.owned_organization_id
          end
        _ -> user.owned_organization_id
      end

    with %ClipperProfile{} = profile <- ClipperProfiles.get_profile_by_slug(slug),
         {:org, true} <- {:org, not is_nil(organization_id)},
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
      {:org, false} ->
        conn |> put_status(:forbidden) |> json(%{success: false, error: "You must own an organization to endorse clippers"})
      false ->
        conn |> put_status(:forbidden) |> json(%{success: false, error: "Cannot endorse - your organization has not worked with this clipper"})
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
      avatar_url: maybe_presign_avatar(profile.avatar_url),
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
      is_affiliate: Affiliates.is_affiliate?(profile.user_id),
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
        email: profile.user.email,
        last_active_at: profile.user.last_active_at
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
      id: entry.id,
      rank: entry.rank,
      score: entry.score,
      clips_delivered: entry.clips_delivered,
      campaigns_active: entry.campaigns_active,
      endorsements_received: entry.endorsements_received,
      total_views: entry.total_views || 0,
      clipper_profile: if(entry.clipper_profile, do: %{
        id: entry.clipper_profile.id,
        user_id: entry.clipper_profile.user_id,
        display_name: entry.clipper_profile.display_name,
        avatar_url: maybe_presign_avatar(entry.clipper_profile.avatar_url),
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
