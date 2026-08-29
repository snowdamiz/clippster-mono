defmodule ClippsterServer.UserBranding do
  @moduledoc """
  Personal creator profiles and branding assets for cross-device sync.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Storage
  alias ClippsterServer.Accounts.{UserAsset, UserCreatorProfile}

  # ---------------------------------------------------------------------------
  # Assets
  # ---------------------------------------------------------------------------

  def list_user_assets(user_id, opts \\ []) do
    asset_type = Keyword.get(opts, :asset_type)

    UserAsset
    |> where([a], a.user_id == ^user_id)
    |> maybe_filter_asset_type(asset_type)
    |> order_by([a], asc: a.asset_type, asc: a.name)
    |> Repo.all()
  end

  defp maybe_filter_asset_type(query, nil), do: query

  defp maybe_filter_asset_type(query, asset_type) when is_binary(asset_type) do
    where(query, [a], a.asset_type == ^asset_type)
  end

  def get_user_asset(user_id, asset_id) do
    case parse_id(asset_id) do
      nil -> nil
      id -> Repo.get_by(UserAsset, id: id, user_id: user_id)
    end
  end

  def create_user_asset(user_id, asset_type, file_binary, filename, opts \\ []) do
    content_type = Keyword.get(opts, :content_type, "application/octet-stream")
    thumbnail_binary = Keyword.get(opts, :thumbnail_binary)
    duration = Keyword.get(opts, :duration)
    width = Keyword.get(opts, :width)
    height = Keyword.get(opts, :height)
    file_size = byte_size(file_binary)
    content_hash = :crypto.hash(:sha256, file_binary) |> Base.encode16(case: :lower)

    case get_asset_by_hash(user_id, asset_type, content_hash) do
      %UserAsset{} = existing ->
        {:ok, existing}

      nil ->
        key = Storage.generate_user_asset_key(user_id, asset_type, filename)

        with {:ok, url} <- Storage.upload_file(file_binary, key, content_type: content_type),
             {:ok, thumbnail_url} <-
               maybe_upload_user_thumbnail(user_id, asset_type, filename, thumbnail_binary) do
          %UserAsset{}
          |> UserAsset.create_changeset(%{
            user_id: user_id,
            asset_type: asset_type,
            name: filename,
            url: url,
            thumbnail_url: thumbnail_url,
            duration: duration,
            width: width,
            height: height,
            file_size: file_size,
            mime_type: content_type,
            content_hash: content_hash
          })
          |> Repo.insert()
        end
    end
  end

  defp get_asset_by_hash(user_id, asset_type, content_hash) do
    UserAsset
    |> where([a], a.user_id == ^user_id)
    |> where([a], a.asset_type == ^asset_type)
    |> where([a], a.content_hash == ^content_hash)
    |> Repo.one()
  end

  defp maybe_upload_user_thumbnail(_user_id, _asset_type, _filename, nil), do: {:ok, nil}

  defp maybe_upload_user_thumbnail(user_id, asset_type, filename, thumbnail_binary) do
    key = Storage.generate_user_asset_thumbnail_key(user_id, asset_type, filename)

    case Storage.upload_file(thumbnail_binary, key, content_type: "image/jpeg") do
      {:ok, url} -> {:ok, url}
      {:error, _} -> {:ok, nil}
    end
  end

  def update_user_asset(%UserAsset{} = asset, attrs) do
    asset
    |> UserAsset.update_changeset(attrs)
    |> Repo.update()
  end

  def delete_user_asset(%UserAsset{} = asset) do
    Repo.transaction(fn ->
      Storage.delete_file_by_url(asset.url)
      if asset.thumbnail_url, do: Storage.delete_file_by_url(asset.thumbnail_url)

      case Repo.delete(asset) do
        {:ok, deleted} -> deleted
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  # ---------------------------------------------------------------------------
  # Profiles
  # ---------------------------------------------------------------------------

  def list_user_creator_profiles(user_id) do
    UserCreatorProfile
    |> where([p], p.user_id == ^user_id)
    |> preload([:intro, :outro, :watermark])
    |> order_by([p], asc: p.name)
    |> Repo.all()
  end

  def get_user_creator_profile(user_id, profile_id) do
    case parse_id(profile_id) do
      nil ->
        nil

      id ->
        UserCreatorProfile
        |> where([p], p.user_id == ^user_id and p.id == ^id)
        |> preload([:intro, :outro, :watermark])
        |> Repo.one()
    end
  end

  def get_user_creator_profile_by_client_id(user_id, client_id)
      when is_binary(client_id) and client_id != "" do
    UserCreatorProfile
    |> where([p], p.user_id == ^user_id and p.client_id == ^client_id)
    |> preload([:intro, :outro, :watermark])
    |> Repo.one()
  end

  def get_user_creator_profile_by_client_id(_user_id, _), do: nil

  def create_user_creator_profile(user_id, attrs) do
    attrs =
      attrs
      |> stringify_keys()
      |> Map.put("user_id", user_id)
      |> normalize_asset_refs(user_id)

    case Map.get(attrs, "client_id") do
      client_id when is_binary(client_id) and client_id != "" ->
        case get_user_creator_profile_by_client_id(user_id, client_id) do
          %UserCreatorProfile{} = existing ->
            update_user_creator_profile(existing, attrs)

          nil ->
            do_insert_profile(attrs)
        end

      _ ->
        do_insert_profile(attrs)
    end
  end

  defp do_insert_profile(attrs) do
    %UserCreatorProfile{}
    |> UserCreatorProfile.create_changeset(attrs)
    |> Repo.insert()
    |> maybe_preload_profile()
  end

  def update_user_creator_profile(%UserCreatorProfile{} = profile, attrs) do
    attrs =
      attrs
      |> stringify_keys()
      |> normalize_asset_refs(profile.user_id)

    profile
    |> UserCreatorProfile.update_changeset(attrs)
    |> Repo.update()
    |> maybe_preload_profile()
  end

  def delete_user_creator_profile(%UserCreatorProfile{} = profile) do
    Repo.delete(profile)
  end

  def branding_bundle(user_id) do
    %{
      assets: list_user_assets(user_id),
      profiles: list_user_creator_profiles(user_id)
    }
  end

  defp maybe_preload_profile({:ok, profile}) do
    {:ok, Repo.preload(profile, [:intro, :outro, :watermark])}
  end

  defp maybe_preload_profile(other), do: other

  defp stringify_keys(attrs) when is_map(attrs) do
    Enum.into(attrs, %{}, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end

  defp normalize_asset_refs(attrs, user_id) do
    Enum.reduce(["intro_id", "outro_id", "watermark_id"], attrs, fn key, acc ->
      case Map.get(acc, key) do
        nil ->
          acc

        "" ->
          Map.put(acc, key, nil)

        id ->
          parsed = parse_id(id)

          case parsed && get_user_asset(user_id, parsed) do
            %UserAsset{} -> Map.put(acc, key, parsed)
            _ -> Map.put(acc, key, nil)
          end
      end
    end)
  end

  defp parse_id(id) when is_integer(id), do: id

  defp parse_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {n, _} -> n
      :error -> nil
    end
  end

  defp parse_id(_), do: nil
end
