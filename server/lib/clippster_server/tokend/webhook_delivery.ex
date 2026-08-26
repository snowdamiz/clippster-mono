defmodule ClippsterServer.Tokend.WebhookDelivery do
  @moduledoc false

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :id, autogenerate: true}
  schema "tokend_webhook_deliveries" do
    field :delivery_id, :string
    field :event_type, :string
    field :event_key, :string
    field :payload, :map, default: %{}
    field :processed_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(delivery, attrs) do
    delivery
    |> cast(attrs, [:delivery_id, :event_type, :event_key, :payload, :processed_at])
    |> validate_required([:delivery_id, :event_type, :payload])
    |> unique_constraint(:delivery_id)
  end
end
