defmodule ClippsterServerWeb.AnalyticsController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Analytics

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
  Get analytics statistics (admin only).
  """
  def stats(conn, _params) do
    stats = Analytics.get_event_counts_by_date_range()

    json(conn, %{
      success: true,
      stats: stats
    })
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
