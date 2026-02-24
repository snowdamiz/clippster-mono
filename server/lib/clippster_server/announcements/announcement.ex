defmodule ClippsterServer.Announcements.Announcement do
  use Ecto.Schema
  import Ecto.Changeset

  schema "announcements" do
    field :title, :string
    field :body, :string
    field :type, :string, default: "info"
    field :audience, :string, default: "everyone"
    field :is_active, :boolean, default: false
    field :published_at, :utc_datetime
    field :expires_at, :utc_datetime

    belongs_to :creator, ClippsterServer.Accounts.User, foreign_key: :created_by

    timestamps(type: :utc_datetime)
  end

  @valid_types ~w(info warning feature campaign)
  @valid_audiences ~w(everyone users_only orgs_only)

  def changeset(announcement, attrs) do
    announcement
    |> cast(attrs, [:title, :body, :type, :audience, :is_active, :published_at, :expires_at, :created_by])
    |> validate_required([:title, :body, :type, :audience])
    |> validate_inclusion(:type, @valid_types)
    |> validate_inclusion(:audience, @valid_audiences)
  end
end
