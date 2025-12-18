defmodule ClippsterServer.Organizations.OrganizationMember do
  use Ecto.Schema
  import Ecto.Changeset

  @roles ["owner", "admin", "member"]

  schema "organization_members" do
    field :role, :string, default: "member"
    field :joined_at, :utc_datetime

    belongs_to :organization, ClippsterServer.Organizations.Organization
    belongs_to :user, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new organization member.
  """
  def create_changeset(member, attrs) do
    member
    |> cast(attrs, [:organization_id, :user_id, :role])
    |> validate_required([:organization_id, :user_id, :role])
    |> validate_inclusion(:role, @roles)
    |> put_joined_at()
    |> unique_constraint([:organization_id, :user_id])
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Changeset for updating a member's role.
  """
  def update_role_changeset(member, attrs) do
    member
    |> cast(attrs, [:role])
    |> validate_required([:role])
    |> validate_inclusion(:role, @roles)
    |> validate_not_demoting_owner()
  end

  defp put_joined_at(changeset) do
    case get_field(changeset, :joined_at) do
      nil -> put_change(changeset, :joined_at, DateTime.utc_now() |> DateTime.truncate(:second))
      _ -> changeset
    end
  end

  defp validate_not_demoting_owner(changeset) do
    current_role = get_field(changeset, :role)
    
    # This validation would need the original role from the database
    # For now, we'll handle this at the context level
    if current_role != "owner" do
      changeset
    else
      changeset
    end
  end

  @doc """
  Returns the list of valid roles.
  """
  def roles, do: @roles

  @doc """
  Checks if a role has admin privileges (owner or admin).
  """
  def is_admin_role?(role), do: role in ["owner", "admin"]

  @doc """
  Checks if a role is the owner role.
  """
  def is_owner_role?(role), do: role == "owner"
end

