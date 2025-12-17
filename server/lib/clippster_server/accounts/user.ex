defmodule ClippsterServer.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :wallet_address, :string
    field :email, :string
    field :name, :string
    field :avatar_url, :string
    field :provider, :string, default: "wallet"
    field :provider_id, :string
    field :is_admin, :boolean, default: false

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for wallet-based authentication.
  """
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:wallet_address, :is_admin])
    |> validate_required([:wallet_address])
    |> put_wallet_provider()
    |> unique_constraint(:wallet_address)
    |> unique_constraint([:provider, :provider_id])
  end

  @doc """
  Changeset for OAuth-based authentication (Google, etc.).
  """
  def oauth_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :name, :avatar_url, :provider, :provider_id, :is_admin])
    |> validate_required([:provider, :provider_id])
    |> validate_inclusion(:provider, ["google", "wallet"])
    |> unique_constraint(:email)
    |> unique_constraint([:provider, :provider_id])
  end

  @doc """
  Changeset for updating OAuth info on existing user.
  """
  def oauth_update_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :name, :avatar_url])
    |> unique_constraint(:email)
  end

  @doc """
  Changeset for linking OAuth to existing wallet user.
  """
  def link_oauth_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :name, :avatar_url])
    |> unique_constraint(:email)
  end

  defp put_wallet_provider(changeset) do
    case get_change(changeset, :wallet_address) do
      nil -> changeset
      wallet_address ->
        changeset
        |> put_change(:provider, "wallet")
        |> put_change(:provider_id, wallet_address)
    end
  end
end
