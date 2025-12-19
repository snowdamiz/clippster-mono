defmodule ClippsterServer.Social.SocialAccountAssignment do
  @moduledoc """
  Schema for assignments of social accounts to organization members.
  A social account can be assigned to multiple members, allowing them to post.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Social.SocialAccount
  alias ClippsterServer.Accounts.User

  schema "social_account_assignments" do
    field :assigned_at, :utc_datetime

    belongs_to :organization_social_account, SocialAccount
    belongs_to :user, User
    belongs_to :assigned_by_user, User, foreign_key: :assigned_by_user_id

    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc """
  Changeset for creating a new account assignment.
  """
  def changeset(assignment, attrs) do
    assignment
    |> cast(attrs, [:organization_social_account_id, :user_id, :assigned_by_user_id])
    |> validate_required([:organization_social_account_id, :user_id])
    |> put_assigned_at()
    |> foreign_key_constraint(:organization_social_account_id)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:assigned_by_user_id)
    |> unique_constraint([:organization_social_account_id, :user_id],
      name: :social_account_assignments_unique,
      message: "user is already assigned to this account"
    )
  end

  defp put_assigned_at(changeset) do
    case get_field(changeset, :assigned_at) do
      nil -> put_change(changeset, :assigned_at, DateTime.utc_now() |> DateTime.truncate(:second))
      _ -> changeset
    end
  end
end
