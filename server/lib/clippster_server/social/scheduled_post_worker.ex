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
  alias ClippsterServer.Social.{PostSubmission, SocialAccount, Platform, TwitterDuplicateDetector}
  alias ClippsterServer.Campaigns
  alias ClippsterServer.Campaigns.ClipperSocialAccount

  @poll_interval :timer.minutes(1)
  @batch_size 20

  # ============================================================================
  # Public API
  # ============================================================================

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Triggers an immediate check for scheduled posts.
  """
  def process_now do
    GenServer.cast(__MODULE__, :process_now)
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
    Task.start(fn ->
      result = process_scheduled_posts()
      send(__MODULE__, {:process_complete, result})
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
    now = DateTime.utc_now()

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
  end

  defp process_single_post(%PostSubmission{} = post) do
    # Try to lock the post
    case Social.lock_post_for_publishing(post) do
      {:ok, locked_post} ->
        publish_post(locked_post)

      {:error, :already_locked} ->
        Logger.debug("[ScheduledPostWorker] Post #{post.id} already locked, skipping")
        :skipped

      {:error, reason} ->
        Logger.warning("[ScheduledPostWorker] Failed to lock post #{post.id}: #{inspect(reason)}")
        :failed
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

      access_token = SocialAccount.get_access_token(account)

      case Platform.call(account.platform, :refresh_tokens, [access_token]) do
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

      access_token = ClipperSocialAccount.get_access_token(account)

      case Platform.call(account.platform, :refresh_tokens, [access_token]) do
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

  # X/Twitter-specific publish: two-step flow (upload media, then create tweet)
  defp do_publish(%PostSubmission{platform: platform} = post, account, access_token)
       when platform in ["twitter", "x"] do
    Logger.info("[ScheduledPostWorker] Publishing post #{post.id} to X (two-step flow)")

    # Check for duplicate content before publishing
    account_id = get_account_id(post)
    caption = post.caption || ""

    case TwitterDuplicateDetector.check_duplicate(account_id, caption, []) do
      {:ok, _content_hash} ->
        # No duplicate, proceed with publish
        publish_opts = %{
          filename: "video.mp4",
          ig_user_id: get_platform_user_id(account)
        }

        # Step 1: Upload media
        Logger.info("[ScheduledPostWorker] Twitter: uploading media for post #{post.id}")

        case Platform.call("twitter", :publish_media, [access_token, post.media_url, publish_opts]) do
          {:ok, %{media_id: media_id}} ->
            # Step 2: Create tweet with media_id
            Logger.info("[ScheduledPostWorker] Twitter: creating tweet with media_id #{media_id}")

            case Platform.call("twitter", :create_tweet, [
                   access_token,
                   caption,
                   [media_ids: [media_id]]
                 ]) do
              {:ok, result} ->
                # Store content hash with media_id for accurate future duplicate detection
                final_content_hash = TwitterDuplicateDetector.generate_hash(caption, [media_id])
                handle_publish_success(post, result, final_content_hash)

              {:error, reason} ->
                error_type = classify_error(reason)
                handle_publish_failure(post, inspect(reason), error_type)
            end

          {:error, reason} ->
            error_type = classify_error(reason)
            handle_publish_failure(post, inspect(reason), error_type)
        end

      {:error, :duplicate_content, existing_post} ->
        # Duplicate detected, fail permanently
        error_msg =
          "Duplicate content detected (matches post #{existing_post.id} from #{existing_post.inserted_at})"

        handle_publish_failure(post, error_msg, :permanent)
    end
  end

  # Default platform publish: single-step flow (Instagram and others)
  defp do_publish(%PostSubmission{} = post, account, access_token) do
    Logger.info("[ScheduledPostWorker] Publishing post #{post.id} to #{post.platform}")

    publish_opts = %{
      caption: post.caption || "",
      media_type: post.media_type || "reel",
      ig_user_id: get_platform_user_id(account)
    }

    case Platform.call(post.platform, :publish_media, [access_token, post.media_url, publish_opts]) do
      {:ok, result} ->
        handle_publish_success(post, result)

      {:error, reason} ->
        error_type = classify_error(reason)
        handle_publish_failure(post, inspect(reason), error_type)
    end
  end

  defp get_platform_user_id(%SocialAccount{platform_user_id: id}), do: id
  defp get_platform_user_id(%ClipperSocialAccount{platform_user_id: id}), do: id
  defp get_platform_user_id(_), do: nil

  defp get_account_id(%PostSubmission{} = post) do
    post.organization_social_account_id || post.user_social_account_id
  end

  defp handle_publish_success(%PostSubmission{} = post, result, content_hash \\ nil) do
    Logger.info("[ScheduledPostWorker] Successfully published post #{post.id}")

    attrs = %{
      post_id: result.post_id,
      post_url: result.post_url,
      posted_at: DateTime.utc_now()
    }

    attrs = if content_hash, do: Map.put(attrs, :content_hash, content_hash), else: attrs

    Social.mark_post_published(post, attrs)

    :ok
  end

  defp handle_publish_failure(%PostSubmission{} = post, error_message, error_type) do
    Logger.warning("[ScheduledPostWorker] Failed to publish post #{post.id}: #{error_message}")

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

  defp classify_error(_), do: :transient
end
