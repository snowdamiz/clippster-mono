defmodule ClippsterServer.Social.PostForMeAccountHealth do
  @moduledoc """
  Post For Me account connection health: sync provider status, validate publish readiness,
  and normalize reconnect messaging.
  """

  alias ClippsterServer.Social.Providers.PostForMe

  @reconnect_suffix "Reconnect in Account Connections, then try again."

  def reconnect_suffix, do: @reconnect_suffix

  def token_expired_message(platform_label) do
    "Your #{platform_label} connection has expired. #{@reconnect_suffix}"
  end

  def disconnected_message(platform_label) do
    "Your #{platform_label} connection is disconnected. #{@reconnect_suffix}"
  end

  def provider_connected?(%{status: "connected"}), do: true
  def provider_connected?(%{status: :connected}), do: true
  def provider_connected?(%{status: "disconnected"}), do: false
  def provider_connected?(%{status: :disconnected}), do: false
  def provider_connected?(_), do: true

  def provider_disconnected?(provider_account), do: not provider_connected?(provider_account)

  def provider_status_attrs(provider_account) do
    %{
      is_active: provider_connected?(provider_account),
      token_expires_at:
        ClippsterServer.Social.PostForMeConnectionSync.extract_token_expires_at(provider_account)
    }
  end

  def account_token_expired?(%{token_expires_at: nil}), do: false

  def account_token_expired?(%{token_expires_at: expires_at}) do
    DateTime.compare(expires_at, DateTime.utc_now()) == :lt
  end

  def validate_publishable(account, platform_label) do
    cond do
      not Map.get(account, :is_active, true) ->
        {:error, :token_expired, disconnected_message(platform_label)}

      account_token_expired?(account) ->
        {:error, :token_expired, token_expired_message(platform_label)}

      true ->
        :ok
    end
  end

  def social_token_expired_error?(%{message: message}) when is_binary(message) do
    social_token_expired_error?(message)
  end

  def social_token_expired_error?(message) when is_binary(message) do
    normalized = String.downcase(message)

    Enum.any?(
      [
        "expired",
        "token",
        "disconnected",
        "unauthorized",
        "auth",
        "reconnect",
        "not connected",
        "social_token_expired"
      ],
      &String.contains?(normalized, &1)
    )
  end

  def social_token_expired_error?(_), do: false

  def fetch_provider_account(provider_account_id) when is_binary(provider_account_id) do
    case PostForMe.list_social_accounts(%{id: [provider_account_id]}) do
      {:ok, %{data: [provider_account | _]}} ->
        {:ok, provider_account}

      {:ok, %{data: []}} ->
        {:error, :provider_account_not_found}

      {:ok, _} ->
        {:error, :provider_account_not_found}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def fetch_provider_account(_), do: {:error, :missing_provider_account_id}
end
