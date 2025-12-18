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

    belongs_to :organization, Organization
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
      :name,
      :description,
      :profile_image_url,
      :intro_id,
      :outro_id,
      :watermark_id,
      :watermark_settings
    ])
    |> validate_required([:organization_id, :name])
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:description, max: 1000)
    |> foreign_key_constraint(:organization_id)
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
      :watermark_settings
    ])
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:description, max: 1000)
    |> foreign_key_constraint(:intro_id)
    |> foreign_key_constraint(:outro_id)
    |> foreign_key_constraint(:watermark_id)
  end
end

