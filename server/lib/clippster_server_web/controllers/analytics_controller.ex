defmodule ClippsterServerWeb.AnalyticsController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Analytics

  @public_metadata_keys [
    "button_label",
    "detected_arch",
    "detected_os",
    "device_pixel_ratio",
    "download_file_name",
    "download_label",
    "download_platform",
    "download_url_host",
    "language",
    "page_title",
    "page_type",
    "path",
    "preferred_download_platform",
    "ref",
    "referrer",
    "referrer_host",
    "release_tag",
    "release_version",
    "screen_height",
    "screen_width",
    "session_id",
    "source",
    "surface",
    "timezone",
    "url",
    "utm_campaign",
    "utm_content",
    "utm_medium",
    "utm_source",
    "utm_term",
    "visitor_id",
    "viewport_height",
    "viewport_width"
  ]

  @max_metadata_string_length 500

  @doc """
  Track an analytics event from the client.
  """
  def track(conn, %{"event_type" => event_type} = params) do
    user_id = conn.assigns[:current_user_id]
    metadata = Map.get(params, "metadata", %{})

    case Analytics.track_event(event_type, user_id, metadata) do
      {:ok, _event} ->
        json(conn, %{success: true, message: "Event tracked"})

      {:error, changeset} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "Failed to track event",
          details: format_changeset_errors(changeset)
        })
    end
  end

  def track(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameter: event_type"})
  end

  @doc """
  Track a public landing-page analytics event.
  """
  def track_public(conn, %{"event_type" => event_type} = params) when is_binary(event_type) do
    event_type = String.slice(event_type, 0, 80)

    if Analytics.landing_event_type?(event_type) do
      metadata =
        params
        |> Map.get("metadata", %{})
        |> sanitize_public_metadata()
        |> Map.merge(request_metadata(conn))

      case Analytics.track_event(event_type, nil, metadata) do
        {:ok, _event} ->
          json(conn, %{success: true, message: "Event tracked"})

        {:error, changeset} ->
          conn
          |> put_status(400)
          |> json(%{
            success: false,
            error: "Failed to track event",
            details: format_changeset_errors(changeset)
          })
      end
    else
      conn
      |> put_status(400)
      |> json(%{success: false, error: "Unsupported public analytics event"})
    end
  end

  def track_public(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameter: event_type"})
  end

  @doc """
  Get analytics statistics (admin only).
  """
  def stats(conn, _params) do
    stats = Analytics.get_event_counts_by_date_range()
    landing = Analytics.get_landing_dashboard_stats()

    json(conn, %{
      success: true,
      stats: stats,
      landing: landing
    })
  end

  defp sanitize_public_metadata(metadata) when is_map(metadata) do
    Enum.reduce(@public_metadata_keys, %{}, fn key, acc ->
      case Map.fetch(metadata, key) do
        {:ok, value} ->
          put_sanitized_metadata(acc, key, value)

        :error ->
          acc
      end
    end)
  end

  defp sanitize_public_metadata(_metadata), do: %{}

  defp put_sanitized_metadata(acc, _key, nil), do: acc

  defp put_sanitized_metadata(acc, key, value) when is_binary(value) do
    Map.put(acc, key, String.slice(value, 0, @max_metadata_string_length))
  end

  defp put_sanitized_metadata(acc, key, value)
       when is_integer(value) or is_float(value) or is_boolean(value) do
    Map.put(acc, key, value)
  end

  defp put_sanitized_metadata(acc, key, value) do
    Map.put(acc, key, value |> inspect(limit: 20) |> String.slice(0, @max_metadata_string_length))
  end

  defp request_metadata(conn) do
    user_agent = first_req_header(conn, "user-agent")

    %{
      "browser" => browser_from_user_agent(user_agent),
      "device_type" => device_type_from_user_agent(user_agent),
      "ip_hash" => ip_hash(conn.remote_ip),
      "request_host" => conn.host
    }
  end

  defp first_req_header(conn, header) do
    conn
    |> get_req_header(header)
    |> List.first()
    |> to_string()
  end

  defp browser_from_user_agent(user_agent) do
    cond do
      user_agent == "" -> "Unknown"
      String.contains?(user_agent, "Edg/") -> "Edge"
      String.contains?(user_agent, "Chrome/") -> "Chrome"
      String.contains?(user_agent, "Firefox/") -> "Firefox"
      String.contains?(user_agent, "Safari/") -> "Safari"
      true -> "Other"
    end
  end

  defp device_type_from_user_agent(user_agent) do
    user_agent = String.downcase(user_agent)

    cond do
      user_agent == "" -> "Unknown"
      String.contains?(user_agent, "mobile") -> "Mobile"
      String.contains?(user_agent, "tablet") or String.contains?(user_agent, "ipad") -> "Tablet"
      true -> "Desktop"
    end
  end

  defp ip_hash(nil), do: nil

  defp ip_hash(remote_ip) do
    salt =
      :clippster_server
      |> Application.get_env(ClippsterServerWeb.Endpoint, [])
      |> Keyword.get(:secret_key_base, "analytics")

    digest =
      :crypto.hash(:sha256, "#{salt}:#{remote_ip_to_string(remote_ip)}")
      |> Base.encode16(case: :lower)

    String.slice(digest, 0, 24)
  end

  defp remote_ip_to_string(remote_ip) do
    remote_ip
    |> :inet.ntoa()
    |> to_string()
  rescue
    _ -> to_string(remote_ip)
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
