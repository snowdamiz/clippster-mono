defmodule ClippsterServer.Campaigns.ClipperSocialAccount do
  @moduledoc """
  Schema for clipper social media accounts used for posting clips.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Social.TokenEncryption

  @platforms ~w(tiktok instagram x youtube)

  schema "clipper_social_accounts" do
    field :platform, :string
    field :platform_user_id, :string
    field :username, :string
    field :display_name, :string
    field :profile_image_url, :string
    field :access_token_encrypted, :binary
    field :refresh_token_encrypted, :binary
    field :token_expires_at, :utc_datetime
    field :connected_at, :utc_datetime
    field :is_active, :boolean, default: true
    field :profile_url, :string
    field :follower_count, :integer
    field :is_verified, :boolean, default: false
    field :pfm_account_id, :string
    field :account_type, :string  # "personal" or "business" (for Instagram)

    # Virtual fields for token handling
    field :access_token, :string, virtual: true
    field :refresh_token, :string, virtual: true

    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new social account.
  """
  def create_changeset(account, attrs) do
    account
    |> cast(attrs, [
      :user_id,
      :platform,
      :platform_user_id,
      :username,
      :display_name,
      :profile_image_url,
      :access_token,
      :refresh_token,
      :token_expires_at,
      :profile_url,
      :follower_count,
      :is_verified,
      :pfm_account_id,
      :account_type
    ])
    |> validate_required([:user_id, :platform])
    |> validate_inclusion(:platform, @platforms)
    |> validate_length(:username, max: 100)
    |> validate_length(:display_name, max: 200)
    |> put_connected_at()
    |> encrypt_tokens()
    |> foreign_key_constraint(:user_id)
    |> unique_constraint([:user_id, :platform, :platform_user_id],
      name: :clipper_social_accounts_unique,
      message: "account already connected"
    )
  end

  @doc """
  Changeset for updating a social account.
  """
  def update_changeset(account, attrs) do
    account
    |> cast(attrs, [
      :username,
      :display_name,
      :profile_image_url,
      :access_token,
      :refresh_token,
      :token_expires_at,
      :profile_url,
      :follower_count,
      :is_verified,
      :is_active,
      :pfm_account_id,
      :account_type
    ])
    |> validate_length(:username, max: 100)
    |> validate_length(:display_name, max: 200)
    |> encrypt_tokens()
  end

  @doc """
  Changeset for updating OAuth tokens.
  """
  def update_tokens_changeset(account, attrs) do
    account
    |> cast(attrs, [:access_token, :refresh_token, :token_expires_at])
    |> validate_required([:access_token])
    |> encrypt_tokens()
  end

  @doc """
  Decrypts and returns the access token for use in API calls.
  """
  def get_access_token(%__MODULE__{access_token_encrypted: encrypted}) do
    TokenEncryption.decrypt(encrypted)
  end

  @doc """
  Decrypts and returns the refresh token.
  """
  def get_refresh_token(%__MODULE__{refresh_token_encrypted: encrypted}) do
    TokenEncryption.decrypt(encrypted)
  end

  @doc """
  Checks if the token is expired or will expire soon (within 1 day).
  """
  def token_needs_refresh?(%__MODULE__{token_expires_at: nil}), do: false
  def token_needs_refresh?(%__MODULE__{token_expires_at: expires_at}) do
    # Refresh if token expires within 1 day
    refresh_threshold = DateTime.utc_now() |> DateTime.add(1, :day)
    DateTime.compare(expires_at, refresh_threshold) == :lt
  end

  @doc """
  Changeset for deactivating an account.
  """
  def deactivate_changeset(account) do
    account
    |> change(is_active: false)
  end

  def platforms, do: @platforms

  # Private functions

  defp put_connected_at(changeset) do
    case get_field(changeset, :connected_at) do
      nil -> put_change(changeset, :connected_at, DateTime.utc_now() |> DateTime.truncate(:second))
      _ -> changeset
    end
  end

  defp encrypt_tokens(changeset) do
    changeset
    |> maybe_encrypt_token(:access_token, :access_token_encrypted)
    |> maybe_encrypt_token(:refresh_token, :refresh_token_encrypted)
  end

  defp maybe_encrypt_token(changeset, source_field, target_field) do
    case get_change(changeset, source_field) do
      nil -> changeset
      token ->
        encrypted = TokenEncryption.encrypt(token)
        changeset
        |> put_change(target_field, encrypted)
        |> delete_change(source_field)
    end
  end
end
