defmodule ClippsterServerWeb.SchedulingController do
  @moduledoc """
  Controller for managing scheduled social media posts.
  Handles scheduling, updating, canceling, and listing scheduled posts.
  """
  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.Social
  alias ClippsterServer.Social.PostSubmission
  alias ClippsterServer.Organizations

  plug ClippsterServerWeb.AuthPlug

  # ============================================================================
  # Schedule Post
  # ============================================================================

  @doc """
  Schedule a post for future publishing.
  POST /social/schedule

  Body:
  {
    "platform": "instagram",
    "media_url": "https://...",
    "caption": "Check out this clip!",
    "scheduled_at": "2024-01-15T14:00:00Z",
    "media_type": "reel",
    "clip_id": "optional-clip-id",

    // For org posts:
    "organization_id": 1,
    "social_account_id": 2,
    "creator_profile_id": 3,
    "campaign_id": 4,

    // For personal posts:
    "user_social_account_id": 5
  }
  """
  def schedule(conn, params) do
    user = conn.assigns.current_user

    # Free tier users cannot schedule posts
    if is_free_tier?(user) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Post scheduling requires a paid subscription"})
    else
      # Determine if this is an org or personal post
      owner_type = determine_owner_type(params)

      # Validate org membership and settings if org post
      with :ok <- validate_scheduling_request(params, user, owner_type),
           attrs <- build_scheduling_attrs(params, owner_type),
           {:ok, post} <- Social.schedule_post(attrs, user) do
        conn
        |> put_status(201)
        |> json(%{
          success: true,
          post: serialize_post(post),
          message: "Post scheduled successfully"
        })
      else
        {:error, :unauthorized} ->
          conn
          |> put_status(403)
          |> json(%{success: false, error: "You don't have permission to schedule this post"})

        {:error, :scheduling_disabled} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Scheduling is disabled for this organization"})

        {:error, :personal_accounts_disabled} ->
          conn
          |> put_status(400)
          |> json(%{
            success: false,
            error: "Personal Instagram accounts are not allowed for this organization"
          })

        {:error, %Ecto.Changeset{} = changeset} ->
          conn
          |> put_status(422)
          |> json(%{success: false, error: format_errors(changeset)})

        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: to_string(reason)})
      end
    end
  end

  # ============================================================================
  # Update Scheduled Post
  # ============================================================================

  @doc """
  Update a scheduled post (before it's locked for publishing).
  PUT /social/scheduled/:id

  Body:
  {
    "caption": "Updated caption",
    "scheduled_at": "2024-01-15T15:00:00Z",
    "social_account_id": 3
  }
  """
  def update(conn, %{"id" => post_id} = params) do
    user = conn.assigns.current_user

    case Social.get_post_submission(post_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Post not found"})

      post ->
        attrs =
          %{
            caption: params["caption"],
            scheduled_at: parse_datetime(params["scheduled_at"]),
            organization_social_account_id: params["social_account_id"],
            user_social_account_id: params["user_social_account_id"]
          }
          |> Enum.reject(fn {_, v} -> is_nil(v) end)
          |> Enum.into(%{})

        case Social.update_scheduled_post(post, attrs, user) do
          {:ok, updated} ->
            json(conn, %{success: true, post: serialize_post(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "You don't have permission to update this post"})

          {:error, %Ecto.Changeset{} = changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: to_string(reason)})
        end
    end
  end

  # ============================================================================
  # Cancel Scheduled Post
  # ============================================================================

  @doc """
  Cancel a scheduled post.
  POST /social/scheduled/:id/cancel
  """
  def cancel(conn, %{"id" => post_id}) do
    user = conn.assigns.current_user

    case Social.get_post_submission(post_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Post not found"})

      post ->
        case Social.cancel_scheduled_post(post, user) do
          {:ok, canceled} ->
            json(conn, %{success: true, post: serialize_post(canceled)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "You don't have permission to cancel this post"})

          {:error, %Ecto.Changeset{} = changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: to_string(reason)})
        end
    end
  end

  # ============================================================================
  # Retry Failed Post
  # ============================================================================

  @doc """
  Retry a failed scheduled post.
  POST /social/scheduled/:id/retry
  """
  def retry(conn, %{"id" => post_id}) do
    user = conn.assigns.current_user

    case Social.get_post_submission(post_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Post not found"})

      post ->
        if can_view_post?(post, user) do
          case Social.retry_failed_post(post, user) do
            {:ok, updated} ->
              json(conn, %{
                success: true,
                post: serialize_post(updated),
                message: "Post queued for retry"
              })

            {:error, :not_failed} ->
              conn
              |> put_status(400)
              |> json(%{success: false, error: "Only failed posts can be retried"})

            {:error, :max_retries_exceeded} ->
              conn
              |> put_status(400)
              |> json(%{success: false, error: "Maximum retry attempts exceeded"})

            {:error, reason} ->
              conn
              |> put_status(400)
              |> json(%{success: false, error: to_string(reason)})
          end
        else
          conn
          |> put_status(403)
          |> json(%{success: false, error: "You don't have permission to retry this post"})
        end
    end
  end

  # ============================================================================
  # List Scheduled Posts
  # ============================================================================

  @doc """
  List user's scheduled posts.
  GET /social/scheduled
  """
  def index(conn, params) do
    user = conn.assigns.current_user
    status = params["status"]

    posts = Social.get_user_scheduled_posts(user.id, status: status)

    json(conn, %{
      success: true,
      posts: Enum.map(posts, &serialize_post/1)
    })
  end

  @doc """
  Get a single scheduled post.
  GET /social/scheduled/:id
  """
  def show(conn, %{"id" => post_id}) do
    user = conn.assigns.current_user

    case Social.get_post_submission(post_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Post not found"})

      post ->
        # Verify user has access
        if can_view_post?(post, user) do
          json(conn, %{success: true, post: serialize_post(post)})
        else
          conn
          |> put_status(403)
          |> json(%{success: false, error: "You don't have permission to view this post"})
        end
    end
  end

  @doc """
  List scheduled posts for an organization (admin view).
  GET /organizations/:organization_id/scheduled-posts
  """
  def org_scheduled_posts(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      opts =
        [
          status: params["status"],
          limit: parse_int(params["limit"], 50),
          offset: parse_int(params["offset"], 0)
        ]
        |> Enum.reject(fn {_, v} -> is_nil(v) end)

      {:ok, %{posts: posts, total: total}} = Social.get_org_scheduled_posts(org_id, opts)

      json(conn, %{
        success: true,
        posts: Enum.map(posts, &serialize_post/1),
        total: total
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  # ============================================================================
  # External Post Submissions (Link Submissions)
  # ============================================================================

  @doc """
  Submit an external post link to an organization.
  POST /organizations/:organization_id/external-posts

  Body:
  {
    "platform": "instagram",
    "post_url": "https://www.instagram.com/reel/...",
    "caption": "My post caption",
    "media_type": "reel",
    "creator_profile_id": 1,
    "campaign_id": 2,
    "clip_id": "optional-clip-id",
    "view_count": 1000,
    "like_count": 50
  }
  """
  def submit_external_post(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    # For Instagram, require connected account
    with :ok <- validate_instagram_account_if_needed(params["platform"], user) do
      # Auto-fetch analytics via PostForMe for all supported platforms
      platform_analytics =
        fetch_analytics_for_external_post(params["platform"], params["post_url"], user)

      attrs = %{
        platform: params["platform"],
        post_url: params["post_url"],
        caption: params["caption"],
        media_type: params["media_type"],
        organization_creator_profile_id: params["creator_profile_id"],
        campaign_id: params["campaign_id"],
        clip_id: params["clip_id"],
        view_count: platform_analytics[:view_count] || params["view_count"],
        like_count: platform_analytics[:like_count] || params["like_count"],
        comment_count: platform_analytics[:comment_count] || params["comment_count"],
        share_count: params["share_count"],
        save_count: platform_analytics[:save_count] || params["save_count"],
        notes: params["notes"],
        # Author metadata from platform API
        author_username: platform_analytics[:author_username],
        author_name: platform_analytics[:author_name],
        author_profile_image: platform_analytics[:author_profile_image]
      }

      case Social.create_external_post_submission(org_id, attrs, user) do
        {:ok, submission} ->
          conn
          |> put_status(201)
          |> json(%{
            success: true,
            submission: serialize_external_post(submission),
            message: "Post submitted successfully"
          })

        {:error, :unauthorized} ->
          conn
          |> put_status(403)
          |> json(%{success: false, error: "You must be a member of this organization"})

        {:error, %Ecto.Changeset{} = changeset} ->
          conn
          |> put_status(422)
          |> json(%{success: false, error: format_errors(changeset)})

        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: to_string(reason)})
      end
    else
      {:error, :instagram_not_connected} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error:
            "You must connect your Instagram account before submitting Instagram links. Go to Settings > Social Accounts to connect."
        })
    end
  end

  @doc """
  List external post submissions for an organization.
  GET /organizations/:organization_id/external-posts
  """
  def list_external_posts(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      opts =
        [
          status: params["status"],
          creator_profile_id: params["creator_profile_id"],
          campaign_id: params["campaign_id"],
          limit: parse_int(params["limit"], 50),
          offset: parse_int(params["offset"], 0)
        ]
        |> Enum.reject(fn {_, v} -> is_nil(v) end)

      {:ok, %{posts: posts, total: total}} = Social.list_external_post_submissions(org_id, opts)

      json(conn, %{
        success: true,
        submissions: Enum.map(posts, &serialize_external_post/1),
        total: total
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Approve an external post submission.
  POST /organizations/:organization_id/external-posts/:id/approve
  """
  def approve_external_post(conn, %{"organization_id" => org_id, "id" => id}) do
    user = conn.assigns.current_user

    case Social.get_external_post_submission(org_id, id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Submission not found"})

      submission ->
        case Social.approve_external_post_submission(submission, user) do
          {:ok, updated} ->
            json(conn, %{success: true, submission: serialize_external_post(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Only admins can approve submissions"})

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: to_string(reason)})
        end
    end
  end

  @doc """
  Reject an external post submission.
  POST /organizations/:organization_id/external-posts/:id/reject
  """
  def reject_external_post(conn, %{"organization_id" => org_id, "id" => id} = params) do
    user = conn.assigns.current_user

    case Social.get_external_post_submission(org_id, id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Submission not found"})

      submission ->
        case Social.reject_external_post_submission(submission, user, params["notes"]) do
          {:ok, updated} ->
            json(conn, %{success: true, submission: serialize_external_post(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Only admins can reject submissions"})

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: to_string(reason)})
        end
    end
  end

  @doc """
  Submit a personal external post link (no org required).
  POST /user/external-posts

  Body:
  {
    "platform": "instagram",
    "post_url": "https://www.instagram.com/reel/...",
    "creator_profile_id": 1,
    "campaign_id": 2,
    "clip_id": "optional-clip-id"
  }
  """
  def submit_personal_external_post(conn, params) do
    user = conn.assigns.current_user

    with :ok <- validate_instagram_account_if_needed(params["platform"], user) do
      # Auto-fetch analytics via PostForMe for all supported platforms
      platform_analytics =
        fetch_analytics_for_external_post(params["platform"], params["post_url"], user)

      attrs = %{
        platform: params["platform"],
        post_url: params["post_url"],
        caption: params["caption"],
        media_type: params["media_type"],
        organization_creator_profile_id: params["creator_profile_id"],
        campaign_id: params["campaign_id"],
        clip_id: params["clip_id"],
        view_count: platform_analytics[:view_count] || params["view_count"],
        like_count: platform_analytics[:like_count] || params["like_count"],
        comment_count: platform_analytics[:comment_count] || params["comment_count"],
        share_count: params["share_count"],
        save_count: platform_analytics[:save_count] || params["save_count"],
        notes: params["notes"],
        author_username: platform_analytics[:author_username],
        author_name: platform_analytics[:author_name],
        author_profile_image: platform_analytics[:author_profile_image]
      }

      case Social.create_personal_external_post_submission(attrs, user) do
        {:ok, submission} ->
          conn
          |> put_status(201)
          |> json(%{
            success: true,
            submission: serialize_external_post(submission),
            message: "Post submitted successfully"
          })

        {:error, %Ecto.Changeset{} = changeset} ->
          conn
          |> put_status(422)
          |> json(%{success: false, error: format_errors(changeset)})

        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: to_string(reason)})
      end
    else
      {:error, :instagram_not_connected} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "You must connect your Instagram account before submitting Instagram links."
        })
    end
  end

  @doc """
  List personal external post submissions for the current user.
  GET /user/external-posts
  """
  def list_personal_external_posts(conn, params) do
    user = conn.assigns.current_user

    opts =
      [
        status: params["status"],
        creator_profile_id: params["creator_profile_id"],
        limit: parse_int(params["limit"], 50),
        offset: parse_int(params["offset"], 0)
      ]
      |> Enum.reject(fn {_, v} -> is_nil(v) end)

    {:ok, %{posts: posts, total: total}} =
      Social.list_personal_external_post_submissions(user.id, opts)

    json(conn, %{
      success: true,
      submissions: Enum.map(posts, &serialize_external_post/1),
      total: total
    })
  end

  @doc """
  Sync analytics for all posts in an organization (on-demand).
  POST /organizations/:organization_id/sync-analytics
  """
  def sync_org_analytics(conn, %{"organization_id" => org_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      Logger.info("[sync_org_analytics] Endpoint called for org #{org_id}")
      
      # Run sync synchronously for debugging
      try do
        sync_org_posts_analytics(org_id)
        sync_org_external_posts_analytics(org_id)
        Logger.info("[sync_org_analytics] Sync completed successfully")
      rescue
        e ->
          Logger.error("[sync_org_analytics] Sync failed with error: #{inspect(e)}")
          Logger.error("[sync_org_analytics] Stacktrace: #{inspect(__STACKTRACE__)}")
      end

      json(conn, %{success: true, message: "Analytics sync started"})
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  defp sync_org_posts_analytics(org_id) do
    # All platforms use PostForMe feed API for analytics
    Logger.info("[sync_org_posts_analytics] Starting sync for org #{org_id}")
    
    case Social.list_post_submissions(org_id, status: "published", limit: 500) do
      {:ok, %{posts: posts}} ->
        Logger.info("[sync_org_posts_analytics] Found #{length(posts)} published posts")
        
        # Log post details for debugging
        for post <- posts do
          Logger.debug("[sync_org_posts_analytics] Post #{post.id}: platform=#{post.platform}, post_url=#{inspect(post.post_url)}, has_account=#{post.organization_social_account != nil}")
        end
        
        # Group posts by social account to minimize API calls (one feed fetch per account)
        filtered_posts = posts
          |> Enum.filter(fn post ->
            has_account = post.organization_social_account != nil
            has_provider_id = has_account && is_binary(post.organization_social_account.provider_account_id)
            has_post_url = is_binary(post.post_url) && post.post_url != ""
            is_supported = post.platform in ["instagram", "x", "twitter", "tiktok", "youtube"]
            
            if not has_account do
              Logger.warning("[sync_org_posts_analytics] Post #{post.id} (#{post.platform}) has no organization_social_account")
            end
            if has_account and not has_provider_id do
              Logger.warning("[sync_org_posts_analytics] Post #{post.id} (#{post.platform}) account has no provider_account_id")
            end
            if not has_post_url do
              Logger.warning("[sync_org_posts_analytics] Post #{post.id} (#{post.platform}) has no post_url - cannot sync analytics")
            end
            if not is_supported do
              Logger.debug("[sync_org_posts_analytics] Post #{post.id} platform #{post.platform} not supported")
            end
            
            has_account && has_provider_id && has_post_url && is_supported
          end)
        
        Logger.info("[sync_org_posts_analytics] #{length(filtered_posts)} posts after filtering (need account + provider_id + supported platform)")
        
        posts_by_account = Enum.group_by(filtered_posts, fn post -> post.organization_social_account.id end)

        for {_account_id, account_posts} <- posts_by_account do
          account = hd(account_posts).organization_social_account
          platform = hd(account_posts).platform
          
          Logger.info("[sync_org_posts_analytics] Processing #{length(account_posts)} #{platform} posts for account #{account.provider_account_id}")

          # Fetch feed once per account
          case fetch_post_for_me_feed(account.provider_account_id) do
            {:ok, feed_items} ->
              Logger.info("[sync_org_posts_analytics] Fetched #{length(feed_items)} feed items from PostForMe")
              for post <- account_posts do
                case extract_post_identifier(post.platform, post.post_url) do
                  {:ok, post_identifier} ->
                    Logger.debug("[sync_org_posts_analytics] Post #{post.id}: extracted identifier #{post_identifier} from #{post.post_url}")
                    
                    case match_feed_item(post.platform, feed_items, post_identifier) do
                      nil -> 
                        Logger.warning("[sync_org_posts_analytics] Post #{post.id}: identifier #{post_identifier} NOT FOUND in feed")
                        :ok
                      item ->
                        Logger.info("[sync_org_posts_analytics] Post #{post.id}: MATCHED feed item")
                        analytics = extract_feed_analytics(post.platform, item, account)
                        Logger.info("[sync_org_posts_analytics] Post #{post.id}: extracted analytics: #{inspect(analytics)}")
                        
                        # Only sync if at least one metric is non-zero to avoid overwriting real data with zeros
                        metric_keys = [:view_count, :like_count, :comment_count, :save_count, :reach_count, :impressions_count, :share_count]
                        has_real_data = Enum.any?(metric_keys, fn k -> (Map.get(analytics, k) || 0) > 0 end)
                        
                        if has_real_data do
                          case Social.sync_post_analytics(post, analytics) do
                            {:ok, _} -> Logger.info("[sync_org_posts_analytics] Post #{post.id}: analytics synced successfully")
                            {:error, reason} -> Logger.error("[sync_org_posts_analytics] Post #{post.id}: sync failed: #{inspect(reason)}")
                          end
                        else
                          Logger.debug("[sync_org_posts_analytics] Post #{post.id}: skipping sync - all metrics are zero")
                        end
                    end

                  {:error, reason} -> 
                    Logger.warning("[sync_org_posts_analytics] Post #{post.id}: failed to extract identifier from #{post.post_url}: #{inspect(reason)}")
                    :ok
                end
              end

            {:error, reason} -> 
              Logger.error("[sync_org_posts_analytics] Failed to fetch PostForMe feed for account #{account.provider_account_id}: #{inspect(reason)}")
              :ok
          end
        end
    end
  end

  defp sync_org_external_posts_analytics(org_id) do
    # All platforms use PostForMe feed API for analytics
    Logger.info("[sync_org_external_posts_analytics] Starting sync for org #{org_id}")
    
    case Social.list_external_post_submissions(org_id, limit: 500) do
      {:ok, %{posts: posts}} ->
        Logger.info("[sync_org_external_posts_analytics] Found #{length(posts)} external posts")
        
        # Log post details for debugging
        for post <- posts do
          Logger.debug("[sync_org_external_posts_analytics] External post #{post.id}: platform=#{post.platform}, post_url=#{inspect(post.post_url)}, has_user=#{post.submitted_by_user_id != nil}")
        end
        
        # Filter to supported platforms with a submitting user and post_url
        supported_posts =
          Enum.filter(posts, fn sub ->
            has_user = sub.submitted_by_user_id != nil
            has_post_url = is_binary(sub.post_url) && sub.post_url != ""
            is_supported = sub.platform in ["instagram", "x", "twitter", "tiktok", "youtube"]
            
            if not has_user do
              Logger.warning("[sync_org_external_posts_analytics] External post #{sub.id} (#{sub.platform}) has no submitted_by_user_id")
            end
            if not has_post_url do
              Logger.warning("[sync_org_external_posts_analytics] External post #{sub.id} (#{sub.platform}) has no post_url - cannot sync analytics")
            end
            if not is_supported do
              Logger.debug("[sync_org_external_posts_analytics] External post #{sub.id} platform #{sub.platform} not supported")
            end
            
            has_user && has_post_url && is_supported
          end)
        
        Logger.info("[sync_org_external_posts_analytics] #{length(supported_posts)} external posts after filtering")

        # Group by user to minimize user account lookups
        posts_by_user = Enum.group_by(supported_posts, & &1.submitted_by_user_id)

        for {user_id, user_posts} <- posts_by_user do
          Logger.info("[sync_org_external_posts_analytics] Processing #{length(user_posts)} posts for user #{user_id}")
          
          case ClippsterServer.Campaigns.list_user_social_accounts(user_id) do
            accounts when is_list(accounts) ->
              Logger.debug("[sync_org_external_posts_analytics] User #{user_id} has #{length(accounts)} social accounts")
              # Group user's posts by platform
              posts_by_platform = Enum.group_by(user_posts, & &1.platform)

              for {platform, platform_posts} <- posts_by_platform do
                # Normalize platform for account lookup (x/twitter -> same account)
                lookup_platform = if platform == "twitter", do: "x", else: platform
                Logger.info("[sync_org_external_posts_analytics] Processing #{length(platform_posts)} #{platform} posts")

                account =
                  Enum.find(accounts, fn acc ->
                    normalized = if acc.platform == "twitter", do: "x", else: acc.platform
                    normalized == lookup_platform and acc.is_active and
                      is_binary(acc.provider_account_id)
                  end)

                if account do
                  Logger.info("[sync_org_external_posts_analytics] Found #{platform} account with provider_account_id: #{account.provider_account_id}")
                  case fetch_post_for_me_feed(account.provider_account_id) do
                    {:ok, feed_items} ->
                      Logger.info("[sync_org_external_posts_analytics] Fetched #{length(feed_items)} feed items from PostForMe")
                      
                      # Log first feed item structure to understand PostForMe's format
                      if length(feed_items) > 0 do
                        first_item = hd(feed_items)
                        Logger.debug("[sync_org_external_posts_analytics] First feed item structure: #{inspect(first_item)}")
                        Logger.debug("[sync_org_external_posts_analytics] First feed item keys: #{inspect(Map.keys(first_item))}")
                      end
                      
                      for sub <- platform_posts do
                        case extract_post_identifier(sub.platform, sub.post_url) do
                          {:ok, post_identifier} ->
                            Logger.debug("[sync_org_external_posts_analytics] External post #{sub.id}: extracted identifier #{post_identifier} from #{sub.post_url}")
                            
                            case match_feed_item(sub.platform, feed_items, post_identifier) do
                              nil -> 
                                Logger.warning("[sync_org_external_posts_analytics] External post #{sub.id}: identifier #{post_identifier} NOT FOUND in feed")
                                :ok
                              item ->
                                Logger.info("[sync_org_external_posts_analytics] External post #{sub.id}: MATCHED feed item")
                                analytics = extract_feed_analytics(sub.platform, item, account)
                                Logger.info("[sync_org_external_posts_analytics] External post #{sub.id}: extracted analytics: #{inspect(analytics)}")
                                
                                # Only sync if at least one metric is non-zero to avoid overwriting real data with zeros
                                metric_keys = [:view_count, :like_count, :comment_count, :save_count, :reach_count, :impressions_count, :share_count]
                                has_real_data = Enum.any?(metric_keys, fn k -> (Map.get(analytics, k) || 0) > 0 end)
                                
                                if has_real_data do
                                  case Social.sync_external_post_analytics(sub, analytics) do
                                    {:ok, _} -> Logger.info("[sync_org_external_posts_analytics] External post #{sub.id}: analytics synced successfully")
                                    {:error, reason} -> Logger.error("[sync_org_external_posts_analytics] External post #{sub.id}: sync failed: #{inspect(reason)}")
                                  end
                                else
                                  Logger.debug("[sync_org_external_posts_analytics] External post #{sub.id}: skipping sync - all metrics are zero")
                                end
                            end

                          {:error, reason} -> 
                            Logger.warning("[sync_org_external_posts_analytics] External post #{sub.id}: failed to extract identifier from #{sub.post_url}: #{inspect(reason)}")
                            :ok
                        end
                      end

                    {:error, reason} -> 
                      Logger.error("[sync_org_external_posts_analytics] Failed to fetch PostForMe feed for account #{account.provider_account_id}: #{inspect(reason)}")
                      :ok
                  end
                else
                  Logger.warning("[sync_org_external_posts_analytics] No active #{platform} account found for user #{user_id} with provider_account_id")
                end
              end

            _ -> 
              Logger.warning("[sync_org_external_posts_analytics] Failed to list social accounts for user #{user_id}")
              :ok
          end
        end
    end
  end

  # ============================================================================
  # Private Functions — Unified PostForMe Analytics
  # ============================================================================

  @doc false
  # Fetch analytics for an external post being submitted by a user.
  # Looks up user's connected social accounts to find a PostForMe account for the platform.
  defp fetch_analytics_for_external_post(platform, post_url, user)
       when is_binary(platform) and is_binary(post_url) do
    alias ClippsterServer.Campaigns

    unless platform in ["instagram", "x", "twitter", "tiktok", "youtube"] do
      %{}
    else
      case extract_post_identifier(platform, post_url) do
        {:ok, post_identifier} ->
          lookup_platform = if platform == "twitter", do: "x", else: platform

          case Campaigns.list_user_social_accounts(user.id) do
            accounts when is_list(accounts) ->
              account =
                Enum.find(accounts, fn acc ->
                  normalized = if acc.platform == "twitter", do: "x", else: acc.platform
                  normalized == lookup_platform and acc.is_active and
                    is_binary(acc.provider_account_id)
                end)

              if account do
                case fetch_post_for_me_feed(account.provider_account_id) do
                  {:ok, feed_items} ->
                    case match_feed_item(platform, feed_items, post_identifier) do
                      nil ->
                        Logger.info(
                          "[SchedulingController] Post #{post_identifier} not found in PostForMe #{platform} feed, using author metadata only"
                        )

                        author_metadata(account)

                      item ->
                        extract_feed_analytics(platform, item, account)
                    end

                  {:error, reason} ->
                    Logger.warning(
                      "[SchedulingController] Failed to fetch PostForMe feed for #{platform}: #{inspect(reason)}"
                    )

                    author_metadata(account)
                end
              else
                Logger.info(
                  "[SchedulingController] User has no connected #{platform} account, skipping analytics fetch"
                )

                %{}
              end

            _ ->
              %{}
          end

        {:error, _} ->
          Logger.warning(
            "[SchedulingController] Could not extract post ID from #{platform} URL: #{post_url}"
          )

          %{}
      end
    end
  end

  defp fetch_analytics_for_external_post(_platform, _post_url, _user), do: %{}

  defp validate_instagram_account_if_needed("instagram", user) do
    case ClippsterServer.Campaigns.list_user_social_accounts(user.id) do
      accounts when is_list(accounts) ->
        instagram_account =
          Enum.find(accounts, fn acc -> acc.platform == "instagram" and acc.is_active end)

        if instagram_account do
          :ok
        else
          {:error, :instagram_not_connected}
        end

      _ ->
        {:error, :instagram_not_connected}
    end
  end

  defp validate_instagram_account_if_needed(_platform, _user), do: :ok

  # Fetch feed from PostForMe API for a given provider account
  defp fetch_post_for_me_feed(provider_account_id) do
    alias ClippsterServer.Social.Providers.PostForMe

    case PostForMe.get_social_account_feed(provider_account_id, %{limit: 50, expand: ["metrics"]}) do
      {:ok, %{data: feed_items}} when is_list(feed_items) ->
        {:ok, feed_items}

      {:ok, %{"data" => feed_items}} when is_list(feed_items) ->
        {:ok, feed_items}

      {:ok, feed_items} when is_list(feed_items) ->
        {:ok, feed_items}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Extract a platform-specific identifier from a post URL
  # Instagram: shortcode from /p/ABC123/ or /reel/ABC123/
  # X/Twitter: tweet ID from /status/1234567890
  # TikTok: video ID from /video/1234567890
  # YouTube: video ID from /shorts/ABC123 or watch?v=ABC123
  defp extract_post_identifier("instagram", url) when is_binary(url) do
    case Regex.run(~r{instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)}, url) do
      [_, shortcode] -> {:ok, shortcode}
      _ -> {:error, :invalid_url}
    end
  end

  defp extract_post_identifier(platform, url)
       when platform in ["x", "twitter"] and is_binary(url) do
    case Regex.run(~r{(?:twitter\.com|x\.com)/.+/status/(\d+)}, url) do
      [_, tweet_id] -> {:ok, tweet_id}
      _ -> {:error, :invalid_url}
    end
  end

  defp extract_post_identifier("tiktok", url) when is_binary(url) do
    case Regex.run(~r{tiktok\.com/.+/video/(\d+)}, url) do
      [_, video_id] -> {:ok, video_id}
      _ ->
        # Also handle short URLs like vm.tiktok.com/...
        case Regex.run(~r{tiktok\.com/(?:t/)?([A-Za-z0-9]+)}, url) do
          [_, short_id] -> {:ok, short_id}
          _ -> {:error, :invalid_url}
        end
    end
  end

  defp extract_post_identifier("youtube", url) when is_binary(url) do
    cond do
      # youtube.com/shorts/VIDEO_ID
      match = Regex.run(~r{youtube\.com/shorts/([A-Za-z0-9_-]+)}, url) ->
        {:ok, Enum.at(match, 1)}

      # youtube.com/watch?v=VIDEO_ID
      match = Regex.run(~r{youtube\.com/watch\?v=([A-Za-z0-9_-]+)}, url) ->
        {:ok, Enum.at(match, 1)}

      # youtu.be/VIDEO_ID
      match = Regex.run(~r{youtu\.be/([A-Za-z0-9_-]+)}, url) ->
        {:ok, Enum.at(match, 1)}

      true ->
        {:error, :invalid_url}
    end
  end

  defp extract_post_identifier(_platform, _url), do: {:error, :unsupported_platform}

  # Match a feed item from PostForMe against a post identifier, per platform
  defp match_feed_item("instagram", feed_items, shortcode) do
    Enum.find(feed_items, fn item ->
      item_shortcode =
        item["shortcode"] || item["code"] ||
          extract_shortcode_from_url(item["permalink"]) ||
          extract_shortcode_from_url(item["platform_url"])

      item_shortcode == shortcode
    end)
  end

  defp match_feed_item(platform, feed_items, post_id) when platform in ["x", "twitter"] do
    Enum.find(feed_items, fn item ->
      item_id = item["id"] || item["id_str"] || item["platform_post_id"] || extract_id_from_url(item["url"] || item["platform_url"])
      to_string(item_id) == to_string(post_id)
    end)
  end

  defp match_feed_item("tiktok", feed_items, video_id) do
    result = Enum.find(feed_items, fn item ->
      item_id = item["id"] || item["video_id"] || extract_id_from_url(item["share_url"] || item["url"])
      to_string(item_id) == to_string(video_id)
    end)

    if result do
      Logger.info("[PostForMe] TikTok feed item structure: #{inspect(result, pretty: true)}")
    end

    result
  end

  defp match_feed_item("youtube", feed_items, video_id) do
    result = Enum.find(feed_items, fn item ->
      item_id = item["id"] || item["video_id"] || extract_youtube_id_from_url(item["url"])
      to_string(item_id) == to_string(video_id)
    end)

    if result do
      Logger.info("[PostForMe] YouTube feed item structure: #{inspect(result, pretty: true)}")
    end

    result
  end

  defp match_feed_item(_platform, _feed_items, _id), do: nil

  # Extract analytics from a PostForMe feed item, per platform
  # Metrics are in item["metrics"] when expand=metrics is passed to the feed API
  defp extract_feed_analytics("instagram", item, account) do
    m = item["metrics"] || %{}

    %{
      view_count: m["views"] || 0,
      like_count: m["likes"] || 0,
      comment_count: m["comments"] || 0,
      save_count: m["saved"] || 0,
      reach_count: m["reach"] || 0,
      share_count: m["shares"] || 0,
      author_username: account.username,
      author_name: account.display_name,
      author_profile_image: account.profile_image_url
    }
  end

  defp extract_feed_analytics(platform, item, account) when platform in ["x", "twitter"] do
    m = item["metrics"] || %{}
    pm = m["public_metrics"] || %{}

    %{
      view_count: pm["impression_count"] || 0,
      like_count: pm["like_count"] || 0,
      comment_count: pm["reply_count"] || 0,
      share_count: pm["retweet_count"] || 0,
      impressions_count: pm["impression_count"] || 0,
      author_username: account.username,
      author_name: account.display_name,
      author_profile_image: account.profile_image_url
    }
  end

  defp extract_feed_analytics("tiktok", item, account) do
    m = item["metrics"] || %{}

    # TikTok consumer: like_count, comment_count, share_count, view_count
    # TikTok Business: likes, comments, shares, favorites, reach, video_views
    %{
      view_count: m["view_count"] || m["video_views"] || 0,
      like_count: m["like_count"] || m["likes"] || 0,
      comment_count: m["comment_count"] || m["comments"] || 0,
      share_count: m["share_count"] || m["shares"] || 0,
      save_count: m["favorites"] || 0,
      reach_count: m["reach"] || 0,
      author_username: account.username,
      author_name: account.display_name,
      author_profile_image: account.profile_image_url
    }
  end

  defp extract_feed_analytics("youtube", item, account) do
    m = item["metrics"] || %{}

    %{
      view_count: m["views"] || 0,
      like_count: m["likes"] || 0,
      comment_count: m["comments"] || 0,
      author_username: account.username,
      author_name: account.display_name,
      author_profile_image: account.profile_image_url
    }
  end

  defp extract_feed_analytics("facebook", item, account) do
    m = item["metrics"] || %{}

    %{
      view_count: m["video_views"] || m["media_views"] || 0,
      like_count: m["reactions_total"] || m["reactions_like"] || 0,
      comment_count: m["comments"] || 0,
      share_count: m["shares"] || 0,
      reach_count: m["reach"] || 0,
      author_username: account.username,
      author_name: account.display_name,
      author_profile_image: account.profile_image_url
    }
  end

  defp extract_feed_analytics(_platform, _item, _account), do: %{}

  # Return author metadata only (no analytics numbers)
  defp author_metadata(account) do
    %{
      author_username: account.username,
      author_name: account.display_name,
      author_profile_image: account.profile_image_url
    }
  end

  # URL parsing helpers
  defp extract_shortcode_from_url(nil), do: nil

  defp extract_shortcode_from_url(url) when is_binary(url) do
    case Regex.run(~r{/(?:p|reel|tv)/([A-Za-z0-9_-]+)}, url) do
      [_, code] -> code
      _ -> nil
    end
  end

  defp extract_id_from_url(nil), do: nil

  defp extract_id_from_url(url) when is_binary(url) do
    case Regex.run(~r{/(\d+)/?(?:\?|$)}, url) do
      [_, id] -> id
      _ ->
        case Regex.run(~r{/status/(\d+)}, url) do
          [_, id] -> id
          _ -> nil
        end
    end
  end

  defp extract_youtube_id_from_url(nil), do: nil

  defp extract_youtube_id_from_url(url) when is_binary(url) do
    cond do
      match = Regex.run(~r{youtube\.com/shorts/([A-Za-z0-9_-]+)}, url) -> Enum.at(match, 1)
      match = Regex.run(~r{youtube\.com/watch\?v=([A-Za-z0-9_-]+)}, url) -> Enum.at(match, 1)
      match = Regex.run(~r{youtu\.be/([A-Za-z0-9_-]+)}, url) -> Enum.at(match, 1)
      true -> nil
    end
  end

  defp determine_owner_type(params) do
    cond do
      params["organization_id"] && params["social_account_id"] -> "org"
      params["user_social_account_id"] -> "user"
      true -> "user"
    end
  end

  defp validate_scheduling_request(params, user, "org") do
    org_id = params["organization_id"]

    with true <- Organizations.is_member?(org_id, user.id) || {:error, :unauthorized},
         {:ok, org} <- get_organization(org_id),
         true <- org.scheduling_enabled || {:error, :scheduling_disabled},
         :ok <- validate_account_type(params, org, user) do
      :ok
    end
  end

  defp validate_scheduling_request(_params, _user, "user"), do: :ok

  defp validate_account_type(params, org, user) do
    # If using personal account for org post, check if allowed
    if params["user_social_account_id"] && !org.allow_personal_instagram do
      {:error, :personal_accounts_disabled}
    else
      # Verify user has access to the social account
      if params["social_account_id"] do
        if Social.has_account_access?(org.id, params["social_account_id"], user.id) do
          :ok
        else
          {:error, :unauthorized}
        end
      else
        :ok
      end
    end
  end

  defp get_organization(org_id) do
    case Organizations.get_organization(org_id) do
      nil -> {:error, :organization_not_found}
      org -> {:ok, org}
    end
  end

  defp build_scheduling_attrs(params, "org") do
    %{
      platform: params["platform"],
      media_url: params["media_url"],
      caption: params["caption"],
      media_type: params["media_type"],
      scheduled_at: parse_datetime(params["scheduled_at"]),
      clip_id: params["clip_id"],
      owner_type: "org",
      organization_id: params["organization_id"],
      organization_social_account_id: params["social_account_id"],
      organization_creator_profile_id: params["creator_profile_id"],
      campaign_id: params["campaign_id"]
    }
  end

  defp build_scheduling_attrs(params, "user") do
    %{
      platform: params["platform"],
      media_url: params["media_url"],
      caption: params["caption"],
      media_type: params["media_type"],
      scheduled_at: parse_datetime(params["scheduled_at"]),
      clip_id: params["clip_id"],
      owner_type: "user",
      user_social_account_id: params["user_social_account_id"]
    }
  end

  defp can_view_post?(%PostSubmission{} = post, user) do
    cond do
      post.submitted_by_user_id == user.id -> true
      post.organization_id && Organizations.is_member?(post.organization_id, user.id) -> true
      true -> false
    end
  end

  defp serialize_post(post) do
    %{
      id: post.id,
      platform: post.platform,
      status: post.status,
      caption: post.caption,
      media_url: post.media_url,
      thumbnail_url: post.thumbnail_url,
      media_type: post.media_type,
      owner_type: post.owner_type,
      clip_id: post.clip_id,
      scheduled_at: post.scheduled_at,
      posted_at: post.posted_at,
      post_id: post.post_id,
      post_url: post.post_url,
      error_message: post.error_message,
      attempts: post.attempts,
      max_attempts: post.max_attempts,
      can_edit: PostSubmission.can_edit?(post),
      can_cancel: PostSubmission.can_cancel?(post),
      analytics: %{
        view_count: post.view_count,
        like_count: post.like_count,
        comment_count: post.comment_count,
        save_count: post.save_count,
        reach_count: post.reach_count,
        impressions_count: post.impressions_count
      },
      social_account:
        serialize_social_account(post.organization_social_account || post.user_social_account),
      creator_profile: serialize_creator_profile(post.organization_creator_profile),
      organization: serialize_organization(post.organization),
      submitted_by: serialize_user(post.submitted_by_user),
      campaign: serialize_campaign(post.campaign),
      inserted_at: post.inserted_at,
      updated_at: post.updated_at
    }
  end

  defp serialize_social_account(nil), do: nil
  defp serialize_social_account(%Ecto.Association.NotLoaded{}), do: nil

  defp serialize_social_account(account) do
    %{
      id: account.id,
      platform: account.platform,
      username: account.username,
      display_name: Map.get(account, :display_name),
      profile_image_url: Map.get(account, :profile_image_url)
    }
  end

  defp serialize_external_post(submission) do
    %{
      id: submission.id,
      platform: submission.platform,
      post_url: submission.post_url,
      post_id: submission.post_id,
      caption: submission.caption,
      media_type: submission.media_type,
      clip_id: submission.clip_id,
      status: submission.status,
      notes: submission.notes,
      reviewed_at: submission.reviewed_at,
      analytics: %{
        view_count: submission.view_count,
        like_count: submission.like_count,
        comment_count: submission.comment_count,
        share_count: submission.share_count,
        save_count: submission.save_count
      },
      # Author metadata from platform API
      author_username: submission.author_username,
      author_name: submission.author_name,
      author_profile_image: submission.author_profile_image,
      submitted_by: serialize_user(submission.submitted_by_user),
      reviewed_by: serialize_user(submission.reviewed_by_user),
      creator_profile: serialize_creator_profile(submission.organization_creator_profile),
      campaign: serialize_campaign(submission.campaign),
      inserted_at: submission.inserted_at,
      updated_at: submission.updated_at
    }
  end

  defp serialize_user(nil), do: nil
  defp serialize_user(%Ecto.Association.NotLoaded{}), do: nil

  defp serialize_user(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url
    }
  end

  defp serialize_organization(nil), do: nil
  defp serialize_organization(%Ecto.Association.NotLoaded{}), do: nil

  defp serialize_organization(org) do
    %{
      id: org.id,
      name: org.name,
      logo_url: org.logo_url
    }
  end

  defp serialize_creator_profile(nil), do: nil
  defp serialize_creator_profile(%Ecto.Association.NotLoaded{}), do: nil

  defp serialize_creator_profile(profile) do
    %{
      id: profile.id,
      name: profile.name,
      profile_image_url: profile.profile_image_url
    }
  end

  defp serialize_campaign(nil), do: nil
  defp serialize_campaign(%Ecto.Association.NotLoaded{}), do: nil

  defp serialize_campaign(campaign) do
    %{
      id: campaign.id,
      name: campaign.name
    }
  end

  defp parse_datetime(nil), do: nil

  defp parse_datetime(datetime_string) when is_binary(datetime_string) do
    case DateTime.from_iso8601(datetime_string) do
      {:ok, datetime, _offset} -> DateTime.truncate(datetime, :second)
      _ -> nil
    end
  end

  defp parse_datetime(%DateTime{} = datetime), do: datetime

  defp parse_int(nil, default), do: default
  defp parse_int(value, _default) when is_integer(value), do: value

  defp parse_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {int, _} -> int
      :error -> default
    end
  end

  defp format_errors(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end

  defp is_free_tier?(user) do
    if user.is_admin, do: false, else: user.subscription_status in [nil, "none", "expired"]
  end
end
