defmodule ClippsterServer.AppSettings do
  @moduledoc """
  Context module for managing application-wide settings.
  """
  import Ecto.Query
  alias ClippsterServer.Repo
  alias ClippsterServer.AppSettings.Setting

  # Known feature flag keys
  @live_clip_enabled_key "live_clip_enabled"

  # Default values for feature flags
  @default_settings %{
    @live_clip_enabled_key => "true"
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
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    
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
      live_clip_enabled: is_live_clip_enabled?()
    }
  end

  @doc """
  Check if the Live Clip feature is enabled.
  """
  def is_live_clip_enabled? do
    get_setting(@live_clip_enabled_key) == "true"
  end

  @doc """
  Enable or disable the Live Clip feature.
  """
  def set_live_clip_enabled(enabled) when is_boolean(enabled) do
    set_setting(@live_clip_enabled_key, to_string(enabled))
  end
end

