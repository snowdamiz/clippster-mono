defmodule ClippsterServer.Campaigns.CampaignSubmissionAnalytics do
  @moduledoc """
  Computes verification warnings and trend metrics from PostForMe snapshot history.
  Only uses fields actually returned in snapshots.
  """

  @stale_hours 48
  @spike_multiplier 5
  @min_views_for_engagement_check 1_000
  @max_engagement_rate 0.001

  @doc """
  Computes warning codes from a submission and its snapshot history.
  """
  def compute_warnings(submission, snapshots, opts \\ []) do
    duplicate_url? = Keyword.get(opts, :duplicate_url?, false)
    manual_override? = Keyword.get(opts, :manual_override?, false)

    latest = List.first(snapshots)
    previous = Enum.at(snapshots, 1)

    []
    |> maybe_add(manual_override?, "manual_override")
    |> maybe_add(duplicate_url?, "duplicate_url")
    |> maybe_add(post_not_in_feed?(latest), "post_not_in_feed")
    |> maybe_add(no_account?(latest), "no_connected_account")
    |> maybe_add(stale_metrics?(submission, latest), "stale_metrics")
    |> maybe_add(never_synced?(submission, latest), "never_synced")
    |> maybe_add(view_spike?(latest, previous), "view_spike")
    |> maybe_add(low_engagement?(latest), "low_engagement")
    |> maybe_add(insufficient_metrics?(latest), "insufficient_metrics")
  end

  @doc """
  Builds trend summary from snapshots (newest first).
  """
  def build_trends([]), do: %{snapshots_count: 0}

  def build_trends(snapshots) do
    latest = hd(snapshots)
    oldest = List.last(snapshots)

    %{
      snapshots_count: length(snapshots),
      latest_at: latest.inserted_at,
      view_count: latest.view_count,
      like_count: latest.like_count,
      comment_count: latest.comment_count,
      share_count: latest.share_count,
      save_count: latest.save_count,
      reach_count: latest.reach_count,
      impressions_count: latest.impressions_count,
      view_delta: delta(latest.view_count, oldest.view_count),
      like_delta: delta(latest.like_count, oldest.like_count),
      comment_delta: delta(latest.comment_count, oldest.comment_count),
      share_delta: delta(latest.share_count, oldest.share_count),
      save_delta: delta(latest.save_count, oldest.save_count),
      engagement_rate: engagement_rate(latest)
    }
  end

  defp maybe_add(warnings, true, code), do: warnings ++ [code]
  defp maybe_add(warnings, false, _code), do: warnings

  defp post_not_in_feed?(%{feed_match_status: "not_found"}), do: true
  defp post_not_in_feed?(%{feed_match_status: "no_account"}), do: true
  defp post_not_in_feed?(%{feed_match_status: "no_provider_account"}), do: true
  defp post_not_in_feed?(_), do: false

  defp no_account?(%{feed_match_status: status})
       when status in ["no_account", "no_provider_account"],
       do: true

  defp no_account?(_), do: false

  defp stale_metrics?(_submission, nil), do: false

  defp stale_metrics?(submission, _latest) do
    case submission.metrics_last_synced_at do
      nil ->
        true

      synced_at ->
        DateTime.diff(DateTime.utc_now(), synced_at, :hour) > @stale_hours
    end
  end

  defp never_synced?(submission, latest) do
    is_nil(submission.metrics_last_synced_at) and is_nil(latest)
  end

  defp view_spike?(latest, previous) when not is_nil(latest) and not is_nil(previous) do
    latest_views = latest.view_count || 0
    previous_views = previous.view_count || 0

    previous_views > 0 and latest_views >= previous_views * @spike_multiplier
  end

  defp view_spike?(_, _), do: false

  defp low_engagement?(nil), do: false

  defp low_engagement?(snapshot) do
    views = snapshot.view_count || 0
    rate = engagement_rate(snapshot)

    views >= @min_views_for_engagement_check and not is_nil(rate) and
      rate <= @max_engagement_rate
  end

  defp insufficient_metrics?(nil), do: true

  defp insufficient_metrics?(snapshot) do
    returned =
      [
        snapshot.view_count,
        snapshot.like_count,
        snapshot.comment_count,
        snapshot.share_count,
        snapshot.save_count,
        snapshot.reach_count,
        snapshot.impressions_count
      ]
      |> Enum.count(&(&1 != nil))

    returned <= 1
  end

  defp engagement_rate(snapshot) do
    views = snapshot.view_count

    if is_nil(views) or views <= 0 do
      nil
    else
      engagement_total =
        Enum.reduce(
          [
            snapshot.like_count,
            snapshot.comment_count,
            snapshot.share_count,
            snapshot.save_count
          ],
          0,
          fn
            nil, acc -> acc
            value, acc -> acc + value
          end
        )

      engagement_total / views
    end
  end

  defp delta(nil, _), do: nil
  defp delta(_, nil), do: nil
  defp delta(latest, oldest), do: latest - oldest
end
