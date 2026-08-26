defmodule ClippsterServerWeb.MediaController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.MediaResolver

  def resolve_url(conn, params) do
    url = Map.get(params, "url")

    if is_nil(url) or String.trim(url) == "" do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{success: false, error: "url is required"})
    else
      quality = Map.get(params, "quality", "best")
      platform = Map.get(params, "platform")

      case MediaResolver.resolve_url(url, quality: quality, platform: platform) do
        {:ok, result} ->
          json(conn, Map.put(result, :success, true))

        {:error, :unsupported_platform} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: "Unsupported platform for this URL"})

        {:error, :invalid_json} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: "Could not parse media metadata"})

        {:error, :empty_response} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: "No media found at this URL"})

        {:error, :timeout} ->
          conn
          |> put_status(:gateway_timeout)
          |> json(%{success: false, error: "Media resolver timed out. Try again."})

        {:error, {:ytdlp_failed, message}} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: message})

        {:error, {:ytdlp_unavailable, message}} ->
          conn
          |> put_status(:service_unavailable)
          |> json(%{success: false, error: "Media resolver unavailable: #{message}"})

        {:error, reason} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: inspect(reason)})
      end
    end
  end

  def probe(conn, params) do
    url = Map.get(params, "url")

    if is_nil(url) or String.trim(url) == "" do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{success: false, error: "url is required"})
    else
      platform = Map.get(params, "platform")

      case MediaResolver.probe(url, platform: platform) do
        {:ok, result} ->
          json(conn, Map.put(result, :success, true))

        {:error, :unsupported_platform} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: "Unsupported platform for this URL"})

        {:error, reason} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: format_error(reason)})
      end
    end
  end

  def list_vods(conn, params) do
    platform = Map.get(params, "platform")
    channel = Map.get(params, "channel")

    cond do
      is_nil(platform) or platform == "" ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: "platform is required"})

      is_nil(channel) or channel == "" ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: "channel is required"})

      true ->
        limit = parse_int(Map.get(params, "limit"), 20) |> min(50)
        offset = parse_int(Map.get(params, "offset"), 0)

        case MediaResolver.list_vods(platform, channel, limit: limit, offset: offset) do
          {:ok, result} ->
            json(conn, Map.put(result, :success, true))

          {:error, :vod_list_not_supported} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{success: false, error: "VOD listing is not supported for this platform"})

          {:error, :unsupported_platform} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{success: false, error: "Unsupported platform"})

          {:error, reason} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{success: false, error: format_error(reason)})
        end
    end
  end

  defp parse_int(nil, default), do: default

  defp parse_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {num, _} -> num
      :error -> default
    end
  end

  defp parse_int(value, _default) when is_integer(value), do: value
  defp parse_int(_, default), do: default

  defp format_error({:ytdlp_failed, message}), do: message
  defp format_error(:timeout), do: "Media resolver timed out"
  defp format_error(reason), do: inspect(reason)
end
