defmodule ClippsterServerWeb.UserPreferencesController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Accounts

  @doc """
  Get current user's preferences.
  """
  def get_preferences(conn, _params) do
    user_id = conn.assigns.current_user_id

    case Accounts.get_user_preferences(user_id) do
      {:ok, preferences} ->
        json(conn, %{success: true, preferences: preferences})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User not found"})
    end
  end

  @doc """
  Update current user's preferences.
  Accepts partial updates - only provided fields are changed.
  """
  def update_preferences(conn, params) do
    user_id = conn.assigns.current_user_id

    # Filter to only allowed preference keys
    allowed_keys = ~w(
      time_format_preference
      toast_enabled toast_duration toast_position
      toast_sound_enabled toast_background_enabled
      notify_livestream notify_clips notify_downloads
      notify_projects notify_social notify_organization notify_system
      completed_tours tour_version_seen
    )

    attrs =
      params
      |> Map.take(allowed_keys)
      |> Enum.into(%{}, fn {k, v} -> {String.to_existing_atom(k), v} end)

    case Accounts.update_user_preferences(user_id, attrs) do
      {:ok, user} ->
        {:ok, preferences} = Accounts.get_user_preferences(user.id)
        json(conn, %{success: true, preferences: preferences})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User not found"})

      {:error, changeset} ->
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
            Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
              opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
            end)
          end)

        conn
        |> put_status(422)
        |> json(%{success: false, error: "Invalid preferences", details: errors})
    end
  end
end
