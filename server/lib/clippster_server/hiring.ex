defmodule ClippsterServer.Hiring do
  @moduledoc """
  The Hiring context - manages hiring posts and applications for organizations.
  """

  import Ecto.Query
  alias ClippsterServer.Repo
  alias ClippsterServer.Organizations
  alias ClippsterServer.Organizations.{HiringPost, HiringApplication}

  # ============================================================================
  # Hiring Posts
  # ============================================================================

  @doc """
  Gets the single hiring post for an organization (or nil).
  """
  def get_org_hiring_post(organization_id) do
    HiringPost
    |> where(organization_id: ^organization_id)
    |> preload(:organization)
    |> Repo.one()
  end

  @doc """
  Gets a hiring post by ID with preloads.
  """
  def get_hiring_post(id) do
    HiringPost
    |> preload(:organization)
    |> Repo.get(id)
  end

  @doc """
  Lists all active, public hiring posts for the clipper directory.
  Supports filtering by content_types, languages, platforms, payment_type.
  """
  def list_public_hiring_posts(filters \\ %{}) do
    query =
      HiringPost
      |> where(status: "active", is_public: true)
      |> preload(:organization)
      |> order_by([h], desc: h.inserted_at)

    query = apply_filters(query, filters)

    Repo.all(query)
  end

  defp apply_filters(query, filters) do
    query
    |> maybe_filter_array(
      :content_types,
      Map.get(filters, "content_types") || Map.get(filters, :content_types)
    )
    |> maybe_filter_array(
      :languages,
      Map.get(filters, "languages") || Map.get(filters, :languages)
    )
    |> maybe_filter_array(
      :platforms,
      Map.get(filters, "platforms") || Map.get(filters, :platforms)
    )
    |> maybe_filter_payment_type(
      Map.get(filters, "payment_type") || Map.get(filters, :payment_type)
    )
  end

  defp maybe_filter_array(query, _field, nil), do: query
  defp maybe_filter_array(query, _field, []), do: query

  defp maybe_filter_array(query, field, values) when is_list(values) do
    where(query, [h], fragment("? && ?", field(h, ^field), ^values))
  end

  defp maybe_filter_payment_type(query, nil), do: query
  defp maybe_filter_payment_type(query, ""), do: query

  defp maybe_filter_payment_type(query, payment_type) do
    where(query, [h], h.payment_type == ^payment_type)
  end

  @doc """
  Creates or updates the org's single hiring post (upsert).
  """
  def create_or_update_hiring_post(organization_id, attrs) do
    case get_org_hiring_post(organization_id) do
      nil ->
        %HiringPost{}
        |> HiringPost.create_changeset(Map.put(attrs, "organization_id", organization_id))
        |> Repo.insert()

      existing ->
        existing
        |> HiringPost.update_changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Deletes the org's hiring post and all associated applications.
  """
  def delete_hiring_post(organization_id) do
    case get_org_hiring_post(organization_id) do
      nil -> {:error, :not_found}
      post -> Repo.delete(post)
    end
  end

  # ============================================================================
  # Applications
  # ============================================================================

  @doc """
  Submits an application to a hiring post.
  """
  def apply_to_hiring_post(hiring_post_id, user_id, message) do
    # Verify the post is active
    case get_hiring_post(hiring_post_id) do
      nil ->
        {:error, :not_found}

      %HiringPost{status: status} when status != "active" ->
        {:error, :post_not_active}

      _post ->
        %HiringApplication{}
        |> HiringApplication.create_changeset(%{
          hiring_post_id: hiring_post_id,
          user_id: user_id,
          message: message
        })
        |> Repo.insert()
    end
  end

  @doc """
  Lists applications for a hiring post, preloading user and clipper profile.
  """
  def list_applications_for_post(hiring_post_id) do
    HiringApplication
    |> where(hiring_post_id: ^hiring_post_id)
    |> preload([:user])
    |> order_by([a], desc: a.inserted_at)
    |> Repo.all()
    |> load_clipper_profiles()
  end

  @doc """
  Lists a user's own hiring applications with post + org preloads.
  """
  def list_my_applications(user_id) do
    HiringApplication
    |> where(user_id: ^user_id)
    |> preload(hiring_post: :organization)
    |> order_by([a], desc: a.inserted_at)
    |> Repo.all()
  end

  @doc """
  Checks if a user has already applied to a specific hiring post.
  """
  def has_applied?(hiring_post_id, user_id) do
    HiringApplication
    |> where(hiring_post_id: ^hiring_post_id, user_id: ^user_id)
    |> Repo.exists?()
  end

  @doc """
  Accepts an application and auto-hires the clipper (adds them to the org).
  Returns {:ok, application} or {:error, reason}.
  """
  def accept_and_hire(application_id, organization_id, reviewer_id) do
    Repo.transaction(fn ->
      application =
        HiringApplication
        |> preload([:hiring_post])
        |> Repo.get(application_id)

      cond do
        is_nil(application) ->
          Repo.rollback(:not_found)

        application.hiring_post.organization_id != organization_id ->
          Repo.rollback(:unauthorized)

        application.status == "accepted" ->
          Repo.rollback(:already_accepted)

        true ->
          # Update application status
          {:ok, updated_app} =
            application
            |> HiringApplication.review_changeset(%{
              status: "accepted",
              reviewed_at: DateTime.utc_now() |> DateTime.truncate(:second),
              reviewed_by_id: reviewer_id
            })
            |> Repo.update()

          # Add user as org member
          case Organizations.add_member(organization_id, application.user_id, "member") do
            {:ok, _member} -> :ok
            # Already a member
            {:error, %Ecto.Changeset{errors: [organization_id_user_id: _]}} -> :ok
            {:error, :seat_limit_reached} -> Repo.rollback(:seat_limit_reached)
            {:error, reason} -> Repo.rollback(reason)
          end

          # Increment clipper_slots_filled
          post = application.hiring_post
          new_filled = (post.clipper_slots_filled || 0) + 1

          updates =
            if post.clipper_slots && new_filled >= post.clipper_slots do
              %{clipper_slots_filled: new_filled, status: "closed"}
            else
              %{clipper_slots_filled: new_filled}
            end

          {:ok, _updated_post} =
            post
            |> HiringPost.update_changeset(updates)
            |> Repo.update()

          updated_app
      end
    end)
  end

  @doc """
  Rejects an application.
  """
  def reject_application(application_id, organization_id, reviewer_id, admin_notes \\ nil) do
    application =
      HiringApplication
      |> preload([:hiring_post])
      |> Repo.get(application_id)

    cond do
      is_nil(application) ->
        {:error, :not_found}

      application.hiring_post.organization_id != organization_id ->
        {:error, :unauthorized}

      true ->
        application
        |> HiringApplication.review_changeset(%{
          status: "rejected",
          reviewed_at: DateTime.utc_now() |> DateTime.truncate(:second),
          reviewed_by_id: reviewer_id,
          admin_notes: admin_notes
        })
        |> Repo.update()
    end
  end

  # ============================================================================
  # Private Helpers
  # ============================================================================

  defp load_clipper_profiles(applications) do
    user_ids = Enum.map(applications, & &1.user_id)

    profiles =
      if user_ids != [] do
        from(cp in ClippsterServer.ClipperProfiles.ClipperProfile,
          where: cp.user_id in ^user_ids
        )
        |> Repo.all()
        |> Map.new(&{&1.user_id, &1})
      else
        %{}
      end

    Enum.map(applications, fn app ->
      Map.put(app, :clipper_profile, Map.get(profiles, app.user_id))
    end)
  end
end
