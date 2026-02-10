defmodule ClippsterServerWeb.HiringController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Hiring
  alias ClippsterServer.Organizations
  alias ClippsterServer.Storage

  # ============================================================================
  # Org-scoped endpoints (require auth + org admin)
  # ============================================================================

  @doc "Get the org's single hiring post"
  def show_org_post(conn, %{"organization_id" => org_id}) do
    user = conn.assigns[:current_user]

    with {:ok, _} <- verify_org_admin(org_id, user.id) do
      case Hiring.get_org_hiring_post(String.to_integer(org_id)) do
        nil ->
          json(conn, %{success: true, hiring_post: nil})

        post ->
          json(conn, %{success: true, hiring_post: serialize_post(post)})
      end
    else
      {:error, reason} -> error_response(conn, reason)
    end
  rescue
    e ->
      require Logger
      Logger.error("show_org_post crashed: #{inspect(e)}\n#{Exception.format_stacktrace(__STACKTRACE__)}")
      json(conn |> put_status(500), %{success: false, error: "Internal error: #{inspect(e)}"})
  end

  @doc "Create or update the org's hiring post"
  def save_org_post(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns[:current_user]

    with {:ok, _} <- verify_org_admin(org_id, user.id) do
      attrs =
        %{
          "title" => params["title"],
          "description" => params["description"],
          "content_types" => params["content_types"] || [],
          "languages" => params["languages"] || [],
          "platforms" => params["platforms"] || [],
          "payment_type" => blank_to_nil(params["payment_type"]),
          "payment_details" => blank_to_nil(params["payment_details"]),
          "streamer_count" => to_integer_or_nil(params["streamer_count"]),
          "clipper_slots" => to_integer_or_nil(params["clipper_slots"]),
          "experience_level" => blank_to_nil(params["experience_level"]),
          "status" => params["status"] || "active",
          "is_public" => if(is_nil(params["is_public"]), do: true, else: params["is_public"])
        }

      case Hiring.create_or_update_hiring_post(String.to_integer(org_id), attrs) do
        {:ok, post} ->
          post = ClippsterServer.Repo.preload(post, :organization)
          json(conn, %{success: true, hiring_post: serialize_post(post)})

        {:error, %Ecto.Changeset{} = changeset} ->
          json(conn |> put_status(422), %{
            success: false,
            error: "Validation failed",
            errors: format_changeset_errors(changeset)
          })

        {:error, reason} ->
          json(conn |> put_status(422), %{success: false, error: inspect(reason)})
      end
    else
      {:error, reason} -> error_response(conn, reason)
    end
  rescue
    e ->
      require Logger
      Logger.error("save_org_post crashed: #{inspect(e)}\n#{Exception.format_stacktrace(__STACKTRACE__)}")
      json(conn |> put_status(500), %{success: false, error: "Internal error: #{inspect(e)}"})
  end

  @doc "Delete the org's hiring post"
  def delete_org_post(conn, %{"organization_id" => org_id}) do
    user = conn.assigns[:current_user]

    with {:ok, _} <- verify_org_admin(org_id, user.id) do
      case Hiring.delete_hiring_post(String.to_integer(org_id)) do
        {:ok, _} -> json(conn, %{success: true})
        {:error, :not_found} -> json(conn |> put_status(404), %{success: false, error: "No hiring post found"})
      end
    else
      {:error, reason} -> error_response(conn, reason)
    end
  end

  @doc "List applications for the org's hiring post"
  def list_applications(conn, %{"organization_id" => org_id}) do
    user = conn.assigns[:current_user]

    with {:ok, _} <- verify_org_admin(org_id, user.id) do
      case Hiring.get_org_hiring_post(String.to_integer(org_id)) do
        nil ->
          json(conn, %{success: true, applications: []})

        post ->
          applications = Hiring.list_applications_for_post(post.id)
          json(conn, %{success: true, applications: Enum.map(applications, &serialize_application/1)})
      end
    else
      {:error, reason} -> error_response(conn, reason)
    end
  end

  @doc "Accept an application and auto-hire the clipper"
  def accept_application(conn, %{"organization_id" => org_id, "app_id" => app_id}) do
    user = conn.assigns[:current_user]

    with {:ok, _} <- verify_org_admin(org_id, user.id) do
      case Hiring.accept_and_hire(String.to_integer(app_id), String.to_integer(org_id), user.id) do
        {:ok, application} ->
          json(conn, %{success: true, application: serialize_application(application)})

        {:error, :not_found} ->
          json(conn |> put_status(404), %{success: false, error: "Application not found"})

        {:error, :unauthorized} ->
          json(conn |> put_status(403), %{success: false, error: "Unauthorized"})

        {:error, :already_accepted} ->
          json(conn |> put_status(422), %{success: false, error: "Application already accepted"})

        {:error, :seat_limit_reached} ->
          json(conn |> put_status(422), %{success: false, error: "Organization seat limit reached"})

        {:error, reason} ->
          json(conn |> put_status(422), %{success: false, error: inspect(reason)})
      end
    else
      {:error, reason} -> error_response(conn, reason)
    end
  end

  @doc "Reject an application"
  def reject_application(conn, %{"organization_id" => org_id, "app_id" => app_id} = params) do
    user = conn.assigns[:current_user]

    with {:ok, _} <- verify_org_admin(org_id, user.id) do
      case Hiring.reject_application(
        String.to_integer(app_id),
        String.to_integer(org_id),
        user.id,
        params["admin_notes"]
      ) do
        {:ok, application} ->
          json(conn, %{success: true, application: serialize_application(application)})

        {:error, :not_found} ->
          json(conn |> put_status(404), %{success: false, error: "Application not found"})

        {:error, :unauthorized} ->
          json(conn |> put_status(403), %{success: false, error: "Unauthorized"})

        {:error, reason} ->
          json(conn |> put_status(422), %{success: false, error: inspect(reason)})
      end
    else
      {:error, reason} -> error_response(conn, reason)
    end
  end

  # ============================================================================
  # Clipper-scoped endpoints (require auth)
  # ============================================================================

  @doc "Browse all active public hiring posts"
  def index(conn, params) do
    filters = %{
      "content_types" => params["content_types"] || params["content_types[]"] |> List.wrap() |> Enum.reject(&is_nil/1),
      "languages" => params["languages"] || params["languages[]"] |> List.wrap() |> Enum.reject(&is_nil/1),
      "platforms" => params["platforms"] || params["platforms[]"] |> List.wrap() |> Enum.reject(&is_nil/1),
      "payment_type" => params["payment_type"]
    }

    posts = Hiring.list_public_hiring_posts(filters)

    # Check which posts the current user has applied to
    user = conn.assigns[:current_user]
    my_applications = if user, do: Hiring.list_my_applications(user.id), else: []
    applied_post_ids = MapSet.new(Enum.map(my_applications, & &1.hiring_post_id))

    json(conn, %{
      success: true,
      hiring_posts: Enum.map(posts, fn post ->
        serialize_post(post)
        |> Map.put(:has_applied, MapSet.member?(applied_post_ids, post.id))
      end)
    })
  end

  @doc "Get a single hiring post detail"
  def show(conn, %{"id" => id}) do
    case Hiring.get_hiring_post(String.to_integer(id)) do
      nil ->
        json(conn |> put_status(404), %{success: false, error: "Hiring post not found"})

      post ->
        user = conn.assigns[:current_user]
        has_applied = if user, do: Hiring.has_applied?(post.id, user.id), else: false

        json(conn, %{
          success: true,
          hiring_post: serialize_post(post) |> Map.put(:has_applied, has_applied)
        })
    end
  end

  @doc "Submit an application to a hiring post"
  def apply(conn, %{"id" => id} = params) do
    user = conn.assigns[:current_user]

    case Hiring.apply_to_hiring_post(String.to_integer(id), user.id, params["message"]) do
      {:ok, application} ->
        json(conn, %{success: true, application: serialize_application(application)})

      {:error, :not_found} ->
        json(conn |> put_status(404), %{success: false, error: "Hiring post not found"})

      {:error, :post_not_active} ->
        json(conn |> put_status(422), %{success: false, error: "This hiring post is no longer accepting applications"})

      {:error, %Ecto.Changeset{} = changeset} ->
        if Keyword.has_key?(changeset.errors, :hiring_post_id_user_id) ||
           Keyword.has_key?(changeset.errors, :hiring_post_id) do
          json(conn |> put_status(422), %{success: false, error: "You have already applied to this hiring post"})
        else
          json(conn |> put_status(422), %{
            success: false,
            error: "Validation failed",
            errors: format_changeset_errors(changeset)
          })
        end
    end
  end

  @doc "List the current user's hiring applications"
  def my_applications(conn, _params) do
    user = conn.assigns[:current_user]
    applications = Hiring.list_my_applications(user.id)

    json(conn, %{
      success: true,
      applications: Enum.map(applications, fn app ->
        %{
          id: app.id,
          message: app.message,
          status: app.status,
          reviewed_at: app.reviewed_at,
          inserted_at: app.inserted_at,
          hiring_post: if(app.hiring_post, do: serialize_post(app.hiring_post), else: nil)
        }
      end)
    })
  end

  # ============================================================================
  # Private Helpers
  # ============================================================================

  defp verify_org_admin(org_id, user_id) do
    org_id = if is_binary(org_id), do: String.to_integer(org_id), else: org_id

    case Organizations.get_member(org_id, user_id) do
      nil -> {:error, :not_member}
      member ->
        if member.role in ["owner", "admin"] do
          {:ok, member}
        else
          {:error, :not_admin}
        end
    end
  end

  defp error_response(conn, :not_member) do
    json(conn |> put_status(403), %{success: false, error: "You are not a member of this organization"})
  end

  defp error_response(conn, :not_admin) do
    json(conn |> put_status(403), %{success: false, error: "Admin access required"})
  end

  defp error_response(conn, reason) do
    json(conn |> put_status(422), %{success: false, error: inspect(reason)})
  end

  defp serialize_post(post) do
    %{
      id: post.id,
      organization_id: post.organization_id,
      title: post.title,
      description: post.description,
      content_types: post.content_types || [],
      languages: post.languages || [],
      platforms: post.platforms || [],
      payment_type: post.payment_type,
      payment_details: post.payment_details,
      streamer_count: post.streamer_count,
      clipper_slots: post.clipper_slots,
      clipper_slots_filled: post.clipper_slots_filled || 0,
      experience_level: post.experience_level,
      status: post.status,
      is_public: post.is_public,
      inserted_at: post.inserted_at,
      updated_at: post.updated_at,
      organization: if(Ecto.assoc_loaded?(post.organization) && post.organization, do: %{
        id: post.organization.id,
        name: post.organization.name,
        logo_url: post.organization.logo_url
      }, else: nil)
    }
  end

  defp serialize_application(app) do
    base = %{
      id: app.id,
      hiring_post_id: app.hiring_post_id,
      user_id: app.user_id,
      message: app.message,
      status: app.status,
      reviewed_at: app.reviewed_at,
      admin_notes: app.admin_notes,
      inserted_at: app.inserted_at,
      updated_at: app.updated_at
    }

    base = if Ecto.assoc_loaded?(app.user) && app.user do
      Map.put(base, :user, %{
        id: app.user.id,
        name: app.user.name,
        email: app.user.email,
        avatar_url: app.user.avatar_url
      })
    else
      base
    end

    base = if Map.has_key?(app, :clipper_profile) && app.clipper_profile do
      cp = app.clipper_profile
      Map.put(base, :clipper_profile, %{
        id: cp.id,
        user_id: cp.user_id,
        display_name: cp.display_name,
        avatar_url: maybe_presign(cp.avatar_url),
        slug: cp.slug,
        bio: cp.bio,
        is_verified: cp.is_verified,
        looking_for_work: cp.looking_for_work,
        experience_level: cp.experience_level,
        response_time_hours: cp.response_time_hours,
        specialty_tags: cp.specialty_tags || [],
        content_style_tags: cp.content_style_tags || [],
        preferred_platforms: cp.preferred_platforms || [],
        languages: cp.languages || [],
        total_clips_delivered: cp.total_clips_delivered || 0,
        total_endorsements: cp.total_endorsements || 0,
        total_campaigns_completed: cp.total_campaigns_completed || 0
      })
    else
      base
    end

    base
  end

  defp blank_to_nil(nil), do: nil
  defp blank_to_nil(""), do: nil
  defp blank_to_nil(val), do: val

  defp to_integer_or_nil(nil), do: nil
  defp to_integer_or_nil(""), do: nil
  defp to_integer_or_nil(val) when is_integer(val), do: val
  defp to_integer_or_nil(val) when is_binary(val) do
    case Integer.parse(val) do
      {int, _} -> int
      :error -> nil
    end
  end
  defp to_integer_or_nil(val) when is_float(val), do: round(val)
  defp to_integer_or_nil(_), do: nil

  defp maybe_presign(nil), do: nil
  defp maybe_presign(url) when is_binary(url), do: Storage.presigned_url!(url)

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
