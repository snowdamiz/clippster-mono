defmodule ClippsterServerWeb.KickController do
  use ClippsterServerWeb, :controller
  require Logger

  alias ClippsterServer.Kick.Client

  @rapid_api_host "kick-com-api.p.rapidapi.com"

  defp get_rapid_api_key do
    case System.get_env("RAPID_API_KEY") do
      key when is_binary(key) and key != "" -> key
      _ -> nil
    end
  end

  defp rapid_api_headers do
    case get_rapid_api_key() do
      nil ->
        []

      key ->
        [
          {"x-rapidapi-key", key},
          {"x-rapidapi-host", @rapid_api_host}
        ]
    end
  end

  # Get channel live status with retry logic
  def get_channel(conn, %{"channel_slug" => channel_slug}) do
    do_get_channel_with_retry(conn, channel_slug, 3)
  end

  defp do_get_channel_with_retry(conn, channel_slug, retries_left) when retries_left > 0 do
    url = "https://#{@rapid_api_host}/channels/#{channel_slug}"

    case Req.get(url, headers: rapid_api_headers(), retry: false) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        # RapidAPI wraps response in "data" key
        data = body["data"] || body

        # Extract live status from channel data
        livestream = data["livestream"]
        user = data["user"]

        # Check multiple possible field names for is_live
        is_live =
          case livestream do
            nil -> false
            %{"is_live" => true} -> true
            %{"isLive" => true} -> true
            # Also check if livestream exists and has an id (sometimes is_live field is missing)
            %{"id" => id} when not is_nil(id) -> true
            _ -> false
          end

        Logger.info("Kick channel #{channel_slug} is_live: #{is_live}")

        # Extract profile image with robust fallbacks (API field names may vary)
        profile_image_url =
          (user &&
             (user["profile_pic"] ||
                user["profilePic"] ||
                user["profile_picture"] ||
                user["profilePicture"] ||
                user["profile_image_url"] ||
                user["profileImageUrl"] ||
                user["avatar"])) ||
            data["profile_pic"] ||
            data["profilePic"] ||
            data["profile_image_url"] ||
            data["profileImageUrl"] ||
            data["logo"] ||
            data["icon"]

        response = %{
          isLive: is_live,
          channelId: data["id"],
          channelSlug: data["slug"] || channel_slug,
          username: (user && user["username"]) || nil,
          profileImageUrl: profile_image_url,
          streamTitle:
            (livestream && (livestream["session_title"] || livestream["sessionTitle"])) || nil,
          viewerCount:
            (livestream &&
               (livestream["viewer_count"] || livestream["viewerCount"] || livestream["viewers"])) ||
              nil,
          thumbnailUrl:
            get_in(livestream || %{}, ["thumbnail", "url"]) ||
              get_in(livestream || %{}, ["thumbnail", "src"]),
          playbackUrl: data["playbackUrl"] || data["playback_url"],
          startedAt: (livestream && (livestream["created_at"] || livestream["createdAt"])) || nil
        }

        json(conn, response)

      {:ok, %Req.Response{status: 404}} ->
        json(conn, %{
          isLive: false,
          channelSlug: channel_slug,
          error: "Channel not found"
        })

      {:ok, %Req.Response{status: status, body: _body}} when status >= 500 and retries_left > 1 ->
        Logger.warning(
          "Kick API returned #{status} for channel #{channel_slug}, retrying... (#{retries_left - 1} retries left)"
        )

        # Wait briefly before retry (exponential backoff)
        Process.sleep(500 * (4 - retries_left))
        do_get_channel_with_retry(conn, channel_slug, retries_left - 1)

      {:ok, %Req.Response{status: status, body: body}} ->
        Logger.error(
          "Kick API returned #{status} for channel #{channel_slug}. Body: #{inspect(body)}"
        )

        conn
        |> put_status(:bad_gateway)
        |> json(%{isLive: false, error: "Kick API returned #{status}"})

      {:error, exception} when retries_left > 1 ->
        Logger.warning(
          "Kick API request failed for #{channel_slug}, retrying... (#{retries_left - 1} retries left): #{inspect(exception)}"
        )

        Process.sleep(500 * (4 - retries_left))
        do_get_channel_with_retry(conn, channel_slug, retries_left - 1)

      {:error, exception} ->
        Logger.error("Kick API request failed after retries: #{inspect(exception)}")

        conn
        |> put_status(:internal_server_error)
        |> json(%{isLive: false, error: "Kick API request failed"})
    end
  end

  defp do_get_channel_with_retry(conn, channel_slug, 0) do
    Logger.error("Kick API exhausted all retries for channel #{channel_slug}")

    conn
    |> put_status(:internal_server_error)
    |> json(%{isLive: false, error: "Kick API request failed after retries"})
  end

  def get_clips(conn, %{"channel_slug" => channel_slug, "limit" => limit}) do
    limit_int =
      case Integer.parse(to_string(limit)) do
        {n, _} when n > 0 -> n
        _ -> 20
      end

    case Client.list_videos(channel_slug, limit: limit_int) do
      {:ok, %{clips: clips, has_more: has_more, total: total}} ->
        json(conn, %{
          success: true,
          clips: clips,
          hasMore: has_more,
          total: total
        })

      {:error, {:kick_api_failed, error_msg}} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{success: false, error: error_msg})

      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: "Kick API request failed"})
    end
  end

  # Fallback clause when limit is not provided - use default of 20
  def get_clips(conn, %{"channel_slug" => channel_slug}) do
    get_clips(conn, %{"channel_slug" => channel_slug, "limit" => "20"})
  end
end
