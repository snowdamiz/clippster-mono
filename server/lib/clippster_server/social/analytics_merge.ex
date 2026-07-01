defmodule ClippsterServer.Social.AnalyticsMerge do
  @moduledoc """
  Helpers for merging synced social post analytics without clobbering stored metrics with zeros.

  Post For Me feeds can return partial metrics after token expiry/reconnect (for example likes
  without impressions). Sync code must not overwrite previously synced view counts with 0.
  """

  @metric_keys [
    :view_count,
    :like_count,
    :comment_count,
    :save_count,
    :reach_count,
    :impressions_count,
    :share_count
  ]

  def metric_keys, do: @metric_keys

  @doc """
  Returns true when at least one incoming metric is greater than zero.
  """
  def has_real_metrics?(analytics) when is_map(analytics) do
    Enum.any?(@metric_keys, fn key -> metric_value(analytics, key) > 0 end)
  end

  def has_real_metrics?(_), do: false

  @doc """
  Merges incoming analytics into existing values.

  Incoming values greater than zero replace stored values. Zero or missing incoming values keep
  the existing stored metric when one is already present.
  """
  def merge_metrics(existing, incoming) when is_map(existing) and is_map(incoming) do
    incoming =
      incoming
      |> normalize_keys()
      |> Map.take(@metric_keys)

    Enum.reduce(@metric_keys, %{}, fn key, acc ->
      existing_value = metric_value(existing, key)
      incoming_value = metric_value(incoming, key)

      merged_value =
        cond do
          incoming_value > 0 -> incoming_value
          existing_value > 0 -> existing_value
          Map.has_key?(incoming, key) -> incoming_value
          true -> existing_value
        end

      Map.put(acc, key, merged_value)
    end)
  end

  defp metric_value(map, key) when is_map(map) do
    map
    |> normalize_keys()
    |> Map.get(key, 0)
    |> coerce_metric()
  end

  defp coerce_metric(value) when is_integer(value) and value >= 0, do: value

  defp coerce_metric(value) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, _} when parsed >= 0 -> parsed
      _ -> 0
    end
  end

  defp coerce_metric(_), do: 0

  defp normalize_keys(map) do
    Map.new(map, fn
      {key, value} when is_atom(key) -> {key, value}
      {key, value} when is_binary(key) -> {String.to_existing_atom(key), value}
      {key, value} -> {key, value}
    end)
  rescue
    ArgumentError ->
      Map.new(map, fn
        {key, value} when is_atom(key) -> {key, value}
        {key, value} -> {String.to_atom(key), value}
      end)
  end
end
