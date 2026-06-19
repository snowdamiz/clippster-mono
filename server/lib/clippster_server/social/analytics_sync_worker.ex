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
  alias ClippsterServer.Campaigns
  alias ClippsterServer.Campaigns.{UserPost, ClipperSocialAccount}

  @default_interval :timer.hours(1)
  @batch_size 50
  @rate_limit_delay :timer.seconds(2)
  @max_retries 3

  # ============================================================================
  # Public API
  # ============================================================================

  def start_link(opts \\ []) do
    case GenServer.start_link(__MODULE__, opts, name: {:global, __MODULE__}) do
      {:ok, pid} -> {:ok, pid}
      {:error, {:already_started, _pid}} -> :ignore
      error -> error
    end
  end

  @doc """
  Triggers an immediate sync for all pending posts.
  """
  def sync_now do
    GenServer.cast({:global, __MODULE__}, :sync_now)
  end

  @doc """
  Syncs analytics for a specific post.
  """
  def sync_post(post_id) do
    GenServer.cast({:global, __MODULE__}, {:sync_post, post_id})
  end

  @doc """
  Gets the current worker status.
  """
  def status do
    GenServer.call({:global, __MODULE__}, :status)
  end

  # ============================================================================
  # GenServer Callbacks
  # ============================================================================

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval, @default_interval)

    # DISABLED: No longer auto-sync on timer - analytics are fetched on-demand when org views the page
    # if Keyword.get(opts, :start_immediately, true) do
    #   Process.send_after(self(), :sync, :timer.seconds(30))
    # end

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

    Logger.info("[AnalyticsSyncWorker] Started (on-demand only, no automatic sync)")

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
    Logger.info("[AnalyticsSyncWorker] Starting analytics sync (on-demand)")

    new_state = %{state | syncing: true, last_sync: DateTime.utc_now()}

    # Run sync in a task to not block the GenServer
    worker = self()

    Task.start(fn ->
      result = run_sync()
      send(worker, {:sync_complete, result})
    end)

    # DISABLED: No longer schedule next sync automatically
    # Process.send_after(self(), :sync, state.interval)

    {:noreply, new_state}
  end

  @impl true
  def handle_info({:sync_complete, result}, state) do
    new_stats = %{
      total_synced: state.stats.total_synced + result.synced,
      last_batch_count: result.synced,
      errors: state.stats.errors + result.errors
    }

    Logger.info(
      "[AnalyticsSyncWorker] Sync complete - synced: #{result.synced}, errors: #{result.errors}"
    )

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
    # Sync organization posts
    org_posts = Social.get_posts_needing_sync(limit: div(@batch_size, 2))
    Logger.info("[AnalyticsSyncWorker] Found #{length(org_posts)} organization posts to sync")

    # Sync user posts
    user_posts = Campaigns.get_user_posts_needing_sync(limit: div(@batch_size, 2))
    Logger.info("[AnalyticsSyncWorker] Found #{length(user_posts)} user posts to sync")

    # Sync org posts
    org_results =
      Enum.reduce(org_posts, %{synced: 0, errors: 0}, fn post, acc ->
        Process.sleep(@rate_limit_delay)

        case sync_single_post(post) do
          :ok -> %{acc | synced: acc.synced + 1}
          {:error, _reason} -> %{acc | errors: acc.errors + 1}
        end
      end)

    # Sync user posts
    user_results =
      Enum.reduce(user_posts, %{synced: 0, errors: 0}, fn post, acc ->
        Process.sleep(@rate_limit_delay)

        case sync_user_post(post) do
          :ok -> %{acc | synced: acc.synced + 1}
          {:error, _reason} -> %{acc | errors: acc.errors + 1}
        end
      end)

    %{
      synced: org_results.synced + user_results.synced,
      errors: org_results.errors + user_results.errors
    }
  end

  defp sync_single_post(%PostSubmission{} = post) do
    with {:ok, account} <- get_account_with_token(post),
         {:ok, platform_module} <- Platform.get_platform_module(post.platform),
         access_token <- SocialAccount.get_access_token(account),
         {:ok, insights} <- fetch_insights_with_retry(platform_module, access_token, post.post_id) do
      case Social.sync_post_analytics(post, insights) do
        {:ok, _updated} ->
          Logger.debug("[AnalyticsSyncWorker] Synced post #{post.id}")

          Appsignal.increment_counter("worker.analytics_sync.success", 1, %{
            platform: post.platform
          })

          :ok

        {:error, reason} ->
          Logger.warning(
            "[AnalyticsSyncWorker] Failed to update post #{post.id}: #{inspect(reason)}"
          )

          Appsignal.increment_counter("worker.analytics_sync.failed", 1, %{
            platform: post.platform
          })

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
        Appsignal.increment_counter("worker.analytics_sync.failed", 1, %{platform: post.platform})
        {:error, reason}
    end
  end

  defp get_account_with_token(%PostSubmission{organization_social_account: nil}),
    do: {:error, :no_account}

  defp get_account_with_token(
         %PostSubmission{organization_social_account: %Ecto.Association.NotLoaded{}} = post
       ) do
    case Social.get_post_submission(post.id) do
      nil -> {:error, :no_account}
      loaded_post -> get_account_with_token(loaded_post)
    end
  end

  defp get_account_with_token(%PostSubmission{organization_social_account: account}),
    do: {:ok, account}

  defp sync_user_post(%UserPost{} = post) do
    with {:ok, account} <- get_user_account_with_token(post),
         {:ok, platform_module} <- Platform.get_platform_module(post.platform),
         access_token <- ClipperSocialAccount.get_access_token(account),
         {:ok, insights} <- fetch_insights_with_retry(platform_module, access_token, post.post_id) do
      case Campaigns.update_user_post_analytics(post, insights) do
        {:ok, _updated} ->
          Logger.debug("[AnalyticsSyncWorker] Synced user post #{post.id}")

          Appsignal.increment_counter("worker.analytics_sync.success", 1, %{
            platform: post.platform
          })

          :ok

        {:error, reason} ->
          Logger.warning(
            "[AnalyticsSyncWorker] Failed to update user post #{post.id}: #{inspect(reason)}"
          )

          Appsignal.increment_counter("worker.analytics_sync.failed", 1, %{
            platform: post.platform
          })

          {:error, reason}
      end
    else
      {:error, :no_account} ->
        Logger.warning("[AnalyticsSyncWorker] No account found for user post #{post.id}")
        {:error, :no_account}

      {:error, :not_implemented} ->
        Logger.debug("[AnalyticsSyncWorker] Platform not implemented for user post #{post.id}")
        {:error, :not_implemented}

      {:error, reason} ->
        Logger.warning(
          "[AnalyticsSyncWorker] Failed to sync user post #{post.id}: #{inspect(reason)}"
        )

        Appsignal.increment_counter("worker.analytics_sync.failed", 1, %{platform: post.platform})
        {:error, reason}
    end
  end

  defp get_user_account_with_token(%UserPost{clipper_social_account: nil}),
    do: {:error, :no_account}

  defp get_user_account_with_token(
         %UserPost{clipper_social_account: %Ecto.Association.NotLoaded{}} = post
       ) do
    case Campaigns.get_user_post(post.id) do
      nil -> {:error, :no_account}
      loaded_post -> get_user_account_with_token(loaded_post)
    end
  end

  defp get_user_account_with_token(%UserPost{clipper_social_account: account}), do: {:ok, account}

  defp fetch_insights_with_retry(platform_module, access_token, post_id, attempt \\ 1) do
    case platform_module.get_insights(access_token, post_id) do
      {:ok, insights} ->
        {:ok, insights}

      {:error, _reason} when attempt < @max_retries ->
        # Exponential backoff
        delay = :math.pow(2, attempt) |> round() |> Kernel.*(@rate_limit_delay)

        Logger.debug(
          "[AnalyticsSyncWorker] Retry #{attempt} after #{delay}ms for post #{post_id}"
        )

        Process.sleep(delay)
        fetch_insights_with_retry(platform_module, access_token, post_id, attempt + 1)

      {:error, reason} ->
        {:error, reason}
    end
  end
end
