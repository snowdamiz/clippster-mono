defmodule ClippsterServer.Accounts do
  @moduledoc """
  The Accounts context.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Credits
  alias ClippsterServer.{Emails, Mailer, Analytics}
  alias ClippsterServer.Auth.TokenGenerator
  alias ClippsterServer.Affiliates
  alias ClippsterServer.Storage

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
  def get_or_create_user(wallet_address, referral_code \\ nil) do
    case get_user_by_wallet(wallet_address) do
      nil ->
        case create_user(wallet_address, referral_code) do
          {:ok, user} -> {:ok, user, true}
          error -> error
        end

      user ->
        {:ok, user, false}
    end
  end

  @doc """
  Creates a user. If this is the first user, they are marked as admin.
  New users receive 60 free credits monthly, tracked by free_tier_last_credit_grant.
  """
  def create_user(wallet_address, referral_code \\ nil) do
    is_first_user = Repo.aggregate(User, :count) == 0
    affiliate_id = resolve_affiliate_id(referral_code)

    Repo.transaction(fn ->
      # Create the user
      user =
        %User{}
        |> User.changeset(%{
          wallet_address: wallet_address,
          is_admin: is_first_user
        })
        |> Repo.insert!()

      # Set affiliate referral if present
      user = maybe_set_referral(user, affiliate_id)

      # Set free tier credit grant timestamp so worker grants credits after 30 days
      now = DateTime.utc_now() |> DateTime.truncate(:second)
      {:ok, user} = user |> User.free_tier_changeset(%{free_tier_last_credit_grant: now}) |> Repo.update()

      user
    end)
    |> case do
      {:ok, user} ->
        Analytics.track_event("user_created", user.id, %{
          wallet_address: user.wallet_address,
          is_admin: user.is_admin
        })

        {:ok, user}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Creates or gets a user from OAuth provider (Google, etc.).
  If this is the first user, they are marked as admin.
  New users receive 60 free credits monthly, tracked by free_tier_last_credit_grant.
  """
  def get_or_create_oauth_user(provider, provider_id, oauth_info \\ %{}, referral_code \\ nil) do
    case get_user_by_provider(provider, provider_id) do
      nil ->
        # Check if user exists with this email but different OAuth provider
        email = Map.get(oauth_info, :email)

        case email && get_user_by_email(email) do
          nil ->
            # No existing user, create new one
            case create_oauth_user(provider, provider_id, oauth_info, referral_code) do
              {:ok, user} -> {:ok, user, true}
              error -> error
            end

          existing_user ->
            # User exists with this email, link the new OAuth provider
            case link_oauth_provider(existing_user, provider, provider_id, oauth_info) do
              {:ok, user} -> {:ok, user, false}
              error -> error
            end
        end

      user ->
        case update_oauth_info(user, oauth_info) do
          {:ok, user} -> {:ok, user, false}
          error -> error
        end
    end
  end

  # Creates an OAuth user.
  defp create_oauth_user(provider, provider_id, oauth_info, referral_code) do
    is_first_user = Repo.aggregate(User, :count) == 0
    affiliate_id = resolve_affiliate_id(referral_code)

    Repo.transaction(fn ->
      # Download and store avatar in R2 if it's an external URL
      avatar_url = download_and_store_avatar(Map.get(oauth_info, :avatar_url), provider, provider_id)

      user_attrs = %{
        provider: provider,
        provider_id: provider_id,
        email: Map.get(oauth_info, :email),
        name: Map.get(oauth_info, :name),
        avatar_url: avatar_url,
        is_admin: is_first_user
      }

      user =
        %User{}
        |> User.oauth_changeset(user_attrs)
        |> Repo.insert!()

      # Set affiliate referral if present
      user = maybe_set_referral(user, affiliate_id)

      # Set free tier credit grant timestamp so worker grants credits after 30 days
      now = DateTime.utc_now() |> DateTime.truncate(:second)
      {:ok, user} = user |> User.free_tier_changeset(%{free_tier_last_credit_grant: now}) |> Repo.update()

      user
    end)
    |> case do
      {:ok, user} ->
        Analytics.track_event("user_created", user.id, %{
          provider: provider,
          email: user.email,
          is_admin: user.is_admin
        })

        {:ok, user}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Updates OAuth information for a user (e.g., refresh profile data on login).
  defp update_oauth_info(user, oauth_info) do
    # Only download new avatar if the external URL has changed
    new_avatar_url = Map.get(oauth_info, :avatar_url)
    avatar_url = 
      if new_avatar_url && new_avatar_url != user.avatar_url && is_external_url?(new_avatar_url) do
        download_and_store_avatar(new_avatar_url, user.provider, user.provider_id) || user.avatar_url
      else
        user.avatar_url
      end

    oauth_attrs = %{
      email: Map.get(oauth_info, :email) || user.email,
      name: Map.get(oauth_info, :name) || user.name,
      avatar_url: avatar_url
    }

    user
    |> User.oauth_update_changeset(oauth_attrs)
    |> Repo.update()
  end

  # Links a new OAuth provider to an existing user (e.g., user created with email/password, now logging in with Google)
  defp link_oauth_provider(user, provider, provider_id, oauth_info) do
    # Download and store avatar in R2 if it's an external URL
    avatar_url = download_and_store_avatar(Map.get(oauth_info, :avatar_url), provider, provider_id) || user.avatar_url

    oauth_attrs = %{
      provider: provider,
      provider_id: provider_id,
      email: Map.get(oauth_info, :email) || user.email,
      name: Map.get(oauth_info, :name) || user.name,
      avatar_url: avatar_url,
      email_verified: true
    }

    user
    |> User.oauth_changeset(oauth_attrs)
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
        # Download and store avatar in R2 if it's an external URL
        avatar_url = download_and_store_avatar(Map.get(oauth_info, :avatar_url), "google", user_id) || user.avatar_url

        user_attrs = %{
          email: Map.get(oauth_info, :email),
          name: Map.get(oauth_info, :name) || user.name,
          avatar_url: avatar_url
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
  Deactivates a user account.
  """
  def deactivate_user(user_id) do
    case get_user(user_id) do
      nil ->
        {:error, :not_found}

      user ->
        user
        |> Ecto.Changeset.change(%{
          deactivated: true,
          deactivated_at: DateTime.utc_now()
        })
        |> Repo.update()
    end
  end

  @doc """
  Updates the user's last active timestamp.
  """
  def update_last_active(user_id) do
    case get_user(user_id) do
      nil ->
        {:error, :not_found}

      user ->
        user
        |> Ecto.Changeset.change(%{
          last_active_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
        |> Repo.update()
    end
  end

  @doc """
  Updates a user's preferences (time format, toast notifications, etc.).
  """
  def update_user_preferences(user_id, attrs) do
    case get_user(user_id) do
      nil ->
        {:error, :not_found}

      user ->
        user
        |> User.preferences_changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Gets a user's preferences as a map.
  """
  def get_user_preferences(user_id) do
    case get_user(user_id) do
      nil ->
        {:error, :not_found}

      user ->
        {:ok,
         %{
           time_format_preference: user.time_format_preference || "12hr",
           toast_enabled: user.toast_enabled,
           toast_duration: user.toast_duration || 5000,
           toast_position: user.toast_position || "bottom-right",
           toast_sound_enabled: user.toast_sound_enabled,
           toast_background_enabled: user.toast_background_enabled,
           notify_livestream: user.notify_livestream,
           notify_clips: user.notify_clips,
           notify_downloads: user.notify_downloads,
           notify_projects: user.notify_projects,
           notify_social: user.notify_social,
           notify_organization: user.notify_organization,
           notify_system: user.notify_system
         }}
    end
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

  @doc """
  Activates a user's beta status.
  """
  def activate_user_beta(user_id) do
    case get_user(user_id) do
      nil ->
        {:error, :not_found}

      user ->
        user
        |> User.beta_activation_changeset()
        |> Repo.update()
    end
  end

  @doc """
  Admin function to reset a user's password.
  Only works for email-based accounts.
  """
  def admin_reset_password(user_id, new_password) do
    case get_user(user_id) do
      nil ->
        {:error, :not_found}

      user ->
        if user.provider != "email" do
          {:error, :not_email_account}
        else
          user
          |> User.password_changeset(%{password: new_password})
          |> Repo.update()
        end
    end
  end

  # ============================================
  # Email Authentication Functions
  # ============================================

  @doc """
  Registers a new user with email and password.
  Generates verification OTP and magic link token, sends verification email.
  """
  def register_with_email(email, password, referral_code \\ nil) do
    # Check if email already exists
    case get_user_by_email(email) do
      nil ->
        do_register_with_email(email, password, referral_code)

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

  defp do_register_with_email(email, password, referral_code) do
    is_first_user = Repo.aggregate(User, :count) == 0
    affiliate_id = resolve_affiliate_id(referral_code)

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

      # Set affiliate referral if present
      user = maybe_set_referral(user, affiliate_id)

      # Give new user 60 free minutes of credits
      {:ok, _user_credit} = Credits.add_credits(user.id, 60)

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
    require Logger
    user = get_user_by_email(email)

    cond do
      is_nil(user) ->
        Logger.warning("Login failed: User not found for email: #{email}")
        # Prevent timing attacks
        Pbkdf2.no_user_verify()
        {:error, :invalid_credentials}

      user.provider != "email" ->
        Logger.warning("Login failed: Wrong auth method for #{email}. Provider: #{user.provider}")
        {:error, :wrong_auth_method}

      not user.email_verified ->
        Logger.warning("Login failed: Email not verified for #{email}")
        {:error, :email_not_verified}

      User.valid_password?(user, password) ->
        Logger.info("Login successful for #{email}")
        {:ok, user}

      true ->
        Logger.warning("Login failed: Invalid password for #{email}")
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

  @doc """
  Changes a user's email address.
  Requires current password verification.
  Sends verification email to new address.
  """
  def change_email(user_id, new_email, password) do
    user = get_user(user_id)

    cond do
      is_nil(user) ->
        {:error, :not_found}

      user.provider != "email" ->
        {:error, :not_email_user}

      not User.valid_password?(user, password) ->
        {:error, :invalid_password}

      true ->
        # Check if new email is already in use
        case get_user_by_email(new_email) do
          nil ->
            do_change_email(user, new_email)

          existing_user when existing_user.id != user.id ->
            {:error, :email_already_in_use}

          _ ->
            # Same user, same email - no change needed
            {:ok, user}
        end
    end
  end

  defp do_change_email(user, new_email) do
    # Generate verification token
    verification_token = generate_token()
    hashed_token = hash_token(verification_token)

    {:ok, user} =
      user
      |> User.email_change_request_changeset(%{
        email_change_token: hashed_token,
        email_change_new_email: new_email,
        email_change_sent_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Repo.update()

    # Send verification email to new address
    new_email
    |> Emails.email_change_verification_email(verification_token)
    |> Mailer.deliver()

    {:ok, user}
  end

  @doc """
  Verifies email change using the verification token.
  """
  def verify_email_change(token) do
    hashed_token = hash_token(token)

    case Repo.get_by(User, email_change_token: hashed_token) do
      nil ->
        {:error, :invalid_token}

      user ->
        cond do
          is_nil(user.email_change_sent_at) ->
            {:error, :no_change_pending}

          email_change_expired?(user.email_change_sent_at) ->
            {:error, :token_expired}

          is_nil(user.email_change_new_email) ->
            {:error, :no_change_pending}

          true ->
            # Check if new email is now taken by someone else
            case get_user_by_email(user.email_change_new_email) do
              nil ->
                user
                |> User.email_change_confirm_changeset(%{
                  email: user.email_change_new_email
                })
                |> Repo.update()

              existing_user when existing_user.id != user.id ->
                {:error, :email_already_in_use}

              _ ->
                # Same user, proceed
                user
                |> User.email_change_confirm_changeset(%{
                  email: user.email_change_new_email
                })
                |> Repo.update()
            end
        end
    end
  end

  @doc """
  Changes a user's password.
  Requires current password verification.
  """
  def change_password(user_id, current_password, new_password) do
    user = get_user(user_id)

    cond do
      is_nil(user) ->
        {:error, :not_found}

      user.provider != "email" ->
        {:error, :not_email_user}

      not User.valid_password?(user, current_password) ->
        {:error, :invalid_current_password}

      true ->
        user
        |> User.password_update_changeset(%{password: new_password})
        |> Repo.update()
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

  defp email_change_expired?(sent_at) do
    expiry = DateTime.add(sent_at, @password_reset_expiry_hours, :hour)
    DateTime.compare(DateTime.utc_now(), expiry) == :gt
  end

  # ============================================
  # Affiliate Referral Helpers
  # ============================================

  defp resolve_affiliate_id(nil), do: nil
  defp resolve_affiliate_id(""), do: nil

  defp resolve_affiliate_id(referral_code) do
    case Affiliates.get_affiliate_by_code(referral_code) do
      %{id: id, status: "active"} -> id
      _ -> nil
    end
  end

  defp maybe_set_referral(user, nil), do: user

  defp maybe_set_referral(user, affiliate_id) do
    {:ok, updated_user} =
      user
      |> User.referral_changeset(%{referred_by_affiliate_id: affiliate_id})
      |> Repo.update()

    updated_user
  end

  # ============================================
  # Moderator Management
  # ============================================

  @doc """
  Promotes a user to moderator.
  Validates that user is not on free tier.
  """
  def promote_user_to_moderator(user_id) do
    user = get_user(user_id)

    cond do
      is_nil(user) ->
        {:error, :user_not_found}

      user.is_moderator ->
        {:error, :already_moderator}

      user.subscription_tier == nil or user.subscription_status != "active" ->
        {:error, :must_have_active_subscription}

      true ->
        user
        |> User.moderator_changeset(%{is_moderator: true})
        |> Repo.update()
    end
  end

  @doc """
  Demotes a moderator to regular user.
  """
  def demote_moderator(user_id) do
    user = get_user(user_id)

    cond do
      is_nil(user) ->
        {:error, :user_not_found}

      not user.is_moderator ->
        {:error, :not_moderator}

      true ->
        user
        |> User.moderator_changeset(%{is_moderator: false})
        |> Repo.update()
    end
  end

  @doc """
  Lists all admins and moderators (for customer service routing).
  """
  def list_admins_and_moderators do
    User
    |> where([u], u.is_admin == true or u.is_moderator == true)
    |> Repo.all()
  end

  # ============================================
  # User Restrictions
  # ============================================

  @doc """
  Restricts a user platform-wide.
  """
  def restrict_user(user_id, reason) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      user
      |> User.restriction_changeset(%{
        is_restricted: true,
        restricted_at: DateTime.utc_now() |> DateTime.truncate(:second),
        restricted_reason: reason
      })
      |> Repo.update()
    end
  end

  @doc """
  Unrestricts a user.
  """
  def unrestrict_user(user_id) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      user
      |> User.restriction_changeset(%{
        is_restricted: false,
        restricted_at: nil,
        restricted_reason: nil
      })
      |> Repo.update()
    end
  end

  @doc """
  Schedules a user for deletion at end of billing cycle.
  """
  def schedule_user_deletion(user_id, deletion_date) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      user
      |> User.restriction_changeset(%{scheduled_deletion_at: deletion_date})
      |> Repo.update()
    end
  end

  @doc """
  Deletes a user immediately.
  This should only be used for users without active subscriptions.
  For users with active subscriptions, use schedule_user_deletion instead.

  Handles cascading deletion of related records that have :restrict constraints:
  - Transfers organization ownership or deletes organizations
  - Deletes credit transactions
  - Deletes user credits
  - Deletes processing jobs
  - Deletes organization credit transactions
  """
  def delete_user(user_id) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      Repo.transaction(fn ->
        # 1. Handle organizations owned by this user
        # Transfer ownership to another admin or delete if no other admins
        owned_orgs_query =
          from o in "organizations",
            where: o.owner_id == ^user_id,
            select: %{id: o.id}

        owned_orgs = Repo.all(owned_orgs_query)

        Enum.each(owned_orgs, fn org ->
          # Try to find another admin to transfer ownership
          new_owner_query =
            from m in "organization_members",
              where: m.organization_id == ^org.id and m.role == "admin" and m.user_id != ^user_id,
              select: %{user_id: m.user_id},
              limit: 1

          case Repo.one(new_owner_query) do
            nil ->
              # No other admin, delete the organization (cascade will handle members, etc.)
              Repo.delete_all(from o in "organizations", where: o.id == ^org.id)

            new_owner ->
              # Transfer ownership to another admin
              Repo.update_all(
                from(o in "organizations", where: o.id == ^org.id),
                set: [owner_id: new_owner.user_id]
              )
          end
        end)

        # 2. Delete organization credit transactions where user was the purchaser
        Repo.delete_all(
          from t in "organization_credit_transactions",
            where: t.purchased_by_user_id == ^user_id
        )

        # 3. Delete user's credit transactions
        Repo.delete_all(
          from t in "credit_transactions",
            where: t.user_id == ^user_id
        )

        # 4. Delete user's processing jobs
        Repo.delete_all(
          from j in "processing_jobs",
            where: j.user_id == ^user_id
        )

        # 5. Delete user's credits record
        Repo.delete_all(
          from c in "user_credits",
            where: c.user_id == ^user_id
        )

        # 6. Finally delete the user (other tables with :delete_all or :nilify_all will cascade automatically)
        case Repo.delete(user) do
          {:ok, deleted_user} -> deleted_user
          {:error, changeset} -> Repo.rollback(changeset)
        end
      end)
    end
  end

  # ============================================
  # User Discounts
  # ============================================

  @doc """
  Applies an admin discount to a user.
  Creates a Stripe coupon and applies it to the user's active subscription if they have one.
  """
  def apply_admin_discount(user_id, percent_off, months) do
    user = get_user(user_id)

    cond do
      is_nil(user) ->
        {:error, :user_not_found}

      is_nil(user.stripe_subscription_id) ->
        # Cannot apply a timed discount without an active Stripe subscription —
        # there is no Stripe billing cycle to attach the coupon to, so the
        # discount would never actually be charged correctly.
        {:error, :no_stripe_subscription}

      true ->
        case create_and_apply_stripe_discount(user, percent_off, months) do
          {:ok, coupon_id} ->
            user
            |> User.discount_changeset(%{
              admin_discount_percent: percent_off,
              admin_discount_months_remaining: months,
              admin_discount_applied_at: DateTime.utc_now() |> DateTime.truncate(:second),
              admin_discount_stripe_coupon_id: coupon_id
            })
            |> Repo.update()

          {:error, reason} ->
            {:error, {:stripe_error, reason}}
        end
    end
  end

  defp create_and_apply_stripe_discount(user, percent_off, months) do
    try do
      # Create Stripe coupon
      coupon_params = %{
        percent_off: percent_off,
        duration: "repeating",
        duration_in_months: months,
        name: "Admin Discount - #{percent_off}% for #{months} months"
      }

      case Stripe.Coupon.create(coupon_params) do
        {:ok, coupon} ->
          # Apply coupon to subscription
          case Stripe.Subscription.update(user.stripe_subscription_id, %{coupon: coupon.id}) do
            {:ok, _subscription} -> {:ok, coupon.id}
            {:error, reason} -> {:error, reason}
          end

        {:error, reason} ->
          {:error, reason}
      end
    rescue
      e -> {:error, e}
    end
  end

  @doc """
  Enables moderator discount for a user.
  Creates a recurring 10% Stripe coupon if user has active subscription.
  """
  def enable_mod_discount(user_id) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      # If user has active Stripe subscription, create and apply 10% recurring coupon
      coupon_id =
        if user.stripe_subscription_id do
          case create_and_apply_mod_discount(user) do
            {:ok, coupon_id} -> coupon_id
            {:error, _reason} -> nil
          end
        else
          nil
        end

      user
      |> User.mod_discount_changeset(%{
        mod_discount_enabled: true,
        mod_discount_stripe_coupon_id: coupon_id
      })
      |> Repo.update()
    end
  end

  defp create_and_apply_mod_discount(user) do
    try do
      # Create recurring 10% Stripe coupon
      coupon_params = %{
        percent_off: 10,
        duration: "forever",
        name: "Moderator Discount - 10%"
      }

      case Stripe.Coupon.create(coupon_params) do
        {:ok, coupon} ->
          # Apply coupon to subscription
          case Stripe.Subscription.update(user.stripe_subscription_id, %{coupon: coupon.id}) do
            {:ok, _subscription} -> {:ok, coupon.id}
            {:error, reason} -> {:error, reason}
          end

        {:error, reason} ->
          {:error, reason}
      end
    rescue
      e -> {:error, e}
    end
  end

  @doc """
  Disables moderator discount for a user.
  Removes the Stripe coupon from their subscription if they have one.
  """
  def disable_mod_discount(user_id) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      # Remove coupon from Stripe subscription if present
      if user.stripe_subscription_id && user.mod_discount_stripe_coupon_id do
        try do
          Stripe.Subscription.update(user.stripe_subscription_id, %{coupon: ""})
        rescue
          _ -> :ok
        end
      end

      user
      |> User.mod_discount_changeset(%{
        mod_discount_enabled: false,
        mod_discount_stripe_coupon_id: nil
      })
      |> Repo.update()
    end
  end

  @doc """
  Enables AI editor access for a user.
  """
  def enable_ai_editor(user_id) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      user
      |> Ecto.Changeset.change(%{ai_editor_enabled: true})
      |> Repo.update()
    end
  end

  @doc """
  Disables AI editor access for a user.
  """
  def disable_ai_editor(user_id) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      user
      |> Ecto.Changeset.change(%{ai_editor_enabled: false})
      |> Repo.update()
    end
  end

  @doc """
  Enables campaigns access for a user.
  """
  def enable_campaigns(user_id) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      user
      |> Ecto.Changeset.change(%{campaigns_enabled: true})
      |> Repo.update()
    end
  end

  @doc """
  Disables campaigns access for a user.
  """
  def disable_campaigns(user_id) do
    user = get_user(user_id)

    if is_nil(user) do
      {:error, :user_not_found}
    else
      user
      |> Ecto.Changeset.change(%{campaigns_enabled: false})
      |> Repo.update()
    end
  end

  # Private helper functions

  # Downloads an avatar from an external URL and stores it in R2
  defp download_and_store_avatar(nil, _provider, _provider_id), do: nil
  defp download_and_store_avatar("", _provider, _provider_id), do: nil

  defp download_and_store_avatar(avatar_url, provider, provider_id) when is_binary(avatar_url) do
    # Only download if it's an external URL (not already in R2)
    if is_external_url?(avatar_url) do
      try do
        # Download the image
        case HTTPoison.get(avatar_url, [], timeout: 10_000, recv_timeout: 10_000) do
          {:ok, %HTTPoison.Response{status_code: 200, body: image_binary, headers: headers}} ->
            # Determine content type from headers or default to jpeg
            content_type =
              headers
              |> Enum.find(fn {key, _} -> String.downcase(key) == "content-type" end)
              |> case do
                {_, type} -> type
                nil -> "image/jpeg"
              end

            # Generate storage key
            timestamp = DateTime.utc_now() |> DateTime.to_unix()
            extension = get_extension_from_content_type(content_type)
            key = "avatars/#{provider}/#{provider_id}_#{timestamp}#{extension}"

            # Upload to R2
            case Storage.upload_file(image_binary, key, content_type: content_type) do
              {:ok, url} ->
                IO.puts("[Accounts] Downloaded and stored avatar: #{url}")
                url

              {:error, reason} ->
                IO.puts("[Accounts] Failed to upload avatar to R2: #{inspect(reason)}")
                # Return original URL as fallback
                avatar_url
            end

          {:ok, %HTTPoison.Response{status_code: status}} ->
            IO.puts("[Accounts] Failed to download avatar, status: #{status}")
            avatar_url

          {:error, reason} ->
            IO.puts("[Accounts] Failed to download avatar: #{inspect(reason)}")
            avatar_url
        end
      rescue
        e ->
          IO.puts("[Accounts] Exception downloading avatar: #{inspect(e)}")
          avatar_url
      end
    else
      # Already an R2 URL, return as-is
      avatar_url
    end
  end

  # Check if a URL is external (not from R2)
  defp is_external_url?(nil), do: false
  defp is_external_url?(""), do: false

  defp is_external_url?(url) when is_binary(url) do
    base = Storage.public_url_base()

    cond do
      # If it's from our R2 public URL, it's not external
      base && String.starts_with?(url, base) -> false
      # If it contains R2 domain, it's not external
      String.contains?(url, ".r2.cloudflarestorage.com") -> false
      # If it starts with our storage key format, it's not external
      String.starts_with?(url, "avatars/") -> false
      # Otherwise it's external
      true -> true
    end
  end

  # Get file extension from content type
  defp get_extension_from_content_type(content_type) do
    case content_type do
      "image/jpeg" -> ".jpg"
      "image/jpg" -> ".jpg"
      "image/png" -> ".png"
      "image/gif" -> ".gif"
      "image/webp" -> ".webp"
      _ -> ".jpg"
    end
  end
end
