defmodule ClippsterServer.ClipperProfiles.BadgeWorker do
  @moduledoc """
  Background worker for checking and awarding clipper badges.
  Called after campaign completions and periodically to check eligibility.
  """
  use GenServer
  require Logger

  alias ClippsterServer.ClipperProfiles
  alias ClippsterServer.Repo

  @check_interval :timer.hours(6)

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(state) do
    schedule_check()
    {:ok, state}
  end

  @impl true
  def handle_info(:check_badges, state) do
    Logger.info("[BadgeWorker] Running periodic badge check...")
    check_all_badges()
    schedule_check()
    {:noreply, state}
  end

  @impl true
  def handle_cast({:check_clipper_badges, user_id}, state) do
    Logger.info("[BadgeWorker] Checking badges for user #{user_id}")
    check_badges_for_user(user_id)
    {:noreply, state}
  end

  defp schedule_check do
    Process.send_after(self(), :check_badges, @check_interval)
  end

  @doc """
  Trigger badge check for a specific user (called after campaign completion).
  """
  def check_user_badges(user_id) do
    GenServer.cast(__MODULE__, {:check_clipper_badges, user_id})
  end

  @doc """
  Check badges for all clippers.
  """
  def check_all_badges do
    profiles = ClipperProfiles.list_all_profiles()
    
    Enum.each(profiles, fn profile ->
      check_badges_for_profile(profile)
    end)
  end

  defp check_badges_for_user(user_id) do
    case ClipperProfiles.get_profile_by_user_id(user_id) do
      nil -> :ok
      profile -> check_badges_for_profile(profile)
    end
  end

  defp check_badges_for_profile(profile) do
    check_verified_badge(profile)
    check_top_clipper_badge(profile)
    check_rising_star_badge(profile)
  end

  # Verified Clipper Badge - Earned when:
  # - Completed 3+ campaigns with positive endorsements, OR
  # - Manually verified by admin
  defp check_verified_badge(profile) do
    if not has_badge?(profile, "verified") do
      campaigns_completed = profile.total_campaigns_completed || 0
      endorsements = profile.total_endorsements || 0

      if campaigns_completed >= 3 and endorsements >= 1 do
        Logger.info("[BadgeWorker] Awarding verified badge to profile #{profile.id}")
        ClipperProfiles.award_badge(profile.id, "verified")
      end
    end
  end

  # Top Clipper Badge - Earned when:
  # - Ranked in top 10 on monthly leaderboard
  defp check_top_clipper_badge(profile) do
    # Check if in top 10 of most recent monthly leaderboard
    case ClipperProfiles.get_clipper_rank(profile.id, "monthly") do
      {:ok, rank} when rank <= 10 ->
        if not has_badge?(profile, "top_clipper") do
          Logger.info("[BadgeWorker] Awarding top_clipper badge to profile #{profile.id}")
          ClipperProfiles.award_badge(profile.id, "top_clipper")
        end
      _ ->
        # Revoke if no longer in top 10
        if has_badge?(profile, "top_clipper") do
          Logger.info("[BadgeWorker] Revoking top_clipper badge from profile #{profile.id}")
          ClipperProfiles.revoke_badge(profile.id, "top_clipper")
        end
    end
  end

  # Rising Star Badge - Earned when:
  # - New clipper (< 3 months) with 5+ campaigns completed
  defp check_rising_star_badge(profile) do
    three_months_ago = DateTime.add(DateTime.utc_now(), -90 * 24 * 60 * 60, :second)
    is_new = DateTime.compare(profile.inserted_at, three_months_ago) == :gt
    campaigns_completed = profile.total_campaigns_completed || 0

    if is_new and campaigns_completed >= 5 do
      if not has_badge?(profile, "rising_star") do
        Logger.info("[BadgeWorker] Awarding rising_star badge to profile #{profile.id}")
        ClipperProfiles.award_badge(profile.id, "rising_star")
      end
    else
      # Revoke if no longer eligible (profile is now > 3 months old)
      if has_badge?(profile, "rising_star") and not is_new do
        Logger.info("[BadgeWorker] Revoking rising_star badge from profile #{profile.id} (no longer new)")
        ClipperProfiles.revoke_badge(profile.id, "rising_star")
      end
    end
  end

  defp has_badge?(profile, badge_type) do
    profile = Repo.preload(profile, :badges)
    Enum.any?(profile.badges || [], fn badge -> badge.badge_type == badge_type end)
  end
end
