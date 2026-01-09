defmodule ClippsterServerWeb.PostSubmissionController do
  @moduledoc """
  Controller for managing post submissions.
  Handles publishing to social platforms and analytics management.
  """
  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.Social
  alias ClippsterServer.Social.{SocialAccount, Platform}
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
  # Post Submissions CRUD
  # ============================================================================

  @doc """
  List all post submissions for an organization.
  GET /organizations/:organization_id/posts
  Supports filtering by creator_profile_id, account_id, platform, status.
  """
  def index(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      opts = [
        creator_profile_id: params["creator_profile_id"],
        account_id: params["account_id"],
        platform: params["platform"],
        status: params["status"],
        submitted_by_user_id: params["submitted_by_user_id"],
        limit: parse_int(params["limit"], 50),
        offset: parse_int(params["offset"], 0)
      ]
      |> Enum.reject(fn {_, v} -> is_nil(v) end)

      {:ok, %{posts: posts, total: total}} = Social.list_post_submissions(org_id, opts)

      json(conn, %{
        success: true,
        posts: Enum.map(posts, &serialize_post/1),
        total: total,
        limit: Keyword.get(opts, :limit, 50),
        offset: Keyword.get(opts, :offset, 0)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Get a single post submission.
  GET /organizations/:organization_id/posts/:id
  """
  def show(conn, %{"organization_id" => org_id, "id" => post_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      case Social.get_post_submission(org_id, post_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Post not found"})

        post ->
          json(conn, %{
            success: true,
            post: serialize_post(post)
          })
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Publish a clip to a social platform.
  POST /organizations/:organization_id/posts/publish

  Body:
  {
    "social_account_id": 1,
    "creator_profile_id": 2,
    "media_url": "https://...",
    "caption": "Check out this clip!",
    "media_type": "video"  // optional, auto-detected if not provided
  }
  """
  def publish(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user
    account_id = params["social_account_id"]

    # Verify user has access to this account
    unless Social.has_account_access?(org_id, account_id, user.id) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "You don't have access to this social account"})
    else
      # Get the social account
      case Social.get_social_account(org_id, account_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Social account not found"})

        account ->
          unless account.is_active do
            conn
            |> put_status(400)
            |> json(%{success: false, error: "Social account is not active"})
          else
            # Create the post submission record first
            submission_attrs = %{
              organization_social_account_id: account.id,
              organization_creator_profile_id: params["creator_profile_id"],
              platform: account.platform,
              media_type: params["media_type"],
              caption: params["caption"],
              media_url: params["media_url"],
              thumbnail_url: params["thumbnail_url"]
            }

            case Social.create_post_submission(org_id, submission_attrs, user) do
              {:ok, submission} ->
                # PulseKit: Log submission created
                pulse_capture(%{
                  type: "post.submission.created",
                  level: :info,
                  message: "Post submission created: #{submission.id}",
                  metadata: %{
                    submission_id: submission.id,
                    organization_id: org_id,
                    account_id: account.id,
                    platform: account.platform,
                    media_url: params["media_url"],
                    media_type: params["media_type"],
                    user_id: user.id
                  },
                  tags: %{platform: account.platform, action: "submission_created"}
                })

                # Attempt to publish asynchronously
                Task.start(fn ->
                  publish_to_platform(submission, account, params)
                end)

                conn
                |> put_status(202)
                |> json(%{
                  success: true,
                  post: serialize_post(submission),
                  message: "Post is being published"
                })

              {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
                pulse_capture(%{
                  type: "post.submission.error",
                  level: :error,
                  message: "Failed to create post submission: validation error",
                  metadata: %{
                    organization_id: org_id,
                    account_id: account.id,
                    platform: account.platform,
                    error: format_errors(changeset)
                  },
                  tags: %{platform: account.platform, action: "submission_error"}
                })
                conn
                |> put_status(422)
                |> json(%{success: false, error: format_errors(changeset)})

              {:error, reason} ->
                pulse_capture(%{
                  type: "post.submission.error",
                  level: :error,
                  message: "Failed to create post submission: #{inspect(reason)}",
                  metadata: %{
                    organization_id: org_id,
                    account_id: account.id,
                    platform: account.platform,
                    error: to_string(reason)
                  },
                  tags: %{platform: account.platform, action: "submission_error"}
                })
                conn
                |> put_status(400)
                |> json(%{success: false, error: to_string(reason)})
            end
          end
      end
    end
  end

  @doc """
  Update a post's analytics manually.
  PUT /organizations/:organization_id/posts/:id
  Admin only.
  """
  def update(conn, %{"organization_id" => org_id, "id" => post_id} = params) do
    user = conn.assigns.current_user

    case Social.get_post_submission(org_id, post_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Post not found"})

      post ->
        analytics = %{
          view_count: params["view_count"],
          like_count: params["like_count"],
          comment_count: params["comment_count"],
          save_count: params["save_count"],
          reach_count: params["reach_count"],
          impressions_count: params["impressions_count"]
        }
        |> Enum.reject(fn {_, v} -> is_nil(v) end)
        |> Enum.into(%{})

        case Social.update_post_analytics_manual(post, analytics, user) do
          {:ok, updated} ->
            json(conn, %{success: true, post: serialize_post(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Only admins can manually update analytics"})

          {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
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

  @doc """
  Trigger analytics sync for a specific post.
  POST /organizations/:organization_id/posts/:id/sync
  """
  def sync_analytics(conn, %{"organization_id" => org_id, "id" => post_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      case Social.get_post_submission(org_id, post_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Post not found"})

        post ->
          ClippsterServer.Social.AnalyticsSyncWorker.sync_post(post.id)
          json(conn, %{success: true, message: "Analytics sync initiated"})
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Reset manual override on a post to allow auto-sync.
  POST /organizations/:organization_id/posts/:id/reset-override
  Admin only.
  """
  def reset_override(conn, %{"organization_id" => org_id, "id" => post_id}) do
    user = conn.assigns.current_user

    case Social.get_post_submission(org_id, post_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Post not found"})

      post ->
        case Social.reset_analytics_override(post, user) do
          {:ok, updated} ->
            json(conn, %{success: true, post: serialize_post(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Only admins can reset override"})

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: to_string(reason)})
        end
    end
  end

  @doc """
  Get analytics summary for an organization.
  GET /organizations/:organization_id/posts/analytics
  """
  def analytics_summary(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      opts = [
        creator_profile_id: params["creator_profile_id"],
        days: parse_int(params["days"], 30)
      ]
      |> Enum.reject(fn {_, v} -> is_nil(v) end)

      summary = Social.get_analytics_summary(org_id, opts)

      json(conn, %{
        success: true,
        summary: %{
          total_posts: summary.total_posts || 0,
          total_views: summary.total_views || 0,
          total_likes: summary.total_likes || 0,
          total_comments: summary.total_comments || 0,
          total_saves: summary.total_saves || 0,
          total_reach: summary.total_reach || 0,
          total_impressions: summary.total_impressions || 0
        }
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Upload media for a post submission.
  POST /organizations/:organization_id/posts/upload-media

  Accepts multipart form data with:
  - file: The video/image file
  - thumbnail: Optional thumbnail file

  Returns the uploaded media URL(s) for use with publish.
  """
  def upload_media(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      case params do
        %{"file" => %Plug.Upload{} = upload} ->
          # Generate unique key for the file
          ext = Path.extname(upload.filename) |> String.downcase()
          timestamp = DateTime.utc_now() |> DateTime.to_unix()
          unique_id = :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
          key = "social-media/#{org_id}/#{timestamp}_#{unique_id}#{ext}"

          # Determine content type
          content_type = case ext do
            ".mp4" -> "video/mp4"
            ".mov" -> "video/quicktime"
            ".webm" -> "video/webm"
            ".jpg" -> "image/jpeg"
            ".jpeg" -> "image/jpeg"
            ".png" -> "image/png"
            ".gif" -> "image/gif"
            _ -> "application/octet-stream"
          end

          case ClippsterServer.Storage.upload_file_from_path(upload.path, key, content_type: content_type) do
            {:ok, url} ->
              # Handle optional thumbnail upload
              thumbnail_url = case params["thumbnail"] do
                %Plug.Upload{} = thumb ->
                  thumb_ext = Path.extname(thumb.filename) |> String.downcase()
                  thumb_key = "social-media/#{org_id}/#{timestamp}_#{unique_id}_thumb#{thumb_ext}"
                  thumb_content_type = case thumb_ext do
                    ".jpg" -> "image/jpeg"
                    ".jpeg" -> "image/jpeg"
                    ".png" -> "image/png"
                    _ -> "image/jpeg"
                  end

                  case ClippsterServer.Storage.upload_file_from_path(thumb.path, thumb_key, content_type: thumb_content_type) do
                    {:ok, thumb_url} -> thumb_url
                    {:error, _} -> nil
                  end
                _ -> nil
              end

              json(conn, %{
                success: true,
                media_url: url,
                thumbnail_url: thumbnail_url
              })

            {:error, reason} ->
              conn
              |> put_status(500)
              |> json(%{success: false, error: "Failed to upload media: #{inspect(reason)}"})
          end

        _ ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "No file provided"})
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  # ============================================================================
  # Private Functions
  # ============================================================================

  defp publish_to_platform(submission, account, params) do
    Logger.info("[PostSubmission] Starting publish for submission #{submission.id} to #{account.platform}")
    Logger.info("[PostSubmission] Media URL: #{params["media_url"]}")
    Logger.info("[PostSubmission] Platform User ID: #{account.platform_user_id}")

    # PulseKit: Log async task start
    pulse_capture(%{
      type: "post.publish.task_start",
      level: :info,
      message: "Async publish task started for submission #{submission.id}",
      metadata: %{
        submission_id: submission.id,
        account_id: account.id,
        platform: account.platform,
        platform_user_id: account.platform_user_id,
        media_url: params["media_url"],
        media_type: params["media_type"]
      },
      tags: %{platform: account.platform, action: "task_start"}
    })

    access_token = SocialAccount.get_access_token(account)

    if is_nil(access_token) or access_token == "" do
      Logger.error("[PostSubmission] No access token found for account #{account.id}")
      pulse_capture(%{
        type: "post.publish.error",
        level: :error,
        message: "No access token available for account #{account.id}",
        metadata: %{
          submission_id: submission.id,
          account_id: account.id,
          platform: account.platform,
          error: "no_access_token"
        },
        tags: %{platform: account.platform, action: "publish_error", error_type: "no_token"}
      })
      Social.mark_post_failed(submission, "No access token available")
    else
      Logger.info("[PostSubmission] Access token available (length: #{String.length(access_token)})")

      publish_opts = %{
        caption: params["caption"] || "",
        media_type: params["media_type"],
        ig_user_id: account.platform_user_id
      }

      Logger.info("[PostSubmission] Publishing with opts: #{inspect(publish_opts)}")

      pulse_capture(%{
        type: "post.publish.platform_call",
        level: :info,
        message: "Calling platform publish_media for #{account.platform}",
        metadata: %{
          submission_id: submission.id,
          platform: account.platform,
          media_type: params["media_type"],
          has_caption: params["caption"] != nil && params["caption"] != ""
        },
        tags: %{platform: account.platform, action: "platform_call"}
      })

      case Platform.call(account.platform, :publish_media, [access_token, params["media_url"], publish_opts]) do
        {:ok, result} ->
          Logger.info("[PostSubmission] Publish successful! Post ID: #{result.post_id}")
          pulse_capture(%{
            type: "post.publish.success",
            level: :info,
            message: "Successfully published submission #{submission.id}",
            metadata: %{
              submission_id: submission.id,
              platform: account.platform,
              post_id: result.post_id,
              post_url: result.post_url
            },
            tags: %{platform: account.platform, action: "publish_success"}
          })
          # Update submission with post details
          Social.mark_post_published(submission, %{
            post_id: result.post_id,
            post_url: result.post_url,
            posted_at: DateTime.utc_now()
          })

        {:error, reason} ->
          error_msg = if is_binary(reason), do: reason, else: inspect(reason)
          Logger.error("[PostSubmission] Publish failed: #{error_msg}")
          pulse_capture(%{
            type: "post.publish.failed",
            level: :error,
            message: "Failed to publish submission #{submission.id}: #{error_msg}",
            metadata: %{
              submission_id: submission.id,
              account_id: account.id,
              platform: account.platform,
              platform_user_id: account.platform_user_id,
              media_url: params["media_url"],
              media_type: params["media_type"],
              error: error_msg,
              error_raw: inspect(reason)
            },
            tags: %{platform: account.platform, action: "publish_failed"}
          })
          Social.mark_post_failed(submission, error_msg)
      end
    end
  end

  defp serialize_post(post) do
    %{
      id: post.id,
      organization_id: post.organization_id,
      platform: post.platform,
      post_id: post.post_id,
      post_url: post.post_url,
      media_type: post.media_type,
      caption: post.caption,
      media_url: post.media_url,
      thumbnail_url: post.thumbnail_url,
      status: post.status,
      error_message: post.error_message,
      posted_at: post.posted_at,
      last_synced_at: post.last_synced_at,
      manual_override: post.manual_override,
      analytics: %{
        view_count: post.view_count,
        like_count: post.like_count,
        comment_count: post.comment_count,
        save_count: post.save_count,
        reach_count: post.reach_count,
        impressions_count: post.impressions_count
      },
      social_account: serialize_social_account(post.organization_social_account),
      creator_profile: serialize_creator_profile(post.organization_creator_profile),
      submitted_by: serialize_user(post.submitted_by_user),
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
      display_name: account.display_name,
      profile_image_url: account.profile_image_url
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
