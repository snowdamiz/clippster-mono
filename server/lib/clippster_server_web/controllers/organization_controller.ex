defmodule ClippsterServerWeb.OrganizationController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Organizations
  alias ClippsterServer.Accounts
  alias ClippsterServer.Repo
  alias ClippsterServer.Storage

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
      organizations:
        Enum.map(organizations, fn %{organization: org, role: role} ->
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
        attrs =
          Map.take(params, [
            "name",
            "description",
            "bio",
            "logo_url",
            "website_url",
            "public_contact_email",
            "content_type_tags",
            "settings",
            "restriction_defaults"
          ])

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

  @doc """
  Upload logo for organization.
  """
  def upload_logo(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with organization when not is_nil(organization) <- Organizations.get_organization(id),
         true <- Organizations.is_admin?(organization.id, user.id),
         %Plug.Upload{path: temp_path, filename: filename} <- params["file"] do
      # Read file contents
      {:ok, file_binary} = File.read(temp_path)

      # Generate storage key
      key = "organizations/#{id}/logo-#{System.unique_integer([:positive])}-#{filename}"

      # Determine content type
      content_type = MIME.from_path(filename)

      # Upload to R2
      case Storage.upload_file(file_binary, key, content_type: content_type) do
        {:ok, url} ->
          # Update organization with logo URL (store raw URL)
          case Organizations.update_organization(organization, %{"logo_url" => url}, user) do
            {:ok, _updated_org} ->
              json(conn, %{
                success: true,
                logo_url: maybe_presign_url(url)
              })

            {:error, _} ->
              conn
              |> put_status(500)
              |> json(%{success: false, error: "Failed to save logo URL"})
          end

        {:error, reason} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to upload logo: #{inspect(reason)}"})
      end
    else
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found or no file provided"})

      false ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can upload organization logo"})

      _ ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid request"})
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

      # Include allocation info for each member
      members_with_allocations =
        Enum.map(members, fn member ->
          allocation = Organizations.get_member_allocation(org_id, member.user_id)
          serialize_member_with_allocation(member, allocation)
        end)

      json(conn, %{
        success: true,
        members: members_with_allocations
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
  def update_member(conn, %{
        "organization_id" => org_id,
        "user_id" => member_user_id,
        "role" => role
      }) do
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

  @doc """
  Update a member's account details (admin only).
  """
  def update_member_account(
        conn,
        %{"organization_id" => org_id, "user_id" => member_user_id} = params
      ) do
    user = conn.assigns.current_user

    # Only admins can update member accounts
    unless Organizations.is_admin?(org_id, user.id) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can update member accounts"})
    else
      # Get the member
      case Organizations.get_member(org_id, member_user_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Member not found"})

        member ->
          # Verify this user was created by this organization
          org_id_int = if is_binary(org_id), do: String.to_integer(org_id), else: org_id

          unless member.user.created_by_organization_id == org_id_int do
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Can only edit users created by this organization"})
          else
            # Build update attrs
            attrs = %{}
            attrs = if params["name"], do: Map.put(attrs, :name, params["name"]), else: attrs
            attrs = if params["email"], do: Map.put(attrs, :email, params["email"]), else: attrs

            # Handle password separately
            result =
              if params["password"] && String.length(params["password"]) >= 8 do
                # Update with new password
                member.user
                |> Accounts.User.password_changeset(%{password: params["password"]})
                |> then(fn changeset ->
                  # Also apply name/email changes
                  Ecto.Changeset.cast(changeset, attrs, [:name, :email])
                end)
                |> Repo.update()
              else
                # Update without password
                if map_size(attrs) > 0 do
                  member.user
                  |> Ecto.Changeset.cast(%{}, [])
                  |> Ecto.Changeset.cast(attrs, [:name, :email])
                  |> Repo.update()
                else
                  {:ok, member.user}
                end
              end

            case result do
              {:ok, updated_user} ->
                json(conn, %{
                  success: true,
                  user: %{
                    id: updated_user.id,
                    email: updated_user.email,
                    name: updated_user.name
                  }
                })

              {:error, changeset} ->
                conn
                |> put_status(422)
                |> json(%{success: false, error: format_errors(changeset)})
            end
          end
      end
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

      {:error, :invitation_pending} ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "An invitation has already been sent to this email address"
        })

      {:error, :user_not_found} ->
        conn
        |> put_status(404)
        |> json(%{
          success: false,
          error:
            "No account found with this email address. The user must create an account before they can be invited to an organization."
        })

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
  Resend an invitation email.
  """
  def resend_invitation(conn, %{"organization_id" => org_id, "id" => invitation_id}) do
    user = conn.assigns.current_user

    case Organizations.resend_invitation(org_id, invitation_id, user) do
      {:ok, _} ->
        json(conn, %{success: true, message: "Invitation resent"})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Invitation not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Not authorized"})

      {:error, :invitation_expired} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invitation has expired"})

      {:error, :not_pending} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invitation is no longer pending"})
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
            inviter_name:
              invitation.invited_by_user &&
                (invitation.invited_by_user.name || invitation.invited_by_user.email),
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

      {:error, :basic_tier_cannot_join} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Upgrade to Starter or higher to join organizations"})
    end
  end

  @doc """
  Accept an invitation by ID (for in-app acceptance).
  """
  def accept_invitation_by_id(conn, %{"id" => invitation_id}) do
    user = conn.assigns.current_user

    case Organizations.accept_invitation_by_id(invitation_id, user) do
      {:ok, invitation} ->
        json(conn, %{
          success: true,
          message: "Welcome to #{invitation.organization.name}!",
          organization_id: invitation.organization_id
        })

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Invitation not found or already processed"})

      {:error, :invitation_expired} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "This invitation has expired"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "This invitation was sent to a different account"})

      {:error, :basic_tier_cannot_join} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Upgrade to Starter or higher to join organizations"})
    end
  end

  @doc """
  Decline an invitation (requires authentication).
  Returns organization info so the client can create an in-app notification.
  """
  def decline_invitation(conn, %{"id" => invitation_id}) do
    user = conn.assigns.current_user

    case Organizations.decline_invitation(invitation_id, user) do
      {:ok, invitation} ->
        # Return info for in-app notification to org owner
        json(conn, %{
          success: true,
          message: "Invitation declined",
          notification: %{
            organization_id: invitation.organization_id,
            organization_name: invitation.organization.name,
            inviter_user_id: invitation.invited_by,
            declined_by_name: user.name || user.email
          }
        })

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Invitation not found"})

      {:error, :already_processed} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invitation already processed"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Not authorized to decline this invitation"})
    end
  end

  @doc """
  Invite a user to join the organization by user_id (for Clipper Directory).
  """
  def invite_user(conn, %{"organization_id" => org_id, "user_id" => user_id} = params) do
    user = conn.assigns.current_user
    role = Map.get(params, "role", "member")

    case Organizations.invite_member_by_user_id(org_id, user_id, role, user) do
      {:ok, invitation} ->
        json(conn, %{
          success: true,
          invitation: serialize_invitation(invitation),
          message: "Invitation sent"
        })

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Not authorized to invite members"})

      {:error, :user_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User not found"})

      {:error, :already_member} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "User is already a member"})

      {:error, :invitation_pending} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "An invitation has already been sent to this user"})

      {:error, :seat_limit_reached} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Organization seat limit reached"})

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Failed to send invitation"})
    end
  end

  @doc """
  List pending invitations for the current user.
  """
  def list_my_invitations(conn, _params) do
    user = conn.assigns.current_user
    invitations = Organizations.list_user_pending_invitations(user.email)

    json(conn, %{
      success: true,
      invitations:
        Enum.map(invitations, fn inv ->
          %{
            id: inv.id,
            organization_id: inv.organization_id,
            organization_name: inv.organization.name,
            organization_logo: inv.organization.logo_url,
            role: inv.role,
            inviter_name:
              inv.invited_by_user && (inv.invited_by_user.name || inv.invited_by_user.email),
            expires_at: inv.expires_at,
            inserted_at: inv.inserted_at
          }
        end)
    })
  end

  # ============================================================================
  # Member Account Creation
  # ============================================================================

  @doc """
  Create a new member account directly (admin creates account for user).
  """
  def create_member_account(
        conn,
        %{"organization_id" => org_id, "email" => email, "password" => password} = params
      ) do
    user = conn.assigns.current_user
    role = Map.get(params, "role", "member")
    name = Map.get(params, "name")

    case Organizations.create_member_account(org_id, email, password, role, name, user) do
      {:ok, new_user} ->
        json(conn, %{
          success: true,
          user: %{
            id: new_user.id,
            email: new_user.email,
            name: new_user.name
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
        my_allocation:
          if allocation do
            %{
              hours_allocated: Decimal.to_string(allocation.hours_allocated),
              hours_used: Decimal.to_string(allocation.hours_used),
              hours_remaining:
                Decimal.to_string(
                  ClippsterServer.Organizations.MemberCreditAllocation.remaining_hours(allocation)
                ),
              allow_pool_fallback: allocation.allow_pool_fallback
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
  def allocate_credits(conn, %{
        "organization_id" => org_id,
        "user_id" => member_id,
        "hours" => hours
      }) do
    user = conn.assigns.current_user

    case Organizations.allocate_credits_to_member(org_id, member_id, hours, user) do
      {:ok, allocation} ->
        # Get updated org pool balance
        {:ok, org_credit} = Organizations.get_organization_credits(org_id)

        json(conn, %{
          success: true,
          allocation: %{
            hours_allocated: Decimal.to_string(allocation.hours_allocated),
            hours_used: Decimal.to_string(allocation.hours_used),
            allow_pool_fallback: allocation.allow_pool_fallback
          },
          org_pool_remaining: Decimal.to_string(org_credit.hours_remaining)
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

      {:error, :org_credits_not_found} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Organization has no credits. Purchase credits first."})

      {:error, _} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Failed to allocate credits"})
    end
  end

  @doc """
  Toggle allow_pool_fallback for a member.
  Only admins can toggle this setting.
  Creates a member allocation if one doesn't exist yet.
  """
  def toggle_pool_fallback(conn, %{
        "organization_id" => org_id,
        "user_id" => member_id,
        "allow_pool_fallback" => allow_fallback
      }) do
    user = conn.assigns.current_user

    if Organizations.is_admin?(org_id, user.id) do
      with true <- Organizations.is_member?(org_id, member_id) do
        # Get or create allocation - this ensures the member has an allocation record
        allocation = Organizations.get_or_create_member_allocation(org_id, member_id)

        case allocation
             |> ClippsterServer.Organizations.MemberCreditAllocation.changeset(%{
               allow_pool_fallback: allow_fallback
             })
             |> Repo.update() do
          {:ok, updated_allocation} ->
            json(conn, %{
              success: true,
              allocation: %{
                hours_allocated: Decimal.to_string(updated_allocation.hours_allocated),
                hours_used: Decimal.to_string(updated_allocation.hours_used),
                allow_pool_fallback: updated_allocation.allow_pool_fallback
              }
            })

          {:error, _changeset} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: "Failed to update pool fallback setting"})
        end
      else
        false ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "User is not a member of this organization"})
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can change this setting"})
    end
  end

  @doc """
  Get organization's credit transaction history.
  Only admins can view transaction history.
  """
  def get_transactions(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_admin?(org_id, user.id) do
      limit = Map.get(params, "limit", "50") |> parse_int(50)
      offset = Map.get(params, "offset", "0") |> parse_int(0)

      {:ok, %{transactions: transactions, total: total}} =
        Organizations.list_organization_transactions(org_id, limit: limit, offset: offset)

      json(conn, %{
        success: true,
        transactions: Enum.map(transactions, &format_transaction/1),
        total: total,
        limit: limit,
        offset: offset
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can view transaction history"})
    end
  end

  @doc """
  Returns Stripe invoices for the organization's subscription.
  Fetches directly from Stripe so the initial setup payment and all recurring
  charges are always visible, regardless of whether they were recorded locally.
  """
  def get_subscription_invoices(conn, %{"organization_id" => org_id_raw}) do
    user = conn.assigns.current_user

    if Organizations.is_admin?(org_id_raw, user.id) do
      org_id = if is_binary(org_id_raw), do: String.to_integer(org_id_raw), else: org_id_raw

      case Repo.get(ClippsterServer.Organizations.Organization, org_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Organization not found"})

        %{stripe_customer_id: nil, stripe_subscription_id: nil} ->
          json(conn, %{success: true, invoices: []})

        org ->
          customer_id = org.stripe_customer_id
          subscription_id = org.stripe_subscription_id

          stripe_params =
            %{limit: 50}
            |> then(fn p -> if customer_id, do: Map.put(p, :customer, customer_id), else: p end)
            |> then(fn p ->
              if subscription_id, do: Map.put(p, :subscription, subscription_id), else: p
            end)

          case Stripe.Invoice.list(stripe_params) do
            {:ok, %{data: invoices}} ->
              formatted =
                Enum.map(invoices, fn inv ->
                  %{
                    id: safe_get(inv, :id),
                    number: safe_get(inv, :number),
                    status: safe_get(inv, :status),
                    amount_paid: safe_get(inv, :amount_paid),
                    amount_due: safe_get(inv, :amount_due),
                    currency: safe_get(inv, :currency),
                    created: safe_get(inv, :created),
                    period_start: safe_get(inv, :period_start),
                    period_end: safe_get(inv, :period_end),
                    hosted_invoice_url: safe_get(inv, :hosted_invoice_url),
                    invoice_pdf: safe_get(inv, :invoice_pdf),
                    description: safe_get(inv, :description)
                  }
                end)

              json(conn, %{success: true, invoices: formatted})

            {:error, %Stripe.Error{message: msg}} ->
              conn
              |> put_status(500)
              |> json(%{success: false, error: msg})
          end
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can view invoices"})
    end
  end

  defp safe_get(obj, key) when is_struct(obj) do
    Map.get(obj, key)
  rescue
    _ -> nil
  end

  defp safe_get(obj, key) when is_map(obj), do: Map.get(obj, key)
  defp safe_get(_, _), do: nil

  defp format_transaction(transaction) do
    %{
      id: transaction.id,
      pack_type: transaction.pack_type,
      hours_purchased: Decimal.to_string(transaction.hours_purchased),
      amount_usd: Decimal.to_string(transaction.amount_usd),
      amount_sol:
        if(transaction.amount_sol, do: Decimal.to_string(transaction.amount_sol), else: nil),
      payment_method: transaction.payment_method,
      status: transaction.status,
      purchased_at: DateTime.to_iso8601(transaction.inserted_at),
      purchased_by:
        if transaction.purchased_by do
          %{
            id: transaction.purchased_by.id,
            name: transaction.purchased_by.name,
            email: transaction.purchased_by.email
          }
        else
          nil
        end
    }
  end

  defp parse_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {int, _} -> int
      :error -> default
    end
  end

  defp parse_int(value, _default) when is_integer(value), do: value
  defp parse_int(_, default), do: default

  # ============================================================================
  # Helpers
  # ============================================================================

  defp serialize_organization(org) do
    %{
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      bio: org.bio,
      logo_url: maybe_presign_url(org.logo_url),
      website_url: org.website_url,
      public_contact_email: org.public_contact_email,
      content_type_tags: org.content_type_tags || [],
      owner_id: org.owner_id,
      created_at: org.inserted_at,
      settings: org.settings || %{},
      restriction_defaults: org.restriction_defaults || %{},
      setup_completed: org.setup_completed,
      admin_price_cents: org.admin_price_cents,
      subscription_tier: org.subscription_tier,
      subscription_status: org.subscription_status,
      monthly_credits: org.monthly_credits,
      max_seats: org.max_seats
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
      is_restricted: member.is_restricted || false,
      restriction_overrides: member.restriction_overrides,
      user:
        if member.user do
          %{
            id: member.user.id,
            email: member.user.email,
            name: member.user.name,
            avatar_url: member.user.avatar_url,
            created_by_organization_id: member.user.created_by_organization_id
          }
        else
          nil
        end
    }
  end

  defp serialize_member_with_allocation(member, allocation) do
    base = serialize_member(member)

    allocation_data =
      if allocation do
        remaining = Organizations.MemberCreditAllocation.remaining_hours(allocation)

        %{
          hours_allocated: Decimal.to_string(allocation.hours_allocated),
          hours_used: Decimal.to_string(allocation.hours_used),
          hours_remaining: Decimal.to_string(remaining)
        }
      else
        %{
          hours_allocated: "0",
          hours_used: "0",
          hours_remaining: "0"
        }
      end

    Map.put(base, :allocation, allocation_data)
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

  # Presign a URL only if it's from R2 storage (not external URLs)
  defp maybe_presign_url(nil), do: nil

  defp maybe_presign_url(url) when is_binary(url) do
    if is_r2_storage_url?(url) do
      Storage.presigned_url!(url)
    else
      url
    end
  end

  # Check if a URL is from R2 storage
  defp is_r2_storage_url?(url) do
    base = Storage.public_url_base()

    cond do
      base && String.starts_with?(url, base) -> true
      String.contains?(url, ".r2.cloudflarestorage.com/") -> true
      String.starts_with?(url, "organizations/") -> true
      true -> false
    end
  end
end
