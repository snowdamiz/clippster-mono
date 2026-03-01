defmodule ClippsterServerWeb.TwitchController do
  use ClippsterServerWeb, :controller
  require Logger

  @twitch_client_id "kimne78kx3ncx6brgo4mv6wki5h1ko"

  # Get channel live status and metadata using Twitch's public GQL endpoint
  def get_channel(conn, %{"channel_name" => channel_name}) do
    do_get_channel_with_retry(conn, channel_name, 3)
  end

  defp do_get_channel_with_retry(conn, channel_name, retries_left) when retries_left > 0 do
    url = "https://gql.twitch.tv/gql"

    # GraphQL query to get user and stream info
    query = %{
      query: """
      query {
        user(login: "#{String.downcase(channel_name)}") {
          id
          login
          displayName
          profileImageURL(width: 300)
          description
          stream {
            id
            title
            viewersCount
            createdAt
            game {
              name
            }
          }
        }
      }
      """
    }

    headers = [
      {"Client-Id", @twitch_client_id},
      {"Content-Type", "application/json"}
    ]

    case Req.post(url, json: query, headers: headers, retry: false) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        # Extract user data from GraphQL response
        user = get_in(body, ["data", "user"])

        if user do
          stream = user["stream"]
          is_live = stream != nil

          response = %{
            isLive: is_live,
            channelId: user["id"],
            channelName: user["login"],
            displayName: user["displayName"],
            profileImageUrl: user["profileImageURL"],
            streamTitle: stream && stream["title"],
            viewerCount: stream && stream["viewersCount"],
            gameName: get_in(stream || %{}, ["game", "name"]),
            startedAt: stream && stream["createdAt"]
          }

          json(conn, response)
        else
          # User not found
          json(conn, %{
            isLive: false,
            channelName: channel_name,
            error: "Channel not found"
          })
        end

      {:ok, %Req.Response{status: status, body: _body}} when status >= 500 and retries_left > 1 ->
        Logger.warning(
          "Twitch GQL returned #{status} for channel #{channel_name}, retrying... (#{retries_left - 1} retries left)"
        )

        Process.sleep(500 * (4 - retries_left))
        do_get_channel_with_retry(conn, channel_name, retries_left - 1)

      {:ok, %Req.Response{status: status, body: body}} ->
        Logger.error(
          "Twitch GQL returned #{status} for channel #{channel_name}. Body: #{inspect(body)}"
        )

        conn
        |> put_status(:bad_gateway)
        |> json(%{isLive: false, error: "Twitch API returned #{status}"})

      {:error, exception} when retries_left > 1 ->
        Logger.warning(
          "Twitch GQL request failed for #{channel_name}, retrying... (#{retries_left - 1} retries left): #{inspect(exception)}"
        )

        Process.sleep(500 * (4 - retries_left))
        do_get_channel_with_retry(conn, channel_name, retries_left - 1)

      {:error, exception} ->
        Logger.error("Twitch GQL request failed after retries: #{inspect(exception)}")

        conn
        |> put_status(:internal_server_error)
        |> json(%{isLive: false, error: "Twitch API request failed"})
    end
  end

  defp do_get_channel_with_retry(conn, channel_name, 0) do
    Logger.error("Twitch GQL exhausted all retries for channel #{channel_name}")

    conn
    |> put_status(:internal_server_error)
    |> json(%{isLive: false, error: "Twitch API request failed after retries"})
  end
end
