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
    field :video_playbook, :map
    field :creator_skill_preferences, :map
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
      :video_playbook,
      :creator_skill_preferences,
      :client_id
    ])
    |> validate_required([:user_id, :name])
    |> validate_platform_links()
    |> validate_video_playbook()
    |> validate_creator_skill_preferences()
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
      :video_playbook,
      :creator_skill_preferences,
      :client_id
    ])
    |> validate_platform_links()
    |> validate_video_playbook()
    |> validate_creator_skill_preferences()
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

  defp validate_video_playbook(changeset) do
    validate_change(changeset, :video_playbook, fn :video_playbook, playbook ->
      limits = %{"audience" => 300, "editing_style" => 300, "hard_rules" => 1000}

      valid =
        is_map(playbook) and
          Enum.all?(limits, fn {key, max} ->
            value = Map.get(playbook, key, "")
            is_binary(value) and String.length(value) <= max
          end) and
          Map.get(playbook, "captions", "ask") in ~w(ask yes no) and
          map_size(playbook) <= 4

      if valid, do: [], else: [video_playbook: "has invalid video editing preferences"]
    end)
  end

  defp validate_creator_skill_preferences(changeset) do
    validate_change(changeset, :creator_skill_preferences, fn :creator_skill_preferences,
                                                              preferences ->
      valid =
        is_map(preferences) and
          map_size(preferences) <= 5 and
          Enum.all?(Map.keys(preferences), &(&1 in ~w(brand editing sponsors publishing delivery))) and
          valid_creator_preview_limit?(preferences) and
          byte_size(Jason.encode!(preferences)) <= 16_000 and
          is_list(Map.get(preferences, "sponsors", [])) and
          length(Map.get(preferences, "sponsors", [])) <= 20

      if valid, do: [], else: [creator_skill_preferences: "has invalid creator edit preferences"]
    end)
  end

  defp valid_creator_preview_limit?(preferences) do
    case Map.get(preferences, "delivery") do
      nil -> true
      delivery when is_map(delivery) ->
        case Map.get(delivery, "previewMaxMb") do
          nil -> true
          value when is_number(value) -> value >= 1 and value <= 200
          _ -> false
        end
      _ -> false
    end
  end
end
