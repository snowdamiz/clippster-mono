defmodule ClippsterServerWeb.PostForMeController do
  @moduledoc """
  Authenticated proxy controller for Post for Me API operations.

  All requests require authentication. The server proxies calls to PFM
  so the API key never reaches the client.

  Supports:
  - Media upload URL generation
  - Post creation/management
  - Analytics retrieval
  - Account listing and disconnection
  """

  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.Social
  alias ClippsterServer.Social.PostForMe.{Accounts, Media, Posts, Analytics}

  # ============================================================================
  # Accounts
  # ============================================================================

  @doc """
  GET /api/postforme/accounts

  Lists Post for Me social accounts, optionally filtered by platform.
  """
  def list_accounts(conn, params) do
    opts = []
    opts = if params["platform"], do: [{:platform, params["platform"]} | opts], else: opts
    opts = if params["cursor"], do: [{:cursor, params["cursor"]} | opts], else: opts

    case Accounts.list_accounts(opts) do
      {:ok, data} ->
        json(conn, %{success: true, data: data})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: format_error(reason)})
    end
  end

  @doc """
  POST /api/postforme/accounts/:id/disconnect

  Disconnects a social account from Post for Me.
  """
  def disconnect(conn, %{"id" => pfm_account_id}) do
    case Accounts.disconnect_account(pfm_account_id) do
      {:ok, _data} ->
        # Also deactivate our local account
        case Social.get_social_account_by_pfm_id(pfm_account_id) do
          nil -> :ok
          account -> Social.update_social_account(account, %{is_active: false})
        end

        json(conn, %{success: true, message: "Account disconnected"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: format_error(reason)})
    end
  end

  # ============================================================================
  # Media Upload
  # ============================================================================

  @doc """
  POST /api/postforme/media/upload-url

  Generates a presigned upload URL for media.
  Client will PUT the file directly to this URL.

  Params:
  - file_name: Name of the file
  - file_size: Size in bytes
  - content_type: MIME type
  """
  def create_upload_url(conn, %{
        "file_name" => file_name,
        "file_size" => file_size,
        "content_type" => content_type
      }) do
    case Media.create_upload_url(file_name, file_size, content_type) do
      {:ok, data} ->
        json(conn, %{success: true, data: data})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: format_error(reason)})
    end
  end

  def create_upload_url(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameters: file_name, file_size, content_type"})
  end

  # ============================================================================
  # Posts
  # ============================================================================

  @doc """
  POST /api/postforme/posts

  Creates a social post via Post for Me.

  Params:
  - social_account_ids: List of PFM social account IDs
  - media_url: Media URL from PFM upload
  - text: Caption/description
  - scheduled_at: (optional) ISO 8601 datetime
  - instagram_config: (optional) platform-specific config
  - tiktok_config: (optional) platform-specific config
  - youtube_config: (optional) platform-specific config
  """
  def create_post(conn, params) do
    user = conn.assigns.current_user

    # Build PFM post payload
    pfm_payload = build_post_payload(params)

    case Posts.create_post(pfm_payload) do
      {:ok, pfm_post} ->
        pfm_post_id = pfm_post["id"]

        # Create local PostSubmission record to track it
        local_attrs = build_local_post_attrs(params, user, pfm_post_id)

        case create_local_post_submission(local_attrs, params, user) do
          {:ok, local_post} ->
            json(conn, %{
              success: true,
              post: %{
                id: local_post.id,
                pfm_post_id: pfm_post_id,
                platform: local_post.platform,
                status: local_post.status,
                caption: local_post.caption
              }
            })

          {:error, reason} ->
            # PFM post was created but local tracking failed - still report success
            Logger.warning("[PostForMe] Local post creation failed: #{inspect(reason)}")
            json(conn, %{
              success: true,
              pfm_post_id: pfm_post_id,
              warning: "Post submitted but local tracking failed"
            })
        end

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: format_error(reason)})
    end
  end

  @doc """
  GET /api/postforme/posts

  Lists posts, optionally filtered.
  """
  def list_posts(conn, params) do
    opts = []
    opts = if params["social_account_id"], do: [{:social_account_id, params["social_account_id"]} | opts], else: opts
    opts = if params["status"], do: [{:status, params["status"]} | opts], else: opts
    opts = if params["cursor"], do: [{:cursor, params["cursor"]} | opts], else: opts

    case Posts.list_posts(opts) do
      {:ok, data} ->
        json(conn, %{success: true, data: data})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: format_error(reason)})
    end
  end

  @doc """
  GET /api/postforme/posts/:id

  Gets a single post from PFM.
  """
  def get_post(conn, %{"id" => pfm_post_id}) do
    case Posts.get_post(pfm_post_id) do
      {:ok, data} ->
        json(conn, %{success: true, data: data})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: format_error(reason)})
    end
  end

  # ============================================================================
  # Analytics
  # ============================================================================

  @doc """
  GET /api/postforme/accounts/:id/feed

  Gets the social account feed with optional metrics.
  """
  def get_feed(conn, %{"id" => pfm_account_id} = params) do
    opts = []
    opts = if params["expand"], do: [{:expand, params["expand"]} | opts], else: [{:expand, "metrics"} | opts]
    opts = if params["cursor"], do: [{:cursor, params["cursor"]} | opts], else: opts

    case Analytics.get_account_feed(pfm_account_id, opts) do
      {:ok, data} ->
        json(conn, %{success: true, data: data})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: format_error(reason)})
    end
  end

  @doc """
  GET /api/postforme/post-results

  Gets post results (publish outcomes).
  """
  def get_post_results(conn, params) do
    opts = []
    opts = if params["social_post_id"], do: [{:social_post_id, params["social_post_id"]} | opts], else: opts
    opts = if params["cursor"], do: [{:cursor, params["cursor"]} | opts], else: opts

    case Analytics.list_post_results(opts) do
      {:ok, data} ->
        json(conn, %{success: true, data: data})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: format_error(reason)})
    end
  end

  # ============================================================================
  # Private - Payload Building
  # ============================================================================

  defp build_post_payload(params) do
    payload = %{
      "social_account_ids" => params["social_account_ids"] || [],
      "media_url" => params["media_url"]
    }

    payload = if params["text"], do: Map.put(payload, "text", params["text"]), else: payload
    payload = if params["caption"], do: Map.put(payload, "text", params["caption"]), else: payload
    payload = if params["scheduled_at"], do: Map.put(payload, "scheduled_at", params["scheduled_at"]), else: payload

    # Platform-specific configs
    payload = if params["instagram_config"], do: Map.put(payload, "instagram_config", params["instagram_config"]), else: payload
    payload = if params["tiktok_config"], do: Map.put(payload, "tiktok_config", params["tiktok_config"]), else: payload
    payload = if params["youtube_config"], do: Map.put(payload, "youtube_config", params["youtube_config"]), else: payload

    # Per-account overrides
    payload = if params["social_account_configs"], do: Map.put(payload, "social_account_configs", params["social_account_configs"]), else: payload

    payload
  end

  defp build_local_post_attrs(params, user, pfm_post_id) do
    platform = params["platform"] || detect_platform(params)

    base = %{
      submitted_by_user_id: user.id,
      platform: platform,
      media_url: params["media_url"],
      caption: params["text"] || params["caption"],
      media_type: params["media_type"] || "video",
      thumbnail_url: params["thumbnail_url"],
      pfm_post_id: pfm_post_id,
      status: if(params["scheduled_at"], do: "scheduled", else: "publishing")
    }

    base = if params["scheduled_at"] do
      case DateTime.from_iso8601(params["scheduled_at"]) do
        {:ok, dt, _} -> Map.put(base, :scheduled_at, dt)
        _ -> base
      end
    else
      base
    end

    # Determine owner type and account IDs
    cond do
      params["organization_id"] ->
        base
        |> Map.put(:owner_type, "org")
        |> Map.put(:organization_id, parse_int(params["organization_id"]))
        |> Map.put(:organization_social_account_id, parse_int(params["social_account_id"]))
        |> Map.put(:organization_creator_profile_id, parse_int(params["creator_profile_id"]))
        |> Map.put(:campaign_id, parse_int(params["campaign_id"]))

      params["user_social_account_id"] ->
        base
        |> Map.put(:owner_type, "user")
        |> Map.put(:user_social_account_id, parse_int(params["user_social_account_id"]))

      true ->
        Map.put(base, :owner_type, "user")
    end
  end

  defp create_local_post_submission(attrs, params, user) do
    if params["scheduled_at"] do
      Social.schedule_post(attrs, user)
    else
      Social.create_immediate_post(attrs, user)
    end
  end

  defp detect_platform(params) do
    cond do
      params["instagram_config"] -> "instagram"
      params["tiktok_config"] -> "tiktok"
      params["youtube_config"] -> "youtube"
      true -> "instagram"
    end
  end

  defp parse_int(nil), do: nil
  defp parse_int(val) when is_integer(val), do: val
  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {int, _} -> int
      :error -> nil
    end
  end

  defp format_error(%{message: message}), do: message
  defp format_error(reason) when is_binary(reason), do: reason
  defp format_error(reason), do: inspect(reason)
end
