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

    # Email auth fields
    field :password, :string, virtual: true
    field :password_hash, :string
    field :email_verified, :boolean, default: false
    field :email_verification_token, :string
    field :email_verification_otp, :string
    field :email_verification_sent_at, :utc_datetime
    field :email_verification_attempts, :integer, default: 0
    field :password_reset_token, :string
    field :password_reset_sent_at, :utc_datetime

    # Organization fields
    field :account_type, :string  # "personal" | "organization" | nil (pending)
    field :owned_organization_id, :integer
    field :created_by_organization_id, :integer  # Set when account is created by an org admin

    # Beta activation
    field :beta_activated, :boolean, default: false

    # Subscription fields
    field :subscription_status, :string, default: "none"  # none, active, cancelled, expired
    field :subscription_tier, :string  # starter, creator, pro
    field :subscription_start_date, :utc_datetime
    field :subscription_end_date, :utc_datetime
    field :subscription_renewal_method, :string  # stripe, crypto
    field :stripe_subscription_id, :string
    field :stripe_customer_id, :string

    # Affiliate referral tracking
    field :referred_by_affiliate_id, :integer

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
    |> cast(attrs, [:email, :name, :avatar_url, :provider, :provider_id, :is_admin, :email_verified])
    |> validate_required([:provider, :provider_id])
    |> validate_inclusion(:provider, ["google", "wallet", "email"])
    |> put_change(:email_verified, true)  # OAuth users are automatically verified
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

  @doc """
  Changeset for email/password registration.
  """
  def email_registration_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :password, :name])
    |> validate_required([:email, :password])
    |> validate_email()
    |> validate_password()
    |> put_change(:provider, "email")
    |> put_change(:email_verified, false)
    |> hash_password()
    |> put_email_provider_id()
    |> unique_constraint(:email)
    |> unique_constraint([:provider, :provider_id])
  end

  @doc """
  Changeset for setting verification tokens.
  """
  def verification_changeset(user, attrs) do
    user
    |> cast(attrs, [
      :email_verification_token,
      :email_verification_otp,
      :email_verification_sent_at,
      :email_verification_attempts
    ])
  end

  @doc """
  Changeset for marking email as verified.
  """
  def verify_email_changeset(user) do
    user
    |> change()
    |> put_change(:email_verified, true)
    |> put_change(:email_verification_token, nil)
    |> put_change(:email_verification_otp, nil)
    |> put_change(:email_verification_sent_at, nil)
    |> put_change(:email_verification_attempts, 0)
  end

  @doc """
  Changeset for incrementing verification attempts.
  """
  def increment_verification_attempts_changeset(user) do
    user
    |> change()
    |> put_change(:email_verification_attempts, (user.email_verification_attempts || 0) + 1)
  end

  @doc """
  Changeset for password reset request.
  """
  def password_reset_request_changeset(user, attrs) do
    user
    |> cast(attrs, [:password_reset_token, :password_reset_sent_at])
  end

  @doc """
  Changeset for password update.
  """
  def password_changeset(user, attrs) do
    user
    |> cast(attrs, [:password])
    |> validate_required([:password])
    |> validate_password()
    |> hash_password()
    |> put_change(:password_reset_token, nil)
    |> put_change(:password_reset_sent_at, nil)
  end

  @doc """
  Changeset for setting account type (personal/organization).
  """
  def account_type_changeset(user, attrs) do
    user
    |> cast(attrs, [:account_type, :owned_organization_id])
    |> validate_inclusion(:account_type, ["personal", "organization"])
  end

  @doc """
  Changeset for admin operations (promoting to admin, etc.).
  Does not require wallet_address, works for all user types.
  """
  def admin_changeset(user, attrs) do
    user
    |> cast(attrs, [:is_admin])
  end

  @doc """
  Changeset for beta activation.
  """
  def beta_activation_changeset(user) do
    user
    |> change()
    |> put_change(:beta_activated, true)
  end

  @doc """
  Changeset for setting affiliate referral on signup.
  """
  def referral_changeset(user, attrs) do
    user
    |> cast(attrs, [:referred_by_affiliate_id])
  end

  @doc """
  Changeset for subscription management.
  """
  def subscription_changeset(user, attrs) do
    user
    |> cast(attrs, [
      :subscription_status,
      :subscription_tier,
      :subscription_start_date,
      :subscription_end_date,
      :subscription_renewal_method,
      :stripe_subscription_id,
      :stripe_customer_id
    ])
    |> validate_inclusion(:subscription_status, ["none", "active", "cancelled", "expired"])
    |> validate_inclusion(:subscription_tier, ["starter", "creator", "pro", nil])
    |> validate_inclusion(:subscription_renewal_method, ["stripe", "crypto", "admin", nil])
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

  defp put_email_provider_id(changeset) do
    case get_change(changeset, :email) do
      nil -> changeset
      email ->
        changeset
        |> put_change(:provider_id, email)
    end
  end

  defp validate_email(changeset) do
    changeset
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/, message: "must be a valid email address")
    |> validate_length(:email, max: 160)
  end

  defp validate_password(changeset) do
    changeset
    |> validate_length(:password, min: 8, message: "must be at least 8 characters")
    |> validate_length(:password, max: 72, message: "must be at most 72 characters")
  end

  defp hash_password(changeset) do
    case get_change(changeset, :password) do
      nil ->
        changeset

      password ->
        changeset
        |> put_change(:password_hash, Pbkdf2.hash_pwd_salt(password))
        |> delete_change(:password)
    end
  end

  @doc """
  Verifies the password against the stored hash.
  """
  def valid_password?(%__MODULE__{password_hash: password_hash}, password)
      when is_binary(password_hash) and byte_size(password) > 0 do
    Pbkdf2.verify_pass(password, password_hash)
  end

  def valid_password?(_, _) do
    Pbkdf2.no_user_verify()
    false
  end
end
