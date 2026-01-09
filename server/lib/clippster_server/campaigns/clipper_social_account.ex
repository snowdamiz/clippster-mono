defmodule ClippsterServer.Campaigns.ClipperSocialAccount do
  @moduledoc """
  Schema for clipper social media accounts used for posting clips.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User

  @platforms ~w(tiktok instagram x youtube)

  schema "clipper_social_accounts" do
    field :platform, :string
    field :platform_user_id, :string
    field :username, :string
    field :display_name, :string
    field :access_token, :binary
    field :refresh_token, :binary
    field :token_expires_at, :utc_datetime
    field :profile_url, :string
    field :follower_count, :integer
    field :is_verified, :boolean, default: false

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
      :access_token,
      :refresh_token,
      :token_expires_at,
      :profile_url,
      :follower_count,
      :is_verified
    ])
    |> validate_required([:user_id, :platform])
    |> validate_inclusion(:platform, @platforms)
    |> validate_length(:username, max: 100)
    |> validate_length(:display_name, max: 200)
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
      :access_token,
      :refresh_token,
      :token_expires_at,
      :profile_url,
      :follower_count,
      :is_verified
    ])
    |> validate_length(:username, max: 100)
    |> validate_length(:display_name, max: 200)
  end

  @doc """
  Changeset for updating OAuth tokens.
  """
  def update_tokens_changeset(account, attrs) do
    account
    |> cast(attrs, [:access_token, :refresh_token, :token_expires_at])
  end

  def platforms, do: @platforms
end
