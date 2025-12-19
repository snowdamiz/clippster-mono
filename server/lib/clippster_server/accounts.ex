defmodule ClippsterServer.Accounts do
  @moduledoc """
  The Accounts context.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Credits
  alias ClippsterServer.{Emails, Mailer}
  alias ClippsterServer.Auth.TokenGenerator

  # OTP expires in 10 minutes
  @otp_expiry_minutes 10
  # Magic link expires in 24 hours
  @magic_link_expiry_hours 24
  # Password reset expires in 1 hour
  @password_reset_expiry_hours 1
  # Max OTP verification attempts
  @max_otp_attempts 5

  @doc """
  Gets a user by ID.
  """
  def get_user(id) do
    Repo.get(User, id)
  end

  @doc """
  Verifies a JWT token and returns the associated user.
  """
  def verify_token(token) when is_binary(token) do
    with {:ok, claims} <- TokenGenerator.verify_token(token),
         user_id when not is_nil(user_id) <- claims["user_id"],
         user when not is_nil(user) <- get_user(user_id) do
      {:ok, user}
    else
      nil -> {:error, :user_not_found}
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_token}
    end
  end

  def verify_token(_), do: {:error, :invalid_token}

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
      nil ->
        {:error, :not_found}

      user ->
        user
        |> User.admin_changeset(%{is_admin: true})
        |> Repo.update()
    end
  end

  # ============================================
  # Email Authentication Functions
  # ============================================

  @doc """
  Registers a new user with email and password.
  Generates verification OTP and magic link token, sends verification email.
  """
  def register_with_email(email, password) do
    # Check if email already exists
    case get_user_by_email(email) do
      nil ->
        do_register_with_email(email, password)

      existing_user ->
        # Check if it's an email provider user who hasn't verified yet
        if existing_user.provider == "email" and not existing_user.email_verified do
          # Resend verification for existing unverified user
          resend_verification(existing_user)
        else
          {:error, :email_already_registered}
        end
    end
  end

  defp do_register_with_email(email, password) do
    is_first_user = Repo.aggregate(User, :count) == 0

    # Generate OTP and magic link token
    otp_code = generate_otp()
    magic_link_token = generate_token()
    hashed_otp = hash_token(otp_code)
    hashed_token = hash_token(magic_link_token)

    Repo.transaction(fn ->
      # Create the user
      user_attrs = %{
        email: email,
        password: password,
        is_admin: is_first_user
      }

      user =
        %User{}
        |> User.email_registration_changeset(user_attrs)
        |> Repo.insert!()

      # Set verification tokens
      {:ok, user} =
        user
        |> User.verification_changeset(%{
          email_verification_otp: hashed_otp,
          email_verification_token: hashed_token,
          email_verification_sent_at: DateTime.utc_now() |> DateTime.truncate(:second),
          email_verification_attempts: 0
        })
        |> Repo.update()

      # Give new user 1 free hour of credits
      {:ok, _user_credit} = Credits.add_credits(user.id, 1)

      # Send verification email (with plain OTP and token)
      email
      |> Emails.verification_email(otp_code, magic_link_token)
      |> Mailer.deliver()

      user
    end)
    |> case do
      {:ok, user} -> {:ok, user}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Verifies a user's email using the 6-digit OTP code.
  """
  def verify_email_otp(email, otp_code) do
    case get_user_by_email(email) do
      nil ->
        {:error, :not_found}

      user ->
        cond do
          user.email_verified ->
            {:error, :already_verified}

          (user.email_verification_attempts || 0) >= @max_otp_attempts ->
            {:error, :too_many_attempts}

          is_nil(user.email_verification_sent_at) ->
            {:error, :no_verification_pending}

          otp_expired?(user.email_verification_sent_at) ->
            {:error, :otp_expired}

          verify_token(otp_code, user.email_verification_otp) ->
            user
            |> User.verify_email_changeset()
            |> Repo.update()

          true ->
            # Increment attempts on wrong OTP
            user
            |> User.increment_verification_attempts_changeset()
            |> Repo.update()

            {:error, :invalid_otp}
        end
    end
  end

  @doc """
  Verifies a user's email using the magic link token.
  """
  def verify_email_token(token) do
    # Find user with matching hashed token
    hashed_token = hash_token(token)

    case Repo.get_by(User, email_verification_token: hashed_token) do
      nil ->
        {:error, :invalid_token}

      user ->
        cond do
          user.email_verified ->
            {:error, :already_verified}

          is_nil(user.email_verification_sent_at) ->
            {:error, :no_verification_pending}

          magic_link_expired?(user.email_verification_sent_at) ->
            {:error, :token_expired}

          true ->
            user
            |> User.verify_email_changeset()
            |> Repo.update()
        end
    end
  end

  @doc """
  Resends verification email with new OTP and token.
  """
  def resend_verification(email_or_user)

  def resend_verification(email) when is_binary(email) do
    case get_user_by_email(email) do
      nil -> {:error, :not_found}
      user -> resend_verification(user)
    end
  end

  def resend_verification(%User{} = user) do
    cond do
      user.email_verified ->
        {:error, :already_verified}

      user.provider != "email" ->
        {:error, :not_email_user}

      true ->
        # Generate new OTP and token
        otp_code = generate_otp()
        magic_link_token = generate_token()
        hashed_otp = hash_token(otp_code)
        hashed_token = hash_token(magic_link_token)

        {:ok, user} =
          user
          |> User.verification_changeset(%{
            email_verification_otp: hashed_otp,
            email_verification_token: hashed_token,
            email_verification_sent_at: DateTime.utc_now() |> DateTime.truncate(:second),
            email_verification_attempts: 0
          })
          |> Repo.update()

        # Send verification email
        user.email
        |> Emails.verification_email(otp_code, magic_link_token)
        |> Mailer.deliver()

        {:ok, user}
    end
  end

  @doc """
  Authenticates a user with email and password.
  Returns error if email is not verified.
  """
  def authenticate_with_email(email, password) do
    user = get_user_by_email(email)

    cond do
      is_nil(user) ->
        # Prevent timing attacks
        Pbkdf2.no_user_verify()
        {:error, :invalid_credentials}

      user.provider != "email" ->
        {:error, :wrong_auth_method}

      not user.email_verified ->
        {:error, :email_not_verified}

      User.valid_password?(user, password) ->
        {:ok, user}

      true ->
        {:error, :invalid_credentials}
    end
  end

  @doc """
  Requests a password reset for the given email.
  Sends reset email with token.
  """
  def request_password_reset(email) do
    case get_user_by_email(email) do
      nil ->
        # Don't reveal if email exists
        :ok

      user ->
        if user.provider == "email" do
          reset_token = generate_token()
          hashed_token = hash_token(reset_token)

          {:ok, _user} =
            user
            |> User.password_reset_request_changeset(%{
              password_reset_token: hashed_token,
              password_reset_sent_at: DateTime.utc_now() |> DateTime.truncate(:second)
            })
            |> Repo.update()

          # Send password reset email
          user.email
          |> Emails.password_reset_email(reset_token)
          |> Mailer.deliver()
        end

        :ok
    end
  end

  @doc """
  Resets a user's password using the reset token.
  """
  def reset_password(token, new_password) do
    hashed_token = hash_token(token)

    case Repo.get_by(User, password_reset_token: hashed_token) do
      nil ->
        {:error, :invalid_token}

      user ->
        cond do
          is_nil(user.password_reset_sent_at) ->
            {:error, :no_reset_pending}

          password_reset_expired?(user.password_reset_sent_at) ->
            {:error, :token_expired}

          true ->
            user
            |> User.password_changeset(%{password: new_password})
            |> Repo.update()
        end
    end
  end

  # ============================================
  # Helper Functions
  # ============================================

  defp generate_otp do
    :rand.uniform(999_999)
    |> Integer.to_string()
    |> String.pad_leading(6, "0")
  end

  defp generate_token do
    :crypto.strong_rand_bytes(32)
    |> Base.url_encode64(padding: false)
  end

  defp hash_token(token) do
    :crypto.hash(:sha256, token)
    |> Base.encode64()
  end

  defp verify_token(plain_token, hashed_token) do
    hash_token(plain_token) == hashed_token
  end

  defp otp_expired?(sent_at) do
    expiry = DateTime.add(sent_at, @otp_expiry_minutes, :minute)
    DateTime.compare(DateTime.utc_now(), expiry) == :gt
  end

  defp magic_link_expired?(sent_at) do
    expiry = DateTime.add(sent_at, @magic_link_expiry_hours, :hour)
    DateTime.compare(DateTime.utc_now(), expiry) == :gt
  end

  defp password_reset_expired?(sent_at) do
    expiry = DateTime.add(sent_at, @password_reset_expiry_hours, :hour)
    DateTime.compare(DateTime.utc_now(), expiry) == :gt
  end
end
