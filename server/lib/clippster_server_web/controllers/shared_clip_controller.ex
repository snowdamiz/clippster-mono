defmodule ClippsterServerWeb.SharedClipController do
  @moduledoc """
  Controller for organization shared clips.
  Handles upload, listing, and member actions (view, download, post).
  """
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Organizations
  alias ClippsterServer.Storage

  plug ClippsterServerWeb.AuthPlug

  # ============================================================================
  # Admin Endpoints
  # ============================================================================

  @doc """
  Upload and share a new clip with organization members.
  POST /organizations/:organization_id/shared-clips
  """
  def create(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    cond do
      not Organizations.is_admin?(org_id, user.id) ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can share clips"})

      not Storage.configured?() ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Storage service not configured"})

      is_nil(params["file"]) ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "No file provided"})

      true ->
        %Plug.Upload{path: temp_path, filename: filename, content_type: content_type} = params["file"]

        case File.read(temp_path) do
          {:ok, file_binary} ->
            name = params["name"] || filename

            # Build attributes
            attrs = %{
              name: name,
              description: params["description"],
              duration: parse_decimal(params["duration"]),
              share_with_all: parse_boolean(params["share_with_all"], true),
              branding_config: parse_json(params["branding_config"], %{}),
              branding_required: parse_boolean(params["branding_required"], true)
            }

            # Build options
            opts = [
              content_type: content_type,
              recipient_user_ids: parse_json(params["recipient_user_ids"], [])
            ]

            # Handle thumbnail if provided
            opts = case params["thumbnail"] do
              %Plug.Upload{path: thumb_path} ->
                case File.read(thumb_path) do
                  {:ok, thumb_binary} -> Keyword.put(opts, :thumbnail_binary, thumb_binary)
                  _ -> opts
                end
              _ -> opts
            end

            case Organizations.create_shared_clip(org_id, user.id, attrs, file_binary, filename, opts) do
              {:ok, clip} ->
                conn
                |> put_status(201)
                |> json(%{
                  success: true,
                  clip: serialize_clip(clip)
                })

              {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
                conn
                |> put_status(422)
                |> json(%{success: false, error: format_changeset_errors(changeset)})

              {:error, reason} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Upload failed: #{inspect(reason)}"})
            end

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to read uploaded file: #{inspect(reason)}"})
        end
    end
  end

  @doc """
  List all shared clips for an organization (admin view).
  GET /organizations/:organization_id/shared-clips
  """
  def index(conn, %{"organization_id" => org_id}) do
    user = conn.assigns.current_user

    if Organizations.is_admin?(org_id, user.id) do
      clips = Organizations.list_shared_clips(org_id)

      json(conn, %{
        success: true,
        clips: Enum.map(clips, &serialize_clip_with_stats/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can list all shared clips"})
    end
  end

  @doc """
  Get a single shared clip.
  GET /organizations/:organization_id/shared-clips/:id
  """
  def show(conn, %{"organization_id" => org_id, "id" => clip_id}) do
    user = conn.assigns.current_user

    case Organizations.get_shared_clip_for_org(org_id, clip_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared clip not found"})

      clip ->
        if Organizations.has_shared_clip_access?(clip_id, user.id) do
          # Mark as viewed if member
          unless Organizations.is_admin?(org_id, user.id) do
            Organizations.mark_shared_clip_viewed(clip_id, user.id)
          end

          json(conn, %{
            success: true,
            clip: serialize_clip_with_url(clip)
          })
        else
          conn
          |> put_status(403)
          |> json(%{success: false, error: "You don't have access to this clip"})
        end
    end
  end

  @doc """
  Update branding configuration for a shared clip.
  PUT /organizations/:organization_id/shared-clips/:id/branding
  """
  def update_branding(conn, %{"organization_id" => _org_id, "id" => clip_id} = params) do
    user = conn.assigns.current_user
    branding_config = parse_json(params["branding_config"], %{})
    branding_required = parse_boolean(params["branding_required"], true)

    case Organizations.update_shared_clip_branding(clip_id, branding_config, branding_required, user) do
      {:ok, clip} ->
        json(conn, %{
          success: true,
          clip: serialize_clip(clip)
        })

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared clip not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can update branding"})

      {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_changeset_errors(changeset)})
    end
  end

  @doc """
  Delete a shared clip.
  DELETE /organizations/:organization_id/shared-clips/:id
  """
  def delete(conn, %{"organization_id" => _org_id, "id" => clip_id}) do
    user = conn.assigns.current_user

    case Organizations.delete_shared_clip(clip_id, user) do
      {:ok, _} ->
        json(conn, %{success: true, message: "Shared clip deleted"})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared clip not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can delete shared clips"})
    end
  end

  @doc """
  Get access statistics for a shared clip.
  GET /organizations/:organization_id/shared-clips/:id/stats
  """
  def stats(conn, %{"organization_id" => org_id, "id" => clip_id}) do
    user = conn.assigns.current_user

    if Organizations.is_admin?(org_id, user.id) do
      case Organizations.get_shared_clip_for_org(org_id, clip_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Shared clip not found"})

        _clip ->
          stats = Organizations.get_shared_clip_stats(clip_id)
          json(conn, %{success: true, stats: stats})
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can view stats"})
    end
  end

  # ============================================================================
  # Member Endpoints
  # ============================================================================

  @doc """
  List all shared clips for the current user across all organizations.
  GET /user/shared-clips
  """
  def user_clips(conn, _params) do
    user = conn.assigns.current_user
    clips_with_recipients = Organizations.list_shared_clips_for_user(user.id)

    json(conn, %{
      success: true,
      clips: Enum.map(clips_with_recipients, fn %{clip: clip, recipient: recipient} ->
        serialize_clip_for_member(clip, recipient)
      end)
    })
  end

  @doc """
  Mark a shared clip as viewed.
  POST /shared-clips/:id/mark-viewed
  """
  def mark_viewed(conn, %{"id" => clip_id}) do
    user = conn.assigns.current_user

    case Organizations.mark_shared_clip_viewed(clip_id, user.id) do
      {:ok, _recipient} ->
        json(conn, %{success: true})

      {:error, :clip_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared clip not found"})

      {:error, :clip_expired} ->
        conn
        |> put_status(410)
        |> json(%{success: false, error: "Shared clip has expired"})

      {:error, :not_a_member} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "You don't have access to this clip"})
    end
  end

  @doc """
  Mark a shared clip as downloaded.
  POST /shared-clips/:id/mark-downloaded
  """
  def mark_downloaded(conn, %{"id" => clip_id}) do
    user = conn.assigns.current_user

    case Organizations.mark_shared_clip_downloaded(clip_id, user.id) do
      {:ok, _recipient} ->
        json(conn, %{success: true})

      {:error, :clip_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared clip not found"})

      {:error, :clip_expired} ->
        conn
        |> put_status(410)
        |> json(%{success: false, error: "Shared clip has expired"})

      {:error, :not_a_member} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "You don't have access to this clip"})
    end
  end

  @doc """
  Mark a shared clip as posted.
  POST /shared-clips/:id/post
  """
  def mark_posted(conn, %{"id" => clip_id}) do
    user = conn.assigns.current_user

    case Organizations.mark_shared_clip_posted(clip_id, user.id) do
      {:ok, _recipient} ->
        json(conn, %{success: true})

      {:error, :clip_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared clip not found"})

      {:error, :clip_expired} ->
        conn
        |> put_status(410)
        |> json(%{success: false, error: "Shared clip has expired"})

      {:error, :not_a_member} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "You don't have access to this clip"})
    end
  end

  # ============================================================================
  # Private Helpers
  # ============================================================================

  defp serialize_clip(clip) do
    %{
      id: clip.id,
      organization_id: clip.organization_id,
      name: clip.name,
      description: clip.description,
      thumbnail_url: presign_url(clip.thumbnail_url),
      duration: clip.duration && Decimal.to_float(clip.duration),
      file_size: clip.file_size,
      share_with_all: clip.share_with_all,
      branding_config: clip.branding_config,
      branding_required: clip.branding_required,
      expires_at: clip.expires_at,
      days_until_expiration: Organizations.OrganizationSharedClip.days_until_expiration(clip),
      inserted_at: clip.inserted_at,
      uploaded_by: serialize_user(clip.uploaded_by)
    }
  end

  defp serialize_clip_with_url(clip) do
    serialize_clip(clip)
    |> Map.put(:url, presign_url(clip.url))
  end

  defp serialize_clip_with_stats(clip) do
    stats = Organizations.get_shared_clip_stats(clip.id)

    serialize_clip(clip)
    |> Map.put(:stats, stats)
    |> Map.put(:recipients, Enum.map(clip.recipients || [], &serialize_recipient/1))
  end

  defp serialize_clip_for_member(clip, recipient) do
    %{
      id: clip.id,
      organization_id: clip.organization_id,
      organization_name: clip.organization && clip.organization.name,
      name: clip.name,
      description: clip.description,
      url: presign_url(clip.url),
      thumbnail_url: presign_url(clip.thumbnail_url),
      duration: clip.duration && Decimal.to_float(clip.duration),
      file_size: clip.file_size,
      branding_config: clip.branding_config,
      branding_required: clip.branding_required,
      expires_at: clip.expires_at,
      days_until_expiration: Organizations.OrganizationSharedClip.days_until_expiration(clip),
      inserted_at: clip.inserted_at,
      uploaded_by: serialize_user(clip.uploaded_by),
      viewed_at: recipient.viewed_at,
      downloaded_at: recipient.downloaded_at,
      posted_at: recipient.posted_at
    }
  end

  defp serialize_recipient(recipient) do
    %{
      user_id: recipient.user_id,
      user: serialize_user(recipient.user),
      viewed_at: recipient.viewed_at,
      downloaded_at: recipient.downloaded_at,
      posted_at: recipient.posted_at
    }
  end

  defp serialize_user(nil), do: nil
  defp serialize_user(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url
    }
  end

  defp presign_url(nil), do: nil
  defp presign_url(url), do: Storage.presigned_url!(url)

  defp parse_decimal(nil), do: nil
  defp parse_decimal(value) when is_binary(value) do
    case Decimal.parse(value) do
      {decimal, _} -> decimal
      :error -> nil
    end
  end
  defp parse_decimal(value) when is_number(value), do: Decimal.new(to_string(value))

  defp parse_boolean(nil, default), do: default
  defp parse_boolean(true, _default), do: true
  defp parse_boolean(false, _default), do: false
  defp parse_boolean("true", _default), do: true
  defp parse_boolean("false", _default), do: false
  defp parse_boolean("1", _default), do: true
  defp parse_boolean("0", _default), do: false
  defp parse_boolean(_, default), do: default

  defp parse_json(nil, default), do: default
  defp parse_json(value, default) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, parsed} -> parsed
      {:error, _} -> default
    end
  end
  defp parse_json(value, _default) when is_map(value), do: value
  defp parse_json(value, _default) when is_list(value), do: value
  defp parse_json(_, default), do: default

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end
end
