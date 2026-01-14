defmodule ClippsterServer.Campaigns.SubmissionViewSyncWorker do
  @moduledoc """
  GenServer worker that periodically syncs view counts for campaign submissions.

  Features:
  - Runs every 6 hours for verified submissions from last 30 days
  - Uses clipper's linked social account to fetch views via platform API
  - Implements rate limiting to respect API limits
  - Logs failures for submissions without linked accounts
  """

  use GenServer
  require Logger

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Campaigns.{CampaignSubmission, ClipperSocialAccount}
  alias ClippsterServer.Social.Platform

  @default_interval :timer.hours(6)
  @batch_size 100
  @rate_limit_delay :timer.seconds(2)
  @max_retries 3
  @sync_window_days 30

  # ============================================================================
  # Public API
  # ============================================================================

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Triggers an immediate sync for all pending submissions.
  """
  def sync_now do
    GenServer.cast(__MODULE__, :sync_now)
  end

  @doc """
  Syncs views for a specific submission.
  """
  def sync_submission(submission_id) do
    GenServer.cast(__MODULE__, {:sync_submission, submission_id})
  end

  @doc """
  Gets the current worker status.
  """
  def status do
    GenServer.call(__MODULE__, :status)
  end

  # ============================================================================
  # GenServer Callbacks
  # ============================================================================

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval, @default_interval)

    # Schedule first sync after a short delay to let the app start up
    if Keyword.get(opts, :start_immediately, true) do
      Process.send_after(self(), :sync, :timer.minutes(5))
    end

    state = %{
      interval: interval,
      last_sync: nil,
      syncing: false,
      stats: %{
        total_synced: 0,
        last_batch_count: 0,
        errors: 0,
        no_account: 0
      }
    }

    Logger.info("[SubmissionViewSyncWorker] Started with interval: #{div(interval, 60_000)} minutes")

    {:ok, state}
  end

  @impl true
  def handle_cast(:sync_now, state) do
    if state.syncing do
      Logger.info("[SubmissionViewSyncWorker] Sync already in progress, skipping")
      {:noreply, state}
    else
      send(self(), :sync)
      {:noreply, state}
    end
  end

  @impl true
  def handle_cast({:sync_submission, submission_id}, state) do
    Task.start(fn ->
      case Campaigns.get_submission(submission_id) do
        nil ->
          Logger.warning("[SubmissionViewSyncWorker] Submission not found: #{submission_id}")
        submission ->
          sync_single_submission(submission)
      end
    end)
    {:noreply, state}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_info(:sync, %{syncing: true} = state) do
    # Already syncing, skip this tick
    {:noreply, state}
  end

  @impl true
  def handle_info(:sync, state) do
    Logger.info("[SubmissionViewSyncWorker] Starting submission view sync")

    new_state = %{state | syncing: true, last_sync: DateTime.utc_now()}

    # Run sync in a task to not block the GenServer
    Task.start(fn ->
      result = run_sync()
      send(__MODULE__, {:sync_complete, result})
    end)

    # Schedule next sync
    Process.send_after(self(), :sync, state.interval)

    {:noreply, new_state}
  end

  @impl true
  def handle_info({:sync_complete, result}, state) do
    new_stats = %{
      total_synced: state.stats.total_synced + result.synced,
      last_batch_count: result.synced,
      errors: state.stats.errors + result.errors,
      no_account: state.stats.no_account + result.no_account
    }

    Logger.info("[SubmissionViewSyncWorker] Sync complete - synced: #{result.synced}, errors: #{result.errors}, no_account: #{result.no_account}")

    {:noreply, %{state | syncing: false, stats: new_stats}}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  # ============================================================================
  # Private Functions
  # ============================================================================

  defp run_sync do
    # Get verified submissions from last 30 days
    submissions = get_submissions_needing_sync()
    Logger.info("[SubmissionViewSyncWorker] Found #{length(submissions)} submissions to sync")

    # Sync each submission with rate limiting
    results = Enum.reduce(submissions, %{synced: 0, errors: 0, no_account: 0}, fn submission, acc ->
      Process.sleep(@rate_limit_delay)

      case sync_single_submission(submission) do
        :ok -> %{acc | synced: acc.synced + 1}
        {:error, :no_account} -> %{acc | no_account: acc.no_account + 1}
        {:error, _reason} -> %{acc | errors: acc.errors + 1}
      end
    end)

    results
  end

  defp get_submissions_needing_sync do
    import Ecto.Query

    cutoff_date = DateTime.utc_now() |> DateTime.add(-@sync_window_days * 24 * 60 * 60, :second)

    CampaignSubmission
    |> where([s], s.status in ["verified", "paid"])
    |> where([s], s.inserted_at >= ^cutoff_date)
    |> where([s], not is_nil(s.platform_post_id))
    |> order_by([s], [desc: s.views_last_updated_at])
    |> limit(^@batch_size)
    |> ClippsterServer.Repo.all()
    |> ClippsterServer.Repo.preload(:social_account)
  end

  defp sync_single_submission(%CampaignSubmission{} = submission) do
    cond do
      is_nil(submission.platform_post_id) ->
        Logger.debug("[SubmissionViewSyncWorker] No post ID for submission #{submission.id}")
        {:error, :no_post_id}

      is_nil(submission.social_account) ->
        Logger.debug("[SubmissionViewSyncWorker] No linked social account for submission #{submission.id}")
        {:error, :no_account}

      true ->
        fetch_and_update_views(submission)
    end
  end

  defp fetch_and_update_views(submission) do
    with {:ok, platform_module} <- Platform.get_platform_module(submission.platform),
         access_token <- ClipperSocialAccount.get_access_token(submission.social_account),
         {:ok, insights} <- fetch_insights_with_retry(platform_module, access_token, submission.platform_post_id) do

      view_count = insights.view_count || 0

      case Campaigns.update_submission_views(submission, view_count) do
        {:ok, _updated} ->
          Logger.debug("[SubmissionViewSyncWorker] Synced submission #{submission.id}: #{view_count} views")
          :ok
        {:error, reason} ->
          Logger.warning("[SubmissionViewSyncWorker] Failed to update submission #{submission.id}: #{inspect(reason)}")
          {:error, reason}
      end
    else
      {:error, :not_implemented} ->
        Logger.debug("[SubmissionViewSyncWorker] Platform not implemented for submission #{submission.id}")
        {:error, :not_implemented}

      {:error, reason} ->
        Logger.warning("[SubmissionViewSyncWorker] Failed to sync submission #{submission.id}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp fetch_insights_with_retry(platform_module, access_token, post_id, attempt \\ 1) do
    case platform_module.get_insights(access_token, post_id) do
      {:ok, insights} ->
        {:ok, insights}

      {:error, _reason} when attempt < @max_retries ->
        # Exponential backoff
        delay = :math.pow(2, attempt) |> round() |> Kernel.*(@rate_limit_delay)
        Logger.debug("[SubmissionViewSyncWorker] Retry #{attempt} after #{delay}ms for post #{post_id}")
        Process.sleep(delay)
        fetch_insights_with_retry(platform_module, access_token, post_id, attempt + 1)

      {:error, reason} ->
        {:error, reason}
    end
  end
end
