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
    OrganizationMember
    |> where([m], m.organization_id == ^organization_id and m.user_id == ^user_id)
    |> preload(:user)
    |> Repo.one()
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
         end),
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
      %OrganizationInvitation{} -> {:error, :invitation_pending}
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
  """
  def create_member_account(organization_id, email, password, role, name, %User{} = creator) do
    with {:ok, _} <- verify_admin(organization_id, creator.id),
         nil <- Accounts.get_user_by_email(email) do
      
      Repo.transaction(fn ->
        # Create the user account (already verified since admin is creating it)
        case create_verified_user(email, password, organization_id, name) do
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

  defp create_verified_user(email, password, created_by_organization_id, name \\ nil) do
    # Create user with email provider, already verified
    # Mark account as created by the organization
    user_attrs = %{
      email: email,
      password: password,
      provider: "email",
      provider_id: email
    }

    # Ensure organization_id is an integer (route params come as strings)
    org_id_int = if is_binary(created_by_organization_id) do
      String.to_integer(created_by_organization_id)
    else
      created_by_organization_id
    end

    changeset = %User{}
    |> User.email_registration_changeset(user_attrs)
    |> Ecto.Changeset.put_change(:email_verified, true)
    |> Ecto.Changeset.put_change(:account_type, "personal")  # Auto-set to personal (they're a member, not an org owner)
    |> Ecto.Changeset.put_change(:created_by_organization_id, org_id_int)

    # Add name if provided
    changeset = if name && name != "" do
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

          changeset = if payment_method == "stripe" do
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

    query = from t in OrganizationCreditTransaction,
      where: t.organization_id == ^organization_id,
      order_by: [desc: t.inserted_at],
      limit: ^limit,
      offset: ^offset,
      preload: [:purchased_by]

    transactions = Repo.all(query)

    # Get total count
    count_query = from t in OrganizationCreditTransaction,
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

