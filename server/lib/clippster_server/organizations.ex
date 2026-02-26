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
    OrganizationCreditTransaction,
    MemberCreditAllocation,
    OrganizationAsset,
    OrganizationCreatorProfile,
    OrganizationCreatorPlatformLink,
    OrganizationProfileAssignment,
    OrganizationSharedClip,
    SharedClipRecipient,
    OrganizationApplication
  }

  alias ClippsterServer.{Emails, Mailer}
  alias ClippsterServer.Storage

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
      {:ok, organization} =
        %Organization{}
        |> Organization.create_changeset(Map.put(attrs, :owner_id, owner.id))
        |> Repo.insert()

      # Add owner as a member
      {:ok, _member} =
        %OrganizationMember{}
        |> OrganizationMember.create_changeset(%{
          organization_id: organization.id,
          user_id: owner.id,
          role: "owner"
        })
        |> Repo.insert()

      # Initialize org credits
      {:ok, _credits} =
        %OrganizationCredit{}
        |> OrganizationCredit.changeset(%{organization_id: organization.id})
        |> Repo.insert()

      # Update user to organization account type
      {:ok, _user} =
        owner
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
    ensure_owner_membership_for_org(id)

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
  Deletes an organization as an admin (bypasses owner check).
  Should only be called after verifying no active subscription.
  """
  def delete_organization_as_admin(%Organization{} = organization) do
    Repo.transaction(fn ->
      Repo.update_all(
        from(u in User, where: u.owned_organization_id == ^organization.id),
        set: [owned_organization_id: nil, account_type: "personal"]
      )

      Repo.delete(organization)
    end)
  end

  @doc """
  Lists all organizations where the user is a member.
  """
  def list_user_organizations(user_id) do
    case normalize_id(user_id) do
      nil ->
        []

      user_id_int ->
        ensure_owned_organization_memberships(user_id_int)

        member_orgs =
          Organization
          |> join(:inner, [o], m in OrganizationMember, on: m.organization_id == o.id)
          |> where([_o, m], m.user_id == ^user_id_int)
          |> select([o, m], %{organization: o, role: m.role})
          |> Repo.all()

        owner_orgs =
          Organization
          |> where([o], o.owner_id == ^user_id_int)
          |> select([o], %{organization: o, role: "owner"})
          |> Repo.all()

        (member_orgs ++ owner_orgs)
        |> Enum.uniq_by(fn %{organization: org} -> org.id end)
    end
  end

  # ============================================================================
  # Member Management
  # ============================================================================

  @doc """
  Adds a user as a member to an organization.
  Enforces seat limits if organization has an active subscription.
  Owner role bypasses seat limit checks.
  """
  def add_member(organization_id, user_id, role \\ "member") do
    IO.puts("[Organizations] add_member called: org_id=#{organization_id}, user_id=#{user_id}, role=#{role}")
    
    # Skip seat limit check for owner role
    if role == "owner" do
      result = %OrganizationMember{}
      |> OrganizationMember.create_changeset(%{
        organization_id: organization_id,
        user_id: user_id,
        role: role
      })
      |> Repo.insert()
      
      case result do
        {:ok, member} ->
          IO.puts("[Organizations] add_member SUCCESS: created member id=#{member.id}")
          {:ok, member}
        {:error, changeset} ->
          IO.puts("[Organizations] add_member FAILED: #{inspect(changeset.errors)}")
          {:error, changeset}
      end
    else
      # Check seat limit for non-owner members
      case ClippsterServer.OrganizationSubscriptions.can_add_member?(organization_id) do
        {:error, :seat_limit_reached} ->
          {:error, :seat_limit_reached}

        {:ok, _} ->
          %OrganizationMember{}
          |> OrganizationMember.create_changeset(%{
            organization_id: organization_id,
            user_id: user_id,
            role: role
          })
          |> Repo.insert()
      end
    end
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
          where: a.organization_id == ^organization_id and a.user_id == ^user_id
        )
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
    IO.puts("[Organizations] get_member called: org_id=#{inspect(organization_id)}, user_id=#{inspect(user_id)}")
    
    with org_id when is_integer(org_id) <- normalize_id(organization_id),
         user_id_int when is_integer(user_id_int) <- normalize_id(user_id) do
      IO.puts("[Organizations] get_member normalized: org_id=#{org_id}, user_id=#{user_id_int}")
      
      case fetch_member(org_id, user_id_int) do
        nil ->
          IO.puts("[Organizations] get_member: member not found, attempting backfill")
          maybe_backfill_owner_membership(org_id, user_id_int)
          result = fetch_member(org_id, user_id_int)
          IO.puts("[Organizations] get_member after backfill: #{inspect(result)}")
          result

        member ->
          IO.puts("[Organizations] get_member: found member with role=#{member.role}")
          member
      end
    else
      _ -> 
        IO.puts("[Organizations] get_member: normalization failed")
        nil
    end
  end

  @doc """
  Lists all members of an organization.
  """
  def list_members(organization_id) do
    case normalize_id(organization_id) do
      nil ->
        []

      org_id ->
        ensure_owner_membership_for_org(org_id)

        OrganizationMember
        |> where([m], m.organization_id == ^org_id)
        |> preload(:user)
        |> order_by([m], asc: m.joined_at)
        |> Repo.all()
    end
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
    result = get_member(organization_id, user_id) != nil
    IO.puts("[Organizations] is_member? org_id=#{organization_id}, user_id=#{user_id} => #{result}")
    result
  end

  defp fetch_member(organization_id, user_id) do
    OrganizationMember
    |> where([m], m.organization_id == ^organization_id and m.user_id == ^user_id)
    |> preload(:user)
    |> Repo.one()
  end

  defp ensure_owner_membership_for_org(organization_id) do
    with org_id when is_integer(org_id) <- normalize_id(organization_id),
         %Organization{owner_id: owner_id} when is_integer(owner_id) <-
           Repo.get(Organization, org_id) do
      ensure_owner_membership(org_id, owner_id)
    else
      _ -> :ok
    end
  end

  defp ensure_owned_organization_memberships(user_id) do
    Organization
    |> where([o], o.owner_id == ^user_id)
    |> select([o], o.id)
    |> Repo.all()
    |> Enum.each(fn org_id -> ensure_owner_membership(org_id, user_id) end)
  end

  defp maybe_backfill_owner_membership(organization_id, user_id) do
    IO.puts("[Organizations] maybe_backfill_owner_membership: org_id=#{organization_id}, user_id=#{user_id}")
    
    case Repo.get(Organization, organization_id) do
      %Organization{owner_id: ^user_id} = org ->
        IO.puts("[Organizations] User #{user_id} IS the owner of org #{organization_id} (owner_id=#{org.owner_id}), backfilling...")
        ensure_owner_membership(organization_id, user_id)

      %Organization{owner_id: actual_owner_id} ->
        IO.puts("[Organizations] User #{user_id} is NOT the owner of org #{organization_id} (owner_id=#{inspect(actual_owner_id)})")
        :ok

      nil ->
        IO.puts("[Organizations] Organization #{organization_id} not found!")
        :ok
    end
  end

  defp ensure_owner_membership(organization_id, owner_id) do
    if is_nil(fetch_member(organization_id, owner_id)) do
      IO.puts("[Organizations] ensure_owner_membership: inserting member for org=#{organization_id}, user=#{owner_id}")
      
      %OrganizationMember{}
      |> OrganizationMember.create_changeset(%{
        organization_id: organization_id,
        user_id: owner_id,
        role: "owner"
      })
      |> Repo.insert(
        on_conflict: [set: [role: "owner"]],
        conflict_target: [:organization_id, :user_id]
      )
      |> case do
        {:ok, member} ->
          IO.puts("[Organizations] ensure_owner_membership SUCCESS: member id=#{member.id}")
          :ok
        {:error, changeset} ->
          IO.puts("[Organizations] ensure_owner_membership FAILED: #{inspect(changeset.errors)}")
          IO.puts("[Organizations] ensure_owner_membership changeset: #{inspect(changeset)}")
          :ok
      end
    else
      IO.puts("[Organizations] ensure_owner_membership: member already exists for org=#{organization_id}, user=#{owner_id}")
      :ok
    end
  end

  defp normalize_id(value) when is_integer(value), do: value

  defp normalize_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> nil
    end
  end

  defp normalize_id(_), do: nil

  defp verify_admin(organization_id, user_id) do
    if is_admin?(organization_id, user_id) do
      {:ok, :authorized}
    else
      {:error, :unauthorized}
    end
  end

  defp check_not_solo_tier(organization_id) do
    org = Repo.get(Organization, organization_id)

    if org && org.subscription_tier == "solo" do
      {:error, :solo_tier_no_accounts}
    else
      {:ok, :allowed}
    end
  end

  # ============================================================================
  # Invitation Management
  # ============================================================================

  @doc """
  Invites a user to an organization by email.
  Sends invitation email via Resend.
  Enforces seat limits if organization has an active subscription.
  """
  def invite_member(organization_id, email, role, %User{} = inviter) do
    with {:ok, _} <- verify_admin(organization_id, inviter.id),
         {:ok, _} <- ClippsterServer.OrganizationSubscriptions.can_add_member?(organization_id),
         organization when not is_nil(organization) <- get_organization(organization_id),
         user when not is_nil(user) <- Accounts.get_user_by_email(email),
         false <- is_member?(organization_id, user.id),
         nil <- get_pending_invitation(organization_id, email) do
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

      changeset =
        %OrganizationInvitation{}
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
      nil -> {:error, :user_not_found}
      true -> {:error, :already_member}
      %OrganizationInvitation{} -> {:error, :invitation_pending}
      {:error, :seat_limit_reached} -> {:error, :seat_limit_reached}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Gets a pending, non-expired invitation for an email in an organization.
  Returns nil if no such invitation exists.
  """
  def get_pending_invitation(organization_id, email) do
    now = DateTime.utc_now()

    OrganizationInvitation
    |> where([i], i.organization_id == ^organization_id)
    |> where([i], i.email == ^email)
    |> where([i], i.status == "pending")
    |> where([i], i.expires_at > ^now)
    |> Repo.one()
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
        case invitation
             |> OrganizationInvitation.accept_changeset()
             |> Repo.update() do
          {:ok, updated_invitation} ->
            {:ok, Repo.preload(updated_invitation, [:organization, :invited_by_user])}

          error ->
            error
        end

      true ->
        case Repo.transaction(fn ->
               # Add as member
               {:ok, _member} = add_member(invitation.organization_id, user.id, invitation.role)

               # Initialize credit allocation
               {:ok, _allocation} =
                 %MemberCreditAllocation{}
                 |> MemberCreditAllocation.changeset(%{
                   organization_id: invitation.organization_id,
                   user_id: user.id
                 })
                 |> Repo.insert()

               # Mark invitation as accepted
               {:ok, updated_invitation} =
                 invitation
                 |> OrganizationInvitation.accept_changeset()
                 |> Repo.update()

               updated_invitation
             end) do
          {:ok, updated_invitation} ->
            {:ok, Repo.preload(updated_invitation, [:organization, :invited_by_user])}

          error ->
            error
        end
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
  Resends an invitation email.
  Generates a new token and updates the expiry date.
  """
  def resend_invitation(organization_id, invitation_id, %User{} = user) do
    invitation =
      OrganizationInvitation
      |> where([i], i.id == ^invitation_id and i.organization_id == ^organization_id)
      |> preload(:organization)
      |> Repo.one()

    cond do
      is_nil(invitation) ->
        {:error, :not_found}

      not is_admin?(organization_id, user.id) ->
        {:error, :unauthorized}

      invitation.status != "pending" ->
        {:error, :not_pending}

      OrganizationInvitation.expired?(invitation) ->
        {:error, :invitation_expired}

      true ->
        # Generate new token and extend expiry
        plain_token = OrganizationInvitation.generate_token()
        hashed_token = OrganizationInvitation.hash_token(plain_token)
        new_expires_at = DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.truncate(:second)

        case invitation
             |> Ecto.Changeset.change(%{token: hashed_token, expires_at: new_expires_at})
             |> Repo.update() do
          {:ok, updated_invitation} ->
            # Resend the email
            invitation.email
            |> Emails.organization_invitation_email(
              invitation.organization.name,
              user.name || user.email,
              plain_token
            )
            |> Mailer.deliver()

            {:ok, updated_invitation}

          {:error, changeset} ->
            {:error, changeset}
        end
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
  Enforces seat limits if organization has an active subscription.
  """
  def create_member_account(organization_id, email, password, role, name, %User{} = creator) do
    with {:ok, _} <- verify_admin(organization_id, creator.id),
         {:ok, _} <- check_not_solo_tier(organization_id),
         {:ok, _} <- ClippsterServer.OrganizationSubscriptions.can_add_member?(organization_id),
         nil <- Accounts.get_user_by_email(email) do
      Repo.transaction(fn ->
        # Create the user account (already verified since admin is creating it)
        case create_verified_user(email, password, organization_id, name) do
          {:ok, user} ->
            # Add as member - mark as restricted since account was created by org
            {:ok, member} = add_member_restricted(organization_id, user.id, role)

            # Auto-assign global branding profile if one exists
            case get_global_branding_profile(organization_id) do
              %OrganizationCreatorProfile{id: profile_id} ->
                member
                |> OrganizationMember.update_branding_profile_changeset(%{
                  branding_profile_id: profile_id
                })
                |> Repo.update()

              nil ->
                :ok
            end

            # Initialize credit allocation
            {:ok, _allocation} =
              %MemberCreditAllocation{}
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
      {:error, :seat_limit_reached} -> {:error, :seat_limit_reached}
      {:error, reason} -> {:error, reason}
      _existing_user -> {:error, :email_already_exists}
    end
  end

  @doc """
  Adds a user as a restricted member to an organization.
  Used when creating accounts directly for clippers.
  """
  def add_member_restricted(organization_id, user_id, role \\ "member") do
    %OrganizationMember{}
    |> OrganizationMember.create_changeset(%{
      organization_id: organization_id,
      user_id: user_id,
      role: role,
      is_restricted: true
    })
    |> Repo.insert()
  end

  defp create_verified_user(email, password, created_by_organization_id, name) do
    # Create user with email provider, already verified
    # Mark account as created by the organization
    user_attrs = %{
      email: email,
      password: password,
      provider: "email",
      provider_id: email
    }

    # Ensure organization_id is an integer (route params come as strings)
    org_id_int =
      if is_binary(created_by_organization_id) do
        String.to_integer(created_by_organization_id)
      else
        created_by_organization_id
      end

    changeset =
      %User{}
      |> User.email_registration_changeset(user_attrs)
      |> Ecto.Changeset.put_change(:email_verified, true)
      # Auto-set to personal (they're a member, not an org owner)
      |> Ecto.Changeset.put_change(:account_type, "personal")
      |> Ecto.Changeset.put_change(:created_by_organization_id, org_id_int)

    # Add name if provided
    changeset =
      if name && name != "" do
        Ecto.Changeset.put_change(changeset, :name, name)
      else
        changeset
      end

    Repo.insert(changeset)
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
  Creates an organization credit transaction and adds credits to the pool.
  Used for both Solana and Stripe payments.
  Returns {:ok, %{org_credit: ..., transaction: ...}} or {:error, reason}
  """
  def create_org_credit_transaction_and_add_credits(
        organization_id,
        user_id,
        pack_type,
        hours,
        amount_usd,
        amount_sol,
        sol_usd_rate,
        tx_signature,
        payment_method,
        stripe_opts \\ []
      ) do
    # Check if transaction already exists (idempotency)
    case get_org_transaction_by_signature(tx_signature) do
      nil ->
        Repo.transaction(fn ->
          # Create transaction record
          tx_attrs = %{
            organization_id: organization_id,
            purchased_by_user_id: user_id,
            pack_type: pack_type,
            hours_purchased: Decimal.new(to_string(hours)),
            amount_usd: Decimal.new(to_string(amount_usd)),
            amount_sol: if(amount_sol, do: Decimal.new(to_string(amount_sol)), else: nil),
            sol_usd_rate: if(sol_usd_rate, do: Decimal.new(to_string(sol_usd_rate)), else: nil),
            tx_signature: tx_signature,
            status: "confirmed",
            payment_method: payment_method,
            stripe_session_id: Keyword.get(stripe_opts, :stripe_session_id),
            stripe_payment_intent_id: Keyword.get(stripe_opts, :stripe_payment_intent_id)
          }

          changeset =
            if payment_method == "stripe" do
              OrganizationCreditTransaction.stripe_changeset(tx_attrs)
            else
              OrganizationCreditTransaction.solana_changeset(tx_attrs)
            end

          case Repo.insert(changeset) do
            {:ok, transaction} ->
              # Add credits to organization pool
              {:ok, org_credit} = add_organization_credits(organization_id, hours)
              %{org_credit: org_credit, transaction: transaction}

            {:error, changeset} ->
              Repo.rollback(changeset)
          end
        end)

      _existing ->
        {:error, :already_processed}
    end
  end

  @doc """
  Gets an organization transaction by its signature (tx_signature).
  """
  def get_org_transaction_by_signature(tx_signature) when is_binary(tx_signature) do
    Repo.get_by(OrganizationCreditTransaction, tx_signature: tx_signature)
  end

  def get_org_transaction_by_signature(_), do: nil

  @doc """
  Gets an organization transaction by Stripe session ID.
  """
  def get_org_transaction_by_stripe_session(session_id) when is_binary(session_id) do
    Repo.get_by(OrganizationCreditTransaction, stripe_session_id: session_id)
  end

  def get_org_transaction_by_stripe_session(_), do: nil

  @doc """
  Lists all credit transactions for an organization, ordered by most recent first.
  Optionally supports pagination with limit and offset.
  """
  def list_organization_transactions(organization_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    offset = Keyword.get(opts, :offset, 0)

    query =
      from t in OrganizationCreditTransaction,
        where: t.organization_id == ^organization_id,
        order_by: [desc: t.inserted_at],
        limit: ^limit,
        offset: ^offset,
        preload: [:purchased_by]

    transactions = Repo.all(query)

    # Get total count
    count_query =
      from t in OrganizationCreditTransaction,
        where: t.organization_id == ^organization_id,
        select: count(t.id)

    total = Repo.one(count_query)

    {:ok, %{transactions: transactions, total: total}}
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
          {:ok, _} =
            org_credit
            |> OrganizationCredit.deduct_hours_changeset(hours)
            |> Repo.update()

          # Get or create member allocation
          allocation = get_or_create_member_allocation(organization_id, user_id)

          # Add to member allocation
          {:ok, updated_allocation} =
            allocation
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
        {:ok, allocation} =
          %MemberCreditAllocation{}
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
  If member has allow_pool_fallback enabled and allocation is insufficient,
  will deduct from org pool and track usage on member.
  """
  def deduct_member_credits(organization_id, user_id, hours) do
    allocation = get_member_allocation(organization_id, user_id)

    case MemberCreditAllocation.deduct_hours_changeset(allocation, hours) do
      {:ok, changeset} ->
        changeset |> Repo.update()

      {:error, :insufficient_allocation} ->
        # Check if this member has pool fallback enabled
        if allocation && allocation.allow_pool_fallback do
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
                  {:ok, _updated_credit} =
                    org_credit
                    |> OrganizationCredit.deduct_hours_changeset(hours)
                    |> Repo.update()

                  # Track the usage (this may result in negative remaining, but that's ok for tracking)
                  new_used = Decimal.add(allocation.hours_used, hours_decimal)

                  {:ok, updated_allocation} =
                    allocation
                    |> Ecto.Changeset.change(hours_used: new_used)
                    |> Repo.update()

                  updated_allocation
                end)
              end
            end
        else
          {:error, :insufficient_credits}
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

        changes =
          if hours_used do
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

  # ============================================================================
  # Organization Assets
  # ============================================================================

  @doc """
  Lists all assets for an organization.
  Optionally filter by asset_type.
  """
  def list_organization_assets(organization_id, opts \\ []) do
    asset_type = Keyword.get(opts, :asset_type)

    query =
      from a in OrganizationAsset,
        where: a.organization_id == ^organization_id,
        order_by: [desc: a.inserted_at],
        preload: [:uploaded_by]

    query =
      if asset_type do
        where(query, [a], a.asset_type == ^asset_type)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Gets a single organization asset by ID.
  """
  def get_organization_asset(id) do
    OrganizationAsset
    |> preload(:uploaded_by)
    |> Repo.get(id)
  end

  @doc """
  Gets a single organization asset by ID, scoped to an organization.
  """
  def get_organization_asset(organization_id, asset_id) do
    OrganizationAsset
    |> where([a], a.organization_id == ^organization_id and a.id == ^asset_id)
    |> preload(:uploaded_by)
    |> Repo.one()
  end

  @doc """
  Creates a new organization asset.
  Uploads the file to R2 storage and creates the database record.
  Checks for existing assets with the same content hash to prevent duplicates.
  """
  def create_organization_asset(
        organization_id,
        user_id,
        asset_type,
        file_binary,
        filename,
        opts \\ []
      ) do
    content_type = Keyword.get(opts, :content_type, "application/octet-stream")
    thumbnail_binary = Keyword.get(opts, :thumbnail_binary)
    duration = Keyword.get(opts, :duration)
    width = Keyword.get(opts, :width)
    height = Keyword.get(opts, :height)
    file_size = byte_size(file_binary)

    # Compute SHA-256 hash of file content for deduplication
    content_hash = :crypto.hash(:sha256, file_binary) |> Base.encode16(case: :lower)

    # Check for existing asset with same content hash, organization, and asset type
    case get_asset_by_hash(organization_id, asset_type, content_hash) do
      %OrganizationAsset{} = existing ->
        # Asset with same content already exists, return it without uploading
        {:ok, existing}

      nil ->
        # No existing asset found, proceed with upload
        # Generate storage key and upload to R2
        key = Storage.generate_key(organization_id, asset_type, filename)

        with {:ok, url} <- Storage.upload_file(file_binary, key, content_type: content_type),
             {:ok, thumbnail_url} <-
               maybe_upload_thumbnail(organization_id, asset_type, filename, thumbnail_binary) do
          # Create database record with content hash
          attrs = %{
            organization_id: organization_id,
            uploaded_by_user_id: user_id,
            asset_type: asset_type,
            name: filename,
            url: url,
            thumbnail_url: thumbnail_url,
            duration: duration,
            width: width,
            height: height,
            file_size: file_size,
            mime_type: content_type,
            content_hash: content_hash
          }

          %OrganizationAsset{}
          |> OrganizationAsset.create_changeset(attrs)
          |> Repo.insert()
        end
    end
  end

  # Gets an organization asset by content hash, organization ID, and asset type.
  # Used for deduplication - returns existing asset if found.
  defp get_asset_by_hash(organization_id, asset_type, content_hash) do
    OrganizationAsset
    |> where([a], a.organization_id == ^organization_id)
    |> where([a], a.asset_type == ^asset_type)
    |> where([a], a.content_hash == ^content_hash)
    |> preload(:uploaded_by)
    |> Repo.one()
  end

  defp maybe_upload_thumbnail(_org_id, _asset_type, _filename, nil), do: {:ok, nil}

  defp maybe_upload_thumbnail(organization_id, asset_type, filename, thumbnail_binary) do
    key = Storage.generate_thumbnail_key(organization_id, asset_type, filename)

    case Storage.upload_file(thumbnail_binary, key, content_type: "image/jpeg") do
      {:ok, url} -> {:ok, url}
      # Don't fail if thumbnail upload fails
      {:error, _} -> {:ok, nil}
    end
  end

  @doc """
  Updates an organization asset (name only).
  """
  def update_organization_asset(%OrganizationAsset{} = asset, attrs, %User{} = user) do
    if is_admin?(asset.organization_id, user.id) do
      asset
      |> OrganizationAsset.update_changeset(attrs)
      |> Repo.update()
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Deletes an organization asset.
  Also deletes the file from R2 storage.
  """
  def delete_organization_asset(%OrganizationAsset{} = asset, %User{} = user) do
    if is_admin?(asset.organization_id, user.id) do
      Repo.transaction(fn ->
        # Delete from R2
        Storage.delete_file_by_url(asset.url)
        if asset.thumbnail_url, do: Storage.delete_file_by_url(asset.thumbnail_url)

        # Delete database record
        case Repo.delete(asset) do
          {:ok, deleted} -> deleted
          {:error, changeset} -> Repo.rollback(changeset)
        end
      end)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Deletes an organization asset by ID.
  """
  def delete_organization_asset_by_id(organization_id, asset_id, %User{} = user) do
    case get_organization_asset(organization_id, asset_id) do
      nil -> {:error, :not_found}
      asset -> delete_organization_asset(asset, user)
    end
  end

  @doc """
  Gets all assets for organizations the user is a member of.
  Returns a map of organization_id => [assets].
  """
  def get_assets_for_user_organizations(user_id) do
    # Get all organizations the user is a member of
    org_memberships = list_user_organizations(user_id)

    org_memberships
    |> Enum.map(fn %{organization: org} ->
      assets = list_organization_assets(org.id)
      {org.id, %{organization: org, assets: assets}}
    end)
    |> Enum.into(%{})
  end

  @doc """
  Gets all asset IDs for organizations the user is a member of.
  Used for sync comparison.
  """
  def get_asset_ids_for_user_organizations(user_id) do
    org_memberships = list_user_organizations(user_id)
    org_ids = Enum.map(org_memberships, fn %{organization: org} -> org.id end)

    if Enum.empty?(org_ids) do
      []
    else
      OrganizationAsset
      |> where([a], a.organization_id in ^org_ids)
      |> select([a], %{id: a.id, organization_id: a.organization_id, updated_at: a.updated_at})
      |> Repo.all()
    end
  end

  # ============================================================================
  # Organization Creator Profiles
  # ============================================================================

  @doc """
  Lists all creator profiles for an organization.
  Optionally include disabled profiles (default: false).
  """
  def list_creator_profiles(organization_id, opts \\ []) do
    include_disabled = Keyword.get(opts, :include_disabled, false)

    query =
      OrganizationCreatorProfile
      |> where([p], p.organization_id == ^organization_id)
      |> preload([:platform_links, :intro, :outro, :watermark, assignments: :user])
      |> order_by([p], desc: p.inserted_at)

    query =
      if include_disabled do
        query
      else
        where(query, [p], p.disabled == false)
      end

    Repo.all(query)
  end

  @doc """
  Gets the global branding profile for an organization (if one exists).
  Returns the first profile with scope "global" that is not disabled, or nil.
  """
  def get_global_branding_profile(organization_id) do
    OrganizationCreatorProfile
    |> where(
      [p],
      p.organization_id == ^organization_id and p.scope == "global" and p.disabled == false
    )
    |> limit(1)
    |> Repo.one()
  end

  @doc """
  Assigns the global branding profile to restricted (org-created) members
  of the given organization who do NOT already have a streamer-scoped profile
  assignment. Organization creator profiles (streamer scope) are always superior
  to global branding and must never be overridden.
  """
  def assign_global_branding_to_restricted_members(organization_id, branding_profile_id) do
    # Find user_ids of members who have a streamer-scoped profile assignment
    members_with_streamer_profile =
      from(a in OrganizationProfileAssignment,
        join: p in OrganizationCreatorProfile,
        on: a.organization_creator_profile_id == p.id,
        join: m in OrganizationMember,
        on: m.user_id == a.user_id and m.organization_id == ^organization_id,
        where: p.organization_id == ^organization_id and p.scope == "streamer",
        select: a.user_id
      )

    from(m in OrganizationMember,
      where: m.organization_id == ^organization_id and m.is_restricted == true,
      where: m.user_id not in subquery(members_with_streamer_profile)
    )
    |> Repo.update_all(set: [branding_profile_id: branding_profile_id])
  end

  @doc """
  Lists creator profiles for an organization filtered by scope.
  Optionally include disabled profiles (default: false).
  """
  def list_creator_profiles_by_scope(organization_id, scope, opts \\ [])
      when scope in ["streamer", "global"] do
    include_disabled = Keyword.get(opts, :include_disabled, false)

    query =
      OrganizationCreatorProfile
      |> where([p], p.organization_id == ^organization_id and p.scope == ^scope)
      |> preload([:platform_links, :intro, :outro, :watermark, assignments: :user])
      |> order_by([p], desc: p.inserted_at)

    query =
      if include_disabled do
        query
      else
        where(query, [p], p.disabled == false)
      end

    Repo.all(query)
  end

  @doc """
  Gets a single creator profile by ID.
  """
  def get_creator_profile(id) do
    OrganizationCreatorProfile
    |> preload([:platform_links, :intro, :outro, :watermark, :organization, assignments: :user])
    |> Repo.get(id)
  end

  @doc """
  Gets a creator profile by ID, scoped to an organization.
  """
  def get_creator_profile(organization_id, profile_id) do
    OrganizationCreatorProfile
    |> where([p], p.organization_id == ^organization_id and p.id == ^profile_id)
    |> preload([:platform_links, :intro, :outro, :watermark, :organization, assignments: :user])
    |> Repo.one()
  end

  @doc """
  Creates a new creator profile for an organization.
  Admin only.
  """
  def create_creator_profile(organization_id, attrs, %User{} = user) do
    if is_admin?(organization_id, user.id) do
      %OrganizationCreatorProfile{}
      |> OrganizationCreatorProfile.create_changeset(
        attrs
        |> Map.put(:organization_id, organization_id)
        |> Map.put(:created_by_user_id, user.id)
      )
      |> Repo.insert()
      |> case do
        {:ok, profile} ->
          # If this is a global branding profile, assign it to all existing restricted members
          if profile.scope == "global" do
            assign_global_branding_to_restricted_members(organization_id, profile.id)
          end

          {:ok, get_creator_profile(profile.id)}

        error ->
          error
      end
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Updates a creator profile.
  Admin only.
  """
  def update_creator_profile(%OrganizationCreatorProfile{} = profile, attrs, %User{} = user) do
    if is_admin?(profile.organization_id, user.id) do
      profile
      |> OrganizationCreatorProfile.update_changeset(attrs)
      |> Repo.update()
      |> case do
        {:ok, updated} ->
          # If this is a global branding profile, ensure all restricted members point to it
          if updated.scope == "global" do
            assign_global_branding_to_restricted_members(updated.organization_id, updated.id)
          end

          {:ok, get_creator_profile(updated.id)}

        error ->
          error
      end
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Deletes a creator profile.
  Admin only.
  """
  def delete_creator_profile(%OrganizationCreatorProfile{} = profile, %User{} = user) do
    if is_admin?(profile.organization_id, user.id) do
      # Delete profile image from storage if exists
      if profile.profile_image_url do
        Storage.delete_file_by_url(profile.profile_image_url)
      end

      Repo.delete(profile)
    else
      {:error, :unauthorized}
    end
  end

  @doc """
  Deletes a creator profile by ID.
  """
  def delete_creator_profile_by_id(organization_id, profile_id, %User{} = user) do
    case get_creator_profile(organization_id, profile_id) do
      nil -> {:error, :not_found}
      profile -> delete_creator_profile(profile, user)
    end
  end

  @doc """
  Toggles the disabled state of a creator profile.
  Organization admins can toggle any profile in their organization.
  Regular users can only toggle profiles they created (not profiles assigned to them).
  """
  def toggle_creator_profile_disabled(profile_id, %User{} = user) do
    case get_creator_profile(profile_id) do
      nil ->
        {:error, :not_found}

      profile ->
        # Check if user is org admin (can toggle any profile in their org)
        is_org_admin = is_admin?(profile.organization_id, user.id)

        # Check if user created this profile
        is_creator = profile.created_by_user_id == user.id

        cond do
          is_org_admin ->
            # Org admin can toggle any profile in their organization
            profile
            |> OrganizationCreatorProfile.update_changeset(%{disabled: !profile.disabled})
            |> Repo.update()

          is_creator ->
            # User can only toggle profiles they created
            profile
            |> OrganizationCreatorProfile.update_changeset(%{disabled: !profile.disabled})
            |> Repo.update()

          true ->
            {:error, :unauthorized}
        end
    end
  end

  @doc """
  Uploads a profile image for a creator profile.
  Returns the URL.
  """
  def upload_creator_profile_image(organization_id, profile_id, image_binary, filename) do
    key = "orgs/#{organization_id}/profiles/#{profile_id}/#{filename}"

    case Storage.upload_file(image_binary, key, content_type: "image/jpeg") do
      {:ok, url} -> {:ok, url}
      error -> error
    end
  end

  # ============================================================================
  # Creator Profile Platform Links
  # ============================================================================

  @doc """
  Adds a platform link to a creator profile.
  Admin only.
  """
  def add_creator_platform_link(organization_id, profile_id, attrs, %User{} = user) do
    with true <- is_admin?(organization_id, user.id),
         profile when not is_nil(profile) <- get_creator_profile(organization_id, profile_id) do
      %OrganizationCreatorPlatformLink{}
      |> OrganizationCreatorPlatformLink.create_changeset(
        Map.put(attrs, :organization_creator_profile_id, profile.id)
      )
      |> Repo.insert()
    else
      false -> {:error, :unauthorized}
      nil -> {:error, :profile_not_found}
    end
  end

  @doc """
  Updates a platform link.
  Admin only.
  """
  def update_creator_platform_link(organization_id, link_id, attrs, %User{} = user) do
    link =
      Repo.get(OrganizationCreatorPlatformLink, link_id)
      |> Repo.preload(:organization_creator_profile)

    cond do
      is_nil(link) ->
        {:error, :not_found}

      link.organization_creator_profile.organization_id != String.to_integer("#{organization_id}") ->
        {:error, :not_found}

      not is_admin?(organization_id, user.id) ->
        {:error, :unauthorized}

      true ->
        link
        |> OrganizationCreatorPlatformLink.update_changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Deletes a platform link.
  Admin only.
  """
  def delete_creator_platform_link(organization_id, link_id, %User{} = user) do
    link =
      Repo.get(OrganizationCreatorPlatformLink, link_id)
      |> Repo.preload(:organization_creator_profile)

    cond do
      is_nil(link) ->
        {:error, :not_found}

      link.organization_creator_profile.organization_id != String.to_integer("#{organization_id}") ->
        {:error, :not_found}

      not is_admin?(organization_id, user.id) ->
        {:error, :unauthorized}

      true ->
        Repo.delete(link)
    end
  end

  # ============================================================================
  # Creator Profile Assignments
  # ============================================================================

  @doc """
  Assigns a creator profile to one or more users.
  Admin only. Users must be members of the organization.
  """
  def assign_creator_profile(organization_id, profile_id, user_ids, %User{} = admin)
      when is_list(user_ids) do
    with true <- is_admin?(organization_id, admin.id),
         profile when not is_nil(profile) <- get_creator_profile(organization_id, profile_id) do
      # Filter to only users who are members
      valid_user_ids =
        user_ids
        |> Enum.filter(fn uid -> is_member?(organization_id, uid) end)

      results =
        Enum.map(valid_user_ids, fn user_id ->
          %OrganizationProfileAssignment{}
          |> OrganizationProfileAssignment.changeset(%{
            organization_creator_profile_id: profile.id,
            user_id: user_id
          })
          |> Repo.insert(on_conflict: :nothing)
        end)

      # Return count of successful assignments
      successful =
        Enum.count(results, fn
          {:ok, _} -> true
          _ -> false
        end)

      {:ok, %{assigned: successful, total: length(user_ids)}}
    else
      false -> {:error, :unauthorized}
      nil -> {:error, :profile_not_found}
    end
  end

  @doc """
  Unassigns a creator profile from a user.
  Admin only.
  """
  def unassign_creator_profile(organization_id, profile_id, user_id, %User{} = admin) do
    with true <- is_admin?(organization_id, admin.id),
         profile when not is_nil(profile) <- get_creator_profile(organization_id, profile_id) do
      assignment =
        Repo.get_by(OrganizationProfileAssignment,
          organization_creator_profile_id: profile.id,
          user_id: user_id
        )

      case assignment do
        nil -> {:error, :not_assigned}
        a -> Repo.delete(a)
      end
    else
      false -> {:error, :unauthorized}
      nil -> {:error, :profile_not_found}
    end
  end

  @doc """
  Lists all assignments for a creator profile.
  """
  def list_profile_assignments(organization_id, profile_id) do
    OrganizationProfileAssignment
    |> join(:inner, [a], p in OrganizationCreatorProfile,
      on: a.organization_creator_profile_id == p.id
    )
    |> where([a, p], p.organization_id == ^organization_id and p.id == ^profile_id)
    |> preload(:user)
    |> Repo.all()
  end

  @doc """
  Gets all creator profiles assigned to a user across all their organizations.
  Used by members to see their assigned profiles.
  """
  def get_assigned_creator_profiles(user_id) do
    OrganizationCreatorProfile
    |> join(:inner, [p], a in OrganizationProfileAssignment,
      on: a.organization_creator_profile_id == p.id
    )
    |> where([p, a], a.user_id == ^user_id)
    |> preload([:platform_links, :intro, :outro, :watermark, :organization])
    |> order_by([p], desc: p.inserted_at)
    |> Repo.all()
  end

  @doc """
  Checks if a user has access to a creator profile.
  User has access if they are assigned to the profile or are an admin of the organization.
  """
  def has_profile_access?(profile_id, user_id) do
    profile = get_creator_profile(profile_id)

    cond do
      is_nil(profile) ->
        false

      is_admin?(profile.organization_id, user_id) ->
        true

      true ->
        # Check if assigned
        assignment =
          Repo.get_by(OrganizationProfileAssignment,
            organization_creator_profile_id: profile_id,
            user_id: user_id
          )

        assignment != nil
    end
  end

  # ============================================================================
  # Shared Clips
  # ============================================================================

  @doc """
  Creates a new shared clip for an organization.
  Uploads the video to R2 storage and creates recipient records.
  """
  def create_shared_clip(organization_id, user_id, attrs, file_binary, filename, opts \\ []) do
    content_type = Keyword.get(opts, :content_type, "video/mp4")
    thumbnail_binary = Keyword.get(opts, :thumbnail_binary)
    recipient_user_ids = Keyword.get(opts, :recipient_user_ids, [])

    # Generate storage key and upload to R2
    key = Storage.generate_key(organization_id, "shared-clips", filename)

    with {:ok, url} <- Storage.upload_file(file_binary, key, content_type: content_type),
         {:ok, thumbnail_url} <-
           maybe_upload_shared_clip_thumbnail(organization_id, filename, thumbnail_binary) do
      Repo.transaction(fn ->
        # Create the shared clip record
        clip_attrs =
          attrs
          |> Map.put(:organization_id, organization_id)
          |> Map.put(:uploaded_by_user_id, user_id)
          |> Map.put(:url, url)
          |> Map.put(:thumbnail_url, thumbnail_url)
          |> Map.put(:file_size, byte_size(file_binary))

        {:ok, clip} =
          %OrganizationSharedClip{}
          |> OrganizationSharedClip.create_changeset(clip_attrs)
          |> Repo.insert()

        # Create recipient records
        share_with_all = Map.get(attrs, :share_with_all, true)

        if share_with_all do
          # Create recipients for all org members
          create_recipients_for_all_members(clip.id, organization_id)
        else
          # Create recipients for specific users
          create_recipients_for_users(clip.id, recipient_user_ids)
        end

        clip
      end)
    end
  end

  defp maybe_upload_shared_clip_thumbnail(_org_id, _filename, nil), do: {:ok, nil}

  defp maybe_upload_shared_clip_thumbnail(organization_id, filename, thumbnail_binary) do
    key = Storage.generate_thumbnail_key(organization_id, "shared-clips", filename)

    case Storage.upload_file(thumbnail_binary, key, content_type: "image/jpeg") do
      {:ok, url} -> {:ok, url}
      {:error, _} -> {:ok, nil}
    end
  end

  defp create_recipients_for_all_members(clip_id, organization_id) do
    members = list_members(organization_id)

    Enum.each(members, fn member ->
      %SharedClipRecipient{}
      |> SharedClipRecipient.create_changeset(%{
        shared_clip_id: clip_id,
        user_id: member.user_id
      })
      |> Repo.insert()
    end)
  end

  defp create_recipients_for_users(clip_id, user_ids) do
    Enum.each(user_ids, fn user_id ->
      %SharedClipRecipient{}
      |> SharedClipRecipient.create_changeset(%{
        shared_clip_id: clip_id,
        user_id: user_id
      })
      |> Repo.insert()
    end)
  end

  @doc """
  Gets a shared clip by ID.
  """
  def get_shared_clip(clip_id) do
    Repo.get(OrganizationSharedClip, clip_id)
  end

  @doc """
  Gets a shared clip by ID with preloaded associations.
  """
  def get_shared_clip_with_recipients(clip_id) do
    OrganizationSharedClip
    |> where([c], c.id == ^clip_id)
    |> preload(recipients: :user, uploaded_by: [])
    |> Repo.one()
  end

  @doc """
  Gets a shared clip for a specific organization.
  """
  def get_shared_clip_for_org(organization_id, clip_id) do
    OrganizationSharedClip
    |> where([c], c.id == ^clip_id and c.organization_id == ^organization_id)
    |> preload(recipients: :user, uploaded_by: [])
    |> Repo.one()
  end

  @doc """
  Lists all active (non-expired) shared clips for an organization.
  """
  def list_shared_clips(organization_id) do
    now = DateTime.utc_now()

    OrganizationSharedClip
    |> where([c], c.organization_id == ^organization_id and c.expires_at > ^now)
    |> order_by([c], desc: c.inserted_at)
    |> preload([:uploaded_by, :recipients])
    |> Repo.all()
  end

  @doc """
  Lists all shared clips available to a specific user across all their organizations.
  Only returns clips where the user is a recipient and the clip hasn't expired.
  """
  def list_shared_clips_for_user(user_id) do
    now = DateTime.utc_now()

    OrganizationSharedClip
    |> join(:inner, [c], r in SharedClipRecipient, on: r.shared_clip_id == c.id)
    |> where([c, r], r.user_id == ^user_id and c.expires_at > ^now)
    |> order_by([c], desc: c.inserted_at)
    |> preload([:organization, :uploaded_by])
    |> select([c, r], %{clip: c, recipient: r})
    |> Repo.all()
  end

  @doc """
  Updates branding configuration for a shared clip.
  """
  def update_shared_clip_branding(clip_id, branding_config, branding_required, %User{} = user) do
    with clip when not is_nil(clip) <- get_shared_clip(clip_id),
         true <- is_admin?(clip.organization_id, user.id) do
      clip
      |> OrganizationSharedClip.update_branding_changeset(%{
        branding_config: branding_config,
        branding_required: branding_required
      })
      |> Repo.update()
    else
      nil -> {:error, :not_found}
      false -> {:error, :unauthorized}
    end
  end

  @doc """
  Deletes a shared clip and its R2 files.
  """
  def delete_shared_clip(clip_id, %User{} = user) do
    with clip when not is_nil(clip) <- get_shared_clip(clip_id),
         true <- is_admin?(clip.organization_id, user.id) do
      # Delete from R2
      if clip.url, do: Storage.delete_file_by_url(clip.url)
      if clip.thumbnail_url, do: Storage.delete_file_by_url(clip.thumbnail_url)

      # Delete from database (cascades to recipients)
      Repo.delete(clip)
    else
      nil -> {:error, :not_found}
      false -> {:error, :unauthorized}
    end
  end

  @doc """
  Marks a shared clip as viewed by a user.
  """
  def mark_shared_clip_viewed(clip_id, user_id) do
    case get_or_create_recipient(clip_id, user_id) do
      {:ok, recipient} ->
        recipient
        |> SharedClipRecipient.mark_viewed_changeset()
        |> Repo.update()

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Marks a shared clip as downloaded by a user.
  """
  def mark_shared_clip_downloaded(clip_id, user_id) do
    case get_or_create_recipient(clip_id, user_id) do
      {:ok, recipient} ->
        recipient
        |> SharedClipRecipient.mark_downloaded_changeset()
        |> Repo.update()

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Marks a shared clip as posted by a user.
  """
  def mark_shared_clip_posted(clip_id, user_id) do
    case get_or_create_recipient(clip_id, user_id) do
      {:ok, recipient} ->
        recipient
        |> SharedClipRecipient.mark_posted_changeset()
        |> Repo.update()

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp get_or_create_recipient(clip_id, user_id) do
    case Repo.get_by(SharedClipRecipient, shared_clip_id: clip_id, user_id: user_id) do
      nil ->
        # Check if clip exists and user has access
        clip = get_shared_clip(clip_id)

        cond do
          is_nil(clip) ->
            {:error, :clip_not_found}

          OrganizationSharedClip.expired?(clip) ->
            {:error, :clip_expired}

          not is_member?(clip.organization_id, user_id) ->
            {:error, :not_a_member}

          true ->
            # Create recipient record
            %SharedClipRecipient{}
            |> SharedClipRecipient.create_changeset(%{shared_clip_id: clip_id, user_id: user_id})
            |> Repo.insert()
        end

      recipient ->
        {:ok, recipient}
    end
  end

  @doc """
  Gets access statistics for a shared clip.
  Returns counts of viewed, downloaded, and posted.
  """
  def get_shared_clip_stats(clip_id) do
    query =
      from r in SharedClipRecipient,
        where: r.shared_clip_id == ^clip_id,
        select: %{
          total: count(r.id),
          viewed: count(r.viewed_at),
          downloaded: count(r.downloaded_at),
          posted: count(r.posted_at)
        }

    Repo.one(query) || %{total: 0, viewed: 0, downloaded: 0, posted: 0}
  end

  @doc """
  Deletes all expired shared clips and their R2 files.
  Called by the cleanup worker.
  """
  def cleanup_expired_shared_clips do
    now = DateTime.utc_now()

    expired_clips =
      OrganizationSharedClip
      |> where([c], c.expires_at < ^now)
      |> Repo.all()

    Enum.each(expired_clips, fn clip ->
      # Delete from R2
      if clip.url, do: Storage.delete_file_by_url(clip.url)
      if clip.thumbnail_url, do: Storage.delete_file_by_url(clip.thumbnail_url)

      # Delete from database
      Repo.delete(clip)
    end)

    {:ok, length(expired_clips)}
  end

  @doc """
  Checks if a user has access to a shared clip.
  User has access if they are a recipient or an admin of the organization.
  """
  def has_shared_clip_access?(clip_id, user_id) do
    clip = get_shared_clip(clip_id)

    cond do
      is_nil(clip) ->
        false

      OrganizationSharedClip.expired?(clip) ->
        false

      is_admin?(clip.organization_id, user_id) ->
        true

      true ->
        # Check if recipient
        recipient = Repo.get_by(SharedClipRecipient, shared_clip_id: clip_id, user_id: user_id)
        recipient != nil
    end
  end

  # ============================================================================
  # Restriction Management
  # ============================================================================

  @doc """
  Checks if a user is a restricted member of any organization.
  """
  def is_restricted_member?(user_id) do
    OrganizationMember
    |> where([m], m.user_id == ^user_id and m.is_restricted == true)
    |> Repo.exists?()
  end

  @doc """
  Gets the effective restrictions for a user.
  Returns a map of all effective restriction settings, merging org defaults with member overrides.
  Returns nil if user is not a restricted member.
  """
  def get_user_restrictions(user_id) do
    # Get the first organization where user is a restricted member
    member =
      OrganizationMember
      |> where([m], m.user_id == ^user_id and m.is_restricted == true)
      |> preload(:organization)
      |> Repo.one()

    case member do
      nil ->
        # User is not restricted
        nil

      member ->
        get_effective_restrictions(member.organization.id, user_id)
    end
  end

  @doc """
  Gets effective restrictions for a specific user in an organization.
  Merges org defaults with member-specific overrides.
  """
  def get_effective_restrictions(organization_id, user_id) do
    org = get_organization(organization_id)
    member = get_member(organization_id, user_id)

    cond do
      is_nil(org) or is_nil(member) ->
        nil

      not member.is_restricted ->
        # Non-restricted members have no restrictions
        %{restricted: false}

      true ->
        # Merge org defaults with member overrides
        org_defaults = org.restriction_defaults || %{}
        member_overrides = member.restriction_overrides || %{}

        # Member overrides take precedence
        effective = Map.merge(org_defaults, member_overrides)

        Map.put(effective, "restricted", true)
        |> Map.put("restricting_org_id", organization_id)
    end
  end

  @doc """
  Updates restriction defaults for an organization.
  Admin only.
  """
  def update_restriction_defaults(organization_id, settings, %User{} = admin) do
    with {:ok, _} <- verify_admin(organization_id, admin.id),
         org when not is_nil(org) <- get_organization(organization_id) do
      org
      |> Organization.update_restriction_defaults_changeset(%{restriction_defaults: settings})
      |> Repo.update()
    else
      nil -> {:error, :organization_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Updates restriction overrides for a specific member.
  Admin only.
  """
  def update_member_restrictions(organization_id, user_id, overrides, %User{} = admin) do
    with {:ok, _} <- verify_admin(organization_id, admin.id),
         member when not is_nil(member) <- get_member(organization_id, user_id) do
      member
      |> OrganizationMember.update_restriction_overrides_changeset(%{
        restriction_overrides: overrides
      })
      |> Repo.update()
    else
      nil -> {:error, :member_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Sets whether a member is restricted.
  Admin only.
  """
  def set_member_restricted(organization_id, user_id, is_restricted, %User{} = admin) do
    with {:ok, _} <- verify_admin(organization_id, admin.id),
         member when not is_nil(member) <- get_member(organization_id, user_id) do
      # Cannot restrict the owner
      if member.role == "owner" do
        {:error, :cannot_restrict_owner}
      else
        member
        |> OrganizationMember.update_restriction_overrides_changeset(%{
          is_restricted: is_restricted
        })
        |> Repo.update()
      end
    else
      nil -> {:error, :member_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Checks if a user can access a specific creator profile.
  Returns true if:
  - User is not restricted
  - User is an admin of the org
  - User is assigned to the creator profile
  """
  def can_access_creator?(user_id, creator_profile_id) do
    profile = get_creator_profile(creator_profile_id)

    cond do
      is_nil(profile) ->
        false

      # Check if user is restricted
      not is_restricted_member?(user_id) ->
        true

      # Check if user is admin of the organization
      is_admin?(profile.organization_id, user_id) ->
        true

      true ->
        # Check if user is assigned to this creator profile
        assignment =
          Repo.get_by(OrganizationProfileAssignment,
            organization_creator_profile_id: creator_profile_id,
            user_id: user_id
          )

        assignment != nil
    end
  end

  @doc """
  Gets all creator profile IDs that a user is allowed to access.
  Returns :all if user is not restricted, otherwise returns list of assigned profile IDs.
  """
  def get_allowed_creators_for_user(user_id) do
    # Check if user is restricted
    unless is_restricted_member?(user_id) do
      :all
    else
      # Get assigned creator profiles
      OrganizationProfileAssignment
      |> where([a], a.user_id == ^user_id)
      |> select([a], a.organization_creator_profile_id)
      |> Repo.all()
    end
  end

  # ============================================================================
  # Organization Applications
  # ============================================================================

  @doc """
  Creates a new organization application.
  If user has a rejected application, creates a new one.
  If user has a pending or approved application, returns error.
  """
  def create_organization_application(%User{} = user, attrs) do
    # Check if user has an existing application
    existing = get_user_organization_application(user.id)

    case existing do
      nil ->
        # No existing application, create new one
        %OrganizationApplication{}
        |> OrganizationApplication.create_changeset(Map.put(attrs, :user_id, user.id))
        |> Repo.insert()

      %{status: "rejected"} ->
        # Previous application was rejected, allow creating a new one
        %OrganizationApplication{}
        |> OrganizationApplication.create_changeset(Map.put(attrs, :user_id, user.id))
        |> Repo.insert()

      %{status: "pending"} ->
        {:error, :application_pending}

      %{status: "approved"} ->
        {:error, :application_already_approved}
    end
  end

  @doc """
  Lists all organization applications.
  Admin only. Optionally filter by status.
  """
  def list_organization_applications(opts \\ []) do
    status = Keyword.get(opts, :status)

    query =
      from a in OrganizationApplication,
        order_by: [desc: a.inserted_at],
        preload: [:user, :reviewed_by]

    query =
      if status do
        where(query, [a], a.status == ^status)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Gets a user's organization application (most recent).
  """
  def get_user_organization_application(user_id) do
    OrganizationApplication
    |> where([a], a.user_id == ^user_id)
    |> order_by([a], desc: a.inserted_at)
    |> limit(1)
    |> preload([:reviewed_by])
    |> Repo.one()
  end

  @doc """
  Gets an organization application by ID.
  """
  def get_organization_application(id) do
    OrganizationApplication
    |> preload([:user, :reviewed_by])
    |> Repo.get(id)
  end

  @doc """
  Approves an organization application and creates the organization.
  Admin only.
  """
  def approve_organization_application(application_id, admin_notes, %User{} = admin) do
    application = get_organization_application(application_id)

    cond do
      is_nil(application) ->
        {:error, :not_found}

      application.status != "pending" ->
        {:error, :already_processed}

      true ->
        Repo.transaction(fn ->
          # Create the organization
          org_attrs = %{
            name: application.name,
            description: application.description,
            logo_url: application.logo_url
          }

          case create_organization(application.user, org_attrs) do
            {:ok, organization} ->
              # Update application status
              {:ok, updated_application} =
                application
                |> OrganizationApplication.review_changeset(%{
                  status: "approved",
                  admin_notes: admin_notes,
                  reviewed_by_id: admin.id,
                  reviewed_at: DateTime.utc_now() |> DateTime.truncate(:second)
                })
                |> Repo.update()

              %{application: updated_application, organization: organization}

            {:error, reason} ->
              Repo.rollback(reason)
          end
        end)
    end
  end

  @doc """
  Rejects an organization application.
  Admin only.
  """
  def reject_organization_application(application_id, admin_notes, %User{} = admin) do
    application = get_organization_application(application_id)

    cond do
      is_nil(application) ->
        {:error, :not_found}

      application.status != "pending" ->
        {:error, :already_processed}

      true ->
        application
        |> OrganizationApplication.review_changeset(%{
          status: "rejected",
          admin_notes: admin_notes,
          reviewed_by_id: admin.id,
          reviewed_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
        |> Repo.update()
    end
  end

  @doc """
  Updates a user's pending organization application.
  Users can only update their own pending applications.
  """
  def update_organization_application(application_id, attrs, %User{} = user) do
    application = get_organization_application(application_id)

    cond do
      is_nil(application) ->
        {:error, :not_found}

      application.user_id != user.id ->
        {:error, :unauthorized}

      application.status != "pending" ->
        {:error, :cannot_update_processed_application}

      true ->
        application
        |> OrganizationApplication.create_changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Deletes an organization application.
  Users can delete their own applications, or admin can delete any.
  """
  def delete_organization_application(application_id, %User{} = user) do
    application = get_organization_application(application_id)

    cond do
      is_nil(application) ->
        {:error, :not_found}

      application.user_id != user.id and not user.is_admin ->
        {:error, :unauthorized}

      true ->
        Repo.delete(application)
    end
  end

  @doc """
  Deletes an organization application (admin only - for admin page).
  """
  def delete_organization_application(application_id) do
    case get_organization_application(application_id) do
      nil -> {:error, :not_found}
      application -> Repo.delete(application)
    end
  end
end
