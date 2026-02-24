defmodule ClippsterServerWeb.FreesoundController do
  use ClippsterServerWeb, :controller
  require Logger

  @freesound_base_url "https://freesound.org/apiv2"

  @fields [
    "id",
    "name",
    "description",
    "url",
    "previews",
    "download",
    "duration",
    "filesize",
    "type",
    "channels",
    "bitrate",
    "bitdepth",
    "samplerate",
    "username",
    "tags",
    "license",
    "created",
    "num_downloads",
    "avg_rating",
    "num_ratings"
  ]

  defp get_api_key do
    config = Application.get_env(:clippster_server, :freesound, [])
    config[:api_key]
  end

  def search(conn, params) do
    api_key = get_api_key()

    if is_nil(api_key) or api_key == "" do
      conn
      |> put_status(:service_unavailable)
      |> json(%{error: "Freesound API is not configured"})
    else
      query = params["query"] || ""
      page = params["page"] || "1"
      page_size = params["page_size"] || "15"
      sort = params["sort"] || "score"
      filter = params["filter"]

      url_params = %{
        "query" => query,
        "token" => api_key,
        "page" => page,
        "page_size" => page_size,
        "sort" => sort,
        "fields" => Enum.join(@fields, ",")
      }

      url_params =
        if filter && filter != "" do
          Map.put(url_params, "filter", filter)
        else
          url_params
        end

      query_string = URI.encode_query(url_params)
      url = "#{@freesound_base_url}/search/text/?#{query_string}"

      # Disable SSL verification temporarily to get past certificate validation issues
      # TODO: Fix this properly with correct CA certificates
      case Req.get(url, connect_options: [transport_opts: [verify: :verify_none]]) do
        {:ok, %Req.Response{status: 200, body: body}} ->
          json(conn, body)

        {:ok, %Req.Response{status: status, body: body}} ->
          Logger.error("Freesound API returned #{status}: #{inspect(body)}")

          conn
          |> put_status(:bad_gateway)
          |> json(%{error: "Freesound API returned #{status}"})

        {:error, exception} ->
          Logger.error("Freesound API request failed: #{inspect(exception)}")

          conn
          |> put_status(:internal_server_error)
          |> json(%{error: "Freesound API request failed"})
      end
    end
  end
end
