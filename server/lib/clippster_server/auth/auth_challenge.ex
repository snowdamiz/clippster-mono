defmodule ClippsterServer.Auth.AuthChallenge do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:nonce, :string, []}
  schema "auth_challenges" do
    field :client_id, :string
    field :domain, :string
    field :expires_at, :utc_datetime_usec
    field :timestamp, :integer
    timestamps(updated_at: false)
  end

  def changeset(challenge, attrs) do
    challenge
    |> cast(attrs, [:nonce, :client_id, :domain, :expires_at, :timestamp])
    |> validate_required([:nonce, :client_id, :domain, :expires_at, :timestamp])
  end
end
