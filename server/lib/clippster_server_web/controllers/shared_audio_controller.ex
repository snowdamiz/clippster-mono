defmodule ClippsterServerWeb.SharedAudioController do
  @moduledoc """
  Controller for organization shared audio.
  Handles upload, listing, and member actions (view, download).
  """
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Organizations
  alias ClippsterServer.Storage

  plug ClippsterServerWeb.AuthPlug

  def create(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    cond do
      not Organizations.is_admin?(org_id, user.id) ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can share audio"})

      not Storage.configured?() ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Storage service not configured"})

      is_nil(params["file"]) ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "No file provided"})

      true ->
        %Plug.Upload{path: temp_path, filename: filename, content_type: content_type} =
          params["file"]

        case File.read(temp_path) do
          {:ok, file_binary} ->
            name = params["name"] || filename

            attrs = %{
              name: name,
              description: params["description"],
              duration: parse_decimal(params["duration"]),
              share_with_all: parse_boolean(params["share_with_all"], true)
            }

            opts = [
              content_type: content_type,
              recipient_user_ids: parse_json(params["recipient_user_ids"], [])
            ]

            case Organizations.create_shared_audio(
                   org_id,
                   user.id,
                   attrs,
                   file_binary,
                   filename,
                   opts
                 ) do
              {:ok, audio} ->
                conn
                |> put_status(201)
                |> json(%{
                  success: true,
                  audio: serialize_audio(audio)
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

  def index(conn, %{"organization_id" => org_id}) do
    user = conn.assigns.current_user

    if Organizations.is_admin?(org_id, user.id) do
      audio_files = Organizations.list_shared_audio(org_id)

      json(conn, %{
        success: true,
        audio: Enum.map(audio_files, &serialize_audio_with_stats/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can list all shared audio"})
    end
  end

  def show(conn, %{"organization_id" => org_id, "id" => audio_id}) do
    user = conn.assigns.current_user

    case Organizations.get_shared_audio_for_org(org_id, audio_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared audio not found"})

      audio ->
        if Organizations.has_shared_audio_access?(audio_id, user.id) do
          unless Organizations.is_admin?(org_id, user.id) do
            Organizations.mark_shared_audio_viewed(audio_id, user.id)
          end

          json(conn, %{
            success: true,
            audio: serialize_audio_with_url(audio)
          })
        else
          conn
          |> put_status(403)
          |> json(%{success: false, error: "You don't have access to this audio"})
        end
    end
  end

  def delete(conn, %{"organization_id" => _org_id, "id" => audio_id}) do
    user = conn.assigns.current_user

    case Organizations.delete_shared_audio(audio_id, user) do
      {:ok, _} ->
        json(conn, %{success: true, message: "Shared audio deleted"})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared audio not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can delete shared audio"})
    end
  end

  def stats(conn, %{"organization_id" => org_id, "id" => audio_id}) do
    user = conn.assigns.current_user

    if Organizations.is_admin?(org_id, user.id) do
      case Organizations.get_shared_audio_for_org(org_id, audio_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Shared audio not found"})

        _audio ->
          stats = Organizations.get_shared_audio_stats(audio_id)
          json(conn, %{success: true, stats: stats})
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can view stats"})
    end
  end

  def user_audio(conn, _params) do
    user = conn.assigns.current_user
    audio_with_recipients = Organizations.list_shared_audio_for_user(user.id)

    json(conn, %{
      success: true,
      audio:
        Enum.map(audio_with_recipients, fn %{audio: audio, recipient: recipient} ->
          serialize_audio_for_member(audio, recipient)
        end)
    })
  end

  def mark_viewed(conn, %{"id" => audio_id}) do
    user = conn.assigns.current_user

    case Organizations.mark_shared_audio_viewed(audio_id, user.id) do
      {:ok, _recipient} ->
        json(conn, %{success: true})

      {:error, :audio_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared audio not found"})

      {:error, :audio_expired} ->
        conn
        |> put_status(410)
        |> json(%{success: false, error: "Shared audio has expired"})

      {:error, :not_a_member} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "You don't have access to this audio"})
    end
  end

  def mark_downloaded(conn, %{"id" => audio_id}) do
    user = conn.assigns.current_user

    case Organizations.mark_shared_audio_downloaded(audio_id, user.id) do
      {:ok, _recipient} ->
        json(conn, %{success: true})

      {:error, :audio_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Shared audio not found"})

      {:error, :audio_expired} ->
        conn
        |> put_status(410)
        |> json(%{success: false, error: "Shared audio has expired"})

      {:error, :not_a_member} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "You don't have access to this audio"})
    end
  end

  defp serialize_audio(audio) do
    %{
      id: audio.id,
      organization_id: audio.organization_id,
      name: audio.name,
      description: audio.description,
      mime_type: audio.mime_type,
      duration: audio.duration && Decimal.to_float(audio.duration),
      file_size: audio.file_size,
      share_with_all: audio.share_with_all,
      expires_at: audio.expires_at,
      days_until_expiration: Organizations.OrganizationSharedAudio.days_until_expiration(audio),
      inserted_at: audio.inserted_at,
      uploaded_by: serialize_user(audio.uploaded_by)
    }
  end

  defp serialize_audio_with_url(audio) do
    serialize_audio(audio)
    |> Map.put(:url, presign_url(audio.url))
  end

  defp serialize_audio_with_stats(audio) do
    stats = Organizations.get_shared_audio_stats(audio.id)

    serialize_audio(audio)
    |> Map.put(:url, presign_url(audio.url))
    |> Map.put(:stats, stats)
    |> Map.put(:recipients, Enum.map(audio.recipients || [], &serialize_recipient/1))
  end

  defp serialize_audio_for_member(audio, recipient) do
    %{
      id: audio.id,
      organization_id: audio.organization_id,
      organization_name: audio.organization && audio.organization.name,
      name: audio.name,
      description: audio.description,
      url: presign_url(audio.url),
      mime_type: audio.mime_type,
      duration: audio.duration && Decimal.to_float(audio.duration),
      file_size: audio.file_size,
      expires_at: audio.expires_at,
      days_until_expiration: Organizations.OrganizationSharedAudio.days_until_expiration(audio),
      inserted_at: audio.inserted_at,
      uploaded_by: serialize_user(audio.uploaded_by),
      viewed_at: recipient.viewed_at,
      downloaded_at: recipient.downloaded_at
    }
  end

  defp serialize_recipient(recipient) do
    %{
      user_id: recipient.user_id,
      user: serialize_user(recipient.user),
      viewed_at: recipient.viewed_at,
      downloaded_at: recipient.downloaded_at
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
