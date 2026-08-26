defmodule ClippsterServer.Tokend.Publisher do
  @moduledoc """
  Native Tokend publishing capability boundary.

  Publishing is available only when Clippster partner OAuth is ready
  (`TOKEND_PARTNER_API_ENABLED` + complete OAuth config). Actual upload/post
  calls still fail closed if the configured Tokend deployment rejects them.
  """

  alias ClippsterServer.Tokend.{AccountTokens, Client}

  @unavailable_error :tokend_publish_unavailable

  @spec unavailable_error() :: :tokend_publish_unavailable
  def unavailable_error, do: @unavailable_error

  @spec unavailable_message() :: String.t()
  def unavailable_message do
    if Client.oauth_ready?() do
      "Tokend publishing is enabled on Clippster, but the publish request failed or the configured Tokend deployment rejected it."
    else
      "Tokend publishing requires TOKEND_PARTNER_API_ENABLED and a complete Tokend OAuth configuration on Phoenix."
    end
  end

  @spec available?() :: boolean()
  def available?, do: Client.oauth_ready?()

  @spec validate_account(map()) :: :ok | {:error, :not_tokend_account}
  def validate_account(%{provider: "tokend", platform: "tokend"}), do: :ok
  def validate_account(_), do: {:error, :not_tokend_account}

  @spec readiness(map()) :: :ok | {:error, atom()}
  def readiness(account) do
    with :ok <- validate_account(account) do
      if available?(), do: :ok, else: {:error, @unavailable_error}
    end
  end

  @spec publish(map(), String.t(), map() | keyword()) :: {:ok, map()} | {:error, term()}
  def publish(account, media_url, opts \\ %{})

  def publish(account, media_url, opts) when is_binary(media_url) do
    opts =
      opts
      |> Map.new()
      |> Map.put_new(:creator_slug, creator_slug(account))
      |> Map.put_new(:idempotency_key, idempotency_key(account, media_url, opts))

    with :ok <- readiness(account),
         {:ok, %{access_token: access_token}} <- AccountTokens.ensure_fresh_access_token(account) do
      Client.publish_media(access_token, media_url, opts)
    end
  end

  def publish(_account, _media_url, _opts), do: {:error, :invalid_media_url}

  defp creator_slug(account) do
    payload = Map.get(account, :provider_payload) || %{}

    payload["creator_slug"] || payload[:creator_slug] || payload["slug"] || payload[:slug] ||
      payload["username"] || payload[:username] || Map.get(account, :username)
  end

  defp idempotency_key(account, media_url, opts) do
    opts = Map.new(opts)

    opts[:idempotency_key] || opts["idempotency_key"] ||
      "clippster-#{Map.get(account, :id)}-#{Base.url_encode64(:crypto.hash(:sha256, media_url), padding: false)}"
  end
end
