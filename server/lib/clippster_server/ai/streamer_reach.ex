defmodule ClippsterServer.AI.StreamerReach do
  @moduledoc """
  Scores streamer reach for AI clip detection.

  This is a capped context boost only. A famous creator can make a good moment
  more valuable, but it must never rescue a boring clip.
  """

  @type tier :: :unknown | :niche | :established | :famous | :top_tier

  @curated_tiers %{
    # Top global streamers / creators
    "kai cenat" => :top_tier,
    "kaicenat" => :top_tier,
    "xqc" => :top_tier,
    "ishowspeed" => :top_tier,
    "speed" => :top_tier,
    "adin ross" => :top_tier,
    "adinross" => :top_tier,
    "hasanabi" => :top_tier,
    "hasan piker" => :top_tier,
    "ninja" => :top_tier,
    "pokimane" => :top_tier,
    "ludwig" => :top_tier,
    "logan paul" => :top_tier,
    "ksi" => :top_tier,
    "mrbeast" => :top_tier,

    # Famous streamer personalities
    "asmongold" => :famous,
    "mizkif" => :famous,
    "extraemily" => :famous,
    "emiru" => :famous,
    "tectone" => :famous,
    "summit1g" => :famous,
    "shroud" => :famous,
    "tarik" => :famous,
    "caseoh" => :famous,
    "moistcr1tikal" => :famous,
    "penguinz0" => :famous,
    "drdisrespect" => :famous,
    "nickmercs" => :famous,
    "timthetatman" => :famous,
    "trainwreckstv" => :famous,
    "tyler1" => :famous,
    "sodapoppin" => :famous,
    "nmplol" => :famous,
    "fanum" => :famous,
    "agent00" => :famous,
    "duke dennis" => :famous,
    "duke" => :famous,
    "ray" => :famous,
    "rayasianboy" => :famous,
    "plaqueboymax" => :famous,
    "yourrage" => :famous,
    "adin" => :famous,
    "faze banks" => :famous,
    "banks" => :famous,
    "n3on" => :famous,
    "neon" => :famous,
    "sneako" => :famous,
    "destiny" => :famous,
    "myth" => :famous,
    "cyr" => :famous,
    "austinshow" => :famous,

    # Established / category-famous creators
    "qt cinderella" => :established,
    "qtcinderella" => :established,
    "fuslie" => :established,
    "lily pichu" => :established,
    "lilypichu" => :established,
    "sykkuno" => :established,
    "valkyrae" => :established,
    "disguised toast" => :established,
    "toast" => :established,
    "jacksepticeye" => :established,
    "markiplier" => :established,
    "jasontheween" => :established,
    "jason the ween" => :established,
    "stable ronaldo" => :established,
    "ronaldo" => :established,
    "clix" => :established,
    "mongraal" => :established,
    "nadeshot" => :established,
    "swagg" => :established,
    "jynxzi" => :established,
    "sketch" => :established,
    "m0xyy" => :established,
    "loltyler1" => :established,
    "adinupdates" => :established,
    "bruce" => :established,
    "brucedropemoff" => :established,
    "cashnasty" => :established,
    "flight" => :established,
    "flightreacts" => :established,
    "pokelawls" => :established,
    "forsen" => :established,
    "quin69" => :established
  }

  @doc """
  Scores streamer metadata from a detection request.
  """
  @spec score(map() | nil) :: map()
  def score(metadata) when is_map(metadata) do
    explicit_tier =
      metadata |> get_any(["tier", "reach_tier", "creator_tier"]) |> tier_from_value()

    viewer_tier =
      metadata
      |> get_any(["viewer_count", "average_viewers", "peak_viewers"])
      |> tier_from_viewers()

    follower_tier = metadata |> get_any(["followers", "follower_count"]) |> tier_from_followers()

    curated_tier =
      metadata |> display_names() |> Enum.find_value(&Map.get(@curated_tiers, normalize(&1)))

    tier =
      [explicit_tier, viewer_tier, follower_tier, curated_tier, :unknown]
      |> Enum.max_by(&tier_weight/1)

    %{
      tier: tier,
      score: tier_score(tier),
      label: tier_label(tier),
      matched_name:
        Enum.find(display_names(metadata), &Map.has_key?(@curated_tiers, normalize(&1)))
    }
  end

  def score(_), do: %{tier: :unknown, score: 0, label: "unknown creator", matched_name: nil}

  @doc """
  Returns a compact prompt appendix for creator reach.
  """
  @spec format_for_prompt(map() | nil) :: String.t()
  def format_for_prompt(metadata) do
    reach = score(metadata)

    """
    **STREAMER REACH CONTEXT:**
    - Creator tier: #{reach.label}
    - Creator Factor boost ceiling: +#{reach.score} points
    - Rule: use this only to boost genuinely hooky personality/community moments. Never accept a boring clip because the streamer is famous.
    """
    |> String.trim()
  end

  defp display_names(metadata) do
    [
      get_any(metadata, ["display_name", "displayName", "channel", "login", "username", "name"]),
      get_any(metadata, ["platform_id", "platformId", "channel_slug"])
    ]
    |> Enum.filter(&is_binary/1)
  end

  defp get_any(map, keys) do
    Enum.find_value(keys, fn key ->
      Map.get(map, key) || Map.get(map, String.to_atom(key))
    end)
  rescue
    _ -> nil
  end

  defp normalize(value) when is_binary(value) do
    value
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s]/, "")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end

  defp normalize(_), do: ""

  defp tier_from_value(value) when is_binary(value) do
    case normalize(value) do
      "top tier" -> :top_tier
      "toptier" -> :top_tier
      "famous" -> :famous
      "established" -> :established
      "niche" -> :niche
      _ -> nil
    end
  end

  defp tier_from_value(_), do: nil

  defp tier_from_viewers(value) when is_binary(value),
    do: value |> parse_number() |> tier_from_viewers()

  defp tier_from_viewers(value) when is_number(value) and value >= 50_000, do: :top_tier
  defp tier_from_viewers(value) when is_number(value) and value >= 10_000, do: :famous
  defp tier_from_viewers(value) when is_number(value) and value >= 1_000, do: :established
  defp tier_from_viewers(value) when is_number(value) and value > 0, do: :niche
  defp tier_from_viewers(_), do: nil

  defp tier_from_followers(value) when is_binary(value),
    do: value |> parse_number() |> tier_from_followers()

  defp tier_from_followers(value) when is_number(value) and value >= 5_000_000, do: :top_tier
  defp tier_from_followers(value) when is_number(value) and value >= 1_000_000, do: :famous
  defp tier_from_followers(value) when is_number(value) and value >= 100_000, do: :established
  defp tier_from_followers(value) when is_number(value) and value > 0, do: :niche
  defp tier_from_followers(_), do: nil

  defp parse_number(value) do
    value
    |> String.replace(~r/[^0-9.]/, "")
    |> Float.parse()
    |> case do
      {number, _} -> number
      _ -> nil
    end
  end

  defp tier_weight(:top_tier), do: 4
  defp tier_weight(:famous), do: 3
  defp tier_weight(:established), do: 2
  defp tier_weight(:niche), do: 1
  defp tier_weight(_), do: 0

  defp tier_score(:top_tier), do: 5
  defp tier_score(:famous), do: 4
  defp tier_score(:established), do: 3
  defp tier_score(:niche), do: 1
  defp tier_score(_), do: 0

  defp tier_label(:top_tier), do: "top-tier viral creator"
  defp tier_label(:famous), do: "famous creator"
  defp tier_label(:established), do: "established creator"
  defp tier_label(:niche), do: "niche creator"
  defp tier_label(_), do: "unknown creator"
end
