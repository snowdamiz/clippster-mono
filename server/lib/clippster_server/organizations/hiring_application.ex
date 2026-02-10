defmodule ClippsterServer.Organizations.HiringApplication do
  use Ecto.Schema
  import Ecto.Changeset

  @statuses ["pending", "reviewed", "accepted", "rejected"]

  schema "hiring_applications" do
    field :message, :string
    field :status, :string, default: "pending"
    field :reviewed_at, :utc_datetime
    field :admin_notes, :string

    belongs_to :hiring_post, ClippsterServer.Organizations.HiringPost
    belongs_to :user, ClippsterServer.Accounts.User
    belongs_to :reviewed_by, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  def create_changeset(application, attrs) do
    application
    |> cast(attrs, [:hiring_post_id, :user_id, :message])
    |> validate_required([:hiring_post_id, :user_id])
    |> validate_length(:message, max: 2000)
    |> unique_constraint([:hiring_post_id, :user_id],
      message: "you have already applied to this hiring post"
    )
    |> foreign_key_constraint(:hiring_post_id)
    |> foreign_key_constraint(:user_id)
  end

  def review_changeset(application, attrs) do
    application
    |> cast(attrs, [:status, :reviewed_at, :reviewed_by_id, :admin_notes])
    |> validate_required([:status])
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:admin_notes, max: 2000)
  end

  def statuses, do: @statuses
end
