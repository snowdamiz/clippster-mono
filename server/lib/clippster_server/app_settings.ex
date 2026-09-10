defmodule ClippsterServer.AppSettings do
  @moduledoc """
  Context module for managing application-wide settings.
  """
  alias ClippsterServer.Repo
  alias ClippsterServer.AppSettings.Setting

  # Known feature flag keys
  @live_clip_enabled_key "live_clip_enabled"
  @beta_mode_enabled_key "beta_mode_enabled"
  @ai_video_enabled_key "ai_video_enabled"
  @image_editor_enabled_key "image_editor_enabled"
  @tokend_enabled_key "tokend_enabled"
  @campaigns_enabled_key "campaigns_enabled"

  # Default values for feature flags
  @default_settings %{
    @live_clip_enabled_key => "true",
    @beta_mode_enabled_key => "false",
    @ai_video_enabled_key => "false",
    @image_editor_enabled_key => "false",
    @tokend_enabled_key => "false",
    @campaigns_enabled_key => "false"
  }

  @doc """
  Get a setting value by key.
  Returns the default value if the setting doesn't exist.
  """
  def get_setting(key) do
    case Repo.get(Setting, key) do
      nil -> Map.get(@default_settings, key)
      setting -> setting.value
    end
  end

  @doc """
  Set a setting value. Creates or updates the setting.
  """
  def set_setting(key, value) do
    case Repo.get(Setting, key) do
      nil ->
        %Setting{}
        |> Setting.changeset(%{key: key, value: value})
        |> Repo.insert()

      setting ->
        setting
        |> Setting.changeset(%{value: value})
        |> Repo.update()
    end
  end

  @doc """
  Get all settings as a map.
  """
  def get_all_settings do
    settings = Repo.all(Setting)

    Enum.reduce(settings, @default_settings, fn setting, acc ->
      Map.put(acc, setting.key, setting.value)
    end)
  end

  @doc """
  Get all feature flags.
  Returns a map with boolean values for each feature flag.
  """
  def get_feature_flags do
    %{
      live_clip_enabled: is_live_clip_enabled?(),
      beta_mode_enabled: is_beta_mode_enabled?(),
      ai_video_enabled: is_ai_video_enabled?(),
      image_editor_enabled: is_image_editor_enabled?(),
      tokend_enabled: is_tokend_enabled?(),
      campaigns_enabled: is_campaigns_enabled?()
    }
  end

  @doc """
  Check if the Live Clip feature is enabled.
  """
  def is_live_clip_enabled? do
    enabled?(@live_clip_enabled_key)
  end

  @doc """
  Enable or disable the Live Clip feature.
  """
  def set_live_clip_enabled(enabled) when is_boolean(enabled) do
    set_setting(@live_clip_enabled_key, to_string(enabled))
  end

  @doc """
  Check if Beta Mode is enabled.
  """
  def is_beta_mode_enabled? do
    enabled?(@beta_mode_enabled_key)
  end

  @doc """
  Enable or disable Beta Mode.
  """
  def set_beta_mode_enabled(enabled) when is_boolean(enabled) do
    set_setting(@beta_mode_enabled_key, to_string(enabled))
  end

  def is_ai_video_enabled?, do: enabled?(@ai_video_enabled_key)
  def is_image_editor_enabled?, do: enabled?(@image_editor_enabled_key)
  def is_tokend_enabled?, do: enabled?(@tokend_enabled_key)
  def is_campaigns_enabled?, do: enabled?(@campaigns_enabled_key)

  defp enabled?(key), do: get_setting(key) == "true"
end
