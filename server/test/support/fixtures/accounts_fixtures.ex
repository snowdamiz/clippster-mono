defmodule ClippsterServer.AccountsFixtures do
  @moduledoc """
  Test fixtures for accounts / Google OAuth users.
  """

  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Credits

  @doc """
  Inserts a Google-authenticated user.
  """
  def google_user_fixture(attrs \\ %{}) do
    unique = System.unique_integer([:positive])

    defaults = %{
      provider: "google",
      provider_id: "google-provider-#{unique}",
      email: "google-user-#{unique}@gmail.com",
      name: "Google User #{unique}",
      avatar_url: nil,
      email_verified: true,
      account_type: "personal",
      subscription_status: "none"
    }

    attrs = Map.merge(defaults, Map.new(attrs))

    %User{}
    |> User.oauth_changeset(attrs)
    |> Repo.insert!()
  end

  @doc """
  Inserts a verified email/password user.
  """
  def email_user_fixture(attrs \\ %{}) do
    unique = System.unique_integer([:positive])
    attrs = Map.new(attrs)
    password = Map.get(attrs, :password, "password123")
    email = Map.get(attrs, :email, "email-user-#{unique}@example.com")

    user =
      %User{}
      |> User.email_registration_changeset(%{
        email: email,
        password: password,
        name: Map.get(attrs, :name, "Email User #{unique}")
      })
      |> Ecto.Changeset.put_change(:email_verified, true)
      |> Ecto.Changeset.put_change(:account_type, "personal")
      |> Ecto.Changeset.put_change(:subscription_status, "none")
      |> Repo.insert!()

    user
  end

  @doc """
  Grants credits to a user so tests can assert data is preserved across Gmail switches.
  """
  def with_credits!(user, hours \\ 12.5) do
    {:ok, _credit} = Credits.add_credits(user.id, hours)
    user
  end

  @doc """
  Builds oauth_info attrs as returned from Google userinfo.
  """
  def google_oauth_info(attrs \\ %{}) do
    unique = System.unique_integer([:positive])

    Map.merge(
      %{
        provider_id: "switched-google-#{unique}",
        email: "switched-#{unique}@gmail.com",
        name: "Switched Google User",
        avatar_url: nil
      },
      Map.new(attrs)
    )
  end
end
