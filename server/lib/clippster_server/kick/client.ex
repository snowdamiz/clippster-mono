defmodule ClippsterServer.Kick.Client do
  @moduledoc """
  Kick.com channel and VOD listing via RapidAPI, with yt-dlp fallback.
  Shared by KickController and MediaResolver.
  """

  require Logger

  alias ClippsterServer.MediaResolver

  @rapid_api_host "kick-com-api.p.rapidapi.com"

  @type clip :: %{
          clipId: String.t(),
          sessionId: String.t(),
          title: String.t() | nil,
          duration: integer(),
          thumbnailUrl: String.t() | nil,
          playlistUrl: String.t() | nil,
          mp4Url: nil,
          clipType: String.t(),
          startTime: String.t() | nil,
          createdAt: String.t() | nil,
          isLive: boolean(),
          views: integer() | nil
        }

  def extract_channel_slug(input) when is_binary(input) do
    trimmed = String.trim(input)

    cond do
      trimmed == "" ->
        {:error, :invalid_channel}

      String.starts_with?(trimmed, "http://") or String.starts_with?(trimmed, "https://") ->
        case URI.parse(trimmed) do
          %URI{host: host, path: path} when host in ["kick.com", "www.kick.com"] ->
            parts = path |> String.split("/", trim: true)

            case parts do
              [slug | _] when slug != "" and slug != "video" -> {:ok, slug}
              _ -> {:error, :invalid_channel}
            end

          _ ->
            {:error, :invalid_channel}
        end

      Regex.match?(~r/^[a-zA-Z0-9_-]{3,}$/, trimmed) ->
        {:ok, trimmed}

      true ->
        {:error, :invalid_channel}
    end
  end

  def extract_channel_slug(_), do: {:error, :invalid_channel}

  @doc """
  List archived VODs for a channel slug.
  Tries RapidAPI first, then yt-dlp (same as desktop fallback path).
  """
  def list_videos(channel_slug, opts \\ []) do
    case list_videos_via_rapidapi(channel_slug, opts) do
      {:ok, result} ->
        {:ok, result}

      {:error, rapid_err} ->
        Logger.warning(
          "Kick RapidAPI failed for #{channel_slug} (#{inspect(rapid_err)}), falling back to yt-dlp"
        )

        list_videos_via_ytdlp(channel_slug, opts)
    end
  end

  defp list_videos_via_rapidapi(channel_slug, opts) do
    limit = Keyword.get(opts, :limit, 20)
    offset = Keyword.get(opts, :offset, 0)

    case rapid_api_key() do
      "" ->
        {:error, {:kick_api_failed, "RAPID_API_KEY not configured"}}

      _key ->
        fetch_rapidapi_videos(channel_slug, limit, offset)
    end
  end

  defp fetch_rapidapi_videos(channel_slug, limit, offset) do
    url = "https://#{@rapid_api_host}/channels/#{channel_slug}/videos"

    case Req.get(url, headers: rapid_api_headers(), retry: false) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        videos_list = normalize_videos_list(body)

        clips =
          videos_list
          |> Enum.drop(offset)
          |> Enum.take(limit)
          |> Enum.map(&map_kick_video(&1, channel_slug))
          |> Enum.reject(&is_nil/1)
          |> Enum.reject(& &1.isLive)

        {:ok,
         %{
           clips: clips,
           has_more: length(videos_list) > offset + limit,
           total: length(videos_list)
         }}

      {:ok, %Req.Response{status: status, body: body}} ->
        Logger.error("Kick RapidAPI returned #{status} for #{channel_slug}: #{inspect(body)}")

        error_msg =
          case body do
            %{"message" => msg} when is_binary(msg) and msg != "" -> msg
            %{"error" => err} when is_binary(err) and err != "" -> err
            _ -> "Kick API returned #{status}"
          end

        {:error, {:kick_api_failed, error_msg}}

      {:error, exception} ->
        Logger.error("Kick RapidAPI request failed for #{channel_slug}: #{inspect(exception)}")
        {:error, {:kick_api_failed, "Kick API request failed"}}
    end
  end

  defp list_videos_via_ytdlp(channel_slug, opts) do
    limit = Keyword.get(opts, :limit, 20)
    offset = Keyword.get(opts, :offset, 0)

    case MediaResolver.list_kick_vods_ytdlp(channel_slug, limit: limit, offset: offset) do
      {:ok, %{entries: entries, has_more: has_more, total: total}} ->
        clips =
          entries
          |> Enum.map(&ytdlp_entry_to_clip(&1, channel_slug))
          |> Enum.reject(&is_nil/1)

        {:ok, %{clips: clips, has_more: has_more, total: total}}

      {:error, reason} ->
        Logger.error("Kick yt-dlp fallback failed for #{channel_slug}: #{inspect(reason)}")

        {:error,
         {:kick_api_failed,
          "Could not load Kick VODs. Check that yt-dlp is installed and RAPID_API_KEY is valid."}}
    end
  end

  defp normalize_videos_list(body) do
    case body do
      %{"data" => data} when is_list(data) -> data
      list when is_list(list) -> list
      _ ->
        Logger.warning("Kick API response body format unexpected: #{inspect(body)}")
        []
    end
  end

  defp ytdlp_entry_to_clip(entry, channel_slug) when is_map(entry) do
    video_id = entry["id"] && to_string(entry["id"])

    page_url =
      entry["webpage_url"] ||
        entry["url"] ||
        (video_id && "https://kick.com/#{channel_slug}/videos/#{video_id}")

    created_at = entry["upload_date"] || entry["release_timestamp"] || entry["timestamp"]

    %{
      clipId: video_id || "",
      sessionId: video_id || "",
      title: entry["title"],
      duration: normalize_kick_duration(entry["duration"] || 0),
      thumbnailUrl: ytdlp_thumbnail(entry),
      playlistUrl: page_url,
      pageUrl: page_url,
      mp4Url: nil,
      clipType: "COMPLETE",
      startTime: format_ytdlp_date(created_at),
      createdAt: format_ytdlp_date(created_at),
      isLive: false,
      views: entry["view_count"] || entry["views"]
    }
  end

  defp ytdlp_entry_to_clip(_, _), do: nil

  defp ytdlp_thumbnail(entry) do
    cond do
      is_binary(entry["thumbnail"]) -> entry["thumbnail"]
      is_list(entry["thumbnails"]) and entry["thumbnails"] != [] ->
        entry["thumbnails"] |> List.last() |> Map.get("url")

      true ->
        nil
    end
  end

  defp format_ytdlp_date(nil), do: nil

  defp format_ytdlp_date(date) when is_binary(date) do
    if Regex.match?(~r/^\d{8}$/, date) do
      "#{String.slice(date, 0, 4)}-#{String.slice(date, 4, 2)}-#{String.slice(date, 6, 2)}"
    else
      date
    end
  end

  defp format_ytdlp_date(date) when is_integer(date), do: to_string(date)
  defp format_ytdlp_date(_), do: nil

  defp rapid_api_headers do
    [
      {"x-rapidapi-key", rapid_api_key()},
      {"x-rapidapi-host", @rapid_api_host}
    ]
  end

  defp rapid_api_key do
    case System.get_env("RAPID_API_KEY") do
      key when is_binary(key) and key != "" -> key
      _ -> ""
    end
  end

  # RapidAPI currently returns seconds; older Kick/native payloads used milliseconds.
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

  def vod_page_url(video, channel_slug_fallback) do
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

    page_url = vod_page_url(video, channel_slug)

    playlist_url =
      video["source"] ||
        video["stream"] ||
        video["playback_url"] ||
        video["playbackUrl"] ||
        video["url"] ||
        video["video_url"] ||
        video["videoUrl"] ||
        reconstruct_kick_hls_url(video) ||
        page_url

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
      pageUrl: page_url,
      mp4Url: nil,
      clipType: "COMPLETE",
      startTime: created_at,
      createdAt: created_at,
      isLive: video["isLive"] || video["is_live"] || false,
      views: video["views"] || video["viewer_count"] || video["viewerCount"] || video["viewers"]
    }
  end

  defp map_kick_video(_, _), do: nil
end
