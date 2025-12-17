defmodule ClippsterServerWeb.OrganizationController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Organizations
  alias ClippsterServer.Accounts

  plug ClippsterServerWeb.AuthPlug

  @doc """
  Create a new organization (convert personal account to organization).
  """
  def create(conn, %{"name" => name} = params) do
    user = conn.assigns.current_user

    attrs = %{
      name: name,
      description: Map.get(params, "description"),
      logo_url: Map.get(params, "logo_url")
    }

    case Organizations.convert_to_organization(user, attrs) do
      {:ok, organization} ->
        json(conn, %{
          success: true,
          organization: serialize_organization(organization)
        })

      {:error, :already_organization} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Account is already an organization"})

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_errors(changeset)})
    end
  end

  @doc """
  List organizations the current user is a member of.
  """
  def index(conn, _params) do
    user = conn.assigns.current_user
    organizations = Organizations.list_user_organizations(user.id)

    json(conn, %{
      success: true,
      organizations: Enum.map(organizations, fn %{organization: org, role: role} ->
        serialize_organization(org)
        |> Map.put(:role, role)
      end)
    })
  end

  @doc """
  Get a specific organization with members.
  """
  def show(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Organizations.get_organization_with_members(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found"})

      organization ->
        if Organizations.is_member?(organization.id, user.id) do
          json(conn, %{
            success: true,
            organization: serialize_organization_with_members(organization),
            role: get_user_role(organization, user.id)
          })
        else
          conn
          |> put_status(403)
          |> json(%{success: false, error: "Not a member of this organization"})
        end
    end
  end

  @doc """
  Update an organization.
  """
  def update(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    case Organizations.get_organization(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found"})

      organization ->
        attrs = Map.take(params, ["name", "description", "logo_url"])
        
        case Organizations.update_organization(organization, attrs, user) do
          {:ok, updated_org} ->
            json(conn, %{
              success: true,
              organization: serialize_organization(updated_org)
            })

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Only admins can update the organization"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  Delete an organization.
  """
  def delete(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Organizations.get_organization(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found"})

      organization ->
        case Organizations.delete_organization(organization, user) do
          {:ok, _} ->
            json(conn, %{success: true, message: "Organization deleted"})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Only the owner can delete the organization"})
        end
    end
  end

  # ============================================================================
  # Member Management
  # ============================================================================

  @doc """
  List members of an organization.
  """
  def list_members(conn, %{"organization_id" => org_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      members = Organizations.list_members(org_id)

      json(conn, %{
        success: true,
        members: Enum.map(members, &serialize_member/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Update a member's role.
  """
  def update_member(conn, %{"organization_id" => org_id, "user_id" => member_user_id, "role" => role}) do
    user = conn.assigns.current_user

    case Organizations.update_member_role(org_id, member_user_id, role, user) do
      {:ok, member} ->
        json(conn, %{success: true, member: serialize_member(member)})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Not authorized"})

      {:error, :member_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Member not found"})

      {:error, :cannot_demote_owner} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Cannot change owner's role"})

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Failed to update member"})
    end
  end

  @doc """
  Remove a member from an organization.
  """
  def remove_member(conn, %{"organization_id" => org_id, "user_id" => member_user_id}) do
    user = conn.assigns.current_user

    case Organizations.remove_member(org_id, member_user_id, user) do
      {:ok, _} ->
        json(conn, %{success: true, message: "Member removed"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Not authorized"})

      {:error, :cannot_remove_owner} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Cannot remove organization owner"})

      {:error, :member_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Member not found"})
    end
  end

  # ============================================================================
  # Invitation Management
  # ============================================================================

  @doc """
  Send an invitation to join the organization.
  """
  def create_invitation(conn, %{"organization_id" => org_id, "email" => email} = params) do
    user = conn.assigns.current_user
    role = Map.get(params, "role", "member")

    case Organizations.invite_member(org_id, email, role, user) do
      {:ok, invitation} ->
        json(conn, %{
          success: true,
          invitation: serialize_invitation(invitation),
          message: "Invitation sent to #{email}"
        })

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Not authorized to invite members"})

      {:error, :organization_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found"})

      {:error, :already_member} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "User is already a member"})

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_errors(changeset)})
    end
  end

  @doc """
  List pending invitations for an organization.
  """
  def list_invitations(conn, %{"organization_id" => org_id}) do
    user = conn.assigns.current_user

    if Organizations.is_admin?(org_id, user.id) do
      invitations = Organizations.list_pending_invitations(org_id)

      json(conn, %{
        success: true,
        invitations: Enum.map(invitations, &serialize_invitation/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can view invitations"})
    end
  end

  @doc """
  Cancel a pending invitation.
  """
  def cancel_invitation(conn, %{"organization_id" => _org_id, "id" => invitation_id}) do
    user = conn.assigns.current_user

    case Organizations.cancel_invitation(invitation_id, user) do
      {:ok, _} ->
        json(conn, %{success: true, message: "Invitation cancelled"})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Invitation not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Not authorized"})

      {:error, :already_processed} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invitation already processed"})
    end
  end

  @doc """
  Get invitation details by token (public - for acceptance page).
  """
  def get_invitation(conn, %{"token" => token}) do
    case Organizations.get_invitation_by_token(token) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Invalid or expired invitation"})

      invitation ->
        json(conn, %{
          success: true,
          invitation: %{
            organization_name: invitation.organization.name,
            organization_logo: invitation.organization.logo_url,
            role: invitation.role,
            inviter_name: invitation.invited_by_user && (invitation.invited_by_user.name || invitation.invited_by_user.email),
            expires_at: invitation.expires_at
          }
        })
    end
  end

  @doc """
  Accept an invitation (requires authentication).
  """
  def accept_invitation(conn, %{"token" => token}) do
    user = conn.assigns.current_user

    case Organizations.accept_invitation(token, user) do
      {:ok, invitation} ->
        json(conn, %{
          success: true,
          message: "Welcome to #{invitation.organization.name}!",
          organization_id: invitation.organization_id
        })

      {:error, :invalid_token} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Invalid or expired invitation"})

      {:error, :invitation_expired} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "This invitation has expired"})

      {:error, :email_mismatch} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "This invitation was sent to a different email address"})
    end
  end

  # ============================================================================
  # Member Account Creation
  # ============================================================================

  @doc """
  Create a new member account directly (admin creates account for user).
  """
  def create_member_account(conn, %{"organization_id" => org_id, "email" => email, "password" => password} = params) do
    user = conn.assigns.current_user
    role = Map.get(params, "role", "member")

    case Organizations.create_member_account(org_id, email, password, role, user) do
      {:ok, new_user} ->
        json(conn, %{
          success: true,
          user: %{
            id: new_user.id,
            email: new_user.email
          },
          message: "Account created for #{email}"
        })

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Not authorized to create member accounts"})

      {:error, :email_already_exists} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "An account with this email already exists"})

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_errors(changeset)})
    end
  end

  # ============================================================================
  # Account Type Selection
  # ============================================================================

  @doc """
  Set account type (personal or organization) for a new user.
  """
  def set_account_type(conn, %{"account_type" => account_type}) do
    user = conn.assigns.current_user

    case Organizations.set_account_type(user, account_type) do
      {:ok, updated_user} ->
        json(conn, %{
          success: true,
          account_type: updated_user.account_type
        })

      {:ok, _user, :needs_org_setup} ->
        json(conn, %{
          success: true,
          account_type: "organization",
          needs_org_setup: true
        })

      {:error, :invalid_account_type} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid account type"})
    end
  end

  # ============================================================================
  # Credit Management
  # ============================================================================

  @doc """
  Get organization's credit balance.
  """
  def get_credits(conn, %{"organization_id" => org_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      {:ok, credits} = Organizations.get_organization_credits(org_id)
      allocation = Organizations.get_member_allocation(org_id, user.id)

      json(conn, %{
        success: true,
        org_credits: %{
          hours_remaining: Decimal.to_string(credits.hours_remaining),
          hours_used: Decimal.to_string(credits.hours_used)
        },
        my_allocation: if allocation do
          %{
            hours_allocated: Decimal.to_string(allocation.hours_allocated),
            hours_used: Decimal.to_string(allocation.hours_used),
            hours_remaining: Decimal.to_string(
              ClippsterServer.Organizations.MemberCreditAllocation.remaining_hours(allocation)
            )
          }
        else
          nil
        end
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Allocate credits from org pool to a member.
  """
  def allocate_credits(conn, %{"organization_id" => org_id, "user_id" => member_id, "hours" => hours}) do
    user = conn.assigns.current_user

    case Organizations.allocate_credits_to_member(org_id, member_id, hours, user) do
      {:ok, allocation} ->
        json(conn, %{
          success: true,
          allocation: %{
            hours_allocated: Decimal.to_string(allocation.hours_allocated),
            hours_used: Decimal.to_string(allocation.hours_used)
          }
        })

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can allocate credits"})

      {:error, :not_a_member} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "User is not a member of this organization"})

      {:error, :insufficient_org_credits} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Organization does not have enough credits"})

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Failed to allocate credits"})
    end
  end

  # ============================================================================
  # Helpers
  # ============================================================================

  defp serialize_organization(org) do
    %{
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logo_url: org.logo_url,
      owner_id: org.owner_id,
      created_at: org.inserted_at
    }
  end

  defp serialize_organization_with_members(org) do
    serialize_organization(org)
    |> Map.put(:members, Enum.map(org.members, &serialize_member/1))
    |> Map.put(:owner, %{
      id: org.owner.id,
      email: org.owner.email,
      name: org.owner.name
    })
  end

  defp serialize_member(member) do
    %{
      id: member.id,
      user_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      user: if member.user do
        %{
          id: member.user.id,
          email: member.user.email,
          name: member.user.name,
          avatar_url: member.user.avatar_url
        }
      else
        nil
      end
    }
  end

  defp serialize_invitation(invitation) do
    %{
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expires_at: invitation.expires_at,
      created_at: invitation.inserted_at
    }
  end

  defp get_user_role(organization, user_id) do
    member = Enum.find(organization.members, fn m -> m.user_id == user_id end)
    if member, do: member.role, else: nil
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

  defp format_errors(error) when is_atom(error), do: to_string(error)
  defp format_errors(error), do: inspect(error)
end

