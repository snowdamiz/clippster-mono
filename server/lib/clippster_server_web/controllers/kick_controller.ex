defmodule ClippsterServerWeb.KickController do
  use ClippsterServerWeb, :controller
  require Logger

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
              Logger.warn("Kick API response body format unexpected: #{inspect(body)}")
              []
          end

        clips = 
          videos_list
          |> Enum.take(limit_int)
          |> Enum.map(fn video ->
            # Map fields safely, handle nil
            %{
              clipId: to_string(video["id"]),
              sessionId: video["slug"],
              title: video["session_title"] || video["sessionTitle"], # Handle different casing
              duration: (video["duration"] || 0) |> div(1000), # ms to seconds
              thumbnailUrl: get_in(video, ["thumbnail", "src"]) || get_in(video, ["thumbnail", "url"]),
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
        # Log the first few chars of the key to verify it's not the placeholder
        key_preview = if String.length(rapid_api_key) > 4, do: String.slice(rapid_api_key, 0, 4) <> "...", else: "TooShort"
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
end
