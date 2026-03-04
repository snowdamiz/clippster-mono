defmodule ClippsterServerWeb.SettingsController do
  @moduledoc """
  Controller for public settings endpoints.
  """
  use ClippsterServerWeb, :controller
  alias ClippsterServer.AppSettings
  alias ClippsterServer.Organizations
  alias ClippsterServer.Storage

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
  Resolves org-asset-{id} references into presigned download URLs so any user can access them.
  """
  def get_free_tier_branding(conn, _params) do
    raw = AppSettings.get_setting("free_tier_branding")

    branding =
      case raw do
        nil ->
          nil

        value when is_binary(value) ->
          case Jason.decode(value) do
            {:ok, decoded} -> decoded
            _ -> nil
          end

        value ->
          value
      end

    # Resolve asset IDs into presigned URLs so free tier users can download them
    resolved = resolve_branding_urls(branding)

    json(conn, %{
      success: true,
      branding: resolved
    })
  end

  # Resolves org-asset-{id} references in branding config into presigned download URLs.
  defp resolve_branding_urls(nil), do: nil

  defp resolve_branding_urls(branding) when is_map(branding) do
    branding
    |> resolve_watermark_url()
    |> resolve_ratio_asset_urls("intro_settings")
    |> resolve_ratio_asset_urls("outro_settings")
  end

  defp resolve_branding_urls(branding), do: branding

  # Resolve watermark_id -> watermark_url
  defp resolve_watermark_url(branding) do
    case resolve_asset_url(branding["watermark_id"]) do
      nil -> branding
      url -> Map.put(branding, "watermark_url", url)
    end
  end

  # Resolve per-ratio settings like intro_settings/outro_settings
  # Each ratio entry has { "assetId": "org-asset-{id}" } -> add "url" key
  defp resolve_ratio_asset_urls(branding, settings_key) do
    case branding[settings_key] do
      nil ->
        branding

      settings when is_map(settings) ->
        resolved_settings =
          Enum.map(settings, fn
            {ratio, %{"assetId" => asset_id} = entry} ->
              case resolve_asset_url(asset_id) do
                nil -> {ratio, entry}
                url -> {ratio, Map.put(entry, "url", url)}
              end

            {ratio, entry} ->
              {ratio, entry}
          end)
          |> Enum.into(%{})

        Map.put(branding, settings_key, resolved_settings)

      _ ->
        branding
    end
  end

  # Parse "org-asset-{id}" and generate a presigned URL for the asset
  defp resolve_asset_url(nil), do: nil

  defp resolve_asset_url("org-asset-" <> id_str) do
    case Integer.parse(id_str) do
      {id, ""} ->
        case Organizations.get_organization_asset(id) do
          nil -> nil
          asset -> Storage.presigned_url!(asset.url)
        end

      _ ->
        nil
    end
  end

  defp resolve_asset_url(_), do: nil
end
