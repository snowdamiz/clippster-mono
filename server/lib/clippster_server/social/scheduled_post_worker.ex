defmodule ClippsterServer.Social.ScheduledPostWorker do
  @moduledoc """
  GenServer worker that processes scheduled posts when their scheduled time arrives.

  Features:
  - Polls every minute for posts ready to publish
  - Acquires row locks to prevent duplicate processing
  - Implements retry logic with exponential backoff for transient failures
  - Distinguishes between transient (retryable) and permanent failures
  - Supports both org and user social accounts
  """

  use GenServer
  require Logger

  alias ClippsterServer.Social
  alias ClippsterServer.Social.{PostSubmission, SocialAccount, Platform}
  alias ClippsterServer.Social.Providers.PostForMe
  alias ClippsterServer.Campaigns
  alias ClippsterServer.Campaigns.ClipperSocialAccount

  @poll_interval :timer.minutes(1)
  @batch_size 20

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
  Triggers an immediate check for scheduled posts.
  """
  def process_now do
    GenServer.cast({:global, __MODULE__}, :process_now)
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
    interval = Keyword.get(opts, :interval, @poll_interval)

    # Schedule first check after app starts
    if Keyword.get(opts, :start_immediately, true) do
      Process.send_after(self(), :process, :timer.seconds(30))
    end

    state = %{
      interval: interval,
      last_run: nil,
      processing: false,
      stats: %{
        total_processed: 0,
        successful: 0,
        failed: 0,
        retried: 0
      }
    }

    Logger.info("[ScheduledPostWorker] Started with interval: #{div(interval, 60_000)} minutes")

    {:ok, state}
  end

  @impl true
  def handle_cast(:process_now, state) do
    if state.processing do
      Logger.info("[ScheduledPostWorker] Already processing, skipping")
      {:noreply, state}
    else
      send(self(), :process)
      {:noreply, state}
    end
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_info(:process, %{processing: true} = state) do
    {:noreply, state}
  end

  @impl true
  def handle_info(:process, state) do
    Logger.debug("[ScheduledPostWorker] Checking for scheduled posts")

    new_state = %{state | processing: true, last_run: DateTime.utc_now()}

    # Run processing in a task
    worker = self()

    Task.start(fn ->
      result = process_scheduled_posts()
      send(worker, {:process_complete, result})
    end)

    # Schedule next check
    Process.send_after(self(), :process, state.interval)

    {:noreply, new_state}
  end

  @impl true
  def handle_info({:process_complete, result}, state) do
    new_stats = %{
      total_processed: state.stats.total_processed + result.processed,
      successful: state.stats.successful + result.successful,
      failed: state.stats.failed + result.failed,
      retried: state.stats.retried + result.retried
    }

    if result.processed > 0 do
      Logger.info(
        "[ScheduledPostWorker] Processed #{result.processed} posts - " <>
          "success: #{result.successful}, failed: #{result.failed}, retried: #{result.retried}"
      )
    end

    {:noreply, %{state | processing: false, stats: new_stats}}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  # ============================================================================
  # Processing Logic
  # ============================================================================

  defp process_scheduled_posts do
    Appsignal.instrument("ScheduledPostWorker#process", fn ->
      now = DateTime.utc_now()

      # Recover any posts stuck in 'publishing' with stale locks (crashed worker)
      Social.recover_stale_publishing_posts()

      # Find posts that are scheduled and ready to publish
      posts = Social.get_scheduled_posts_ready_to_publish(now, @batch_size)

      Logger.debug("[ScheduledPostWorker] Found #{length(posts)} posts ready to publish")

      results =
        Enum.map(posts, fn post ->
          process_single_post(post)
        end)

      %{
        processed: length(results),
        successful: Enum.count(results, &(&1 == :ok)),
        failed: Enum.count(results, &(&1 == :failed)),
        retried: Enum.count(results, &(&1 == :retried))
      }
    end)
  end

  defp process_single_post(%PostSubmission{} = post) do
    # Skip posts whose media hasn't been uploaded to R2 yet (still a local file path)
    if post.media_url && String.starts_with?(post.media_url, "http") do
      # Try to lock the post
      case Social.lock_post_for_publishing(post) do
        {:ok, locked_post} ->
          publish_post(locked_post)

        {:error, :already_locked} ->
          Logger.debug("[ScheduledPostWorker] Post #{post.id} already locked, skipping")
          :skipped

        {:error, reason} ->
          Logger.warning(
            "[ScheduledPostWorker] Failed to lock post #{post.id}: #{inspect(reason)}"
          )

          :failed
      end
    else
      Logger.debug(
        "[ScheduledPostWorker] Post #{post.id} media not yet uploaded (#{post.media_url}), skipping until upload completes"
      )

      :skipped
    end
  end

  defp publish_post(%PostSubmission{} = post) do
    # Get the appropriate social account based on owner type
    account_result =
      case post.owner_type do
        "org" -> get_org_account(post)
        "user" -> get_user_account(post)
        _ -> {:error, :invalid_owner_type}
      end

    case account_result do
      {:ok, account, access_token} ->
        do_publish(post, account, access_token)

      {:error, reason} ->
        handle_publish_failure(post, "Account error: #{inspect(reason)}", :permanent)
    end
  end

  defp get_org_account(%PostSubmission{organization_social_account_id: account_id})
       when not is_nil(account_id) do
    case Social.get_social_account(account_id) do
      nil ->
        {:error, :account_not_found}

      account ->
        if account.is_active do
          # Check if token needs refresh and refresh if needed
          account = maybe_refresh_org_token(account)
          access_token = SocialAccount.get_access_token(account)
          {:ok, account, access_token}
        else
          {:error, :account_inactive}
        end
    end
  end

  defp get_org_account(_), do: {:error, :no_account_specified}

  defp get_user_account(%PostSubmission{user_social_account_id: account_id})
       when not is_nil(account_id) do
    case Campaigns.get_social_account(account_id) do
      nil ->
        {:error, :account_not_found}

      account ->
        if account.is_active do
          # Check if token needs refresh and refresh if needed
          account = maybe_refresh_user_token(account)
          access_token = ClipperSocialAccount.get_access_token(account)
          {:ok, account, access_token}
        else
          {:error, :account_inactive}
        end
    end
  end

  defp get_user_account(_), do: {:error, :no_account_specified}

  # Refresh org social account token if needed
  defp maybe_refresh_org_token(%SocialAccount{} = account) do
    if SocialAccount.token_needs_refresh?(account) do
      Logger.info("[ScheduledPostWorker] Token needs refresh for org account #{account.id}")

      refresh_token = SocialAccount.get_refresh_token(account)

      case Platform.call(account.platform, :refresh_tokens, [refresh_token]) do
        {:ok, new_tokens} ->
          expires_at =
            if new_tokens[:expires_in] do
              DateTime.utc_now()
              |> DateTime.add(new_tokens[:expires_in], :second)
              |> DateTime.truncate(:second)
            else
              nil
            end

          attrs = %{
            access_token: new_tokens[:access_token],
            token_expires_at: expires_at
          }

          attrs =
            if new_tokens[:refresh_token] do
              Map.put(attrs, :refresh_token, new_tokens[:refresh_token])
            else
              attrs
            end

          case Social.refresh_social_account_tokens(account, attrs) do
            {:ok, updated_account} ->
              Logger.info(
                "[ScheduledPostWorker] Successfully refreshed token for org account #{account.id}"
              )

              updated_account

            {:error, reason} ->
              Logger.warning(
                "[ScheduledPostWorker] Failed to save refreshed token: #{inspect(reason)}"
              )

              account
          end

        {:error, reason} ->
          Logger.warning("[ScheduledPostWorker] Failed to refresh org token: #{inspect(reason)}")
          account
      end
    else
      account
    end
  end

  # Refresh user/clipper social account token if needed
  defp maybe_refresh_user_token(%ClipperSocialAccount{} = account) do
    if ClipperSocialAccount.token_needs_refresh?(account) do
      Logger.info("[ScheduledPostWorker] Token needs refresh for user account #{account.id}")

      refresh_token = ClipperSocialAccount.get_refresh_token(account)

      case Platform.call(account.platform, :refresh_tokens, [refresh_token]) do
        {:ok, new_tokens} ->
          expires_at =
            if new_tokens[:expires_in] do
              DateTime.utc_now()
              |> DateTime.add(new_tokens[:expires_in], :second)
              |> DateTime.truncate(:second)
            else
              nil
            end

          attrs = %{
            access_token: new_tokens[:access_token],
            token_expires_at: expires_at
          }

          attrs =
            if new_tokens[:refresh_token] do
              Map.put(attrs, :refresh_token, new_tokens[:refresh_token])
            else
              attrs
            end

          case Campaigns.update_social_account_tokens(account, attrs) do
            {:ok, updated_account} ->
              Logger.info(
                "[ScheduledPostWorker] Successfully refreshed token for user account #{account.id}"
              )

              updated_account

            {:error, reason} ->
              Logger.warning(
                "[ScheduledPostWorker] Failed to save refreshed token: #{inspect(reason)}"
              )

              account
          end

        {:error, reason} ->
          Logger.warning("[ScheduledPostWorker] Failed to refresh user token: #{inspect(reason)}")
          account
      end
    else
      account
    end
  end

  # All platforms publish via PostForMe API
  defp do_publish(%PostSubmission{} = post, account, _access_token) do
    Logger.info(
      "[ScheduledPostWorker] Publishing post #{post.id} to #{post.platform} via PostForMe"
    )

    with {:ok, provider_account_id} <- get_provider_account_id(account),
         {:ok, media_url} <- ensure_accessible_media_url(post.media_url) do
      post_params = %{
        caption: post.caption || "",
        social_accounts: [provider_account_id],
        media: [%{url: media_url}],
        external_id: "scheduled:#{post.id}"
      }

      case PostForMe.create_social_post(post_params) do
        {:ok, pfm_post} ->
          # Try to fetch post_url and provider_post_id from feed
          {post_url, provider_post_id} =
            fetch_post_data_from_feed(provider_account_id, pfm_post.id)

          result = %{
            post_id: pfm_post.id || "pfm_#{post.id}",
            post_url: post_url,
            provider_post_id: provider_post_id
          }

          handle_publish_success(post, result)

        {:error, reason} ->
          error_type = classify_error(reason)
          handle_publish_failure(post, inspect(reason), error_type)
      end
    else
      {:error, :missing_provider_account_id} ->
        handle_publish_failure(post, "Account missing PostForMe provider_account_id", :permanent)

      {:error, reason} ->
        error_type = classify_error(reason)
        handle_publish_failure(post, inspect(reason), error_type)
    end
  end

  defp get_provider_account_id(%SocialAccount{provider_account_id: id})
       when is_binary(id) and id != "", do: {:ok, id}

  defp get_provider_account_id(%ClipperSocialAccount{provider_account_id: id})
       when is_binary(id) and id != "", do: {:ok, id}

  defp get_provider_account_id(_), do: {:error, :missing_provider_account_id}

  defp ensure_accessible_media_url(media_url) do
    # Generate presigned URL for R2 storage
    if String.contains?(media_url, ".r2.cloudflarestorage.com") do
      case ClippsterServer.Storage.presigned_url(media_url, expires_in: 7_200) do
        {:ok, url} -> {:ok, url}
        # Fallback to original
        {:error, _} -> {:ok, media_url}
      end
    else
      {:ok, media_url}
    end
  end

  defp handle_publish_success(%PostSubmission{} = post, result, content_hash \\ nil) do
    Logger.info("[ScheduledPostWorker] Successfully published post #{post.id}")

    Appsignal.increment_counter("worker.scheduled_post.published", 1, %{platform: post.platform})

    attrs = %{
      post_id: result.post_id,
      post_url: result.post_url,
      posted_at: DateTime.utc_now()
    }

    # Add provider_post_id if available
    attrs =
      if Map.has_key?(result, :provider_post_id) && result.provider_post_id do
        Map.put(attrs, :provider_post_id, result.provider_post_id)
      else
        attrs
      end

    attrs = if content_hash, do: Map.put(attrs, :content_hash, content_hash), else: attrs

    Social.mark_post_published(post, attrs)

    :ok
  end

  defp handle_publish_failure(%PostSubmission{} = post, error_message, error_type) do
    Logger.warning("[ScheduledPostWorker] Failed to publish post #{post.id}: #{error_message}")

    Appsignal.increment_counter("worker.scheduled_post.failed", 1, %{
      platform: post.platform,
      error_type: to_string(error_type)
    })

    case error_type do
      :transient ->
        # Increment attempt and unlock for retry
        Social.increment_post_attempt(post)

        if PostSubmission.should_retry?(post) do
          Social.unlock_post_for_retry(post)
          :retried
        else
          Social.mark_post_failed(post, "Max retries exceeded: #{error_message}")
          :failed
        end

      :permanent ->
        # Permanent failure - don't retry
        Social.mark_post_failed(post, error_message)
        :failed
    end
  end

  defp classify_error(reason) when is_binary(reason) do
    reason_lower = String.downcase(reason)

    cond do
      # Transient errors - retry
      String.contains?(reason_lower, "timeout") -> :transient
      String.contains?(reason_lower, "rate limit") -> :transient
      String.contains?(reason_lower, "429") -> :transient
      String.contains?(reason_lower, "500") -> :transient
      String.contains?(reason_lower, "502") -> :transient
      String.contains?(reason_lower, "503") -> :transient
      String.contains?(reason_lower, "504") -> :transient
      String.contains?(reason_lower, "temporarily") -> :transient
      String.contains?(reason_lower, "try again") -> :transient
      # Permanent errors - don't retry
      String.contains?(reason_lower, "invalid token") -> :permanent
      String.contains?(reason_lower, "expired") -> :permanent
      String.contains?(reason_lower, "permission") -> :permanent
      String.contains?(reason_lower, "unauthorized") -> :permanent
      String.contains?(reason_lower, "forbidden") -> :permanent
      String.contains?(reason_lower, "not found") -> :permanent
      String.contains?(reason_lower, "invalid") -> :permanent
      # Default to transient for unknown errors
      true -> :transient
    end
  end

  defp classify_error(_reason), do: :transient

  # Fetch post_url and provider_post_id after publishing via PostForMe
  defp fetch_post_data_from_feed(provider_account_id, pfm_post_id) do
    try do
      # First try social-post-results endpoint (most reliable)
      case PostForMe.list_social_post_results(%{"social_post_id" => pfm_post_id}) do
        {:ok, %{data: results}} when is_list(results) and results != [] ->
          result = List.first(results)
          platform_data = result.platform_data || %{}
          post_url = platform_data["platform_url"] || platform_data["url"]
          provider_post_id = platform_data["platform_post_id"] || platform_data["id"]

          if post_url || provider_post_id do
            Logger.info(
              "[ScheduledPostWorker] Found post data from results: url=#{post_url}, provider_id=#{provider_post_id}"
            )

            {post_url, provider_post_id}
          else
            fetch_from_feed_fallback(provider_account_id, pfm_post_id)
          end

        _ ->
          fetch_from_feed_fallback(provider_account_id, pfm_post_id)
      end
    rescue
      e ->
        Logger.warning(
          "[ScheduledPostWorker] Error fetching post data (non-fatal): #{inspect(e)}"
        )

        {nil, nil}
    end
  end

  # Fallback: search account feed for the most recent matching post
  defp fetch_from_feed_fallback(provider_account_id, pfm_post_id) do
    case PostForMe.get_social_account_feed(provider_account_id) do
      {:ok, %{data: feed_items}} when is_list(feed_items) ->
        # Feed items don't have social_post_id, so just grab the most recent post
        # (it was just published, so it should be first)
        case List.first(feed_items) do
          nil ->
            Logger.warning("[ScheduledPostWorker] Post #{pfm_post_id} not found in feed")
            {nil, nil}

          item when is_map(item) ->
            post_url = item["platform_url"]
            provider_post_id = item["platform_post_id"]

            Logger.info(
              "[ScheduledPostWorker] Using most recent feed item: url=#{post_url}, provider_id=#{provider_post_id}"
            )

            {post_url, provider_post_id}

          _ ->
            {nil, nil}
        end

      _ ->
        Logger.warning("[ScheduledPostWorker] Failed to fetch feed for #{provider_account_id}")
        {nil, nil}
    end
  end
end
