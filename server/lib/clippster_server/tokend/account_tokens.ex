defmodule ClippsterServer.Tokend.AccountTokens do
  @moduledoc """
  Tokend token lifecycle shared by native user and organization social accounts.

  Access tokens are refreshed shortly before their one-hour expiry and rotating refresh
  tokens are persisted through the owning context.
  """

  require Logger

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Campaigns.ClipperSocialAccount
  alias ClippsterServer.Social
  alias ClippsterServer.Social.SocialAccount
  alias ClippsterServer.Tokend.Client

  @refresh_threshold_seconds 300

  @type account :: %ClipperSocialAccount{} | %SocialAccount{}

  @spec ensure_fresh_access_token(account(), keyword()) ::
          {:ok, %{account: account(), access_token: String.t(), refreshed: boolean()}}
          | {:error, term()}
  def ensure_fresh_access_token(account, opts \\ [])

  def ensure_fresh_access_token(account, opts)
      when is_struct(account, ClipperSocialAccount) or is_struct(account, SocialAccount) do
    with :ok <- ensure_tokend_account(account) do
      if refresh_needed?(account, opts) do
        refresh(account, opts)
      else
        with {:ok, access_token} <- decrypt_access_token(account) do
          {:ok, %{account: account, access_token: access_token, refreshed: false}}
        end
      end
    end
  end

  def ensure_fresh_access_token(_, _), do: {:error, :unsupported_account}

  @doc """
  Best-effort remote revocation for native Tokend account deletion.

  Local deletion must continue even when decryption, configuration, or the remote request
  fails. Mock accounts are never sent to the partner API.
  """
  @spec best_effort_revoke(account()) :: :ok
  def best_effort_revoke(account)
      when is_struct(account, ClipperSocialAccount) or is_struct(account, SocialAccount) do
    do_best_effort_revoke(account)
  rescue
    exception ->
      Logger.warning(
        "[Tokend.AccountTokens] remote revoke raised account_id=#{account.id} reason=#{inspect(exception.__struct__)}"
      )

      :ok
  end

  def best_effort_revoke(_), do: :ok

  defp do_best_effort_revoke(account) do
    if native_tokend_account?(account) and not mock_account?(account) and Client.oauth_ready?() do
      case revocation_token(account) do
        {:ok, {token, hint}} ->
          case Client.revoke_token(token, hint) do
            :ok ->
              :ok

            {:error, reason} ->
              Logger.warning(
                "[Tokend.AccountTokens] remote revoke failed account_id=#{account.id} reason=#{inspect(reason)}"
              )
          end

        {:error, reason} ->
          Logger.warning(
            "[Tokend.AccountTokens] no revocable token account_id=#{account.id} reason=#{inspect(reason)}"
          )
      end
    end

    :ok
  end

  @doc false
  def refresh_needed?(
        %{access_token_encrypted: access_token, refresh_token_encrypted: refresh_token},
        _opts
      )
      when access_token in [nil, <<>>] and refresh_token not in [nil, <<>>],
      do: true

  def refresh_needed?(%{token_expires_at: nil}, _opts), do: false

  def refresh_needed?(%{token_expires_at: expires_at}, opts) do
    now = Keyword.get(opts, :now, DateTime.utc_now())
    threshold = Keyword.get(opts, :refresh_threshold_seconds, @refresh_threshold_seconds)
    DateTime.compare(expires_at, DateTime.add(now, threshold, :second)) != :gt
  end

  defp refresh(account, opts) do
    refresh_fun = Keyword.get(opts, :refresh_fun, &Client.refresh_access_token/1)
    persist_fun = Keyword.get(opts, :persist_fun, &persist_tokens/2)

    with :ok <- require_oauth_ready(),
         {:ok, refresh_token} <- decrypt_refresh_token(account),
         {:ok, tokens} <- refresh_fun.(refresh_token),
         {:ok, tokens} <- Client.validate_token_response(tokens),
         attrs <-
           refresh_attrs(tokens, refresh_token, Keyword.get(opts, :now, DateTime.utc_now())),
         {:ok, updated_account} <- persist_fun.(account, attrs) do
      {:ok, %{account: updated_account, access_token: tokens.access_token, refreshed: true}}
    else
      {:error, _} = error -> error
      other -> {:error, {:token_refresh_failed, other}}
    end
  end

  defp refresh_attrs(tokens, previous_refresh_token, now) do
    %{
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || previous_refresh_token,
      token_expires_at:
        now
        |> DateTime.add(tokens.expires_in, :second)
        |> DateTime.truncate(:second)
    }
  end

  defp persist_tokens(%ClipperSocialAccount{} = account, attrs) do
    Campaigns.update_social_account_tokens(account, attrs)
  end

  defp persist_tokens(%SocialAccount{} = account, attrs) do
    Social.refresh_social_account_tokens(account, attrs)
  end

  defp decrypt_access_token(%ClipperSocialAccount{} = account) do
    required_token(ClipperSocialAccount.get_access_token(account), :access_token)
  end

  defp decrypt_access_token(%SocialAccount{} = account) do
    required_token(SocialAccount.get_access_token(account), :access_token)
  end

  defp decrypt_refresh_token(%ClipperSocialAccount{} = account) do
    required_token(ClipperSocialAccount.get_refresh_token(account), :refresh_token)
  end

  defp decrypt_refresh_token(%SocialAccount{} = account) do
    required_token(SocialAccount.get_refresh_token(account), :refresh_token)
  end

  defp required_token(token, _kind) when is_binary(token) and token != "", do: {:ok, token}
  defp required_token(_, kind), do: {:error, {:missing_or_invalid_token, kind}}

  defp revocation_token(account) do
    case decrypt_refresh_token(account) do
      {:ok, token} -> {:ok, {token, "refresh_token"}}
      {:error, _} -> decrypt_access_token(account) |> map_access_token()
    end
  end

  defp map_access_token({:ok, token}), do: {:ok, {token, "access_token"}}
  defp map_access_token({:error, _}), do: {:error, :missing_token}

  defp ensure_tokend_account(account) do
    if native_tokend_account?(account), do: :ok, else: {:error, :not_tokend_account}
  end

  defp require_oauth_ready do
    if Client.oauth_ready?(), do: :ok, else: {:error, :oauth_not_ready}
  end

  defp native_tokend_account?(account) do
    account.provider == "tokend" and account.platform == "tokend"
  end

  defp mock_account?(account) do
    payload = account.provider_payload || %{}

    (payload["mode"] || payload[:mode]) == "mock" or
      (is_binary(account.provider_account_id) and
         String.starts_with?(account.provider_account_id, "tokend-mock-"))
  end
end
