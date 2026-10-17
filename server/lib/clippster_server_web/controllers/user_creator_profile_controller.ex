defmodule ClippsterServerWeb.UserCreatorProfileController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.UserBranding
  alias ClippsterServer.Storage

  plug ClippsterServerWeb.AuthPlug

  def index(conn, _params) do
    user = conn.assigns.current_user
    profiles = UserBranding.list_user_creator_profiles(user.id)

    json(conn, %{
      success: true,
      profiles: Enum.map(profiles, &serialize_profile/1)
    })
  end

  def bundle(conn, _params) do
    user = conn.assigns.current_user
    %{assets: assets, profiles: profiles} = UserBranding.branding_bundle(user.id)

    json(conn, %{
      success: true,
      assets: Enum.map(assets, &serialize_asset/1),
      profiles: Enum.map(profiles, &serialize_profile/1)
    })
  end

  def show(conn, %{"id" => profile_id}) do
    user = conn.assigns.current_user

    case UserBranding.get_user_creator_profile(user.id, profile_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Profile not found"})

      profile ->
        json(conn, %{success: true, profile: serialize_profile(profile)})
    end
  end

  def create(conn, params) do
    user = conn.assigns.current_user

    case UserBranding.create_user_creator_profile(user.id, params) do
      {:ok, profile} ->
        conn
        |> put_status(201)
        |> json(%{success: true, profile: serialize_profile(profile)})

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{
          success: false,
          error: "Validation failed",
          details: changeset_errors(changeset)
        })
    end
  end

  def update(conn, %{"id" => profile_id} = params) do
    user = conn.assigns.current_user

    case UserBranding.get_user_creator_profile(user.id, profile_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Profile not found"})

      profile ->
        case UserBranding.update_user_creator_profile(profile, params) do
          {:ok, updated} ->
            json(conn, %{success: true, profile: serialize_profile(updated)})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{
              success: false,
              error: "Validation failed",
              details: changeset_errors(changeset)
            })
        end
    end
  end

  def delete(conn, %{"id" => profile_id}) do
    user = conn.assigns.current_user

    case UserBranding.get_user_creator_profile(user.id, profile_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Profile not found"})

      profile ->
        case UserBranding.delete_user_creator_profile(profile) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Delete failed: #{inspect(reason)}"})
        end
    end
  end

  defp serialize_asset(asset) do
    %{
      id: asset.id,
      user_id: asset.user_id,
      asset_type: asset.asset_type,
      name: asset.name,
      url: if(asset.url, do: Storage.presigned_url!(asset.url), else: nil),
      thumbnail_url:
        if(asset.thumbnail_url, do: Storage.presigned_url!(asset.thumbnail_url), else: nil),
      duration: asset.duration && Decimal.to_float(asset.duration),
      width: asset.width,
      height: asset.height,
      file_size: asset.file_size,
      mime_type: asset.mime_type,
      content_hash: asset.content_hash,
      inserted_at: asset.inserted_at,
      updated_at: asset.updated_at
    }
  end

  defp serialize_profile(profile) do
    %{
      id: profile.id,
      user_id: profile.user_id,
      client_id: profile.client_id,
      platform_links: profile.platform_links || [],
      name: profile.name,
      description: profile.description,
      profile_image_url:
        if(profile.profile_image_url,
          do: Storage.browser_accessible_url(profile.profile_image_url),
          else: nil
        ),
      intro_id: profile.intro_id,
      outro_id: profile.outro_id,
      watermark_id: profile.watermark_id,
      watermark_settings: profile.watermark_settings,
      intro_outro_settings: profile.intro_outro_settings,
      intro_ratio_settings: profile.intro_ratio_settings,
      outro_ratio_settings: profile.outro_ratio_settings,
      layout_overlays: resolve_overlay_assets(profile.layout_overlays || [], profile.user_id),
      scope: profile.scope,
      disabled: profile.disabled,
      auto_dvr_enabled: profile.auto_dvr_enabled,
      clip_build_defaults: resolve_reference_image(profile.clip_build_defaults, profile.user_id),
      inserted_at: profile.inserted_at,
      updated_at: profile.updated_at
    }
  end

  # Cloud profiles store owned asset IDs. Resolve fresh URLs when read so branding
  # remains usable across clients and does not depend on an expired signed URL.
  defp owned_asset_url(user_id, id) do
    case UserBranding.get_user_asset(user_id, id) do
      %{url: url} when is_binary(url) -> Storage.presigned_url!(url)
      _ -> nil
    end
  end

  defp resolve_overlay_assets(overlays, user_id) do
    Enum.map(overlays, fn overlay ->
      overlay = resolve_overlay_asset(overlay, user_id)

      case overlay["perRatioSettings"] do
        settings when is_map(settings) ->
          resolved = Map.new(settings, fn {ratio, config} -> {ratio, resolve_overlay_asset(config, user_id)} end)
          Map.put(overlay, "perRatioSettings", resolved)
        _ -> overlay
      end
    end)
  end

  defp resolve_overlay_asset(%{"assetId" => id} = overlay, user_id) when is_integer(id) do
    Map.put(overlay, "imagePath", owned_asset_url(user_id, id))
  end
  defp resolve_overlay_asset(overlay, _user_id), do: overlay

  defp resolve_reference_image(%{"referenceImageAssetId" => id} = defaults, user_id) when is_integer(id) do
    Map.put(defaults, "referenceImageUrl", owned_asset_url(user_id, id))
  end
  defp resolve_reference_image(defaults, _user_id), do: defaults

  defp changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
