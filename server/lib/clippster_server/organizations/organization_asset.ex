defmodule ClippsterServer.Organizations.OrganizationAsset do
  @moduledoc """
  Schema for organization-level assets (intros, outros, watermarks, audio, images).
  These assets are stored in Cloudflare R2 and synced to org members' local storage.
  """
  use Ecto.Schema
  import Ecto.Changeset

  schema "organization_assets" do
    field :asset_type, :string  # 'intro', 'outro', 'watermark', 'audio', 'image'
    field :name, :string
    field :url, :string
    field :thumbnail_url, :string
    field :duration, :decimal
    field :width, :integer
    field :height, :integer
    field :file_size, :integer
    field :mime_type, :string

    belongs_to :organization, ClippsterServer.Organizations.Organization
    belongs_to :uploaded_by, ClippsterServer.Accounts.User, foreign_key: :uploaded_by_user_id

    timestamps(type: :utc_datetime)
  end

  @asset_types ~w(intro outro watermark audio image)

  @doc """
  Changeset for creating a new organization asset.
  """
  def create_changeset(asset, attrs) do
    asset
    |> cast(attrs, [
      :organization_id,
      :asset_type,
      :name,
      :url,
      :thumbnail_url,
      :duration,
      :width,
      :height,
      :file_size,
      :mime_type,
      :uploaded_by_user_id
    ])
    |> validate_required([:organization_id, :asset_type, :name, :url])
    |> validate_inclusion(:asset_type, @asset_types)
    |> validate_length(:name, min: 1, max: 255)
    |> validate_number(:duration, greater_than_or_equal_to: 0)
    |> validate_number(:width, greater_than: 0)
    |> validate_number(:height, greater_than: 0)
    |> validate_number(:file_size, greater_than: 0)
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:uploaded_by_user_id)
  end

  @doc """
  Changeset for updating an organization asset (name only).
  """
  def update_changeset(asset, attrs) do
    asset
    |> cast(attrs, [:name])
    |> validate_length(:name, min: 1, max: 255)
  end

  @doc """
  Returns the list of valid asset types.
  """
  def asset_types, do: @asset_types

  @doc """
  Checks if the given asset type is valid.
  """
  def valid_asset_type?(type) when is_binary(type), do: type in @asset_types
  def valid_asset_type?(_), do: false
end

