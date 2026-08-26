defmodule ClippsterServer.CloudMedia do
  @moduledoc """
  Cloud media assets stored in R2 with quota enforcement.
  """

  import Ecto.Query
  alias ClippsterServer.{CloudMedia.CloudMediaAsset, Repo, Storage, StorageQuotas}

  def list_for_project(cloud_project_id) do
    CloudMediaAsset
    |> where([a], a.cloud_project_id == ^cloud_project_id and a.upload_status == "completed")
    |> Repo.all()
  end

  def get_asset!(user_id, project_id, asset_id) do
    Repo.get_by!(CloudMediaAsset,
      id: asset_id,
      cloud_project_id: project_id,
      user_id: user_id
    )
  end

  def get_asset(user_id, project_id, asset_id) do
    Repo.get_by(CloudMediaAsset,
      id: asset_id,
      cloud_project_id: project_id,
      user_id: user_id
    )
  end

  def create_presigned_upload(user_id, project_id, attrs) do
    asset_type = Map.get(attrs, "asset_type") || Map.get(attrs, :asset_type)
    filename = Map.get(attrs, "filename") || Map.get(attrs, :filename) || "upload.bin"
    size_estimate = Map.get(attrs, "size_bytes") || Map.get(attrs, :size_bytes) || 0
    content_type = Map.get(attrs, "content_type") || Map.get(attrs, :content_type) || "application/octet-stream"

    with {:ok, _} <- StorageQuotas.get_or_create_quota(user_id),
         :ok <- ensure_quota_available(user_id, size_estimate),
         {:ok, asset} <- insert_pending_asset(user_id, project_id, asset_type, filename, size_estimate),
         key <- Storage.generate_cloud_media_key(user_id, project_id, asset.id, filename),
         {:ok, %{upload_url: upload_url, media_url: media_url}} <-
           Storage.generate_presigned_upload_url(key, content_type: content_type) do
      asset
      |> Ecto.Changeset.change(r2_key: key)
      |> Repo.update()

      StorageQuotas.reserve_bytes(user_id, size_estimate)

      {:ok,
       %{
         asset_id: asset.id,
         upload_url: upload_url,
         media_url: media_url,
         r2_key: key,
         reserved_bytes: size_estimate
       }}
    else
      {:error, :quota_exceeded} -> {:error, :quota_exceeded}
      {:error, reason} -> {:error, reason}
    end
  end

  defp ensure_quota_available(user_id, size_bytes) do
    if StorageQuotas.can_reserve?(user_id, size_bytes) do
      :ok
    else
      {:error, :quota_exceeded}
    end
  end

  def complete_upload(user_id, project_id, asset_id, attrs) do
    checksum = Map.get(attrs, "checksum") || Map.get(attrs, :checksum)
    actual_size = Map.get(attrs, "size_bytes") || Map.get(attrs, :size_bytes)

    with %CloudMediaAsset{} = asset <- get_asset(user_id, project_id, asset_id),
         reserved <- asset.reserved_bytes || asset.size_bytes || 0,
         actual when is_integer(actual) <- actual_size,
         {:ok, _} <- StorageQuotas.adjust_reserved_to_actual(user_id, reserved, actual) do
      asset
      |> CloudMediaAsset.complete_changeset(%{
        size_bytes: actual,
        checksum: checksum,
        upload_status: "completed",
        reserved_bytes: 0
      })
      |> Repo.update()
    else
      nil -> {:error, :not_found}
      _ -> {:error, :invalid_size}
    end
  end

  def presigned_download(user_id, project_id, asset_id) do
    case get_asset(user_id, project_id, asset_id) do
      %CloudMediaAsset{upload_status: "completed", r2_key: key} ->
        Storage.presigned_url(key, expires_in: 3600)

      %CloudMediaAsset{} ->
        {:error, :not_ready}

      nil ->
        {:error, :not_found}
    end
  end

  def delete_asset(user_id, project_id, asset_id) do
    case get_asset(user_id, project_id, asset_id) do
      %CloudMediaAsset{} = asset ->
        Repo.transaction(fn ->
          if asset.r2_key do
            Storage.delete_file(asset.r2_key)
          end

          if asset.size_bytes > 0 do
            StorageQuotas.release_bytes(user_id, asset.size_bytes)
          end

          Repo.delete!(asset)
        end)

      nil ->
        {:error, :not_found}
    end
  end

  def media_manifest(cloud_project_id) do
    list_for_project(cloud_project_id)
    |> Enum.map(fn asset ->
      %{
        id: asset.id,
        asset_type: asset.asset_type,
        filename: asset.filename,
        size_bytes: asset.size_bytes,
        checksum: asset.checksum,
        optional: asset.optional
      }
    end)
  end

  defp insert_pending_asset(user_id, project_id, asset_type, filename, size_estimate) do
    %CloudMediaAsset{}
    |> CloudMediaAsset.create_changeset(%{
      cloud_project_id: project_id,
      user_id: user_id,
      asset_type: asset_type,
      r2_key: "pending",
      filename: filename,
      size_bytes: 0,
      reserved_bytes: size_estimate,
      upload_status: "pending",
      optional: asset_type == "raw_vod"
    })
    |> Repo.insert()
  end
end
