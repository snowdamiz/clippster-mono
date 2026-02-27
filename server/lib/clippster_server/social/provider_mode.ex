defmodule ClippsterServer.Social.ProviderMode do
  @moduledoc """
  Runtime provider mode switch for social publishing/connect flows.

  Supported modes:
  - `legacy` (default): existing direct platform integrations only
  - `post_for_me`: Post For Me only
  - `dual`: legacy remains source of truth while also writing to Post For Me
  """

  @valid_modes ~w(legacy post_for_me dual)

  @platform_aliases %{
    "twitter" => "x"
  }

  def mode do
    configured_mode =
      Application.get_env(:clippster_server, :social_provider_mode, "legacy")
      |> to_string()
      |> String.trim()
      |> String.downcase()

    if configured_mode in @valid_modes, do: configured_mode, else: "legacy"
  end

  def legacy?, do: mode() == "legacy"
  def post_for_me?, do: mode() == "post_for_me"
  def dual?, do: mode() == "dual"

  def post_for_me_enabled?, do: post_for_me?() or dual?()

  @doc """
  Normalizes user-provided platform values to canonical keys used internally.
  """
  def normalize_platform(platform) when is_binary(platform) do
    normalized =
      platform
      |> String.trim()
      |> String.downcase()

    Map.get(@platform_aliases, normalized, normalized)
  end

  def normalize_platform(platform), do: platform
end
