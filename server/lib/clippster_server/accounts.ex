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
  Gets a user by email address.
  """
  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: email)
  end
  def get_user_by_email(_), do: nil

  @doc """
  Gets a user by provider and provider_id.
  """
  def get_user_by_provider(provider, provider_id) do
    Repo.get_by(User, provider: provider, provider_id: provider_id)
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
  Creates or gets a user from OAuth provider (Google, etc.).
  If this is the first user, they are marked as admin.
  New users automatically receive 1 free hour of credits.
  """
  def get_or_create_oauth_user(provider, provider_id, oauth_info \\ %{}) do
    case get_user_by_provider(provider, provider_id) do
      nil -> create_oauth_user(provider, provider_id, oauth_info)
      user -> update_oauth_info(user, oauth_info)
    end
  end

  # Creates an OAuth user.
  defp create_oauth_user(provider, provider_id, oauth_info) do
    is_first_user = Repo.aggregate(User, :count) == 0

    Repo.transaction(fn ->
      user_attrs = %{
        provider: provider,
        provider_id: provider_id,
        email: Map.get(oauth_info, :email),
        name: Map.get(oauth_info, :name),
        avatar_url: Map.get(oauth_info, :avatar_url),
        is_admin: is_first_user
      }

      user = %User{}
        |> User.oauth_changeset(user_attrs)
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

  # Updates OAuth information for a user (e.g., refresh profile data on login).
  defp update_oauth_info(user, oauth_info) do
    oauth_attrs = %{
      email: Map.get(oauth_info, :email) || user.email,
      name: Map.get(oauth_info, :name) || user.name,
      avatar_url: Map.get(oauth_info, :avatar_url) || user.avatar_url
    }

    user
    |> User.oauth_update_changeset(oauth_attrs)
    |> Repo.update()
  end

  @doc """
  Links an OAuth account (e.g., Google) to an existing user.
  """
  def link_oauth_to_user(user_id, oauth_info) do
    case get_user(user_id) do
      nil ->
        {:error, :not_found}

      user ->
        user_attrs = %{
          email: Map.get(oauth_info, :email),
          name: Map.get(oauth_info, :name) || user.name,
          avatar_url: Map.get(oauth_info, :avatar_url) || user.avatar_url
        }

        user
        |> User.link_oauth_changeset(user_attrs)
        |> Repo.update()
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
