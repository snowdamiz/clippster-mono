defmodule ClippsterServer.Organizations.OrganizationProfileAssignment do
  @moduledoc """
  Schema for assignments of creator profiles to organization members.
  A profile can be assigned to multiple members (shared model).
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.OrganizationCreatorProfile
  alias ClippsterServer.Accounts.User

  schema "organization_profile_assignments" do
    belongs_to :organization_creator_profile, OrganizationCreatorProfile
    belongs_to :user, User

    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc """
  Changeset for creating a new profile assignment.
  """
  def changeset(assignment, attrs) do
    assignment
    |> cast(attrs, [:organization_creator_profile_id, :user_id])
    |> validate_required([:organization_creator_profile_id, :user_id])
    |> foreign_key_constraint(:organization_creator_profile_id)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint([:organization_creator_profile_id, :user_id],
      name: :org_profile_assignments_unique,
      message: "user is already assigned to this profile"
    )
  end
end

