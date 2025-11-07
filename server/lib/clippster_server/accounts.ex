defmodule ClippsterServer.Accounts do
  @moduledoc """
  The Accounts context.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Credits

  @doc """
  Gets a user by ID.
  """
  def get_user(id) do
    Repo.get(User, id)
  end

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
  New users automatically receive 1 free hour of credits.
  """
  def create_user(wallet_address) do
    is_first_user = Repo.aggregate(User, :count) == 0

    Repo.transaction(fn ->
      # Create the user
      user = %User{}
        |> User.changeset(%{
          wallet_address: wallet_address,
          is_admin: is_first_user
        })
        |> Repo.insert!()

      # Give new user 1 free hour of credits
      {:ok, _user_credit} = Credits.add_credits(user.id, 1)

      user
    end)
    |> case do
      {:ok, user} -> {:ok, user}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Lists all users.
  """
  def list_users do
    Repo.all(User)
  end

  @doc """
  Updates a user.
  """
  def update_user(user, attrs) do
    user
    |> User.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Promotes a user to admin.
  """
  def promote_user_to_admin(user_id) do
    case get_user(user_id) do
      nil -> {:error, :not_found}
      user -> update_user(user, %{is_admin: true})
    end
  end
end
