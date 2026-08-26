defmodule ClippsterServer.StorageQuotas do
  @moduledoc """
  User cloud storage quota tracking and tier limits.
  """


  alias ClippsterServer.Repo
  alias ClippsterServer.StorageQuotas.UserStorageQuota

  @default_tier "cloud_none"

  def get_or_create_quota(user_id) do
    case Repo.get_by(UserStorageQuota, user_id: user_id) do
      nil ->
        limit = tier_byte_limit(@default_tier)

        %UserStorageQuota{}
        |> UserStorageQuota.changeset(%{
          user_id: user_id,
          tier: @default_tier,
          bytes_used: 0,
          bytes_limit: limit
        })
        |> Repo.insert()

      quota ->
        {:ok, quota}
    end
  end

  def get_quota(user_id) do
    case get_or_create_quota(user_id) do
      {:ok, quota} -> quota
      {:error, _} = err -> err
    end
  end

  def quota_summary(user_id) do
    case get_or_create_quota(user_id) do
      {:ok, quota} ->
        %{
          bytes_used: quota.bytes_used,
          bytes_limit: quota.bytes_limit,
          tier: quota.tier
        }

      {:error, reason} ->
        {:error, reason}
    end
  end

  def can_reserve?(user_id, size_bytes) when is_integer(size_bytes) and size_bytes >= 0 do
    case get_or_create_quota(user_id) do
      {:ok, quota} ->
        quota.bytes_used + size_bytes <= quota.bytes_limit

      {:error, _} ->
        false
    end
  end

  def reserve_bytes(user_id, size_bytes) do
    Repo.transaction(fn ->
      quota = Repo.get_by!(UserStorageQuota, user_id: user_id) || create_quota!(user_id)

      if quota.bytes_used + size_bytes > quota.bytes_limit do
        Repo.rollback(:quota_exceeded)
      else
        quota
        |> Ecto.Changeset.change(bytes_used: quota.bytes_used + size_bytes)
        |> Repo.update!()
      end
    end)
  end

  def release_bytes(user_id, size_bytes) when size_bytes > 0 do
    Repo.transaction(fn ->
      quota = Repo.get_by!(UserStorageQuota, user_id: user_id)
      new_used = max(0, quota.bytes_used - size_bytes)

      quota
      |> Ecto.Changeset.change(bytes_used: new_used)
      |> Repo.update!()
    end)
  end

  def adjust_reserved_to_actual(user_id, reserved_bytes, actual_bytes) do
    delta = actual_bytes - reserved_bytes

    Repo.transaction(fn ->
      quota = Repo.get_by!(UserStorageQuota, user_id: user_id)
      new_used = max(0, quota.bytes_used + delta)

      if new_used > quota.bytes_limit do
        Repo.rollback(:quota_exceeded)
      else
        quota
        |> Ecto.Changeset.change(bytes_used: new_used)
        |> Repo.update!()
      end
    end)
  end

  def set_tier(user_id, tier) when tier in ["cloud_none", "cloud_50", "cloud_200"] do
    limit = tier_byte_limit(tier)

    case get_or_create_quota(user_id) do
      {:ok, quota} ->
        quota
        |> Ecto.Changeset.change(tier: tier, bytes_limit: limit)
        |> Repo.update()

      err ->
        err
    end
  end

  def admin_set_quota(user_id, attrs) do
    case get_or_create_quota(user_id) do
      {:ok, quota} ->
        quota
        |> UserStorageQuota.changeset(Map.put(attrs, :user_id, user_id))
        |> Repo.update()

      err ->
        err
    end
  end

  defp create_quota!(user_id) do
    {:ok, quota} = get_or_create_quota(user_id)
    quota
  end

  defp tier_byte_limit(tier) do
    UserStorageQuota.tier_limits()
    |> Map.get(tier, 0)
  end
end
