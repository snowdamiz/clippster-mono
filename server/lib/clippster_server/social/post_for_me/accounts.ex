defmodule ClippsterServer.Social.PostForMe.Accounts do
  @moduledoc """
  Post for Me social account management.

  Handles OAuth account connection, listing, and disconnection
  for Instagram, Instagram Business, TikTok, and YouTube.
  """

  require Logger

  alias ClippsterServer.Social.PostForMe.Client

  @doc """
  Generates an OAuth authorization URL for connecting a social account.

  ## Parameters
    - platform: "instagram", "instagram_business", "tiktok", or "youtube"
    - success_url: URL to redirect to on successful auth
    - error_url: URL to redirect to on auth failure

  ## Returns
    - {:ok, %{"url" => auth_url, ...}}
    - {:error, reason}
  """
  def generate_auth_url(platform, success_url, error_url) do
    body = %{
      "platform" => platform,
      "success_url" => success_url,
      "error_url" => error_url
    }

    Client.post("/v1/social-accounts/auth-url", body)
  end

  @doc """
  Lists all social accounts connected via Post for Me.

  ## Options
    - :platform - Filter by platform
    - :cursor - Pagination cursor

  ## Returns
    - {:ok, %{"data" => [accounts], ...}}
    - {:error, reason}
  """
  def list_accounts(opts \\ []) do
    params = opts
    |> Enum.filter(fn {_k, v} -> not is_nil(v) end)
    |> URI.encode_query()

    path = if params == "", do: "/v1/social-accounts", else: "/v1/social-accounts?#{params}"
    Client.get(path)
  end

  @doc """
  Gets a single social account by its Post for Me ID.
  """
  def get_account(pfm_account_id) do
    Client.get("/v1/social-accounts/#{pfm_account_id}")
  end

  @doc """
  Creates/registers a social account in Post for Me.
  Used when the OAuth flow is handled externally.
  """
  def create_account(attrs) do
    Client.post("/v1/social-accounts", attrs)
  end

  @doc """
  Updates a social account's metadata in Post for Me.
  """
  def update_account(pfm_account_id, attrs) do
    Client.patch("/v1/social-accounts/#{pfm_account_id}", attrs)
  end

  @doc """
  Disconnects a social account from Post for Me.
  This revokes the platform OAuth tokens.
  """
  def disconnect_account(pfm_account_id) do
    Client.post("/v1/social-accounts/#{pfm_account_id}/disconnect", %{})
  end
end
