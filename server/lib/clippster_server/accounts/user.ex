defmodule ClippsterServer.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :wallet_address, :string
    field :is_admin, :boolean, default: false

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:wallet_address, :is_admin])
    |> validate_required([:wallet_address])
    |> unique_constraint(:wallet_address)
  end
end
