defmodule ClippsterServer.Organizations.OrganizationCreatorPlatformLink do
  @moduledoc """
  Schema for platform links associated with organization creator profiles.
  Each link connects a creator profile to a streaming platform account.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.OrganizationCreatorProfile

  @platforms ~w(pumpfun kick twitch youtube)

  schema "organization_creator_platform_links" do
    field :platform, :string
    field :platform_id, :string
    field :display_name, :string
    field :profile_image_url, :string
    field :is_primary, :boolean, default: false

    belongs_to :organization_creator_profile, OrganizationCreatorProfile

    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc """
  Changeset for creating a new platform link.
  """
  def create_changeset(link, attrs) do
    link
    |> cast(attrs, [
      :organization_creator_profile_id,
      :platform,
      :platform_id,
      :display_name,
      :profile_image_url,
      :is_primary
    ])
    |> validate_required([:organization_creator_profile_id, :platform, :platform_id])
    |> validate_inclusion(:platform, @platforms)
    |> validate_length(:platform_id, min: 1, max: 255)
    |> validate_length(:display_name, max: 255)
    |> foreign_key_constraint(:organization_creator_profile_id)
    |> unique_constraint([:organization_creator_profile_id, :platform, :platform_id],
      name: :org_creator_platform_links_unique,
      message: "platform link already exists for this profile"
    )
  end

  @doc """
  Changeset for updating a platform link.
  """
  def update_changeset(link, attrs) do
    link
    |> cast(attrs, [:display_name, :profile_image_url, :is_primary])
    |> validate_length(:display_name, max: 255)
  end

  @doc """
  Returns the list of valid platforms.
  """
  def platforms, do: @platforms

  @doc """
  Checks if the given platform is valid.
  """
  def valid_platform?(platform) when is_binary(platform), do: platform in @platforms
  def valid_platform?(_), do: false
end

