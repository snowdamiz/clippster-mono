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

  # Get channel live status
  def get_channel(conn, %{"channel_slug" => channel_slug}) do
    url = "https://#{@rapid_api_host}/channels/#{channel_slug}"

    case Req.get(url, headers: rapid_api_headers()) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        # RapidAPI wraps response in "data" key
        data = body["data"] || body
        
        # Extract live status from channel data
        livestream = data["livestream"]
        user = data["user"]
        
        # Check multiple possible field names for is_live
        is_live = case livestream do
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
          (user && (
            user["profile_pic"] ||
            user["profilePic"] ||
            user["profile_picture"] ||
            user["profilePicture"] ||
            user["profile_image_url"] ||
            user["profileImageUrl"] ||
            user["avatar"]
          )) ||
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
          streamTitle: (livestream && (livestream["session_title"] || livestream["sessionTitle"])) || nil,
          viewerCount: (livestream && (livestream["viewer_count"] || livestream["viewerCount"] || livestream["viewers"])) || nil,
          thumbnailUrl: get_in(livestream || %{}, ["thumbnail", "url"]) || get_in(livestream || %{}, ["thumbnail", "src"]),
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

      {:ok, %Req.Response{status: status, body: body}} ->
        Logger.error("Kick API returned #{status} for channel #{channel_slug}. Body: #{inspect(body)}")
        
        conn
        |> put_status(:bad_gateway)
        |> json(%{isLive: false, error: "Kick API returned #{status}"})

      {:error, exception} ->
        Logger.error("Kick API request failed: #{inspect(exception)}")
        conn
        |> put_status(:internal_server_error)
        |> json(%{isLive: false, error: "Kick API request failed"})
    end
  end

  def get_clips(conn, %{"channel_slug" => channel_slug, "limit" => limit}) do
    # RapidAPI credentials
    # Using the key provided by the user
    rapid_api_key = System.get_env("RAPID_API_KEY") || "1bf3ae18ffmshb1e5abbe9798a55p1246dfjsn389ea6e0de67"
    rapid_api_host = "kick-com-api.p.rapidapi.com"

    # Endpoint structure: /channels/{username}/videos (no /v2 prefix based on user input)
    url = "https://#{rapid_api_host}/channels/#{channel_slug}/videos"

    headers = [
      {"x-rapidapi-key", rapid_api_key},
      {"x-rapidapi-host", rapid_api_host}
    ]

    # Log the first few chars of the key to verify it's not the placeholder
    key_preview = if String.length(rapid_api_key) > 4, do: String.slice(rapid_api_key, 0, 4) <> "...", else: "TooShort"

    case Req.get(url, headers: headers) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        limit_int = String.to_integer(limit)

        # Inspect body to see what we actually got
        Logger.info("Kick API Response Body structure: #{inspect(body)}")

        # RapidAPI response might be wrapped in "data" or just be the array directly
        # Based on screenshots: { "data": [...] } or just [...]
        videos_list =
          case body do
            %{"data" => data} when is_list(data) -> data
            list when is_list(list) -> list
            _ ->
              Logger.warning("Kick API response body format unexpected: #{inspect(body)}")
              []
          end

        clips =
          videos_list
          |> Enum.take(limit_int)
          |> Enum.map(fn video ->
            # Try multiple thumbnail field paths (API response format may vary)
            thumbnail_url =
              get_in(video, ["thumbnail", "src"]) ||
              get_in(video, ["thumbnail", "url"]) ||
              get_in(video, ["thumbnail", "responsive"]) ||
              video["thumbnail_url"] ||
              video["thumbnailUrl"]

            # Map fields safely, handle nil
            %{
              clipId: to_string(video["id"]),
              sessionId: video["slug"],
              title: video["session_title"] || video["sessionTitle"], # Handle different casing
              duration: (video["duration"] || 0) |> div(1000), # ms to seconds
              thumbnailUrl: thumbnail_url,
              playlistUrl: video["source"],
              mp4Url: nil,
              clipType: "COMPLETE",
              startTime: video["created_at"] || video["createdAt"],
              createdAt: video["created_at"] || video["createdAt"],
              isLive: video["is_live"] || video["isLive"],
              views: video["viewer_count"] || video["viewerCount"] || video["views"]
            }
          end)

        json(conn, %{
          success: true,
          clips: clips,
          hasMore: length(videos_list) > limit_int,
          total: length(videos_list)
        })

      {:ok, %Req.Response{status: status, body: body}} ->
        Logger.error("Kick API returned #{status}. Key used starts with: #{key_preview}. Body: #{inspect(body)}")

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
