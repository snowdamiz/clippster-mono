defmodule ClippsterServer.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.ClipperProfiles.ClipperProfile

  schema "users" do
    field :wallet_address, :string
    field :email, :string
    field :name, :string
    field :avatar_url, :string
    field :provider, :string, default: "wallet"
    field :provider_id, :string
    field :is_admin, :boolean, default: false
    field :is_moderator, :boolean, default: false
    field :ai_editor_enabled, :boolean, default: false
    field :campaigns_enabled, :boolean, default: false

    # Associations
    has_one :clipper_profile, ClipperProfile

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
    # "personal" | "organization" | nil (pending)
    field :account_type, :string
    field :owned_organization_id, :integer
    # Set when account is created by an org admin
    field :created_by_organization_id, :integer

    # Beta activation
    field :beta_activated, :boolean, default: false

    # Subscription fields
    # none, active, cancelled, expired
    field :subscription_status, :string, default: "none"
    # starter, creator, pro
    field :subscription_tier, :string
    field :subscription_start_date, :utc_datetime
    field :subscription_end_date, :utc_datetime
    # stripe, crypto
    field :subscription_renewal_method, :string
    field :stripe_subscription_id, :string
    field :stripe_customer_id, :string
    # set when downgrading, applied at next renewal
    field :pending_subscription_tier, :string

    # Affiliate referral tracking
    field :referred_by_affiliate_id, :integer

    # Account deactivation
    field :deactivated, :boolean, default: false
    field :deactivated_at, :utc_datetime

    # Free tier monthly credit tracking
    field :free_tier_last_credit_grant, :utc_datetime

    # Activity tracking
    field :last_active_at, :utc_datetime

    # Platform-level restrictions
    field :is_restricted, :boolean, default: false
    field :restricted_at, :utc_datetime
    field :restricted_reason, :string
    field :scheduled_deletion_at, :utc_datetime

    # Per-user discount tracking
    field :admin_discount_percent, :integer
    field :admin_discount_months_remaining, :integer
    field :admin_discount_applied_at, :utc_datetime
    field :admin_discount_stripe_coupon_id, :string

    # Moderator discount
    field :mod_discount_enabled, :boolean, default: false
    field :mod_discount_stripe_coupon_id, :string

    # User preferences
    field :time_format_preference, :string, default: "12hr"
    field :toast_enabled, :boolean, default: true
    field :toast_duration, :integer, default: 5000
    field :toast_position, :string, default: "bottom-right"
    field :toast_sound_enabled, :boolean, default: false
    field :toast_background_enabled, :boolean, default: true
    field :notify_livestream, :boolean, default: true
    field :notify_clips, :boolean, default: true
    field :notify_downloads, :boolean, default: true
    field :notify_projects, :boolean, default: true
    field :notify_social, :boolean, default: true
    field :notify_organization, :boolean, default: true
    field :notify_system, :boolean, default: true

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
    |> cast(attrs, [
      :email,
      :name,
      :avatar_url,
      :provider,
      :provider_id,
      :is_admin,
      :email_verified
    ])
    |> validate_required([:provider, :provider_id])
    |> validate_inclusion(:provider, ["google", "wallet", "email"])
    # OAuth users are automatically verified
    |> put_change(:email_verified, true)
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
  Changeset for password update (requires current password validation).
  """
  def password_update_changeset(user, attrs) do
    user
    |> cast(attrs, [:password])
    |> validate_required([:password])
    |> validate_password()
    |> hash_password()
  end

  @doc """
  Changeset for email change request.
  """
  def email_change_request_changeset(user, attrs) do
    user
    |> cast(attrs, [:email_change_token, :email_change_new_email, :email_change_sent_at])
  end

  @doc """
  Changeset for confirming email change.
  """
  def email_change_confirm_changeset(user, attrs) do
    user
    |> cast(attrs, [:email])
    |> validate_required([:email])
    |> validate_email()
    |> put_change(:email_change_token, nil)
    |> put_change(:email_change_new_email, nil)
    |> put_change(:email_change_sent_at, nil)
    |> put_email_provider_id()
    |> unique_constraint(:email)
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
  Changeset for moderator operations (promoting/demoting moderator).
  """
  def moderator_changeset(user, attrs) do
    user
    |> cast(attrs, [:is_moderator])
  end

  @doc """
  Changeset for platform-level user restrictions.
  """
  def restriction_changeset(user, attrs) do
    user
    |> cast(attrs, [:is_restricted, :restricted_at, :restricted_reason, :scheduled_deletion_at])
  end

  @doc """
  Changeset for admin-applied user discounts.
  """
  def discount_changeset(user, attrs) do
    user
    |> cast(attrs, [
      :admin_discount_percent,
      :admin_discount_months_remaining,
      :admin_discount_applied_at,
      :admin_discount_stripe_coupon_id
    ])
  end

  @doc """
  Changeset for moderator discount toggle.
  """
  def mod_discount_changeset(user, attrs) do
    user
    |> cast(attrs, [:mod_discount_enabled, :mod_discount_stripe_coupon_id])
  end

  @doc """
  Changeset for free tier credit grant tracking.
  """
  def free_tier_changeset(user, attrs) do
    user
    |> cast(attrs, [:free_tier_last_credit_grant])
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
      :stripe_customer_id,
      :pending_subscription_tier,
      :admin_discount_percent,
      :admin_discount_months_remaining,
      :admin_discount_applied_at,
      :admin_discount_stripe_coupon_id
    ])
    |> validate_inclusion(:subscription_status, ["none", "active", "cancelled", "expired"])
    |> validate_inclusion(:subscription_tier, ["basic", "starter", "creator", "pro", nil])
    |> validate_inclusion(:subscription_renewal_method, ["stripe", "crypto", "admin", nil])
  end

  defp put_wallet_provider(changeset) do
    case get_change(changeset, :wallet_address) do
      nil ->
        changeset

      wallet_address ->
        changeset
        |> put_change(:provider, "wallet")
        |> put_change(:provider_id, wallet_address)
    end
  end

  defp put_email_provider_id(changeset) do
    case get_change(changeset, :email) do
      nil ->
        changeset

      email ->
        changeset
        |> put_change(:provider_id, email)
    end
  end

  defp validate_email(changeset) do
    changeset
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/,
      message: "must be a valid email address"
    )
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

  @preference_fields [
    :time_format_preference,
    :toast_enabled,
    :toast_duration,
    :toast_position,
    :toast_sound_enabled,
    :toast_background_enabled,
    :notify_livestream,
    :notify_clips,
    :notify_downloads,
    :notify_projects,
    :notify_social,
    :notify_organization,
    :notify_system
  ]

  @doc """
  Changeset for updating user preferences (time format, toast notifications, etc.).
  """
  def preferences_changeset(user, attrs) do
    user
    |> cast(attrs, @preference_fields)
    |> validate_inclusion(:time_format_preference, ["12hr", "24hr"])
    |> validate_inclusion(:toast_position, [
      "top-right",
      "top-left",
      "bottom-right",
      "bottom-left"
    ])
    |> validate_inclusion(:toast_duration, [3000, 5000, 7000, 10000, 0])
  end
end
