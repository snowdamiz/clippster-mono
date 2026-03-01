defmodule ClippsterServerWeb.RestrictionController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Organizations

  @doc """
  GET /api/user/restrictions
  Returns the effective restrictions for the current user.
  """
  def get_user_restrictions(conn, _params) do
    user = conn.assigns.current_user

    case Organizations.get_user_restrictions(user.id) do
      nil ->
        # User is not restricted
        json(conn, %{
          success: true,
          restricted: false,
          restrictions: %{
            allow_ai: true,
            allow_asset_uploads: true,
            allow_custom_prompts: true,
            allow_clipper_profile: true,
            allow_personal_social: true,
            allow_clip_deletion: true,
            force_org_watermark: false,
            require_clip_approval: false
          },
          allowed_creator_ids: :all
        })

      restrictions ->
        # Get allowed creators
        allowed_creators = Organizations.get_allowed_creators_for_user(user.id)

        json(conn, %{
          success: true,
          restricted: true,
          restricting_org_id: Map.get(restrictions, "restricting_org_id"),
          restrictions: %{
            allow_ai: Map.get(restrictions, "allow_ai", true),
            allow_asset_uploads: Map.get(restrictions, "allow_asset_uploads", false),
            allow_custom_prompts: Map.get(restrictions, "allow_custom_prompts", false),
            allow_clipper_profile: Map.get(restrictions, "allow_clipper_profile", false),
            allow_personal_social: Map.get(restrictions, "allow_personal_social", true),
            allow_clip_deletion: Map.get(restrictions, "allow_clip_deletion", false),
            force_org_watermark: Map.get(restrictions, "force_org_watermark", true),
            require_clip_approval: Map.get(restrictions, "require_clip_approval", false)
          },
          allowed_creator_ids: allowed_creators
        })
    end
  end

  @doc """
  GET /api/organizations/:id/restriction-settings
  Gets the restriction default settings for an organization.
  Admin only.
  """
  def get_restriction_settings(conn, %{"id" => organization_id}) do
    user = conn.assigns.current_user

    case Organizations.get_organization(organization_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: "Organization not found"})

      org ->
        if Organizations.is_admin?(organization_id, user.id) do
          json(conn, %{
            success: true,
            restriction_defaults: org.restriction_defaults || %{}
          })
        else
          conn
          |> put_status(:forbidden)
          |> json(%{success: false, error: "Unauthorized"})
        end
    end
  end

  @doc """
  PUT /api/organizations/:id/restriction-settings
  Updates the restriction default settings for an organization.
  Admin only.
  """
  def update_restriction_settings(conn, %{"id" => organization_id, "settings" => settings}) do
    user = conn.assigns.current_user

    case Organizations.update_restriction_defaults(organization_id, settings, user) do
      {:ok, org} ->
        json(conn, %{
          success: true,
          restriction_defaults: org.restriction_defaults
        })

      {:error, :organization_not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: "Organization not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(:forbidden)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          success: false,
          error: "Invalid settings",
          details: translate_errors(changeset)
        })
    end
  end

  @doc """
  GET /api/organizations/:id/members/:user_id/restrictions
  Gets the restriction overrides for a specific member.
  Admin only.
  """
  def get_member_restrictions(conn, %{"id" => organization_id, "user_id" => user_id}) do
    current_user = conn.assigns.current_user

    if Organizations.is_admin?(organization_id, current_user.id) do
      case Organizations.get_member(organization_id, user_id) do
        nil ->
          conn
          |> put_status(:not_found)
          |> json(%{success: false, error: "Member not found"})

        member ->
          json(conn, %{
            success: true,
            is_restricted: member.is_restricted,
            restriction_overrides: member.restriction_overrides || %{}
          })
      end
    else
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Unauthorized"})
    end
  end

  @doc """
  PUT /api/organizations/:id/members/:user_id/restrictions
  Updates the restriction overrides for a specific member.
  Admin only.
  """
  def update_member_restrictions(conn, %{"id" => organization_id, "user_id" => user_id} = params) do
    user = conn.assigns.current_user
    overrides = Map.get(params, "overrides", %{})
    is_restricted = Map.get(params, "is_restricted")

    # Update is_restricted status if provided
    result =
      if is_restricted != nil do
        Organizations.set_member_restricted(organization_id, user_id, is_restricted, user)
      else
        {:ok, nil}
      end

    case result do
      {:ok, _} ->
        # Update overrides
        case Organizations.update_member_restrictions(organization_id, user_id, overrides, user) do
          {:ok, member} ->
            json(conn, %{
              success: true,
              is_restricted: member.is_restricted,
              restriction_overrides: member.restriction_overrides
            })

          {:error, :member_not_found} ->
            conn
            |> put_status(:not_found)
            |> json(%{success: false, error: "Member not found"})

          {:error, :unauthorized} ->
            conn
            |> put_status(:forbidden)
            |> json(%{success: false, error: "Unauthorized"})

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{
              success: false,
              error: "Invalid overrides",
              details: translate_errors(changeset)
            })
        end

      {:error, :cannot_restrict_owner} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: "Cannot restrict organization owner"})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  # Helper to translate changeset errors
  defp translate_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
