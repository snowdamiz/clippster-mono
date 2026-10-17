defmodule ClippsterServer.Accounts.UserCreatorProfile do
  @moduledoc """
  Personal creator/branding profiles owned by a user.
  Synced across desktop and mobile; assets reference user_assets.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.UserAsset

  schema "user_creator_profiles" do
    field :name, :string
    field :description, :string
    field :profile_image_url, :string
    field :watermark_settings, :map
    field :intro_outro_settings, :map
    field :intro_ratio_settings, :string
    field :outro_ratio_settings, :string
    field :layout_overlays, {:array, :map}
    field :scope, :string, default: "personal_studio"
    field :disabled, :boolean, default: false
    field :auto_dvr_enabled, :boolean, default: false
    field :clip_build_defaults, :map
    field :client_id, :string
    field :platform_links, {:array, :map}, default: []

    belongs_to :user, ClippsterServer.Accounts.User
    belongs_to :intro, UserAsset, foreign_key: :intro_id
    belongs_to :outro, UserAsset, foreign_key: :outro_id
    belongs_to :watermark, UserAsset, foreign_key: :watermark_id

    timestamps(type: :utc_datetime)
  end

  @scopes ~w(streamer global personal_studio)

  def create_changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :user_id,
      :platform_links,
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
      :disabled,
      :auto_dvr_enabled,
      :clip_build_defaults,
      :client_id
    ])
    |> validate_required([:user_id, :name])
    |> validate_platform_links()
    |> validate_inclusion(:scope, @scopes)
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:description, max: 1000)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:intro_id)
    |> foreign_key_constraint(:outro_id)
    |> foreign_key_constraint(:watermark_id)
    |> unique_constraint([:user_id, :client_id],
      name: :user_creator_profiles_user_id_client_id_index
    )
  end

  def update_changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :name,
      :platform_links,
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
      :disabled,
      :auto_dvr_enabled,
      :clip_build_defaults,
      :client_id
    ])
    |> validate_platform_links()
    |> validate_inclusion(:scope, @scopes)
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:description, max: 1000)
    |> foreign_key_constraint(:intro_id)
    |> foreign_key_constraint(:outro_id)
    |> foreign_key_constraint(:watermark_id)
  end

  defp validate_platform_links(changeset) do
    validate_change(changeset, :platform_links, fn :platform_links, links ->
      valid =
        length(links) <= 12 and
          Enum.all?(links, fn link ->
            link["platform"] in ~w(pumpfun kick twitch YouTube youtube rumble twitter tokend) and
              is_binary(link["platform_id"]) and String.length(link["platform_id"]) in 1..200
          end)

      if valid,
        do: [],
        else: [platform_links: "must contain up to 12 supported platforms with valid identifiers"]
    end)
  end
end
