defmodule ClippsterServer.Accounts do
  @moduledoc """
  The Accounts context.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User

  @doc """
  Gets a user by wallet address.
  """
  def get_user_by_wallet(wallet_address) do
    Repo.get_by(User, wallet_address: wallet_address)
  end

  @doc """
  Creates or gets a user. If this is the first user, they are marked as admin.
  """
  def get_or_create_user(wallet_address) do
    case get_user_by_wallet(wallet_address) do
      nil -> create_user(wallet_address)
      user -> {:ok, user}
    end
  end

  @doc """
  Creates a user. If this is the first user, they are marked as admin.
  """
  def create_user(wallet_address) do
    is_first_user = Repo.aggregate(User, :count) == 0

    %User{}
    |> User.changeset(%{
      wallet_address: wallet_address,
      is_admin: is_first_user
    })
    |> Repo.insert()
  end

  @doc """
  Lists all users.
  """
  def list_users do
    Repo.all(User)
  end
end
