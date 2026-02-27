defmodule ClippsterServer.Social.Platform do
  @moduledoc """
  Behavior defining the interface for social media platform integrations.

  Each platform (Instagram, TikTok, etc.) implements this behavior to provide
  a consistent interface for OAuth, publishing, and analytics.
  """

  @doc """
  Returns the OAuth authorization URL for the platform.
  The opts map should include:
  - :organization_id - The organization connecting the account
  - :state - CSRF token for security
  """
  @callback authorize_url(opts :: map()) :: String.t()

  @doc """
  Exchanges an authorization code for access and refresh tokens.
  Returns {:ok, tokens_map} or {:error, reason}.

  The tokens_map should include:
  - :access_token
  - :refresh_token (if available)
  - :expires_in (seconds until expiry)
  - :user_id (platform user ID)
  """
  @callback exchange_code(code :: String.t(), opts :: map()) ::
    {:ok, map()} | {:error, term()}

  @doc """
  Refreshes an expired access token using the refresh token.
  Returns {:ok, tokens_map} or {:error, reason}.
  """
  @callback refresh_tokens(refresh_token :: String.t()) ::
    {:ok, map()} | {:error, term()}

  @doc """
  Gets user profile information using the access token.
  Returns {:ok, profile_map} or {:error, reason}.

  The profile_map should include:
  - :user_id
  - :username
  - :display_name
  - :profile_image_url
  """
  @callback get_user_profile(access_token :: String.t()) ::
    {:ok, map()} | {:error, term()}

  @doc """
  Publishes media to the platform.
  Returns {:ok, post_map} or {:error, reason}.

  The post_map should include:
  - :post_id
  - :post_url
  - :media_type
  """
  @callback publish_media(access_token :: String.t(), media_url :: String.t(), opts :: map()) ::
    {:ok, map()} | {:error, term()}

  @doc """
  Gets insights/analytics for a post.
  Returns {:ok, insights_map} or {:error, reason}.

  The insights_map should include:
  - :view_count
  - :like_count
  - :comment_count
  - :save_count (if available)
  - :reach_count (if available)
  - :impressions_count (if available)
  """
  @callback get_insights(access_token :: String.t(), post_id :: String.t()) ::
    {:ok, map()} | {:error, term()}

  @doc """
  Returns the platform identifier string (e.g., "instagram", "tiktok").
  """
  @callback platform_id() :: String.t()

  @doc """
  Returns the display name for the platform (e.g., "Instagram", "TikTok").
  """
  @callback platform_name() :: String.t()

  # ============================================================================
  # Helper Functions
  # ============================================================================

  @doc """
  Gets the platform module for a given platform identifier.
  """
  def get_platform_module("instagram"), do: {:ok, ClippsterServer.Social.Platforms.PostForMe}
  def get_platform_module("twitter"), do: {:ok, ClippsterServer.Social.Platforms.Twitter}
  def get_platform_module("tiktok"), do: {:ok, ClippsterServer.Social.Platforms.PostForMe}
  def get_platform_module("youtube"), do: {:ok, ClippsterServer.Social.Platforms.PostForMe}
  def get_platform_module(_), do: {:error, :unknown_platform}

  @doc """
  Calls a platform function dynamically.
  """
  def call(platform, function, args) when is_binary(platform) and is_atom(function) and is_list(args) do
    case get_platform_module(platform) do
      {:ok, module} -> apply(module, function, args)
      {:error, reason} -> {:error, reason}
    end
  end
end
