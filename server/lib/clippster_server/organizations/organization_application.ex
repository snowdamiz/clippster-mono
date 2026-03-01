defmodule ClippsterServer.Organizations.OrganizationApplication do
  use Ecto.Schema
  import Ecto.Changeset

  schema "organization_applications" do
    field :name, :string
    field :description, :string
    field :website, :string
    field :team_size, :string
    field :use_case, :string
    field :contact_email, :string
    field :logo_url, :string
    field :status, :string, default: "pending"
    field :admin_notes, :string
    field :reviewed_at, :utc_datetime

    belongs_to :user, ClippsterServer.Accounts.User
    belongs_to :reviewed_by, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new organization application.
  """
  def create_changeset(application, attrs) do
    application
    |> cast(attrs, [
      :name,
      :description,
      :website,
      :team_size,
      :use_case,
      :contact_email,
      :logo_url,
      :user_id
    ])
    |> validate_required([:name, :description, :team_size, :use_case, :contact_email, :user_id])
    |> validate_length(:name, min: 2, max: 100)
    |> validate_length(:description, min: 10, max: 1000)
    |> validate_length(:use_case, min: 10, max: 1000)
    |> validate_format(:contact_email, ~r/@/)
    |> validate_inclusion(:team_size, ["1-5", "6-10", "11-25", "26-50", "51+"])
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Changeset for updating application status (approve/reject).
  """
  def review_changeset(application, attrs) do
    application
    |> cast(attrs, [:status, :admin_notes, :reviewed_by_id, :reviewed_at])
    |> validate_required([:status, :reviewed_by_id, :reviewed_at])
    |> validate_inclusion(:status, ["pending", "approved", "rejected"])
    |> foreign_key_constraint(:reviewed_by_id)
  end
end
