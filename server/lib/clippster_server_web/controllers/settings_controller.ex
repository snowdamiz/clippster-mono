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

  @doc """
  Get free tier branding configuration (watermark, intro, outro).
  Public endpoint - clients check this to apply admin-configured branding to free tier outputs.
  """
  def get_free_tier_branding(conn, _params) do
    raw = AppSettings.get_setting("free_tier_branding")

    branding =
      case raw do
        nil -> nil
        value when is_binary(value) ->
          case Jason.decode(value) do
            {:ok, decoded} -> decoded
            _ -> nil
          end
        value -> value
      end

    json(conn, %{
      success: true,
      branding: branding
    })
  end
end

