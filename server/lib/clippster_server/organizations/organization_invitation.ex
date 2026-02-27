defmodule ClippsterServer.Organizations.OrganizationInvitation do
  use Ecto.Schema
  import Ecto.Changeset

  @statuses ["pending", "accepted", "expired", "cancelled"]
  @default_expiry_days 7

  schema "organization_invitations" do
    field :email, :string
    field :token, :string
    field :role, :string, default: "member"
    field :status, :string, default: "pending"
    field :expires_at, :utc_datetime
    # Used to return token to caller
    field :plain_token, :string, virtual: true

    belongs_to :organization, ClippsterServer.Organizations.Organization
    belongs_to :invited_by_user, ClippsterServer.Accounts.User, foreign_key: :invited_by

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new invitation.
  """
  def create_changeset(invitation, attrs) do
    invitation
    |> cast(attrs, [:organization_id, :email, :role, :invited_by])
    |> validate_required([:organization_id, :email, :role])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/,
      message: "must be a valid email address"
    )
    |> validate_inclusion(
      :role,
      ClippsterServer.Organizations.OrganizationMember.roles() -- ["owner"]
    )
    |> put_expires_at()
    |> put_change(:status, "pending")
    |> unique_constraint(:token)
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:invited_by)
  end

  @doc """
  Changeset for accepting an invitation.
  """
  def accept_changeset(invitation) do
    invitation
    |> change()
    |> put_change(:status, "accepted")
  end

  @doc """
  Changeset for cancelling an invitation.
  """
  def cancel_changeset(invitation) do
    invitation
    |> change()
    |> put_change(:status, "cancelled")
  end

  @doc """
  Changeset for expiring an invitation.
  """
  def expire_changeset(invitation) do
    invitation
    |> change()
    |> put_change(:status, "expired")
  end

  defp put_expires_at(changeset) do
    expires_at =
      DateTime.utc_now()
      |> DateTime.add(@default_expiry_days, :day)
      |> DateTime.truncate(:second)

    put_change(changeset, :expires_at, expires_at)
  end

  @doc """
  Generates a secure random token.
  """
  def generate_token do
    :crypto.strong_rand_bytes(32)
    |> Base.url_encode64(padding: false)
  end

  @doc """
  Hashes a token for secure storage.
  """
  def hash_token(token) do
    :crypto.hash(:sha256, token)
    |> Base.encode64()
  end

  @doc """
  Verifies a plain token against a hashed token.
  """
  def verify_token(plain_token, hashed_token) do
    hash_token(plain_token) == hashed_token
  end

  @doc """
  Checks if an invitation is expired.
  """
  def expired?(%__MODULE__{expires_at: expires_at}) do
    DateTime.compare(DateTime.utc_now(), expires_at) == :gt
  end

  @doc """
  Checks if an invitation can be accepted.
  """
  def can_accept?(%__MODULE__{status: status} = invitation) do
    status == "pending" and not expired?(invitation)
  end

  @doc """
  Returns the list of valid statuses.
  """
  def statuses, do: @statuses
end
