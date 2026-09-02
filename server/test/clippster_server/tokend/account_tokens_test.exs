defmodule ClippsterServer.Tokend.AccountTokensTest do
  use ExUnit.Case, async: false

  alias ClippsterServer.Campaigns.ClipperSocialAccount
  alias ClippsterServer.Social.SocialAccount
  alias ClippsterServer.Social.TokenEncryption
  alias ClippsterServer.Tokend.AccountTokens

  @encryption_key Base.encode64(:binary.copy(<<7>>, 32))
  @env_names ~w(
    TOKEND_API_BASE_URL
    TOKEND_WEB_BASE_URL
    TOKEND_OAUTH_CLIENT_ID
    TOKEND_OAUTH_CLIENT_SECRET
    TOKEND_OAUTH_REDIRECT_URI
    TOKEND_PARTNER_API_ENABLED
  )

  setup do
    previous_key = Application.get_env(:clippster_server, :social_token_encryption_key)
    previous_config = Application.get_env(:clippster_server, :tokend)
    previous_http_client = Application.get_env(:clippster_server, :tokend_http_client)
    previous_env = Map.new(@env_names, &{&1, System.get_env(&1)})

    Enum.each(@env_names, &System.delete_env/1)
    Application.put_env(:clippster_server, :social_token_encryption_key, @encryption_key)
    configure_oauth()

    on_exit(fn ->
      restore_application_env(:social_token_encryption_key, previous_key)
      restore_application_env(:tokend, previous_config)
      restore_application_env(:tokend_http_client, previous_http_client)

      Enum.each(previous_env, fn
        {name, nil} -> System.delete_env(name)
        {name, value} -> System.put_env(name, value)
      end)
    end)

    :ok
  end

  test "user account refresh persists rotated access and refresh tokens" do
    now = ~U[2026-08-25 12:00:00Z]
    account = user_account(now, "old-access", "old-refresh")
    parent = self()

    refresh_fun = fn "old-refresh" ->
      {:ok,
       %{
         access_token: "new-access",
         refresh_token: "rotated-refresh",
         token_type: "Bearer",
         expires_in: 3600,
         scope: "profile:read offline_access"
       }}
    end

    persist_fun = fn ^account, attrs ->
      send(parent, {:persisted, attrs})
      {:ok, %{account | token_expires_at: attrs.token_expires_at}}
    end

    assert {:ok, %{access_token: "new-access", refreshed: true}} =
             AccountTokens.ensure_fresh_access_token(account,
               now: now,
               refresh_fun: refresh_fun,
               persist_fun: persist_fun
             )

    assert_receive {:persisted, attrs}
    assert attrs.access_token == "new-access"
    assert attrs.refresh_token == "rotated-refresh"
    assert attrs.token_expires_at == DateTime.add(now, 3600, :second)
  end

  test "organization account preserves old refresh token when upstream omits one" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    account = org_account(now, "old-access", "old-refresh")
    parent = self()

    refresh_fun = fn "old-refresh" ->
      {:ok,
       %{
         access_token: "new-access",
         refresh_token: nil,
         token_type: "Bearer",
         expires_in: 3600,
         scope: "profile:read offline_access"
       }}
    end

    persist_fun = fn %SocialAccount{}, attrs ->
      send(parent, {:persisted, attrs})
      {:ok, account}
    end

    assert {:ok, %{access_token: "new-access", refreshed: true}} =
             AccountTokens.ensure_fresh_access_token(account,
               now: now,
               refresh_fun: refresh_fun,
               persist_fun: persist_fun
             )

    assert_receive {:persisted, %{refresh_token: "old-refresh"}}
  end

  test "account outside the short refresh window returns decrypted token without persistence" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    account = user_account(DateTime.add(now, 900, :second), "current-access", "refresh")

    assert {:ok, %{access_token: "current-access", refreshed: false, account: ^account}} =
             AccountTokens.ensure_fresh_access_token(account,
               now: now,
               refresh_fun: fn _ -> flunk("refresh must not run") end,
               persist_fun: fn _, _ -> flunk("persistence must not run") end
             )
  end

  test "missing access token refreshes from an available refresh token" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    account = user_account(nil, nil, "old-refresh")

    assert {:ok, %{access_token: "new-access", refreshed: true}} =
             AccountTokens.ensure_fresh_access_token(account,
               now: now,
               refresh_fun: fn "old-refresh" ->
                 {:ok,
                  %{
                    access_token: "new-access",
                    refresh_token: nil,
                    token_type: "Bearer",
                    expires_in: 3600
                  }}
               end,
               persist_fun: fn ^account, attrs ->
                 {:ok, %{account | token_expires_at: attrs.token_expires_at}}
               end
             )
  end

  test "native identity requires both Tokend provider and platform" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    assert {:error, :not_tokend_account} =
             user_account(now, "access", "refresh")
             |> Map.put(:provider, "post_for_me")
             |> AccountTokens.ensure_fresh_access_token(now: now)

    assert {:error, :not_tokend_account} =
             user_account(now, "access", "refresh")
             |> Map.put(:platform, "youtube")
             |> AccountTokens.ensure_fresh_access_token(now: now)
  end

  test "best-effort revoke prefers refresh token and does not block on remote failure" do
    parent = self()

    Application.put_env(:clippster_server, :tokend_http_client, fn method, url, opts ->
      send(parent, {:request, method, url, opts[:form]})
      {:ok, %{status: 503, body: %{"error" => "unavailable"}}}
    end)

    account = user_account(DateTime.utc_now(), "access", "refresh")
    assert :ok = AccountTokens.best_effort_revoke(account)

    assert_receive {:request, :post, url, form}
    assert String.ends_with?(url, "/api/v1/oauth/revoke")
    assert form["token"] == "refresh"
    assert form["token_type_hint"] == "refresh_token"
  end

  test "best-effort revoke skips mock accounts" do
    Application.put_env(:clippster_server, :tokend_http_client, fn _, _, _ ->
      flunk("mock tokens must never be sent remotely")
    end)

    account =
      user_account(DateTime.utc_now(), "access", "refresh")
      |> Map.put(:provider_account_id, "tokend-mock-seed-nova")
      |> Map.put(:provider_payload, %{"mode" => "mock"})

    assert :ok = AccountTokens.best_effort_revoke(account)
  end

  test "best-effort revoke falls back to access token" do
    parent = self()

    Application.put_env(:clippster_server, :tokend_http_client, fn _, _, opts ->
      send(parent, {:revoke_form, opts[:form]})
      {:ok, %{status: 200, body: ""}}
    end)

    account = user_account(DateTime.utc_now(), "access", nil)
    assert :ok = AccountTokens.best_effort_revoke(account)
    assert_receive {:revoke_form, %{"token" => "access", "token_type_hint" => "access_token"}}
  end

  defp user_account(expires_at, access_token, refresh_token) do
    %ClipperSocialAccount{
      id: 10,
      platform: "tokend",
      provider: "tokend",
      provider_account_id: "tokend-user-1",
      provider_payload: %{"mode" => "live"},
      access_token_encrypted: TokenEncryption.encrypt(access_token),
      refresh_token_encrypted: TokenEncryption.encrypt(refresh_token),
      token_expires_at: expires_at
    }
  end

  defp org_account(expires_at, access_token, refresh_token) do
    %SocialAccount{
      id: 20,
      platform: "tokend",
      provider: "tokend",
      provider_account_id: "tokend-org-user-1",
      provider_payload: %{"mode" => "live"},
      access_token_encrypted: TokenEncryption.encrypt(access_token),
      refresh_token_encrypted: TokenEncryption.encrypt(refresh_token),
      token_expires_at: expires_at
    }
  end

  defp configure_oauth do
    Application.put_env(:clippster_server, :tokend,
      api_base_url: "https://api.tokend.tv",
      web_base_url: "https://tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback",
      partner_api_enabled: true
    )
  end

  defp restore_application_env(key, nil), do: Application.delete_env(:clippster_server, key)
  defp restore_application_env(key, value), do: Application.put_env(:clippster_server, key, value)
end
