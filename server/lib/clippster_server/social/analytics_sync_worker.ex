defmodule ClippsterServer.Social.AnalyticsSyncWorker do
  @moduledoc """
  GenServer worker that periodically syncs analytics for published posts.

  Features:
  - Runs hourly to fetch updated metrics from social platforms
  - Implements rate limiting to respect API limits
  - Uses exponential backoff on failures
  - Respects manual_override flag on posts
  """

  use GenServer
  require Logger

  alias ClippsterServer.Social
  alias ClippsterServer.Social.{SocialAccount, PostSubmission, Platform}

  @default_interval :timer.hours(1)
  @batch_size 50
  @rate_limit_delay :timer.seconds(2)
  @max_retries 3

  # ============================================================================
  # Public API
  # ============================================================================

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Triggers an immediate sync for all pending posts.
  """
  def sync_now do
    GenServer.cast(__MODULE__, :sync_now)
  end

  @doc """
  Syncs analytics for a specific post.
  """
  def sync_post(post_id) do
    GenServer.cast(__MODULE__, {:sync_post, post_id})
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
      Process.send_after(self(), :sync, :timer.seconds(30))
    end

    state = %{
      interval: interval,
      last_sync: nil,
      syncing: false,
      stats: %{
        total_synced: 0,
        last_batch_count: 0,
        errors: 0
      }
    }

    Logger.info("[AnalyticsSyncWorker] Started with interval: #{div(interval, 60_000)} minutes")

    {:ok, state}
  end

  @impl true
  def handle_cast(:sync_now, state) do
    if state.syncing do
      Logger.info("[AnalyticsSyncWorker] Sync already in progress, skipping")
      {:noreply, state}
    else
      send(self(), :sync)
      {:noreply, state}
    end
  end

  @impl true
  def handle_cast({:sync_post, post_id}, state) do
    Task.start(fn ->
      case Social.get_post_submission(post_id) do
        nil ->
          Logger.warning("[AnalyticsSyncWorker] Post not found: #{post_id}")
        post ->
          sync_single_post(post)
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
    Logger.info("[AnalyticsSyncWorker] Starting analytics sync")

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
      errors: state.stats.errors + result.errors
    }

    Logger.info("[AnalyticsSyncWorker] Sync complete - synced: #{result.synced}, errors: #{result.errors}")

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
    posts = Social.get_posts_needing_sync(limit: @batch_size)

    Logger.info("[AnalyticsSyncWorker] Found #{length(posts)} posts to sync")

    results = Enum.reduce(posts, %{synced: 0, errors: 0}, fn post, acc ->
      # Rate limiting between requests
      Process.sleep(@rate_limit_delay)

      case sync_single_post(post) do
        :ok ->
          %{acc | synced: acc.synced + 1}
        {:error, _reason} ->
          %{acc | errors: acc.errors + 1}
      end
    end)

    results
  end

  defp sync_single_post(%PostSubmission{} = post) do
    with {:ok, account} <- get_account_with_token(post),
         {:ok, platform_module} <- Platform.get_platform_module(post.platform),
         access_token <- SocialAccount.get_access_token(account),
         {:ok, insights} <- fetch_insights_with_retry(platform_module, access_token, post.post_id) do

      case Social.sync_post_analytics(post, insights) do
        {:ok, _updated} ->
          Logger.debug("[AnalyticsSyncWorker] Synced post #{post.id}")
          :ok
        {:error, reason} ->
          Logger.warning("[AnalyticsSyncWorker] Failed to update post #{post.id}: #{inspect(reason)}")
          {:error, reason}
      end
    else
      {:error, :no_account} ->
        Logger.warning("[AnalyticsSyncWorker] No account found for post #{post.id}")
        {:error, :no_account}

      {:error, :not_implemented} ->
        Logger.debug("[AnalyticsSyncWorker] Platform not implemented for post #{post.id}")
        {:error, :not_implemented}

      {:error, reason} ->
        Logger.warning("[AnalyticsSyncWorker] Failed to sync post #{post.id}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp get_account_with_token(%PostSubmission{organization_social_account: nil}), do: {:error, :no_account}
  defp get_account_with_token(%PostSubmission{organization_social_account: %Ecto.Association.NotLoaded{}} = post) do
    case Social.get_post_submission(post.id) do
      nil -> {:error, :no_account}
      loaded_post -> get_account_with_token(loaded_post)
    end
  end
  defp get_account_with_token(%PostSubmission{organization_social_account: account}), do: {:ok, account}

  defp fetch_insights_with_retry(platform_module, access_token, post_id, attempt \\ 1) do
    case platform_module.get_insights(access_token, post_id) do
      {:ok, insights} ->
        {:ok, insights}

      {:error, _reason} when attempt < @max_retries ->
        # Exponential backoff
        delay = :math.pow(2, attempt) |> round() |> Kernel.*(@rate_limit_delay)
        Logger.debug("[AnalyticsSyncWorker] Retry #{attempt} after #{delay}ms for post #{post_id}")
        Process.sleep(delay)
        fetch_insights_with_retry(platform_module, access_token, post_id, attempt + 1)

      {:error, reason} ->
        {:error, reason}
    end
  end
end
