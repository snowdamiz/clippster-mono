defmodule ClippsterServer.Social.AnalyticsSyncWorker do
  @moduledoc """
  GenServer worker that syncs analytics for published posts via Post For Me feeds.

  Features:
  - On-demand sync (no automatic timer)
  - Fetches metrics from Post For Me social account feeds
  - Respects manual_override flag on posts
  """

  use GenServer
  require Logger

  alias ClippsterServer.Social
  alias ClippsterServer.Social.{PostSubmission, PostForMeFeedAnalytics, AnalyticsMerge}
  alias ClippsterServer.Campaigns
  alias ClippsterServer.Campaigns.UserPost

  @default_interval :timer.hours(1)
  @batch_size 50
  @rate_limit_delay :timer.seconds(2)

  def start_link(opts \\ []) do
    case GenServer.start_link(__MODULE__, opts, name: {:global, __MODULE__}) do
      {:ok, pid} -> {:ok, pid}
      {:error, {:already_started, _pid}} -> :ignore
      error -> error
    end
  end

  def sync_now do
    GenServer.cast({:global, __MODULE__}, :sync_now)
  end

  def sync_post(post_id) do
    GenServer.cast({:global, __MODULE__}, {:sync_post, post_id})
  end

  def status do
    GenServer.call({:global, __MODULE__}, :status)
  end

  @doc false
  def post_for_me_account?(%{provider: "post_for_me"}), do: true
  def post_for_me_account?(_), do: false

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval, @default_interval)

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

    Logger.info("[AnalyticsSyncWorker] Started (Post For Me feeds, on-demand only)")

    {:ok, state}
  end

  @impl true
  def handle_cast(:sync_now, state) do
    if state.syncing do
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
        nil -> Logger.warning("[AnalyticsSyncWorker] Post not found: #{post_id}")
        post -> sync_single_post(post)
      end
    end)

    {:noreply, state}
  end

  @impl true
  def handle_call(:status, _from, state), do: {:reply, state, state}

  @impl true
  def handle_info(:sync, %{syncing: true} = state), do: {:noreply, state}

  @impl true
  def handle_info(:sync, state) do
    Logger.info("[AnalyticsSyncWorker] Starting analytics sync (on-demand)")
    new_state = %{state | syncing: true, last_sync: DateTime.utc_now()}
    worker = self()

    Task.start(fn ->
      result = run_sync()
      send(worker, {:sync_complete, result})
    end)

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
  def handle_info(_msg, state), do: {:noreply, state}

  defp run_sync do
    org_posts = Social.get_posts_needing_sync(limit: div(@batch_size, 2))
    user_posts = Campaigns.get_user_posts_needing_sync(limit: div(@batch_size, 2))

    org_results =
      Enum.reduce(org_posts, %{synced: 0, errors: 0}, fn post, acc ->
        Process.sleep(@rate_limit_delay)

        case sync_single_post(post) do
          :ok -> %{acc | synced: acc.synced + 1}
          {:error, _} -> %{acc | errors: acc.errors + 1}
        end
      end)

    user_results =
      Enum.reduce(user_posts, %{synced: 0, errors: 0}, fn post, acc ->
        Process.sleep(@rate_limit_delay)

        case sync_user_post(post) do
          :ok -> %{acc | synced: acc.synced + 1}
          {:error, _} -> %{acc | errors: acc.errors + 1}
        end
      end)

    %{
      synced: org_results.synced + user_results.synced,
      errors: org_results.errors + user_results.errors
    }
  end

  defp sync_single_post(%PostSubmission{} = post) do
    with {:ok, account} <- get_org_account(post),
         :ok <- ensure_post_for_me_account(account),
         {:ok, provider_account_id} <- provider_account_id(account),
         {:ok, post_id} <- provider_post_id(post),
         {:ok, insights} <-
           PostForMeFeedAnalytics.fetch_post_insights(
             provider_account_id,
             post.platform,
             post_id
           ),
         true <- AnalyticsMerge.has_real_metrics?(insights),
         {:ok, _updated} <- Social.sync_post_analytics(post, insights) do
      Logger.debug("[AnalyticsSyncWorker] Synced post #{post.id}")
      Appsignal.increment_counter("worker.analytics_sync.success", 1, %{platform: post.platform})
      :ok
    else
      false ->
        Logger.debug(
          "[AnalyticsSyncWorker] Skipping post #{post.id} - incoming metrics are all zero"
        )

        {:error, :zero_metrics}

      {:error, :no_account} ->
        Logger.warning("[AnalyticsSyncWorker] No account found for post #{post.id}")
        {:error, :no_account}

      {:error, :missing_provider_account} ->
        Logger.debug("[AnalyticsSyncWorker] Missing provider account for post #{post.id}")
        {:error, :missing_provider_account}

      {:error, :missing_post_id} ->
        Logger.debug("[AnalyticsSyncWorker] Missing provider post id for post #{post.id}")
        {:error, :missing_post_id}

      {:error, :not_found} ->
        Logger.debug("[AnalyticsSyncWorker] Post not found in Post For Me feed for #{post.id}")
        {:error, :not_found}

      {:error, reason} ->
        Logger.warning("[AnalyticsSyncWorker] Failed to sync post #{post.id}: #{inspect(reason)}")
        Appsignal.increment_counter("worker.analytics_sync.failed", 1, %{platform: post.platform})
        {:error, reason}
    end
  end

  defp sync_user_post(%UserPost{} = post) do
    with {:ok, account} <- get_user_account(post),
         :ok <- ensure_post_for_me_account(account),
         {:ok, provider_account_id} <- provider_account_id(account),
         {:ok, post_id} <- provider_post_id(post),
         {:ok, insights} <-
           PostForMeFeedAnalytics.fetch_post_insights(
             provider_account_id,
             post.platform,
             post_id
           ),
         true <- AnalyticsMerge.has_real_metrics?(insights),
         {:ok, _updated} <- Campaigns.update_user_post_analytics(post, insights) do
      Logger.debug("[AnalyticsSyncWorker] Synced user post #{post.id}")
      Appsignal.increment_counter("worker.analytics_sync.success", 1, %{platform: post.platform})
      :ok
    else
      false ->
        Logger.debug(
          "[AnalyticsSyncWorker] Skipping user post #{post.id} - incoming metrics are all zero"
        )

        {:error, :zero_metrics}

      {:error, :no_account} ->
        Logger.warning("[AnalyticsSyncWorker] No account found for user post #{post.id}")
        {:error, :no_account}

      {:error, :missing_provider_account} ->
        Logger.debug("[AnalyticsSyncWorker] Missing provider account for user post #{post.id}")
        {:error, :missing_provider_account}

      {:error, :missing_post_id} ->
        Logger.debug("[AnalyticsSyncWorker] Missing provider post id for user post #{post.id}")
        {:error, :missing_post_id}

      {:error, :not_found} ->
        Logger.debug(
          "[AnalyticsSyncWorker] Post not found in Post For Me feed for user post #{post.id}"
        )

        {:error, :not_found}

      {:error, reason} ->
        Logger.warning(
          "[AnalyticsSyncWorker] Failed to sync user post #{post.id}: #{inspect(reason)}"
        )

        Appsignal.increment_counter("worker.analytics_sync.failed", 1, %{platform: post.platform})
        {:error, reason}
    end
  end

  defp get_org_account(%PostSubmission{organization_social_account: nil}),
    do: {:error, :no_account}

  defp get_org_account(
         %PostSubmission{organization_social_account: %Ecto.Association.NotLoaded{}} = post
       ) do
    case Social.get_post_submission(post.id) do
      nil -> {:error, :no_account}
      loaded_post -> get_org_account(loaded_post)
    end
  end

  defp get_org_account(%PostSubmission{organization_social_account: account}),
    do: {:ok, account}

  defp get_user_account(%UserPost{clipper_social_account: nil}), do: {:error, :no_account}

  defp get_user_account(%UserPost{clipper_social_account: %Ecto.Association.NotLoaded{}} = post) do
    case Campaigns.get_user_post(post.id) do
      nil -> {:error, :no_account}
      loaded_post -> get_user_account(loaded_post)
    end
  end

  defp get_user_account(%UserPost{clipper_social_account: account}), do: {:ok, account}

  defp ensure_post_for_me_account(account) do
    if post_for_me_account?(account), do: :ok, else: {:error, :unsupported_provider}
  end

  defp provider_account_id(%{provider_account_id: id}) when is_binary(id) and id != "",
    do: {:ok, id}

  defp provider_account_id(_), do: {:error, :missing_provider_account}

  defp provider_post_id(%{provider_post_id: id}) when is_binary(id) and id != "", do: {:ok, id}
  defp provider_post_id(%{post_id: id}) when is_binary(id) and id != "", do: {:ok, id}
  defp provider_post_id(_), do: {:error, :missing_post_id}
end
