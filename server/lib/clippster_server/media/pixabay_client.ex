defmodule ClippsterServer.Media.PixabayClient do
  @moduledoc """
  Pixabay video search API client (fallback stock B-roll provider).
  """

  require Logger

  @image_base_url "https://pixabay.com/api/"
  @video_base_url "https://pixabay.com/api/videos/"

  def search(query, opts \\ []) do
    api_key = get_api_key()

    if is_nil(api_key) or api_key == "" do
      {:error, :not_configured}
    else
      page = Keyword.get(opts, :page, 1)
      per_page = Keyword.get(opts, :per_page, 8)
      media_type = Keyword.get(opts, :media_type, "video")

      search_url =
        if media_type == "image" do
          build_image_url(api_key, query, page, per_page)
        else
          build_video_url(api_key, query, page, per_page)
        end

      case Req.get(search_url, receive_timeout: 30_000) do
        {:ok, %Req.Response{status: 200, body: body}} ->
          {:ok, map_candidates(body, media_type)}

        {:ok, %Req.Response{status: status, body: body}} ->
          Logger.error("[Pixabay] #{status}: #{inspect(body)}")
          {:error, "Pixabay API returned #{status}"}

        {:error, err} ->
          Logger.error("[Pixabay] request failed: #{inspect(err)}")
          {:error, "Pixabay request failed"}
      end
    end
  end

  defp get_api_key do
    config = Application.get_env(:clippster_server, :pixabay, [])
    config[:api_key]
  end

  defp build_video_url(api_key, query, page, per_page) do
    @video_base_url <>
      "?" <>
      URI.encode_query(%{
        "key" => api_key,
        "q" => query,
        "page" => page,
        "per_page" => per_page,
        "video_type" => "film",
        "safesearch" => "true"
      })
  end

  defp build_image_url(api_key, query, page, per_page) do
    @image_base_url <>
      "?" <>
      URI.encode_query(%{
        "key" => api_key,
        "q" => query,
        "page" => page,
        "per_page" => per_page,
        "image_type" => "photo",
        "safesearch" => "true"
      })
  end

  defp map_candidates(%{"hits" => hits}, "image") when is_list(hits) do
    Enum.map(hits, &map_image_hit/1)
  end

  defp map_candidates(%{"hits" => hits}, _media_type) when is_list(hits) do
    Enum.map(hits, &map_video_hit/1)
  end

  defp map_candidates(_, _), do: []

  defp map_video_hit(hit) do
    videos = Map.get(hit, "videos", %{})
    best = pick_best_variant(videos)

    %{
      "id" => "pixabay-#{hit["id"]}",
      "provider" => "pixabay",
      "mediaType" => "video",
      "previewUrl" => Map.get(best, "thumbnail", ""),
      "downloadUrl" => Map.get(best, "url", ""),
      "width" => Map.get(best, "width", 0),
      "height" => Map.get(best, "height", 0),
      "duration" => Map.get(hit, "duration"),
      "attribution" => "Pixabay / #{Map.get(hit, "user", "Unknown")}",
      "license" => "Pixabay License",
      "providerAssetId" => to_string(hit["id"])
    }
  end

  defp map_image_hit(hit) do
    download_url =
      Map.get(hit, "largeImageURL") ||
        Map.get(hit, "webformatURL") ||
        Map.get(hit, "previewURL", "")

    %{
      "id" => "pixabay-image-#{hit["id"]}",
      "provider" => "pixabay",
      "mediaType" => "image",
      "previewUrl" => Map.get(hit, "previewURL", ""),
      "downloadUrl" => download_url,
      "width" => Map.get(hit, "imageWidth") || Map.get(hit, "webformatWidth", 0),
      "height" => Map.get(hit, "imageHeight") || Map.get(hit, "webformatHeight", 0),
      "duration" => nil,
      "attribution" => "Pixabay / #{Map.get(hit, "user", "Unknown")}",
      "license" => "Pixabay License",
      "providerAssetId" => to_string(hit["id"])
    }
  end

  defp pick_best_variant(videos) when is_map(videos) do
    ["large", "medium", "small", "tiny"]
    |> Enum.find_value(fn k ->
      case Map.get(videos, k) do
        v when is_map(v) and map_size(v) > 0 -> v
        _ -> nil
      end
    end)
    |> case do
      nil -> %{}
      v -> v
    end
  end
end
