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
    field :clip_build_defaults, :map
    field :client_id, :string

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
      :clip_build_defaults,
      :client_id
    ])
    |> validate_required([:user_id, :name])
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
      :clip_build_defaults,
      :client_id
    ])
    |> validate_inclusion(:scope, @scopes)
    |> validate_length(:name, min: 1, max: 255)
    |> validate_length(:description, max: 1000)
    |> foreign_key_constraint(:intro_id)
    |> foreign_key_constraint(:outro_id)
    |> foreign_key_constraint(:watermark_id)
  end
end
