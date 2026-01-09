defmodule ClippsterServer.Analytics.AnalyticsEvent do
  use Ecto.Schema
  import Ecto.Changeset

  schema "analytics_events" do
    field :event_type, :string
    field :metadata, :map, default: %{}

    belongs_to :user, ClippsterServer.Accounts.User

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(analytics_event, attrs) do
    analytics_event
    |> cast(attrs, [:event_type, :user_id, :metadata])
    |> validate_required([:event_type])
    |> foreign_key_constraint(:user_id)
  end
end