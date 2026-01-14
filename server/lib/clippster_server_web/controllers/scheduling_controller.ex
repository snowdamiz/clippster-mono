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

  # PulseKit helper for safe event capture
  defp pulse_capture(event) do
    if Code.ensure_loaded?(PulseKit) do
      try do
        PulseKit.capture(event)
      rescue
        _ -> :ok
      end
    end
  end

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

    # Determine if this is an org or personal post
    owner_type = determine_owner_type(params)

    # Validate org membership and settings if org post
    with :ok <- validate_scheduling_request(params, user, owner_type),
         attrs <- build_scheduling_attrs(params, owner_type),
         {:ok, post} <- Social.schedule_post(attrs, user) do

      pulse_capture(%{
        type: "post.scheduled",
        level: :info,
        message: "Post scheduled for #{post.scheduled_at}",
        metadata: %{
          post_id: post.id,
          platform: post.platform,
          owner_type: owner_type,
          scheduled_at: post.scheduled_at,
          user_id: user.id
        },
        tags: %{platform: post.platform, action: "scheduled"}
      })

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
        |> json(%{success: false, error: "Personal Instagram accounts are not allowed for this organization"})

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
        attrs = %{
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
            pulse_capture(%{
              type: "post.canceled",
              level: :info,
              message: "Scheduled post canceled",
              metadata: %{
                post_id: canceled.id,
                platform: canceled.platform,
                user_id: user.id
              },
              tags: %{platform: canceled.platform, action: "canceled"}
            })

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
              pulse_capture(%{
                type: "post.retry",
                level: :info,
                message: "Failed post queued for retry",
                metadata: %{
                  post_id: updated.id,
                  platform: updated.platform,
                  user_id: user.id
                },
                tags: %{platform: updated.platform, action: "retry"}
              })

              json(conn, %{success: true, post: serialize_post(updated), message: "Post queued for retry"})

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
      opts = [
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

    # Auto-fetch Twitter analytics if it's a Twitter post
    twitter_analytics = fetch_twitter_analytics_if_applicable(params["platform"], params["post_url"])

    attrs = %{
      platform: params["platform"],
      post_url: params["post_url"],
      caption: params["caption"],
      media_type: params["media_type"],
      organization_creator_profile_id: params["creator_profile_id"],
      campaign_id: params["campaign_id"],
      clip_id: params["clip_id"],
      view_count: twitter_analytics[:view_count] || params["view_count"],
      like_count: twitter_analytics[:like_count] || params["like_count"],
      comment_count: twitter_analytics[:comment_count] || params["comment_count"],
      share_count: params["share_count"],
      save_count: params["save_count"],
      notes: params["notes"],
      # Author metadata from Twitter API
      author_username: twitter_analytics[:author_username],
      author_name: twitter_analytics[:author_name],
      author_profile_image: twitter_analytics[:author_profile_image]
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
  end

  @doc """
  List external post submissions for an organization.
  GET /organizations/:organization_id/external-posts
  """
  def list_external_posts(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      opts = [
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

  # ============================================================================
  # Private Functions
  # ============================================================================

  defp fetch_twitter_analytics_if_applicable("twitter", post_url) when is_binary(post_url) do
    alias ClippsterServer.Social.Platforms.Twitter

    case Twitter.extract_tweet_id(post_url) do
      {:ok, tweet_id} ->
        case Twitter.get_tweet_analytics(tweet_id) do
          {:ok, analytics} ->
            Logger.info("[SchedulingController] Fetched Twitter analytics for tweet #{tweet_id}: #{analytics.view_count} views, author: @#{analytics.author_username}")
            %{
              view_count: analytics.view_count,
              like_count: analytics.like_count,
              comment_count: analytics.comment_count,
              author_username: analytics.author_username,
              author_name: analytics.author_name,
              author_profile_image: analytics.author_profile_image
            }

          {:error, reason} ->
            Logger.warning("[SchedulingController] Failed to fetch Twitter analytics: #{inspect(reason)}")
            %{}
        end

      {:error, _} ->
        Logger.warning("[SchedulingController] Could not extract tweet ID from URL: #{post_url}")
        %{}
    end
  end

  defp fetch_twitter_analytics_if_applicable(_platform, _post_url), do: %{}

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
      social_account: serialize_social_account(post.organization_social_account || post.user_social_account),
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
end
