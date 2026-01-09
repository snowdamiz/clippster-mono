defmodule ClippsterServer.ClipperProfiles.LeaderboardWorker do
  @moduledoc """
  Background worker for calculating clipper leaderboards.
  Runs weekly (Monday 00:00 UTC) and monthly (1st of month 00:00 UTC).
  """
  use GenServer
  require Logger

  alias ClippsterServer.ClipperProfiles

  @check_interval :timer.minutes(5)

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(state) do
    schedule_check()
    {:ok, state}
  end

  @impl true
  def handle_info(:check_and_calculate, state) do
    now = DateTime.utc_now()
    
    # Check if it's Monday for weekly leaderboard
    if Date.day_of_week(now) == 1 and now.hour == 0 and now.minute < 5 do
      Logger.info("[LeaderboardWorker] Calculating weekly leaderboard...")
      calculate_weekly_leaderboard()
    end

    # Check if it's 1st of month for monthly leaderboard
    if now.day == 1 and now.hour == 0 and now.minute < 5 do
      Logger.info("[LeaderboardWorker] Calculating monthly leaderboard...")
      calculate_monthly_leaderboard()
    end

    schedule_check()
    {:noreply, state}
  end

  defp schedule_check do
    Process.send_after(self(), :check_and_calculate, @check_interval)
  end

  @doc """
  Calculate weekly leaderboard for all active clippers.
  """
  def calculate_weekly_leaderboard do
    today = Date.utc_today()
    # Get Monday of current week
    days_since_monday = Date.day_of_week(today) - 1
    period_start = Date.add(today, -days_since_monday)
    period_end = Date.add(period_start, 6)

    calculate_leaderboard("weekly", period_start, period_end)
  end

  @doc """
  Calculate monthly leaderboard for all active clippers.
  """
  def calculate_monthly_leaderboard do
    today = Date.utc_today()
    period_start = Date.beginning_of_month(today)
    period_end = Date.end_of_month(today)

    calculate_leaderboard("monthly", period_start, period_end)
  end

  defp calculate_leaderboard(period_type, period_start, period_end) do
    Logger.info("[LeaderboardWorker] Calculating #{period_type} leaderboard for #{period_start} to #{period_end}")

    # Get all public clipper profiles
    profiles = ClipperProfiles.list_all_public_profiles()

    # Calculate scores for each profile
    scored_profiles = 
      profiles
      |> Enum.map(fn profile ->
        stats = calculate_period_stats(profile, period_start, period_end)
        score = calculate_score(stats)
        {profile, stats, score}
      end)
      |> Enum.filter(fn {_, _, score} -> score > 0 end)
      |> Enum.sort_by(fn {_, _, score} -> score end, :desc)
      |> Enum.with_index(1)

    # Create leaderboard entries
    Enum.each(scored_profiles, fn {{profile, stats, score}, rank} ->
      ClipperProfiles.create_leaderboard_entry(%{
        clipper_profile_id: profile.id,
        period_type: period_type,
        period_start: period_start,
        period_end: period_end,
        rank: rank,
        clips_delivered: stats.clips_delivered,
        campaigns_active: stats.campaigns_active,
        endorsements_received: stats.endorsements_received,
        score: score
      })
    end)

    Logger.info("[LeaderboardWorker] Created #{length(scored_profiles)} leaderboard entries for #{period_type}")
  end

  defp calculate_period_stats(profile, period_start, period_end) do
    # Get clips delivered in period
    clips_delivered = ClipperProfiles.count_clips_in_period(profile.user_id, period_start, period_end)
    
    # Get campaigns active in period
    campaigns_active = ClipperProfiles.count_campaigns_in_period(profile.user_id, period_start, period_end)
    
    # Get endorsements received in period
    endorsements_received = ClipperProfiles.count_endorsements_in_period(profile.id, period_start, period_end)

    %{
      clips_delivered: clips_delivered,
      campaigns_active: campaigns_active,
      endorsements_received: endorsements_received
    }
  end

  defp calculate_score(stats) do
    # score = (clips_delivered * 10) + (endorsements_received * 50) + (campaigns_active * 25)
    (stats.clips_delivered * 10) + (stats.endorsements_received * 50) + (stats.campaigns_active * 25)
  end
end
