defmodule ClippsterServerWeb.KickController do
  use ClippsterServerWeb, :controller
  require Logger

  @rapid_api_host "kick-com-api.p.rapidapi.com"

  defp get_rapid_api_key do
    System.get_env("RAPID_API_KEY") || "1bf3ae18ffmshb1e5abbe9798a55p1246dfjsn389ea6e0de67"
  end

  defp rapid_api_headers do
    [
      {"x-rapidapi-key", get_rapid_api_key()},
      {"x-rapidapi-host", @rapid_api_host}
    ]
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

  # RapidAPI currently returns seconds; older Kick/native payloads used milliseconds.
  # Values above 24h in seconds are treated as milliseconds.
  defp normalize_kick_duration(raw) when is_integer(raw) and raw > 86_400, do: div(raw, 1000)
  defp normalize_kick_duration(raw) when is_float(raw) and raw > 86_400, do: trunc(raw / 1000)
  defp normalize_kick_duration(raw) when is_integer(raw) and raw >= 0, do: raw
  defp normalize_kick_duration(raw) when is_float(raw) and raw >= 0, do: trunc(raw)

  defp normalize_kick_duration(raw) when is_binary(raw) do
    case Integer.parse(String.trim(raw)) do
      {n, _} -> normalize_kick_duration(n)
      :error -> 0
    end
  end

  defp normalize_kick_duration(_), do: 0

  defp kick_vod_page_url(video, channel_slug_fallback) do
    vod_id = video["id"]
    channel_slug =
      get_in(video, ["channel", "slug"]) ||
        video["channel_slug"] ||
        video["channelSlug"] ||
        channel_slug_fallback

    if vod_id && channel_slug && to_string(vod_id) != "" && to_string(channel_slug) != "" do
      "https://kick.com/#{channel_slug}/videos/#{vod_id}"
    else
      nil
    end
  end

  # RapidAPI's videos list no longer includes HLS `source`. Kick thumbnails encode the
  # IVS channel + recording ids, and startTime maps to the path date segments.
  defp reconstruct_kick_hls_url(video) do
    thumbnail =
      get_in(video, ["thumbnail", "src"]) ||
        get_in(video, ["thumbnail", "url"]) ||
        video["thumbnail_url"] ||
        video["thumbnailUrl"]

    start_time =
      video["startTime"] ||
        video["start_time"] ||
        video["created_at"] ||
        video["createdAt"]

    with [ivs_channel_id, recording_id] <- parse_kick_thumbnail_ids(thumbnail),
         {:ok, date_path} <- kick_hls_date_path(start_time) do
      "https://stream.kick.com/3c81249a5ce0/ivs/v1/196233775518/#{ivs_channel_id}/#{date_path}/#{recording_id}/media/hls/master.m3u8"
    else
      _ -> nil
    end
  end

  defp parse_kick_thumbnail_ids(thumbnail) when is_binary(thumbnail) do
    case Regex.run(~r{/video_thumbnails/([^/]+)/([^/]+)/}, thumbnail) do
      [_, ivs_channel_id, recording_id] -> [ivs_channel_id, recording_id]
      _ -> :error
    end
  end

  defp parse_kick_thumbnail_ids(_), do: :error

  defp kick_hls_date_path(start_time) when is_binary(start_time) do
    normalized =
      start_time
      |> String.trim()
      |> String.replace(" ", "T")

    iso =
      cond do
        String.ends_with?(normalized, "Z") -> normalized
        Regex.match?(~r/T\d{2}:\d{2}/, normalized) and not String.contains?(normalized, "+") ->
          normalized <> "Z"

        true ->
          normalized
      end

    case DateTime.from_iso8601(iso) do
      {:ok, dt, _} ->
        {:ok, "#{dt.year}/#{dt.month}/#{dt.day}/#{dt.hour}/#{dt.minute}"}

      _ ->
        case NaiveDateTime.from_iso8601(String.trim_trailing(normalized, "Z")) do
          {:ok, ndt} ->
            {:ok, "#{ndt.year}/#{ndt.month}/#{ndt.day}/#{ndt.hour}/#{ndt.minute}"}

          _ ->
            :error
        end
    end
  end

  defp kick_hls_date_path(_), do: :error

  defp map_kick_video(video, channel_slug) when is_map(video) do
    thumbnail_url =
      get_in(video, ["thumbnail", "src"]) ||
        get_in(video, ["thumbnail", "url"]) ||
        get_in(video, ["thumbnail", "responsive"]) ||
        video["thumbnail_url"] ||
        video["thumbnailUrl"]

    created_at =
      video["startTime"] ||
        video["start_time"] ||
        video["created_at"] ||
        video["createdAt"] ||
        get_in(video, ["video", "created_at"]) ||
        get_in(video, ["livestream", "created_at"])

    playlist_url =
      video["source"] ||
        video["stream"] ||
        video["playback_url"] ||
        video["playbackUrl"] ||
        video["url"] ||
        video["video_url"] ||
        video["videoUrl"] ||
        reconstruct_kick_hls_url(video) ||
        kick_vod_page_url(video, channel_slug)

    %{
      clipId: to_string(video["id"] || ""),
      sessionId: video["slug"] || to_string(video["id"] || ""),
      title:
        video["title"] ||
          video["session_title"] ||
          video["sessionTitle"] ||
          get_in(video, ["livestream", "session_title"]),
      duration: normalize_kick_duration(video["duration"] || 0),
      thumbnailUrl: thumbnail_url,
      playlistUrl: playlist_url,
      mp4Url: nil,
      clipType: "COMPLETE",
      startTime: created_at,
      createdAt: created_at,
      isLive: video["isLive"] || video["is_live"] || false,
      views: video["views"] || video["viewer_count"] || video["viewerCount"] || video["viewers"]
    }
  end

  defp map_kick_video(_, _), do: nil

  def get_clips(conn, %{"channel_slug" => channel_slug, "limit" => limit}) do
    # RapidAPI credentials
    # Using the key provided by the user
    rapid_api_key =
      System.get_env("RAPID_API_KEY") || "1bf3ae18ffmshb1e5abbe9798a55p1246dfjsn389ea6e0de67"

    rapid_api_host = "kick-com-api.p.rapidapi.com"

    # Endpoint structure: /channels/{username}/videos (no /v2 prefix based on user input)
    url = "https://#{rapid_api_host}/channels/#{channel_slug}/videos"

    headers = [
      {"x-rapidapi-key", rapid_api_key},
      {"x-rapidapi-host", rapid_api_host}
    ]

    # Log the first few chars of the key to verify it's not the placeholder
    key_preview =
      if String.length(rapid_api_key) > 4,
        do: String.slice(rapid_api_key, 0, 4) <> "...",
        else: "TooShort"

    case Req.get(url, headers: headers) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        limit_int =
          case Integer.parse(to_string(limit)) do
            {n, _} when n > 0 -> n
            _ -> 20
          end

        # RapidAPI response might be wrapped in "data" or just be the array directly
        videos_list =
          case body do
            %{"data" => data} when is_list(data) ->
              data

            list when is_list(list) ->
              list

            _ ->
              Logger.warning("Kick API response body format unexpected: #{inspect(body)}")
              []
          end

        clips =
          videos_list
          |> Enum.take(limit_int)
          |> Enum.map(&map_kick_video(&1, channel_slug))
          |> Enum.reject(&is_nil/1)

        json(conn, %{
          success: true,
          clips: clips,
          hasMore: length(videos_list) > limit_int,
          total: length(videos_list)
        })

      {:ok, %Req.Response{status: status, body: body}} ->
        Logger.error(
          "Kick API returned #{status}. Key used starts with: #{key_preview}. Body: #{inspect(body)}"
        )

        error_msg =
          case body do
            %{"message" => msg} -> msg
            %{"error" => err} -> err
            _ -> "Kick API returned #{status}"
          end

        conn
        |> put_status(:bad_gateway)
        |> json(%{success: false, error: error_msg, upstream_status: status})

      {:error, exception} ->
        Logger.error("Kick API request failed: #{inspect(exception)}")

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
