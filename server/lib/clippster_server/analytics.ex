defmodule ClippsterServer.Analytics do
  @moduledoc """
  The Analytics context.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Analytics.AnalyticsEvent

  @landing_event_types [
    "landing_page_view",
    "landing_download_click",
    "landing_download_disabled_click",
    "landing_nav_click",
    "landing_cta_click",
    "landing_signup_click",
    "landing_pricing_click",
    "landing_external_link_click"
  ]

  @doc """
  Tracks an analytics event.
  """
  def track_event(event_type, user_id \\ nil, metadata \\ %{}) do
    %AnalyticsEvent{}
    |> AnalyticsEvent.changeset(%{
      event_type: event_type,
      user_id: user_id,
      metadata: metadata
    })
    |> Repo.insert()
  end

  @doc """
  Returns aggregated counts for all event types.
  """
  def get_event_counts do
    AnalyticsEvent
    |> group_by([e], e.event_type)
    |> select([e], %{
      event_type: e.event_type,
      total: count(e.id)
    })
    |> Repo.all()
    |> Enum.into(%{}, fn %{event_type: type, total: total} ->
      {type, %{total: total}}
    end)
  end

  @doc """
  Returns aggregated counts with date filtering (today, this_week, total).
  """
  def get_event_counts_by_date_range do
    {today_start, week_start} = date_boundaries()

    AnalyticsEvent
    |> group_by([e], e.event_type)
    |> select([e], %{
      event_type: e.event_type,
      total: count(e.id),
      today: fragment("COUNT(*) FILTER (WHERE ? >= ?)", e.inserted_at, ^today_start),
      this_week: fragment("COUNT(*) FILTER (WHERE ? >= ?)", e.inserted_at, ^week_start)
    })
    |> Repo.all()
    |> Enum.into(%{}, fn %{event_type: type} = counts ->
      {type, Map.drop(counts, [:event_type])}
    end)
  end

  @doc """
  Returns a landing-page analytics dashboard assembled from first-party events.
  """
  def get_landing_dashboard_stats do
    page_view_query = event_query("landing_page_view")
    download_query = event_query("landing_download_click")
    disabled_download_query = event_query("landing_download_disabled_click")

    visitors = distinct_metadata_counts(page_view_query, "visitor_id")
    downloads = range_counts(download_query)

    %{
      overview: %{
        page_views: range_counts(page_view_query),
        unique_visitors: visitors,
        sessions: distinct_metadata_counts(page_view_query, "session_id"),
        download_clicks: downloads,
        disabled_download_clicks: range_counts(disabled_download_query),
        conversion_rate: conversion_rate(downloads.total, visitors.total)
      },
      visits_by_page: metadata_breakdown("landing_page_view", "path", "Unknown page", 10),
      referrers: metadata_breakdown("landing_page_view", "referrer_host", "Direct", 10),
      campaigns: metadata_breakdown("landing_page_view", "utm_campaign", "No campaign", 10),
      devices: metadata_breakdown("landing_page_view", "device_type", "Unknown", 10),
      browsers: metadata_breakdown("landing_page_view", "browser", "Unknown", 10),
      downloads_by_platform:
        metadata_breakdown("landing_download_click", "download_platform", "Unknown", 10),
      downloads_by_source: metadata_breakdown("landing_download_click", "source", "Unknown", 10),
      recent_events: recent_landing_events(25)
    }
  end

  def landing_event_type?(event_type), do: event_type in @landing_event_types

  defp event_query(event_type) do
    from(e in AnalyticsEvent, where: e.event_type == ^event_type)
  end

  defp range_counts(query) do
    {today_start, week_start} = date_boundaries()

    query
    |> select([e], %{
      total: count(e.id),
      today: fragment("COUNT(*) FILTER (WHERE ? >= ?)", e.inserted_at, ^today_start),
      this_week: fragment("COUNT(*) FILTER (WHERE ? >= ?)", e.inserted_at, ^week_start)
    })
    |> Repo.one()
    |> normalize_counts()
  end

  defp distinct_metadata_counts(query, metadata_key) do
    {today_start, week_start} = date_boundaries()

    query
    |> select([e], %{
      total: fragment("COUNT(DISTINCT NULLIF(?->>?, ''))", e.metadata, ^metadata_key),
      today:
        fragment(
          "COUNT(DISTINCT NULLIF(?->>?, '')) FILTER (WHERE ? >= ?)",
          e.metadata,
          ^metadata_key,
          e.inserted_at,
          ^today_start
        ),
      this_week:
        fragment(
          "COUNT(DISTINCT NULLIF(?->>?, '')) FILTER (WHERE ? >= ?)",
          e.metadata,
          ^metadata_key,
          e.inserted_at,
          ^week_start
        )
    })
    |> Repo.one()
    |> normalize_counts()
  end

  defp metadata_breakdown(event_type, metadata_key, fallback, limit) do
    {today_start, week_start} = date_boundaries()

    labeled_events =
      AnalyticsEvent
      |> where([e], e.event_type == ^event_type)
      |> select([e], %{
        id: e.id,
        inserted_at: e.inserted_at,
        label: fragment("COALESCE(NULLIF(?->>?, ''), ?)", e.metadata, ^metadata_key, ^fallback)
      })

    labeled_events
    |> subquery()
    |> group_by([e], e.label)
    |> select([e], %{
      label: e.label,
      total: count(e.id),
      today: fragment("COUNT(*) FILTER (WHERE ? >= ?)", e.inserted_at, ^today_start),
      this_week: fragment("COUNT(*) FILTER (WHERE ? >= ?)", e.inserted_at, ^week_start)
    })
    |> order_by([e], desc: count(e.id))
    |> limit(^limit)
    |> Repo.all()
  end

  defp recent_landing_events(limit) do
    AnalyticsEvent
    |> where([e], e.event_type in ^@landing_event_types)
    |> order_by([e], desc: e.inserted_at)
    |> limit(^limit)
    |> select([e], %{
      id: e.id,
      event_type: e.event_type,
      metadata: e.metadata,
      inserted_at: e.inserted_at
    })
    |> Repo.all()
  end

  defp conversion_rate(_downloads, 0), do: 0.0

  defp conversion_rate(downloads, visitors) do
    Float.round(downloads / visitors * 100, 1)
  end

  defp date_boundaries do
    today_start = DateTime.new!(Date.utc_today(), ~T[00:00:00])
    week_start = DateTime.add(today_start, -7 * 24 * 60 * 60)

    {today_start, week_start}
  end

  defp normalize_counts(nil), do: %{total: 0, today: 0, this_week: 0}

  defp normalize_counts(counts) do
    %{
      total: counts.total || 0,
      today: counts.today || 0,
      this_week: counts.this_week || 0
    }
  end
end
