defmodule ClippsterServer.MediaResolver do
  @moduledoc """
  Server-side yt-dlp orchestration for mobile VOD resolve and channel browse.
  Mirrors desktop Tauri yt-dlp usage without downloading on the server.
  """

  require Logger

  @default_timeout_ms 120_000
  @vod_list_timeout_ms 90_000

  @platform_patterns %{
    "youtube" => ~r/(?:youtube\.com|youtu\.be)/i,
    "kick" => ~r/kick\.com/i,
    "twitch" => ~r/twitch\.tv/i,
    "rumble" => ~r/rumble\.com/i,
    "twitter" => ~r/(?:twitter\.com|x\.com)/i
  }

  @doc """
  List Kick channel VODs via yt-dlp (fallback when RapidAPI is unavailable).
  """
  def list_kick_vods_ytdlp(channel, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    offset = Keyword.get(opts, :offset, 0)

    with {:ok, channel_url} <- build_channel_url("kick", channel),
         {:ok, entries} <- run_playlist_json("kick", channel_url, limit, offset) do
      {:ok,
       %{
         entries: entries,
         has_more: length(entries) >= limit,
         total: length(entries) + offset
       }}
    end
  end

  @doc """
  Detect platform from URL. Optional `platform` param overrides auto-detection.
  """
  def detect_platform(url, platform \\ nil) do
    normalized = platform && String.downcase(platform)

    cond do
      normalized && Map.has_key?(@platform_patterns, normalized) ->
        {:ok, normalized}

      true ->
        case Enum.find(@platform_patterns, fn {_name, pattern} -> Regex.match?(pattern, url) end) do
          {name, _} -> {:ok, name}
          nil -> {:error, :unsupported_platform}
        end
    end
  end

  @doc """
  Resolve a URL into downloadable stream metadata (no server-side download).
  """
  def resolve_url(url, opts \\ []) do
    quality = Keyword.get(opts, :quality, "best")

    with {:ok, platform} <- detect_platform(url, Keyword.get(opts, :platform)),
         {:ok, info} <- run_json(platform, url) do
      {:ok, build_resolve_response(platform, info, quality)}
    end
  end

  @doc """
  Probe metadata (title, duration, thumbnail) without full stream selection.
  """
  def probe(url, opts \\ []) do
    with {:ok, platform} <- detect_platform(url, Keyword.get(opts, :platform)),
         {:ok, info} <- run_json(platform, url) do
      {:ok,
       %{
         platform: platform,
         title: info["title"],
         duration_seconds: to_float(info["duration"]),
         thumbnail_url: pick_thumbnail(info),
         source_id: info["id"]
       }}
    end
  end

  @doc """
  List VODs for a channel browse screen.
  """
  def list_vods(platform, channel, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    offset = Keyword.get(opts, :offset, 0)

    with {:ok, normalized_platform} <- normalize_platform(platform) do
      if normalized_platform == "kick" do
        list_kick_vods(channel, limit, offset)
      else
        list_vods_via_ytdlp(normalized_platform, channel, limit, offset)
      end
    end
  end

  defp list_vods_via_ytdlp(normalized_platform, channel, limit, offset) do
    with {:ok, channel_url} <- build_channel_url(normalized_platform, channel),
         {:ok, entries} <- run_playlist_json(normalized_platform, channel_url, limit, offset) do
      {:ok,
       %{
         platform: normalized_platform,
         channel: channel,
         vods: Enum.map(entries, &map_vod_entry(normalized_platform, &1))
       }}
    end
  end

  defp list_kick_vods(channel, limit, offset) do
    alias ClippsterServer.Kick.Client

    with {:ok, slug} <- Client.extract_channel_slug(channel),
         {:ok, %{clips: clips}} <- Client.list_videos(slug, limit: limit, offset: offset) do
      {:ok,
       %{
         platform: "kick",
         channel: channel,
         vods: Enum.map(clips, &kick_clip_to_vod_entry/1)
       }}
    else
      {:error, {:kick_api_failed, message}} -> {:error, {:ytdlp_failed, message}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp kick_clip_to_vod_entry(clip) do
    %{
      id: clip.clipId,
      title: clip.title,
      duration_seconds: clip.duration * 1.0,
      thumbnail_url: clip.thumbnailUrl,
      url: clip.pageUrl || clip.playlistUrl,
      upload_date: clip.createdAt
    }
  end

  defp normalize_platform(platform) when is_binary(platform) do
    name = platform |> String.downcase() |> String.trim()

    if Map.has_key?(@platform_patterns, name) do
      {:ok, name}
    else
      {:error, :unsupported_platform}
    end
  end

  defp normalize_platform(_), do: {:error, :unsupported_platform}

  defp build_channel_url("youtube", channel) do
    url =
      cond do
        String.contains?(channel, "youtube.com") or String.starts_with?(channel, "@") ->
          if String.starts_with?(channel, "@") do
            "https://www.youtube.com/#{channel}/streams"
          else
            channel_url_with_tab(channel, "streams")
          end

        String.starts_with?(channel, "UC") ->
          "https://www.youtube.com/channel/#{channel}/streams"

        true ->
          "https://www.youtube.com/@#{channel}/streams"
      end

    {:ok, url}
  end

  defp build_channel_url("kick", channel) do
    slug =
      channel
      |> String.replace(~r{^https?://(?:www\.)?kick\.com/}, "")
      |> String.split("/")
      |> List.first()

    {:ok, "https://kick.com/#{slug}/videos"}
  end

  defp build_channel_url("twitch", channel) do
    name =
      channel
      |> String.replace(~r{^https?://(?:www\.)?twitch\.tv/}, "")
      |> String.split("/")
      |> List.first()

    {:ok, "https://www.twitch.tv/#{name}/videos?filter=archives"}
  end

  defp build_channel_url("rumble", channel) do
    name =
      channel
      |> String.replace(~r{^https?://(?:www\.)?rumble\.com/c/}, "")
      |> String.split("/")
      |> List.first()

    {:ok, "https://rumble.com/c/#{name}"}
  end

  defp build_channel_url("twitter", _channel) do
    {:error, :vod_list_not_supported}
  end

  defp channel_url_with_tab(url, tab) do
    base = String.trim_trailing(url, "/")

    cond do
      String.contains?(base, "/streams") or String.contains?(base, "/videos") ->
        base

      true ->
        base <> "/#{tab}"
    end
  end

  defp run_json(platform, url) do
    args =
      base_args(platform)
      |> Kernel.++(["-j", "--no-download", "--no-warnings", url])

    case run_ytdlp(args, timeout: @default_timeout_ms) do
      {:ok, stdout} ->
        parse_single_json(stdout)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp run_playlist_json(platform, url, limit, offset) do
    start_item = offset + 1
    end_item = offset + limit

    args =
      base_args(platform)
      |> Kernel.++([
        "-j",
        "--flat-playlist",
        "--skip-download",
        "--no-warnings",
        "--ignore-errors",
        "--playlist-start",
        Integer.to_string(start_item),
        "--playlist-end",
        Integer.to_string(end_item),
        url
      ])

    case run_ytdlp(args, timeout: @vod_list_timeout_ms) do
      {:ok, stdout} ->
        entries =
          stdout
          |> String.split("\n", trim: true)
          |> Enum.map(&Jason.decode/1)
          |> Enum.filter(&match?({:ok, _}, &1))
          |> Enum.map(fn {:ok, json} -> json end)

        {:ok, entries}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp base_args("youtube") do
    [
      "--impersonate",
      "chrome",
      "--extractor-args",
      "youtubetab:skip=webpage;youtube:player_skip=webpage,configs"
    ]
  end

  defp base_args("kick"), do: ["--impersonate", "chrome"]
  defp base_args("twitch"), do: ["--impersonate", "chrome"]
  defp base_args("rumble"), do: ["--impersonate", "chrome"]
  defp base_args("twitter"), do: ["--impersonate", "chrome"]
  defp base_args(_platform), do: []

  defp run_ytdlp(args, opts) do
    binary = ytdlp_binary()
    timeout = Keyword.get(opts, :timeout, @default_timeout_ms)

    Logger.info("[MediaResolver] yt-dlp #{Enum.join(args, " ")}")

    task =
      Task.async(fn ->
        System.cmd(binary, args, stderr_to_stdout: true, env: ytdlp_env())
      end)

    case Task.yield(task, timeout) || Task.shutdown(task, :brutal_kill) do
      {:ok, result} ->
        parse_ytdlp_cmd_result(result)

      nil ->
        {:error, :timeout}

      {:exit, reason} ->
        {:error, {:ytdlp_crashed, inspect(reason)}}
    end
  rescue
    e ->
      Logger.error("[MediaResolver] yt-dlp exception: #{Exception.message(e)}")
      {:error, {:ytdlp_unavailable, "Media resolver failed. Try again or use a direct video link."}}
  end

  defp parse_ytdlp_cmd_result({stdout, 0}) do
    if String.trim(stdout) == "" do
      {:error, :empty_response}
    else
      {:ok, stdout}
    end
  end

  defp parse_ytdlp_cmd_result({stdout, code}) do
    Logger.warning("[MediaResolver] yt-dlp exit #{code}: #{String.slice(stdout, 0, 500)}")
    {:error, {:ytdlp_failed, sanitize_ytdlp_error(stdout)}}
  end

  defp ytdlp_binary do
    System.get_env("YTDLP_PATH") || System.get_env("YT_DLP_PATH") || "yt-dlp"
  end

  defp ytdlp_env do
    case System.get_env("YTDLP_COOKIES_FILE") do
      nil -> []
      path -> [{"YTDLP_COOKIE_FILE", path}]
    end
  end

  defp parse_single_json(stdout) do
    line =
      stdout
      |> String.split("\n", trim: true)
      |> List.first()

    case Jason.decode(line || "") do
      {:ok, json} -> {:ok, json}
      {:error, _} -> {:error, :invalid_json}
    end
  end

  defp build_resolve_response(platform, info, quality) do
    %{
      platform: platform,
      title: info["title"],
      duration_seconds: to_float(info["duration"]),
      thumbnail_url: pick_thumbnail(info),
      streams: select_streams(info, quality),
      source_id: info["id"]
    }
  end

  defp select_streams(info, quality) do
    formats = info["formats"] || []

    streams =
      cond do
        is_binary(info["url"]) ->
          [stream_entry(info["url"], info["ext"] || "mp4", info)]

        formats != [] ->
          formats
          |> Enum.filter(fn f -> is_binary(f["url"]) end)
          |> sort_formats(quality)
          |> Enum.take(3)
          |> Enum.map(fn f -> stream_entry(f["url"], f["ext"] || "mp4", f) end)

        true ->
          []
      end

    if streams == [] do
      raise "no_streams"
    end

    streams
  rescue
    _ -> []
  end

  defp sort_formats(formats, "best") do
    Enum.sort_by(formats, fn f -> {format_height(f), f["tbr"] || 0} end, :desc)
  end

  # Mobile asks for 720: pick the best format at or below ~720p, else fall back.
  defp sort_formats(formats, "720") do
    capped =
      formats
      |> Enum.filter(fn f -> format_height(f) > 0 and format_height(f) <= 800 end)
      |> Enum.sort_by(fn f -> {format_height(f), f["tbr"] || 0} end, :desc)

    if capped == [], do: sort_formats(formats, "best"), else: capped
  end

  defp sort_formats(formats, _quality), do: sort_formats(formats, "best")

  defp format_height(format), do: format["height"] || 0

  defp stream_entry(url, format, meta) do
    %{
      url: url,
      format: format,
      height: meta["height"],
      expires_at: format_expires(meta)
    }
  end

  defp format_expires(%{"expires" => expires}) when is_integer(expires) do
    DateTime.from_unix!(expires) |> DateTime.to_iso8601()
  end

  defp format_expires(_), do: nil

  defp pick_thumbnail(info) do
    cond do
      is_binary(info["thumbnail"]) -> info["thumbnail"]
      is_list(info["thumbnails"]) and info["thumbnails"] != [] ->
        info["thumbnails"]
        |> List.last()
        |> Map.get("url")

      true ->
        nil
    end
  end

  defp map_vod_entry(_platform, entry) do
    video_id = entry["id"]
    url = entry["url"] || entry["webpage_url"] || vod_url_from_id(video_id, entry)

    %{
      id: video_id,
      title: entry["title"],
      duration_seconds: to_float(entry["duration"]),
      thumbnail_url: pick_thumbnail(entry),
      url: url,
      upload_date: entry["upload_date"] || entry["release_timestamp"]
    }
  end

  defp vod_url_from_id(id, entry) when is_binary(id) do
    case entry["extractor_key"] || entry["ie_key"] do
      "Youtube" -> "https://www.youtube.com/watch?v=#{id}"
      "Twitch" -> "https://www.twitch.tv/videos/#{id}"
      "Kick" -> kick_vod_url_from_entry(id, entry)
      "Rumble" -> rumble_vod_url_from_entry(id, entry)
      _ -> id
    end
  end

  defp vod_url_from_id(_, _), do: nil

  defp rumble_vod_url_from_entry(id, entry) do
    case entry["webpage_url"] do
      url when is_binary(url) and url != "" -> url
      _ -> "https://rumble.com/v#{id}"
    end
  end

  defp kick_vod_url_from_entry(id, entry) do
    case entry["webpage_url"] do
      url when is_binary(url) and url != "" -> url
      _ ->
        channel =
          get_in(entry, ["channel"]) ||
            get_in(entry, ["uploader"]) ||
            entry["uploader_id"]

        if is_binary(channel) and channel != "" do
          "https://kick.com/#{channel}/videos/#{id}"
        else
          id
        end
    end
  end

  defp to_float(nil), do: nil
  defp to_float(value) when is_integer(value), do: value * 1.0
  defp to_float(value) when is_float(value), do: value

  defp to_float(value) when is_binary(value) do
    case Float.parse(value) do
      {num, _} -> num
      :error -> nil
    end
  end

  @doc false
  def sanitize_ytdlp_error(output) when is_binary(output) do
    output
    |> String.split("\n")
    |> Enum.find(fn line ->
      String.contains?(line, "ERROR") or String.contains?(line, "error")
    end)
    |> case do
      nil -> "Unable to resolve this URL. The video may be unavailable or restricted."
      line -> String.trim(line) |> String.replace_prefix("ERROR: ", "")
    end
  end

  def sanitize_ytdlp_error(other), do: inspect(other)
end
