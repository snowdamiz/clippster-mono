defmodule ClippsterServer.Social.ProviderMode do
  @moduledoc """
  Social account connections and publishing use Post For Me exclusively.
  """

  @platform_aliases %{
    "twitter" => "x"
  }

  def mode, do: "post_for_me"
  def legacy?, do: false
  def post_for_me?, do: true
  def dual?, do: false
  def post_for_me_enabled?, do: true

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
