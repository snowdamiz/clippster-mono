defmodule ClippsterServerWeb.SettingsController do
  @moduledoc """
  Controller for public settings endpoints.
  """
  use ClippsterServerWeb, :controller
  alias ClippsterServer.AppSettings

  @doc """
  Get all feature flags.
  This endpoint is public (no authentication required) so clients can
  check feature availability before attempting to use features.
  """
  def get_feature_flags(conn, _params) do
    feature_flags = AppSettings.get_feature_flags()

    json(conn, %{
      success: true,
      feature_flags: feature_flags
    })
  end
end

