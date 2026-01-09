defmodule ClippsterServer.Analytics do
  @moduledoc """
  The Analytics context.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Analytics.AnalyticsEvent

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
    _now = DateTime.utc_now()
    today_start = DateTime.new!(Date.utc_today(), ~T[00:00:00])
    week_start = DateTime.add(today_start, -7 * 24 * 60 * 60)

    _all_events = AnalyticsEvent

    # Get all event types
    event_types =
      AnalyticsEvent
      |> distinct([e], e.event_type)
      |> select([e], e.event_type)
      |> Repo.all()

    # Build stats for each event type
    Enum.reduce(event_types, %{}, fn event_type, acc ->
      total =
        from(e in AnalyticsEvent,
          where: e.event_type == ^event_type
        )
        |> Repo.aggregate(:count, :id)

      today_count =
        from(e in AnalyticsEvent,
          where: e.event_type == ^event_type and e.inserted_at >= ^today_start
        )
        |> Repo.aggregate(:count, :id)

      week_count =
        from(e in AnalyticsEvent,
          where: e.event_type == ^event_type and e.inserted_at >= ^week_start
        )
        |> Repo.aggregate(:count, :id)

      Map.put(acc, event_type, %{
        total: total,
        today: today_count,
        this_week: week_count
      })
    end)
  end
end