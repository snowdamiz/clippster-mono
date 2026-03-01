defmodule ClippsterServerWeb.OrganizationCreatorProfileController do
  @moduledoc """
  Controller for organization creator profile management.
  Handles CRUD operations, platform links, and member assignments.
  """
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Organizations
  alias ClippsterServer.Storage

  plug ClippsterServerWeb.AuthPlug

  # ============================================================================
  # Creator Profile CRUD
  # ============================================================================

  @doc """
  List all creator profiles for an organization.
  GET /organizations/:organization_id/creator-profiles
  """
  def index(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      profiles =
        case params["scope"] do
          scope when scope in ["streamer", "global"] ->
            Organizations.list_creator_profiles_by_scope(org_id, scope)

          _ ->
            Organizations.list_creator_profiles(org_id)
        end

      json(conn, %{
        success: true,
        profiles: Enum.map(profiles, &serialize_profile/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Get a single creator profile.
  GET /organizations/:organization_id/creator-profiles/:id
  """
  def show(conn, %{"organization_id" => org_id, "id" => profile_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      case Organizations.get_creator_profile(org_id, profile_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Profile not found"})

        profile ->
          json(conn, %{
            success: true,
            profile: serialize_profile(profile)
          })
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Create a new creator profile.
  POST /organizations/:organization_id/creator-profiles
  Admin only.
  """
  def create(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    attrs =
      %{
        name: params["name"],
        description: params["description"],
        profile_image_url: params["profile_image_url"],
        intro_id: parse_integer(params["intro_id"]),
        outro_id: parse_integer(params["outro_id"]),
        watermark_id: parse_integer(params["watermark_id"]),
        watermark_settings: params["watermark_settings"],
        layout_overlays: params["layout_overlays"],
        scope: params["scope"]
      }
      |> Enum.reject(fn {_, v} -> is_nil(v) end)
      |> Enum.into(%{})

    case Organizations.create_creator_profile(org_id, attrs, user) do
      {:ok, profile} ->
        conn
        |> put_status(201)
        |> json(%{success: true, profile: serialize_profile(profile)})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can create profiles"})

      {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_changeset_errors(changeset)})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to create profile: #{inspect(reason)}"})
    end
  end

  @doc """
  Update a creator profile.
  PUT /organizations/:organization_id/creator-profiles/:id
  Admin only.
  """
  def update(conn, %{"organization_id" => org_id, "id" => profile_id} = params) do
    user = conn.assigns.current_user

    case Organizations.get_creator_profile(org_id, profile_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Profile not found"})

      profile ->
        attrs =
          Map.take(params, [
            "name",
            "description",
            "profile_image_url",
            "intro_id",
            "outro_id",
            "watermark_id",
            "watermark_settings",
            "layout_overlays",
            "scope"
          ])
          |> Enum.map(fn
            {"intro_id", v} -> {:intro_id, parse_integer(v)}
            {"outro_id", v} -> {:outro_id, parse_integer(v)}
            {"watermark_id", v} -> {:watermark_id, parse_integer(v)}
            {k, v} -> {String.to_existing_atom(k), v}
          end)
          |> Enum.into(%{})

        case Organizations.update_creator_profile(profile, attrs, user) do
          {:ok, updated} ->
            json(conn, %{success: true, profile: serialize_profile(updated)})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Only admins can update profiles"})

          {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_changeset_errors(changeset)})

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to update profile: #{inspect(reason)}"})
        end
    end
  end

  @doc """
  Delete a creator profile.
  DELETE /organizations/:organization_id/creator-profiles/:id
  Admin only.
  """
  def delete(conn, %{"organization_id" => org_id, "id" => profile_id}) do
    user = conn.assigns.current_user

    case Organizations.delete_creator_profile_by_id(org_id, profile_id, user) do
      {:ok, _} ->
        json(conn, %{success: true})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Profile not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can delete profiles"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to delete profile: #{inspect(reason)}"})
    end
  end

  @doc """
  Toggle disabled state of a creator profile.
  POST /organizations/:organization_id/creator-profiles/:id/toggle-disabled
  Org admins can toggle any profile. Users can toggle their own assigned profiles.
  """
  def toggle_disabled(conn, %{"organization_id" => _org_id, "id" => profile_id}) do
    user = conn.assigns.current_user

    case Organizations.toggle_creator_profile_disabled(profile_id, user) do
      {:ok, updated} ->
        json(conn, %{success: true, profile: serialize_profile(updated)})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Profile not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "You don't have permission to toggle this profile"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to toggle profile: #{inspect(reason)}"})
    end
  end

  @doc """
  Upload profile image.
  POST /organizations/:organization_id/creator-profiles/:id/image
  Admin only.
  """
  def upload_image(conn, %{"organization_id" => org_id, "id" => profile_id} = params) do
    user = conn.assigns.current_user

    cond do
      not Organizations.is_admin?(org_id, user.id) ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can upload images"})

      is_nil(params["file"]) ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "No file provided"})

      true ->
        case Organizations.get_creator_profile(org_id, profile_id) do
          nil ->
            conn
            |> put_status(404)
            |> json(%{success: false, error: "Profile not found"})

          profile ->
            %Plug.Upload{path: temp_path, filename: filename} = params["file"]

            case File.read(temp_path) do
              {:ok, binary} ->
                case Organizations.upload_creator_profile_image(
                       org_id,
                       profile_id,
                       binary,
                       filename
                     ) do
                  {:ok, url} ->
                    # Update the profile with the new image URL
                    {:ok, updated} =
                      Organizations.update_creator_profile(
                        profile,
                        %{profile_image_url: url},
                        user
                      )

                    json(conn, %{
                      success: true,
                      url: Storage.presigned_url!(url),
                      profile: serialize_profile(updated)
                    })

                  {:error, reason} ->
                    conn
                    |> put_status(500)
                    |> json(%{success: false, error: "Upload failed: #{inspect(reason)}"})
                end

              {:error, reason} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Failed to read file: #{inspect(reason)}"})
            end
        end
    end
  end

  # ============================================================================
  # Platform Links
  # ============================================================================

  @doc """
  Add a platform link to a profile.
  POST /organizations/:organization_id/creator-profiles/:profile_id/platform-links
  Admin only.
  """
  def add_platform_link(conn, %{"organization_id" => org_id, "profile_id" => profile_id} = params) do
    user = conn.assigns.current_user

    attrs =
      %{
        platform: params["platform"],
        platform_id: params["platform_id"],
        display_name: params["display_name"],
        profile_image_url: params["profile_image_url"],
        is_primary: params["is_primary"] == true || params["is_primary"] == "true"
      }
      |> Enum.reject(fn {_, v} -> is_nil(v) end)
      |> Enum.into(%{})

    case Organizations.add_creator_platform_link(org_id, profile_id, attrs, user) do
      {:ok, link} ->
        conn
        |> put_status(201)
        |> json(%{success: true, link: serialize_platform_link(link)})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can add platform links"})

      {:error, :profile_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Profile not found"})

      {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_changeset_errors(changeset)})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to add link: #{inspect(reason)}"})
    end
  end

  @doc """
  Update a platform link.
  PUT /organizations/:organization_id/creator-profiles/:profile_id/platform-links/:link_id
  Admin only.
  """
  def update_platform_link(conn, %{"organization_id" => org_id, "link_id" => link_id} = params) do
    user = conn.assigns.current_user

    attrs =
      Map.take(params, ["display_name", "profile_image_url", "is_primary"])
      |> Enum.map(fn
        {"is_primary", v} -> {:is_primary, v == true || v == "true"}
        {k, v} -> {String.to_existing_atom(k), v}
      end)
      |> Enum.into(%{})

    case Organizations.update_creator_platform_link(org_id, link_id, attrs, user) do
      {:ok, link} ->
        json(conn, %{success: true, link: serialize_platform_link(link)})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Link not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can update links"})

      {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_changeset_errors(changeset)})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to update link: #{inspect(reason)}"})
    end
  end

  @doc """
  Delete a platform link.
  DELETE /organizations/:organization_id/creator-profiles/:profile_id/platform-links/:link_id
  Admin only.
  """
  def delete_platform_link(conn, %{"organization_id" => org_id, "link_id" => link_id}) do
    user = conn.assigns.current_user

    case Organizations.delete_creator_platform_link(org_id, link_id, user) do
      {:ok, _} ->
        json(conn, %{success: true})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Link not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can delete links"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to delete link: #{inspect(reason)}"})
    end
  end

  # ============================================================================
  # Assignments
  # ============================================================================

  @doc """
  List all assignments for a profile.
  GET /organizations/:organization_id/creator-profiles/:profile_id/assignments
  Admin only.
  """
  def list_assignments(conn, %{"organization_id" => org_id, "profile_id" => profile_id}) do
    user = conn.assigns.current_user

    if Organizations.is_admin?(org_id, user.id) do
      assignments = Organizations.list_profile_assignments(org_id, profile_id)

      json(conn, %{
        success: true,
        assignments: Enum.map(assignments, &serialize_assignment/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can view assignments"})
    end
  end

  @doc """
  Assign profile to members.
  POST /organizations/:organization_id/creator-profiles/:profile_id/assignments
  Admin only.
  Body: { "user_ids": [1, 2, 3] }
  """
  def create_assignments(
        conn,
        %{"organization_id" => org_id, "profile_id" => profile_id} = params
      ) do
    user = conn.assigns.current_user
    user_ids = params["user_ids"] || []

    case Organizations.assign_creator_profile(org_id, profile_id, user_ids, user) do
      {:ok, result} ->
        conn
        |> put_status(201)
        |> json(%{success: true, assigned: result.assigned, total: result.total})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can assign profiles"})

      {:error, :profile_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Profile not found"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to assign: #{inspect(reason)}"})
    end
  end

  @doc """
  Unassign profile from a member.
  DELETE /organizations/:organization_id/creator-profiles/:profile_id/assignments/:user_id
  Admin only.
  """
  def delete_assignment(conn, %{
        "organization_id" => org_id,
        "profile_id" => profile_id,
        "user_id" => user_id
      }) do
    user = conn.assigns.current_user

    case Organizations.unassign_creator_profile(org_id, profile_id, user_id, user) do
      {:ok, _} ->
        json(conn, %{success: true})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can unassign profiles"})

      {:error, :profile_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Profile not found"})

      {:error, :not_assigned} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User is not assigned to this profile"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to unassign: #{inspect(reason)}"})
    end
  end

  @doc """
  Get all profiles assigned to the current user.
  GET /user/assigned-creator-profiles
  """
  def user_assigned_profiles(conn, _params) do
    user = conn.assigns.current_user
    profiles = Organizations.get_assigned_creator_profiles(user.id)

    json(conn, %{
      success: true,
      profiles: Enum.map(profiles, &serialize_profile/1)
    })
  end

  # ============================================================================
  # Private Helpers
  # ============================================================================

  defp serialize_profile(profile) do
    %{
      id: profile.id,
      organization_id: profile.organization_id,
      organization_name: get_org_name(profile),
      created_by_user_id: profile.created_by_user_id,
      name: profile.name,
      description: profile.description,
      profile_image_url: maybe_presign_url(profile.profile_image_url),
      scope: profile.scope,
      disabled: profile.disabled,
      intro_id: profile.intro_id,
      outro_id: profile.outro_id,
      watermark_id: profile.watermark_id,
      watermark_settings: profile.watermark_settings,
      layout_overlays: profile.layout_overlays,
      intro: serialize_asset(profile.intro),
      outro: serialize_asset(profile.outro),
      watermark: serialize_asset(profile.watermark),
      platform_links: serialize_platform_links(profile.platform_links),
      assignments: serialize_assignments(profile),
      assigned_count: count_assignments(profile),
      inserted_at: profile.inserted_at,
      updated_at: profile.updated_at
    }
  end

  defp get_org_name(profile) do
    cond do
      Ecto.assoc_loaded?(profile.organization) and profile.organization ->
        profile.organization.name

      true ->
        nil
    end
  end

  defp serialize_platform_links(links) when is_list(links) do
    Enum.map(links, &serialize_platform_link/1)
  end

  defp serialize_platform_links(_), do: []

  defp serialize_platform_link(link) do
    %{
      id: link.id,
      platform: link.platform,
      platform_id: link.platform_id,
      display_name: link.display_name,
      profile_image_url: link.profile_image_url,
      is_primary: link.is_primary,
      inserted_at: link.inserted_at
    }
  end

  defp serialize_assignments(profile) do
    if Ecto.assoc_loaded?(profile.assignments) do
      Enum.map(profile.assignments, &serialize_assignment/1)
    else
      []
    end
  end

  defp serialize_assignment(assignment) do
    %{
      id: assignment.id,
      user_id: assignment.user_id,
      user: serialize_user(assignment.user),
      inserted_at: assignment.inserted_at
    }
  end

  defp serialize_user(user) when is_struct(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url
    }
  end

  defp serialize_user(_), do: nil

  defp count_assignments(profile) do
    if Ecto.assoc_loaded?(profile.assignments) do
      length(profile.assignments)
    else
      0
    end
  end

  defp serialize_asset(nil), do: nil

  defp serialize_asset(asset) do
    %{
      id: asset.id,
      name: asset.name,
      asset_type: asset.asset_type,
      url: presign_url(asset.url),
      thumbnail_url: presign_url(asset.thumbnail_url),
      duration: asset.duration && Decimal.to_float(asset.duration)
    }
  end

  defp presign_url(nil), do: nil
  defp presign_url(url), do: Storage.presigned_url!(url)

  # For profile images that may be external URLs (e.g., from DexScreener)
  # Don't presign external URLs, only presign S3 storage URLs
  defp maybe_presign_url(nil), do: nil

  defp maybe_presign_url(url) when is_binary(url) do
    if String.starts_with?(url, "http://") or String.starts_with?(url, "https://") do
      # External URL - return as-is
      url
    else
      # Internal storage URL - presign it
      Storage.presigned_url!(url)
    end
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end

  defp parse_integer(nil), do: nil
  defp parse_integer(value) when is_integer(value), do: value

  defp parse_integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, _} -> int
      :error -> nil
    end
  end
end
