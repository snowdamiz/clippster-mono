defmodule ClippsterServer.Accounts.UserAsset do
  @moduledoc """
  Personal branding assets (intros, outros, watermarks, overlays) owned by a user.
  Mirrors organization_assets but scoped to the user for cross-device sync.
  """
  use Ecto.Schema
  import Ecto.Changeset

  schema "user_assets" do
    field :asset_type, :string
    field :name, :string
    field :url, :string
    field :thumbnail_url, :string
    field :duration, :decimal
    field :width, :integer
    field :height, :integer
    field :file_size, :integer
    field :mime_type, :string
    field :content_hash, :string

    belongs_to :user, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  @asset_types ~w(intro outro watermark audio image overlay)

  def create_changeset(asset, attrs) do
    asset
    |> cast(attrs, [
      :user_id,
      :asset_type,
      :name,
      :url,
      :thumbnail_url,
      :duration,
      :width,
      :height,
      :file_size,
      :mime_type,
      :content_hash
    ])
    |> validate_required([:user_id, :asset_type, :name, :url])
    |> validate_inclusion(:asset_type, @asset_types)
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:content_hash, max: 64)
    |> foreign_key_constraint(:user_id)
  end

  def update_changeset(asset, attrs) do
    asset
    |> cast(attrs, [:name])
    |> validate_length(:name, min: 1, max: 255)
  end

  def asset_types, do: @asset_types

  def valid_asset_type?(type) when is_binary(type), do: type in @asset_types
  def valid_asset_type?(_), do: false
end
