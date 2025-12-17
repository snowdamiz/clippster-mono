defmodule ClippsterServer.Organizations do
  @moduledoc """
  The Organizations context - manages organizations, members, invitations, and org credits.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Organizations.{
    Organization,
    OrganizationMember,
    OrganizationInvitation,
    OrganizationCredit,
    MemberCreditAllocation
  }
  alias ClippsterServer.{Emails, Mailer}

  # ============================================================================
  # Organization CRUD
  # ============================================================================

  @doc """
  Creates a new organization with the given user as owner.
  Also creates the owner as a member with "owner" role.
  """
  def create_organization(%User{} = owner, attrs) do
    Repo.transaction(fn ->
      # Create the organization
      {:ok, organization} = %Organization{}
        |> Organization.create_changeset(Map.put(attrs, :owner_id, owner.id))
        |> Repo.insert()

      # Add owner as a member
      {:ok, _member} = %OrganizationMember{}
        |> OrganizationMember.create_changeset(%{
          organization_id: organization.id,
          user_id: owner.id,
          role: "owner"
        })
        |> Repo.insert()

      # Initialize org credits
      {:ok, _credits} = %OrganizationCredit{}
        |> OrganizationCredit.changeset(%{organization_id: organization.id})
        |> Repo.insert()

      # Update user to organization account type
      {:ok, _user} = owner
        |> User.account_type_changeset(%{
          account_type: "organization",
          owned_organization_id: organization.id
        })
        |> Repo.update()

      organization
    end)
  end

  @doc """
  Converts an existing personal account to an organization account.
  Creates an organization and makes the user the owner.
  """
  def convert_to_organization(%User{} = user, org_attrs) do
    if user.account_type == "organization" do
      {:error, :already_organization}
    else
      create_organization(user, org_attrs)
    end
  end

  @doc """
  Gets an organization by ID.
  """
  def get_organization(id) do
    Repo.get(Organization, id)
  end

  @doc """
  Gets an organization by ID with preloaded associations.
  """
  def get_organization_with_members(id) do
    Organization
    |> where([o], o.id == ^id)
    |> preload([:owner, members: :user])
    |> Repo.one()
  end

  @doc """
  Gets an organization by slug.
  """
  def get_organization_by_slug(slug) do
    Repo.get_by(Organization, slug: slug)
  end

  @doc """
  Updates an organization.
  Only owner/admin can update.
  """
  def update_organization(%Organization{} = organization, attrs, %User{} = user) do
    if is_admin?(organization.id, user.id) do
      organization
      |> Organization.update_changeset(attrs)
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Deletes an organization.
  Only the owner can delete.
  """
  def delete_organization(%Organization{} = organization, %User{} = user) do
    if is_owner?(organization.id, user.id) do
      Repo.transaction(fn ->
        # Clear owned_organization_id from owner
        Repo.update_all(
          from(u in User, where: u.owned_organization_id == ^organization.id),
          set: [owned_organization_id: nil, account_type: "personal"]
        )

        Repo.delete(organization)
      end)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Lists all organizations where the user is a member.
  """
  def list_user_organizations(user_id) do
    Organization
    |> join(:inner, [o], m in OrganizationMember, on: m.organization_id == o.id)
    |> where([o, m], m.user_id == ^user_id)
    |> select([o, m], %{organization: o, role: m.role})
    |> Repo.all()
  end

  # ============================================================================
  # Member Management
  # ============================================================================

  @doc """
  Adds a user as a member to an organization.
  """
  def add_member(organization_id, user_id, role \\ "member") do
    %OrganizationMember{}
    |> OrganizationMember.create_changeset(%{
      organization_id: organization_id,
      user_id: user_id,
      role: role
    })
    |> Repo.insert()
  end

  @doc """
  Removes a member from an organization.
  Cannot remove the owner.
  """
  def remove_member(organization_id, user_id, %User{} = requester) do
    with {:ok, _} <- verify_admin(organization_id, requester.id),
         member when not is_nil(member) <- get_member(organization_id, user_id),
         false <- member.role == "owner" do
      
      # Also delete their credit allocation
      Repo.delete_all(
        from(a in MemberCreditAllocation,
          where: a.organization_id == ^organization_id and a.user_id == ^user_id)
      )
      
      Repo.delete(member)
    else
      nil -> {:error, :member_not_found}
      true -> {:error, :cannot_remove_owner}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Updates a member's role.
  """
  def update_member_role(organization_id, user_id, new_role, %User{} = requester) do
    with {:ok, _} <- verify_admin(organization_id, requester.id),
         member when not is_nil(member) <- get_member(organization_id, user_id) do
      
      # Cannot change owner role unless transferring ownership
      if member.role == "owner" and new_role != "owner" do
        {:error, :cannot_demote_owner}
      else
        member
        |> OrganizationMember.update_role_changeset(%{role: new_role})
        |> Repo.update()
      end
    else
      nil -> {:error, :member_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Gets a specific member record.
  """
  def get_member(organization_id, user_id) do
    Repo.get_by(OrganizationMember, organization_id: organization_id, user_id: user_id)
  end

  @doc """
  Lists all members of an organization.
  """
  def list_members(organization_id) do
    OrganizationMember
    |> where([m], m.organization_id == ^organization_id)
    |> preload(:user)
    |> order_by([m], asc: m.joined_at)
    |> Repo.all()
  end

  @doc """
  Checks if a user is an admin (owner or admin role) of an organization.
  """
  def is_admin?(organization_id, user_id) do
    member = get_member(organization_id, user_id)
    member != nil and OrganizationMember.is_admin_role?(member.role)
  end

  @doc """
  Checks if a user is the owner of an organization.
  """
  def is_owner?(organization_id, user_id) do
    member = get_member(organization_id, user_id)
    member != nil and member.role == "owner"
  end

  @doc """
  Checks if a user is a member of an organization (any role).
  """
  def is_member?(organization_id, user_id) do
    get_member(organization_id, user_id) != nil
  end

  defp verify_admin(organization_id, user_id) do
    if is_admin?(organization_id, user_id) do
      {:ok, :authorized}
    else
      {:error, :unauthorized}
    end
  end

  # ============================================================================
  # Invitation Management
  # ============================================================================

  @doc """
  Invites a user to an organization by email.
  Sends invitation email via Resend.
  """
  def invite_member(organization_id, email, role, %User{} = inviter) do
    with {:ok, _} <- verify_admin(organization_id, inviter.id),
         organization when not is_nil(organization) <- get_organization(organization_id),
         nil <- Accounts.get_user_by_email(email) |> then(fn user ->
           if user && is_member?(organization_id, user.id), do: :already_member, else: nil
         end) do
      
      # Generate plain token first
      plain_token = OrganizationInvitation.generate_token()
      hashed_token = OrganizationInvitation.hash_token(plain_token)
      
      # Create the invitation with the hashed token
      invitation_attrs = %{
        organization_id: organization_id,
        email: email,
        role: role,
        invited_by: inviter.id
      }

      changeset = %OrganizationInvitation{}
        |> OrganizationInvitation.create_changeset(invitation_attrs)
        |> Ecto.Changeset.put_change(:token, hashed_token)

      case Repo.insert(changeset) do
        {:ok, invitation} ->
          # Send invitation email with the plain token
          email
          |> Emails.organization_invitation_email(
            organization.name,
            inviter.name || inviter.email,
            plain_token
          )
          |> Mailer.deliver()

          {:ok, invitation}

        {:error, changeset} ->
          {:error, changeset}
      end
    else
      nil -> {:error, :organization_not_found}
      :already_member -> {:error, :already_member}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Gets an invitation by token (for acceptance page).
  """
  def get_invitation_by_token(plain_token) do
    hashed_token = OrganizationInvitation.hash_token(plain_token)
    
    OrganizationInvitation
    |> where([i], i.token == ^hashed_token)
    |> where([i], i.status == "pending")
    |> preload([:organization, :invited_by_user])
    |> Repo.one()
  end

  @doc """
  Accepts an invitation and adds the user as a member.
  """
  def accept_invitation(plain_token, %User{} = user) do
    invitation = get_invitation_by_token(plain_token)

    cond do
      is_nil(invitation) ->
        {:error, :invalid_token}

      not OrganizationInvitation.can_accept?(invitation) ->
        {:error, :invitation_expired}

      invitation.email != user.email ->
        {:error, :email_mismatch}

      is_member?(invitation.organization_id, user.id) ->
        # Already a member, just mark invitation as accepted
        invitation
        |> OrganizationInvitation.accept_changeset()
        |> Repo.update()

      true ->
        Repo.transaction(fn ->
          # Add as member
          {:ok, _member} = add_member(invitation.organization_id, user.id, invitation.role)

          # Initialize credit allocation
          {:ok, _allocation} = %MemberCreditAllocation{}
            |> MemberCreditAllocation.changeset(%{
              organization_id: invitation.organization_id,
              user_id: user.id
            })
            |> Repo.insert()

          # Mark invitation as accepted
          {:ok, updated_invitation} = invitation
            |> OrganizationInvitation.accept_changeset()
            |> Repo.update()

          updated_invitation
        end)
    end
  end

  @doc """
  Cancels a pending invitation.
  """
  def cancel_invitation(invitation_id, %User{} = user) do
    invitation = Repo.get(OrganizationInvitation, invitation_id)

    cond do
      is_nil(invitation) ->
        {:error, :not_found}

      invitation.status != "pending" ->
        {:error, :already_processed}

      not is_admin?(invitation.organization_id, user.id) ->
        {:error, :unauthorized}

      true ->
        invitation
        |> OrganizationInvitation.cancel_changeset()
        |> Repo.update()
    end
  end

  @doc """
  Lists pending invitations for an organization.
  """
  def list_pending_invitations(organization_id) do
    OrganizationInvitation
    |> where([i], i.organization_id == ^organization_id)
    |> where([i], i.status == "pending")
    |> order_by([i], desc: i.inserted_at)
    |> Repo.all()
  end

  # ============================================================================
  # Member Account Creation
  # ============================================================================

  @doc """
  Creates a new account for a member directly (no invitation required).
  Organization admin creates the account with email/password.
  """
  def create_member_account(organization_id, email, password, role, %User{} = creator) do
    with {:ok, _} <- verify_admin(organization_id, creator.id),
         nil <- Accounts.get_user_by_email(email) do
      
      Repo.transaction(fn ->
        # Create the user account (already verified since admin is creating it)
        case create_verified_user(email, password) do
          {:ok, user} ->
            # Add as member
            {:ok, _member} = add_member(organization_id, user.id, role)

            # Initialize credit allocation
            {:ok, _allocation} = %MemberCreditAllocation{}
              |> MemberCreditAllocation.changeset(%{
                organization_id: organization_id,
                user_id: user.id
              })
              |> Repo.insert()

            user

          {:error, changeset} ->
            Repo.rollback(changeset)
        end
      end)
    else
      {:error, reason} -> {:error, reason}
      _existing_user -> {:error, :email_already_exists}
    end
  end

  defp create_verified_user(email, password) do
    # Create user with email provider, already verified
    user_attrs = %{
      email: email,
      password: password,
      provider: "email",
      provider_id: email,
      email_verified: true,
      account_type: "personal"  # They're a member, not an org owner
    }

    %User{}
    |> User.email_registration_changeset(user_attrs)
    |> Ecto.Changeset.put_change(:email_verified, true)
    |> Repo.insert()
  end

  # ============================================================================
  # Account Type Selection
  # ============================================================================

  @doc """
  Sets a user's account type (personal or organization).
  Called after first login when account_type is nil.
  """
  def set_account_type(%User{} = user, "personal") do
    user
    |> User.account_type_changeset(%{account_type: "personal"})
    |> Repo.update()
  end

  def set_account_type(%User{} = user, "organization") do
    # For organization, we just mark as needing setup
    # The actual org creation happens in convert_to_organization
    {:ok, user, :needs_org_setup}
  end

  def set_account_type(_user, _type) do
    {:error, :invalid_account_type}
  end

  # ============================================================================
  # Credit Allocation (Organization Pool -> Member)
  # ============================================================================

  @doc """
  Gets an organization's credit balance.
  """
  def get_organization_credits(organization_id) do
    case Repo.get(OrganizationCredit, organization_id) do
      nil -> {:ok, %{hours_remaining: Decimal.new("0"), hours_used: Decimal.new("0")}}
      credit -> {:ok, %{hours_remaining: credit.hours_remaining, hours_used: credit.hours_used}}
    end
  end

  @doc """
  Adds credits to an organization's pool.
  """
  def add_organization_credits(organization_id, hours) do
    case Repo.get(OrganizationCredit, organization_id) do
      nil ->
        %OrganizationCredit{}
        |> OrganizationCredit.changeset(%{
          organization_id: organization_id,
          hours_remaining: Decimal.new(to_string(hours))
        })
        |> Repo.insert()

      credit ->
        credit
        |> OrganizationCredit.add_hours_changeset(hours)
        |> Repo.update()
    end
  end

  @doc """
  Allocates credits from org pool to a member.
  """
  def allocate_credits_to_member(organization_id, user_id, hours, %User{} = allocator) do
    with {:ok, _} <- verify_admin(organization_id, allocator.id),
         true <- is_member?(organization_id, user_id),
         org_credit when not is_nil(org_credit) <- Repo.get(OrganizationCredit, organization_id) do
      
      hours_decimal = Decimal.new(to_string(hours))
      
      # Check if org has enough credits
      if Decimal.compare(org_credit.hours_remaining, hours_decimal) == :lt do
        {:error, :insufficient_org_credits}
      else
        Repo.transaction(fn ->
          # Deduct from org pool
          {:ok, _} = org_credit
            |> OrganizationCredit.deduct_hours_changeset(hours)
            |> Repo.update()

          # Get or create member allocation
          allocation = get_or_create_member_allocation(organization_id, user_id)

          # Add to member allocation
          {:ok, updated_allocation} = allocation
            |> MemberCreditAllocation.allocate_hours_changeset(hours)
            |> Repo.update()

          updated_allocation
        end)
      end
    else
      false -> {:error, :not_a_member}
      nil -> {:error, :org_credits_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Gets a member's credit allocation within an organization.
  """
  def get_member_allocation(organization_id, user_id) do
    Repo.get_by(MemberCreditAllocation, organization_id: organization_id, user_id: user_id)
  end

  defp get_or_create_member_allocation(organization_id, user_id) do
    case get_member_allocation(organization_id, user_id) do
      nil ->
        {:ok, allocation} = %MemberCreditAllocation{}
          |> MemberCreditAllocation.changeset(%{
            organization_id: organization_id,
            user_id: user_id
          })
          |> Repo.insert()
        allocation

      allocation ->
        allocation
    end
  end

  @doc """
  Deducts credits from a member's org allocation.
  If allow_pool_fallback is true and member allocation is insufficient,
  will try to deduct from org pool directly.
  """
  def deduct_member_credits(organization_id, user_id, hours, allow_pool_fallback \\ false) do
    allocation = get_member_allocation(organization_id, user_id)

    case MemberCreditAllocation.deduct_hours_changeset(allocation, hours) do
      {:ok, changeset} ->
        changeset |> Repo.update()

      {:error, :insufficient_allocation} when allow_pool_fallback ->
        # Try to deduct from org pool directly but still track user usage
        case Repo.get(OrganizationCredit, organization_id) do
          nil ->
            {:error, :insufficient_credits}

          org_credit ->
            hours_decimal = Decimal.new(to_string(hours))
            # Check org pool has enough
            if Decimal.compare(org_credit.hours_remaining, hours_decimal) == :lt do
              {:error, :insufficient_credits}
            else
              # Deduct from org pool AND track the usage for this user
              Repo.transaction(fn ->
                {:ok, _updated_credit} = org_credit
                  |> OrganizationCredit.deduct_hours_changeset(hours)
                  |> Repo.update()

                # Get or create allocation for tracking usage (even if no hours allocated)
                member_allocation = get_or_create_member_allocation(organization_id, user_id)

                # Track the usage (this may result in negative remaining, but that's ok for tracking)
                new_used = Decimal.add(member_allocation.hours_used, hours_decimal)
                {:ok, updated_allocation} = member_allocation
                  |> Ecto.Changeset.change(hours_used: new_used)
                  |> Repo.update()

                updated_allocation
              end)
            end
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Sets an organization's credit balance to specific amounts.
  Admin-only operation.
  """
  def set_organization_credits(organization_id, hours_remaining, hours_used \\ nil) do
    case Repo.get(OrganizationCredit, organization_id) do
      nil ->
        # Create if doesn't exist
        %OrganizationCredit{}
        |> OrganizationCredit.changeset(%{
          organization_id: organization_id,
          hours_remaining: Decimal.new(to_string(hours_remaining)),
          hours_used: Decimal.new(to_string(hours_used || 0))
        })
        |> Repo.insert()

      org_credit ->
        changes = %{
          hours_remaining: Decimal.new(to_string(hours_remaining))
        }
        changes = if hours_used do
          Map.put(changes, :hours_used, Decimal.new(to_string(hours_used)))
        else
          changes
        end

        org_credit
        |> Ecto.Changeset.change(changes)
        |> Repo.update()
    end
  end

  @doc """
  Lists all organizations in the system.
  Admin-only operation.
  """
  def list_all_organizations do
    Organization
    |> order_by([o], desc: o.inserted_at)
    |> Repo.all()
  end

  @doc """
  Counts the number of members in an organization.
  """
  def count_members(organization_id) do
    OrganizationMember
    |> where([m], m.organization_id == ^organization_id)
    |> Repo.aggregate(:count)
  end
end

