defmodule ClippsterServer.Social.SocialAccount do
  @moduledoc """
  Schema for organization social accounts connected via OAuth.
  These accounts can be assigned to organization members for posting.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.Organization
  alias ClippsterServer.Social.{SocialAccountAssignment, PostSubmission, TokenEncryption}

  @platforms ~w(instagram tiktok twitter youtube)

  schema "organization_social_accounts" do
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
    field :facebook_page_id, :string  # For Instagram Business accounts via Facebook Page

    # Virtual fields for token handling
    field :access_token, :string, virtual: true
    field :refresh_token, :string, virtual: true

    belongs_to :organization, Organization
    has_many :assignments, SocialAccountAssignment, foreign_key: :organization_social_account_id
    has_many :assigned_users, through: [:assignments, :user]
    has_many :posts, PostSubmission, foreign_key: :organization_social_account_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new social account connection.
  """
  def create_changeset(account, attrs) do
    account
    |> cast(attrs, [
      :organization_id,
      :platform,
      :platform_user_id,
      :username,
      :display_name,
      :profile_image_url,
      :access_token,
      :refresh_token,
      :token_expires_at,
      :facebook_page_id
    ])
    |> validate_required([:organization_id, :platform, :platform_user_id, :username])
    |> validate_inclusion(:platform, @platforms)
    |> put_connected_at()
    |> encrypt_tokens()
    |> unique_constraint([:organization_id, :platform, :platform_user_id],
      name: :org_social_accounts_unique,
      message: "this account is already connected to the organization"
    )
    |> foreign_key_constraint(:organization_id)
  end

  @doc """
  Changeset for updating a social account (refresh tokens, profile info).
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
      :is_active
    ])
    |> encrypt_tokens()
  end

  @doc """
  Changeset for refreshing OAuth tokens.
  """
  def refresh_tokens_changeset(account, attrs) do
    account
    |> cast(attrs, [:access_token, :refresh_token, :token_expires_at])
    |> validate_required([:access_token])
    |> encrypt_tokens()
  end

  @doc """
  Changeset for deactivating an account.
  """
  def deactivate_changeset(account) do
    account
    |> change(is_active: false)
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
  Returns the list of valid platforms.
  """
  def platforms, do: @platforms

  @doc """
  Checks if the given platform is valid.
  """
  def valid_platform?(platform) when is_binary(platform), do: platform in @platforms
  def valid_platform?(_), do: false

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
