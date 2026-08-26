defmodule ClippsterServer.Tokend.Webhooks do
  @moduledoc """
  Verify and ingest Tokend partner webhooks.

  Signature format from Tokend partner contract:
  `HMAC-SHA256(secret, "{timestamp}." <> raw_body)` as lowercase hex in
  `X-Tokend-Signature`, with unix seconds in `X-Tokend-Timestamp`.
  """

  require Logger

  alias ClippsterServer.Repo
  alias ClippsterServer.Tokend.{Client, WebhookDelivery}

  @max_skew_seconds 300

  @spec verify_and_parse(Plug.Conn.t()) :: {:ok, map()} | {:error, atom()}
  def verify_and_parse(conn) do
    raw_body = conn.assigns[:raw_body]
    timestamp = header(conn, "x-tokend-timestamp")
    signature = header(conn, "x-tokend-signature")
    delivery_id = header(conn, "x-tokend-delivery-id")
    secret = Client.config()[:webhook_signing_secret]

    cond do
      not is_binary(raw_body) or raw_body == "" ->
        {:error, :missing_raw_body}

      not present?(secret) ->
        {:error, :webhook_secret_not_configured}

      not present?(timestamp) or not present?(signature) ->
        {:error, :missing_signature_headers}

      not timestamp_fresh?(timestamp) ->
        {:error, :timestamp_skew}

      not valid_signature?(secret, timestamp, raw_body, signature) ->
        {:error, :invalid_signature}

      true ->
        case Jason.decode(raw_body) do
          {:ok, payload} when is_map(payload) ->
            {:ok,
             %{
               delivery_id: delivery_id || payload["id"],
               event_type: payload["type"],
               payload: payload,
               data: payload["data"] || %{}
             }}

          _ ->
            {:error, :invalid_json}
        end
    end
  end

  @spec ingest(map()) :: {:ok, :processed | :duplicate} | {:error, term()}
  def ingest(%{delivery_id: delivery_id, event_type: event_type, payload: payload, data: data})
      when is_binary(delivery_id) and delivery_id != "" and is_binary(event_type) do
    event_key = event_key(event_type, data)
    attrs = %{
      delivery_id: delivery_id,
      event_type: event_type,
      event_key: event_key,
      payload: payload,
      processed_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }

    case %WebhookDelivery{} |> WebhookDelivery.changeset(attrs) |> Repo.insert() do
      {:ok, _delivery} ->
        handle_event(event_type, data)
        {:ok, :processed}

      {:error, %Ecto.Changeset{errors: errors}} ->
        if Keyword.has_key?(errors, :delivery_id) do
          {:ok, :duplicate}
        else
          {:error, errors}
        end
    end
  end

  def ingest(_), do: {:error, :invalid_event}

  defp handle_event(type, data) when type in ["stream.ended", "stream.recording_ready"] do
    Logger.info(
      "[Tokend.Webhooks] #{type} stream_id=#{inspect(data["stream_id"])} creator=#{inspect(data["creator_slug"])}"
    )

    broadcast_live_refresh(data["creator_slug"])
    :ok
  end

  defp handle_event(type, data) when type in ["circle.ended", "circle.recording_ready"] do
    Logger.info(
      "[Tokend.Webhooks] #{type} circle_id=#{inspect(data["circle_id"])} creator=#{inspect(data["creator_slug"])}"
    )

    :ok
  end

  defp handle_event(type, _data) do
    Logger.info("[Tokend.Webhooks] ignored event type=#{inspect(type)}")
    :ok
  end

  defp broadcast_live_refresh(slug) when is_binary(slug) and slug != "" do
    Phoenix.PubSub.broadcast(
      ClippsterServer.PubSub,
      "tokend:live:#{String.downcase(slug)}",
      {:tokend_live_refresh, slug}
    )
  end

  defp broadcast_live_refresh(_), do: :ok

  defp event_key("stream.ended", %{"stream_id" => id}), do: "stream:#{id}:ended"
  defp event_key("stream.recording_ready", %{"stream_id" => id}), do: "stream:#{id}:recording_ready"
  defp event_key("circle.ended", %{"circle_id" => id}), do: "circle:#{id}:ended"
  defp event_key("circle.recording_ready", %{"circle_id" => id}), do: "circle:#{id}:recording_ready"
  defp event_key(_, _), do: nil

  defp valid_signature?(secret, timestamp, raw_body, signature) do
    expected =
      :crypto.mac(:hmac, :sha256, secret, "#{timestamp}.#{raw_body}")
      |> Base.encode16(case: :lower)

    Plug.Crypto.secure_compare(expected, String.downcase(signature))
  end

  defp timestamp_fresh?(timestamp) do
    case Integer.parse(to_string(timestamp)) do
      {unix, ""} ->
        now = System.system_time(:second)
        abs(now - unix) <= @max_skew_seconds

      _ ->
        false
    end
  end

  defp header(conn, name) do
    case Plug.Conn.get_req_header(conn, name) do
      [value | _] -> value
      _ -> nil
    end
  end

  defp present?(value) when is_binary(value), do: String.trim(value) != ""
  defp present?(_), do: false
end
