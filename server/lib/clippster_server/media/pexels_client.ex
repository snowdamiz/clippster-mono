defmodule ClippsterServer.Media.PexelsClient do
  @moduledoc """
  Pexels video search API client for stock B-roll.
  """

  require Logger

  @base_url "https://api.pexels.com/videos"

  def search(query, opts \\ []) do
    api_key = get_api_key()

    if is_nil(api_key) or api_key == "" do
      {:error, :not_configured}
    else
      orientation = Keyword.get(opts, :orientation, "portrait")
      page = Keyword.get(opts, :page, 1)
      per_page = Keyword.get(opts, :per_page, 8)

      url =
        "#{@base_url}/search?" <>
          URI.encode_query(%{
            "query" => query,
            "orientation" => orientation,
            "page" => page,
            "per_page" => per_page
          })

      headers = [
        {"Authorization", api_key}
      ]

      case Req.get(url, headers: headers, receive_timeout: 30_000) do
        {:ok, %Req.Response{status: 200, body: body}} ->
          {:ok, map_candidates(body)}

        {:ok, %Req.Response{status: status, body: body}} ->
          Logger.error("[Pexels] #{status}: #{inspect(body)}")
          {:error, "Pexels API returned #{status}"}

        {:error, err} ->
          Logger.error("[Pexels] request failed: #{inspect(err)}")
          {:error, "Pexels request failed"}
      end
    end
  end

  defp get_api_key do
    config = Application.get_env(:clippster_server, :pexels, [])
    config[:api_key]
  end

  defp map_candidates(%{"videos" => videos}) when is_list(videos) do
    Enum.map(videos, &map_video/1)
  end

  defp map_candidates(_), do: []

  defp map_video(video) do
    files = Map.get(video, "video_files", [])
    best = pick_best_file(files)
    thumb = List.first(Map.get(video, "video_pictures", []))

    %{
      "id" => "pexels-#{video["id"]}",
      "provider" => "pexels",
      "mediaType" => "video",
      "previewUrl" => get_in(thumb, ["picture"]) || "",
      "downloadUrl" => Map.get(best, "link", ""),
      "width" => Map.get(best, "width", 0),
      "height" => Map.get(best, "height", 0),
      "duration" => Map.get(video, "duration"),
      "attribution" => "Pexels / #{Map.get(video, "user", %{"name" => "Unknown"})["name"]}",
      "license" => "Pexels License",
      "providerAssetId" => to_string(video["id"])
    }
  end

  defp pick_best_file(files) when is_list(files) do
    files
    |> Enum.filter(fn f -> Map.get(f, "quality") in ["hd", "sd", "uhd"] end)
    |> Enum.sort_by(fn f ->
      width = Map.get(f, "width", 0)
      height = Map.get(f, "height", 0)
      pixels = width * height

      quality_rank =
        case Map.get(f, "quality") do
          "uhd" -> 0
          "hd" -> 1
          _ -> 2
        end

      {quality_rank, -pixels}
    end)
    |> List.first()
    |> case do
      nil -> List.first(files) || %{}
      f -> f
    end
  end
end
