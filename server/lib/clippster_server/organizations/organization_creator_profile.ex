defmodule ClippsterServer.Organizations.OrganizationCreatorProfile do
  @moduledoc """
  Schema for organization-level creator profiles.
  These profiles can be assigned to organization members for read-only use.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.{
    Organization,
    OrganizationAsset,
    OrganizationCreatorPlatformLink,
    OrganizationProfileAssignment
  }

  schema "organization_creator_profiles" do
    field :name, :string
    field :description, :string
    field :profile_image_url, :string
    field :watermark_settings, :map
    field :intro_outro_settings, :map
    field :intro_ratio_settings, :string
    field :outro_ratio_settings, :string
    field :layout_overlays, :map
    field :scope, :string, default: "streamer"
    field :disabled, :boolean, default: false

    belongs_to :organization, Organization
    belongs_to :created_by_user, ClippsterServer.Accounts.User, foreign_key: :created_by_user_id
    belongs_to :intro, OrganizationAsset, foreign_key: :intro_id
    belongs_to :outro, OrganizationAsset, foreign_key: :outro_id
    belongs_to :watermark, OrganizationAsset, foreign_key: :watermark_id

    has_many :platform_links, OrganizationCreatorPlatformLink,
      foreign_key: :organization_creator_profile_id,
      on_delete: :delete_all

    has_many :assignments, OrganizationProfileAssignment,
      foreign_key: :organization_creator_profile_id,
      on_delete: :delete_all

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new creator profile.
  """
  def create_changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :organization_id,
      :created_by_user_id,
      :name,
      :description,
      :profile_image_url,
      :intro_id,
      :outro_id,
      :watermark_id,
      :watermark_settings,
      :intro_outro_settings,
      :intro_ratio_settings,
      :outro_ratio_settings,
      :layout_overlays,
      :scope
    ])
    |> validate_required([:organization_id, :name])
    |> validate_inclusion(:scope, ["streamer", "global"])
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:description, max: 1000)
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:created_by_user_id)
    |> foreign_key_constraint(:intro_id)
    |> foreign_key_constraint(:outro_id)
    |> foreign_key_constraint(:watermark_id)
  end

  @doc """
  Changeset for updating a creator profile.
  """
  def update_changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :name,
      :description,
      :profile_image_url,
      :intro_id,
      :outro_id,
      :watermark_id,
      :watermark_settings,
      :intro_outro_settings,
      :intro_ratio_settings,
      :outro_ratio_settings,
      :layout_overlays,
      :scope,
      :disabled
    ])
    |> validate_inclusion(:scope, ["streamer", "global"])
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:description, max: 1000)
    |> foreign_key_constraint(:intro_id)
    |> foreign_key_constraint(:outro_id)
    |> foreign_key_constraint(:watermark_id)
  end
end

