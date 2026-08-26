defmodule ClippsterServer.Social.UserPostsAnalyticsSync do
  @moduledoc """
  Syncs user post analytics from Post For Me social account feeds (expand=metrics).
  """

  require Logger

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Repo
  alias ClippsterServer.Social
  alias ClippsterServer.Social.PostForMeFeedAnalytics
  alias ClippsterServer.Social.AnalyticsMerge
  alias ClippsterServer.Social.PostSubmission

  @supported_platforms ["instagram", "x", "twitter", "tiktok", "youtube", "facebook"]

  @doc """
  Syncs analytics for all published user posts belonging to a user.
  """
  def sync_for_user(user_id) when is_integer(user_id) do
    Logger.info("[UserPostsAnalyticsSync] Starting sync for user #{user_id}")

    posts = Campaigns.list_user_posts(user_id)
    posts_with_urls = backfill_missing_post_urls(posts, user_id)

    syncable_posts =
      Enum.filter(posts_with_urls, fn post ->
        syncable_post?(post)
      end)

    Logger.info(
      "[UserPostsAnalyticsSync] #{length(syncable_posts)} of #{length(posts)} posts are syncable"
    )

    case Campaigns.list_user_social_accounts(user_id) do
      accounts when is_list(accounts) ->
        accounts_by_id = Map.new(accounts, &{&1.id, &1})

        syncable_posts
        |> Enum.group_by(& &1.clipper_social_account_id)
        |> Enum.each(fn {account_id, account_posts} ->
          account = account_for_posts(account_id, account_posts, accounts_by_id, accounts)

          if account do
            platform = List.first(account_posts).platform

            sync_platform_posts(account_posts, platform, account)
          else
            Logger.warning(
              "[UserPostsAnalyticsSync] No social account found for posts (account_id=#{inspect(account_id)})"
            )
          end
        end)

        sync_user_post_submissions(user_id)

      _ ->
        Logger.warning("[UserPostsAnalyticsSync] User #{user_id} has no social accounts")
    end

    :ok
  end

  @doc """
  Syncs analytics for users who have published posts in a date range.
  Used before live leaderboard calculations.
  """
  def sync_for_period(period_start, period_end) do
    import Ecto.Query

    start_dt = DateTime.new!(period_start, ~T[00:00:00], "Etc/UTC")
    end_dt = DateTime.new!(period_end, ~T[23:59:59], "Etc/UTC")

    user_ids_from_posts =
      ClippsterServer.Campaigns.UserPost
      |> where([p], p.status == "published")
      |> where([p], not is_nil(p.posted_at))
      |> where([p], p.posted_at >= ^start_dt and p.posted_at <= ^end_dt)
      |> select([p], p.user_id)
      |> distinct(true)
      |> ClippsterServer.Repo.all()

    user_ids_from_submissions =
      ClippsterServer.Social.PostSubmission
      |> where([p], p.status == "published")
      |> where([p], p.posted_at >= ^start_dt and p.posted_at <= ^end_dt)
      |> where([p], not is_nil(p.submitted_by_user_id))
      |> select([p], p.submitted_by_user_id)
      |> distinct(true)
      |> ClippsterServer.Repo.all()

    (user_ids_from_posts ++ user_ids_from_submissions)
    |> Enum.uniq()
    |> Enum.each(&sync_for_user/1)

    :ok
  end

  defp syncable_post?(post) do
    has_identifier =
      (is_binary(post.post_url) && post.post_url != "") ||
        (is_binary(post.provider_post_id) && post.provider_post_id != "") ||
        (is_binary(post.post_id) && post.post_id != "")

    is_supported = post.platform in @supported_platforms
    is_published = post.status == "published"

    if not has_identifier do
      Logger.warning(
        "[UserPostsAnalyticsSync] Post #{post.id} (#{post.platform}) has no post_url, provider_post_id, or post_id"
      )
    end

    has_identifier && is_supported && is_published
  end

  defp sync_platform_posts(posts, platform, account) do
    case PostForMeFeedAnalytics.fetch_feed(account.provider_account_id) do
      {:ok, feed_items} ->
        Logger.info(
          "[UserPostsAnalyticsSync] Processing #{length(posts)} #{platform} posts (#{length(feed_items)} feed items)"
        )

        Enum.each(posts, fn post ->
          post = resolve_post_metadata(post, account)
          sync_single_post(post, platform, feed_items)
        end)

      {:error, reason} ->
        Logger.error(
          "[UserPostsAnalyticsSync] Failed to fetch PostForMe feed for account #{account.provider_account_id}: #{inspect(reason)}"
        )
    end
  end

  defp resolve_post_metadata(%{status: "failed"} = post, _account), do: post

  defp resolve_post_metadata(post, account) do
    if is_binary(post.post_id) && post.post_id != "" &&
         is_binary(account.provider_account_id) do
      case PostForMeFeedAnalytics.resolve_publish_metadata(
             account.provider_account_id,
             post.post_id
           ) do
        {:error, {:publish_failed, error}} ->
          Logger.warning(
            "[UserPostsAnalyticsSync] Post #{post.id} publish failed on platform: #{error}"
          )

          mark_post_failed(post, error)

        {:ok, metadata} ->
          attrs =
            %{}
            |> maybe_put_attr(:post_url, metadata.post_url)
            |> maybe_put_attr(:provider_post_id, metadata.provider_post_id)

          if map_size(attrs) > 0 do
            case Campaigns.update_user_post(post, attrs) do
              {:ok, updated} -> updated
              {:error, _} -> Map.merge(post, attrs)
            end
          else
            post
          end

        {:error, :not_found} ->
          post

        {:error, reason} ->
          Logger.debug(
            "[UserPostsAnalyticsSync] Could not resolve publish metadata for post #{post.id}: #{inspect(reason)}"
          )

          post
      end
    else
      post
    end
  end

  defp maybe_put_attr(attrs, _key, nil), do: attrs
  defp maybe_put_attr(attrs, _key, ""), do: attrs

  defp maybe_put_attr(attrs, key, value), do: Map.put(attrs, key, value)

  defp mark_post_failed(post, error) do
    case Campaigns.mark_user_post_failed(post, error) do
      {:ok, updated} -> updated
      {:error, _} -> struct(post, status: "failed")
    end
  end

  defp sync_single_post(%{status: "failed"}, _platform, _feed_items), do: :ok

  defp sync_single_post(post, platform, feed_items) do
    case PostForMeFeedAnalytics.match_post_in_feed(platform, feed_items, post) do
      nil ->
        Logger.warning("[UserPostsAnalyticsSync] Post #{post.id} not found in feed")

      item ->
        analytics = PostForMeFeedAnalytics.extract_analytics(platform, item)

        Logger.info(
          "[UserPostsAnalyticsSync] Post #{post.id}: extracted analytics #{inspect(analytics)}"
        )

        maybe_backfill_post_url(post, item)

        if has_real_metrics?(analytics) do
          case Campaigns.update_user_post_analytics(post, analytics) do
            {:ok, updated_post} ->
              maybe_update_campaign_submission(updated_post)

            {:error, reason} ->
              Logger.error(
                "[UserPostsAnalyticsSync] Post #{post.id}: sync failed: #{inspect(reason)}"
              )
          end
        else
          Logger.debug(
            "[UserPostsAnalyticsSync] Post #{post.id}: skipping sync - all metrics are zero"
          )
        end
    end
  end

  defp has_real_metrics?(analytics), do: AnalyticsMerge.has_real_metrics?(analytics)

  defp maybe_backfill_post_url(post, item) do
    if (is_nil(post.post_url) || post.post_url == "") && is_binary(item["platform_url"]) do
      Campaigns.update_user_post(post, %{post_url: item["platform_url"]})
    else
      :ok
    end
  end

  defp maybe_update_campaign_submission(%{campaign_id: campaign_id, post_url: post_url} = post)
       when not is_nil(campaign_id) and is_binary(post_url) do
    case ClippsterServer.Repo.get_by(
           ClippsterServer.Campaigns.CampaignSubmission,
           campaign_id: campaign_id,
           platform_post_id: post.post_id
         ) do
      nil ->
        :ok

      campaign_submission ->
        Campaigns.update_submission_metadata(campaign_submission, %{clip_url: post_url})
    end
  end

  defp maybe_update_campaign_submission(_post), do: :ok

  defp backfill_missing_post_urls(posts, user_id) do
    posts_needing_urls =
      Enum.filter(posts, fn post ->
        is_nil(post.post_url) || post.post_url == ""
      end)

    if posts_needing_urls == [] do
      posts
    else
      Logger.info(
        "[UserPostsAnalyticsSync] Backfilling post_url for #{length(posts_needing_urls)} posts"
      )

      case Campaigns.list_user_social_accounts(user_id) do
        accounts when is_list(accounts) ->
          accounts_by_id = Map.new(accounts, &{&1.id, &1})

          posts_needing_urls
          |> Enum.group_by(& &1.clipper_social_account_id)
          |> Enum.flat_map(fn {account_id, account_posts} ->
            account = account_for_posts(account_id, account_posts, accounts_by_id, accounts)

            if account do
              platform = List.first(account_posts).platform
              backfill_posts_for_account(account_posts, platform, account)
            else
              Enum.map(account_posts, fn post -> {post.id, post} end)
            end
          end)
          |> Map.new()
          |> then(fn backfilled_by_id ->
            Enum.map(posts, fn post ->
              Map.get(backfilled_by_id, post.id, post)
            end)
          end)

        _ ->
          posts
      end
    end
  end

  defp backfill_posts_for_account(platform_posts, platform, account) do
    case PostForMeFeedAnalytics.fetch_feed(account.provider_account_id) do
      {:ok, feed_items} ->
        Enum.map(platform_posts, fn post ->
          case PostForMeFeedAnalytics.match_post_in_feed(platform, feed_items, post) do
            nil ->
              {post.id, post}

            item ->
              update_attrs = build_backfill_attrs(post, item)
              {post.id, maybe_persist_backfill(post, update_attrs)}
          end
        end)

      _ ->
        Enum.map(platform_posts, fn post -> {post.id, post} end)
    end
  end

  defp build_backfill_attrs(post, item) do
    attrs = %{}

    attrs =
      if is_nil(post.post_url) || post.post_url == "",
        do: maybe_put(attrs, :post_url, item["platform_url"]),
        else: attrs

    attrs =
      if is_nil(post.provider_post_id) || post.provider_post_id == "",
        do: maybe_put(attrs, :provider_post_id, item["platform_post_id"]),
        else: attrs

    attrs
  end

  defp maybe_persist_backfill(post, attrs) when map_size(attrs) == 0, do: post

  defp maybe_persist_backfill(post, attrs) do
    case Campaigns.update_user_post(post, attrs) do
      {:ok, updated_post} -> updated_post
      {:error, _} -> post
    end
  end

  defp maybe_put(attrs, _key, nil), do: attrs
  defp maybe_put(attrs, _key, ""), do: attrs
  defp maybe_put(attrs, key, value), do: Map.put(attrs, key, value)

  defp normalize_platform("twitter"), do: "x"
  defp normalize_platform(platform), do: platform

  defp account_for_posts(account_id, posts, accounts_by_id, accounts)
       when is_integer(account_id) do
    case Map.get(accounts_by_id, account_id) do
      %{provider: "post_for_me", provider_account_id: id, is_active: true} = account
      when is_binary(id) ->
        account

      _ ->
        fallback_account_by_platform(posts, accounts)
    end
  end

  defp account_for_posts(_account_id, posts, _accounts_by_id, accounts) do
    fallback_account_by_platform(posts, accounts)
  end

  defp fallback_account_by_platform(posts, accounts) do
    platform = posts |> List.first() |> Map.get(:platform) |> normalize_platform()

    Enum.find(accounts, fn acc ->
      normalize_platform(acc.platform) == platform && acc.is_active &&
        acc.provider == "post_for_me" && is_binary(acc.provider_account_id)
    end)
  end

  defp sync_user_post_submissions(user_id) do
    import Ecto.Query

    PostSubmission
    |> where([p], p.submitted_by_user_id == ^user_id)
    |> where([p], p.status == "published")
    |> preload(:organization_social_account)
    |> Repo.all()
    |> Enum.each(&sync_post_submission/1)
  end

  defp sync_post_submission(%PostSubmission{organization_social_account: nil}), do: :ok

  defp sync_post_submission(%PostSubmission{organization_social_account: %{provider: provider}})
       when provider != "post_for_me",
       do: :ok

  defp sync_post_submission(%PostSubmission{organization_social_account: account} = submission) do
    provider_account_id = account.provider_account_id

    if is_binary(provider_account_id) && provider_account_id != "" do
      with {:ok, feed_items} <- PostForMeFeedAnalytics.fetch_feed(provider_account_id),
           item when not is_nil(item) <-
             PostForMeFeedAnalytics.match_post_in_feed(submission.platform, feed_items, %{
               provider_post_id: submission.provider_post_id,
               post_id: submission.provider_post_id,
               post_url: submission.post_url
             }),
           analytics <- PostForMeFeedAnalytics.extract_analytics(submission.platform, item),
           true <- has_real_metrics?(analytics),
           {:ok, _} <- Social.sync_post_analytics(submission, analytics) do
        :ok
      else
        false -> :ok
        _ -> :ok
      end
    else
      :ok
    end
  end
end
