defmodule ClippsterServerWeb.YouTubeController do
  use ClippsterServerWeb, :controller
  require Logger

  @youtube_api_key "AIzaSyBwKF8pqGqVqKqVqKqVqKqVqKqVqKqVqKq"

  defp get_youtube_api_key do
    System.get_env("YOUTUBE_API_KEY") || @youtube_api_key
  end

  @doc """
  Get YouTube channel information and live status.
  GET /api/youtube/channels/:channel_id

  Accepts either:
  - Channel ID (UC...)
  - Channel handle (@username)
  - Channel custom URL
  """
  def get_channel(conn, %{"channel_id" => channel_id}) do
    do_get_channel_with_retry(conn, channel_id, 3)
  end

  defp do_get_channel_with_retry(conn, channel_id, retries_left) when retries_left > 0 do
    api_key = get_youtube_api_key()

    # Determine if we need to resolve handle to channel ID first
    {resolved_id, channel_name} = resolve_channel_identifier(channel_id, api_key)

    case resolved_id do
      nil ->
        json(conn, %{
          isLive: false,
          channelId: channel_id,
          error: "Channel not found"
        })

      id ->
        # Get channel details and live stream status
        channel_url = "https://www.googleapis.com/youtube/v3/channels"
        search_url = "https://www.googleapis.com/youtube/v3/search"

        channel_params = [
          part: "snippet,statistics",
          id: id,
          key: api_key
        ]

        search_params = [
          part: "snippet",
          channelId: id,
          eventType: "live",
          type: "video",
          key: api_key
        ]

        with {:ok, %Req.Response{status: 200, body: channel_body}} <-
               Req.get(channel_url, params: channel_params, retry: false),
             {:ok, %Req.Response{status: 200, body: search_body}} <-
               Req.get(search_url, params: search_params, retry: false) do
          channel_items = get_in(channel_body, ["items"]) || []
          live_items = get_in(search_body, ["items"]) || []

          if length(channel_items) > 0 do
            channel = List.first(channel_items)
            snippet = channel["snippet"] || %{}
            statistics = channel["statistics"] || %{}

            is_live = length(live_items) > 0
            live_video = if is_live, do: List.first(live_items), else: nil
            live_snippet = if live_video, do: live_video["snippet"], else: nil

            response = %{
              isLive: is_live,
              channelId: channel["id"],
              channelName: channel_name || snippet["title"],
              displayName: snippet["title"],
              profileImageUrl:
                get_in(snippet, ["thumbnails", "high", "url"]) ||
                  get_in(snippet, ["thumbnails", "default", "url"]),
              description: snippet["description"],
              subscriberCount: parse_int(statistics["subscriberCount"]),
              videoCount: parse_int(statistics["videoCount"]),
              streamTitle: live_snippet && live_snippet["title"],
              thumbnailUrl:
                live_snippet &&
                  (get_in(live_snippet, ["thumbnails", "high", "url"]) ||
                     get_in(live_snippet, ["thumbnails", "default", "url"])),
              liveVideoId: live_video && live_video["id"]["videoId"]
            }

            json(conn, response)
          else
            json(conn, %{
              isLive: false,
              channelId: channel_id,
              error: "Channel not found"
            })
          end
        else
          {:ok, %Req.Response{status: status}} when status >= 500 and retries_left > 1 ->
            Logger.warning(
              "YouTube API returned #{status} for channel #{channel_id}, retrying... (#{retries_left - 1} retries left)"
            )

            Process.sleep(500 * (4 - retries_left))
            do_get_channel_with_retry(conn, channel_id, retries_left - 1)

          {:ok, %Req.Response{status: status, body: body}} ->
            Logger.error(
              "YouTube API returned #{status} for channel #{channel_id}. Body: #{inspect(body)}"
            )

            conn
            |> put_status(:bad_gateway)
            |> json(%{isLive: false, error: "YouTube API returned #{status}"})

          {:error, exception} when retries_left > 1 ->
            Logger.warning(
              "YouTube API request failed for #{channel_id}, retrying... (#{retries_left - 1} retries left): #{inspect(exception)}"
            )

            Process.sleep(500 * (4 - retries_left))
            do_get_channel_with_retry(conn, channel_id, retries_left - 1)

          {:error, exception} ->
            Logger.error("YouTube API request failed after retries: #{inspect(exception)}")

            conn
            |> put_status(:internal_server_error)
            |> json(%{isLive: false, error: "YouTube API request failed"})
        end
    end
  end

  defp do_get_channel_with_retry(conn, channel_id, 0) do
    Logger.error("YouTube API exhausted all retries for channel #{channel_id}")

    conn
    |> put_status(:internal_server_error)
    |> json(%{isLive: false, error: "YouTube API request failed after retries"})
  end

  # Resolve channel handle (@username) or custom URL to channel ID
  defp resolve_channel_identifier(identifier, api_key) do
    cond do
      # Already a channel ID (starts with UC)
      String.starts_with?(identifier, "UC") ->
        {identifier, nil}

      # Handle format (@username)
      String.starts_with?(identifier, "@") ->
        handle = String.trim_leading(identifier, "@")
        resolve_handle_to_id(handle, api_key)

      # Try as handle without @
      true ->
        resolve_handle_to_id(identifier, api_key)
    end
  end

  defp resolve_handle_to_id(handle, api_key) do
    url = "https://www.googleapis.com/youtube/v3/search"

    params = [
      part: "snippet",
      q: handle,
      type: "channel",
      maxResults: 1,
      key: api_key
    ]

    case Req.get(url, params: params, retry: false) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        items = get_in(body, ["items"]) || []

        if length(items) > 0 do
          item = List.first(items)
          channel_id = get_in(item, ["snippet", "channelId"])
          channel_title = get_in(item, ["snippet", "channelTitle"])
          {channel_id, channel_title}
        else
          {nil, nil}
        end

      _ ->
        {nil, nil}
    end
  end

  defp parse_int(nil), do: nil
  defp parse_int(value) when is_integer(value), do: value

  defp parse_int(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, _} -> int
      :error -> nil
    end
  end
end
