defmodule ClippsterServer.Tokend.ClientTest do
  use ExUnit.Case, async: false

  alias ClippsterServer.Tokend.Client
  alias ClippsterServerWeb.TokendController

  @env_names ~w(
    TOKEND_API_BASE_URL
    TOKEND_WEB_BASE_URL
    TOKEND_OAUTH_CLIENT_ID
    TOKEND_OAUTH_CLIENT_SECRET
    TOKEND_OAUTH_REDIRECT_URI
    TOKEND_PARTNER_API_ENABLED
  )

  setup do
    previous_config = Application.get_env(:clippster_server, :tokend)
    previous_http_client = Application.get_env(:clippster_server, :tokend_http_client)
    previous_env = Map.new(@env_names, &{&1, System.get_env(&1)})

    Enum.each(@env_names, &System.delete_env/1)

    on_exit(fn ->
      restore_application_env(:tokend, previous_config)
      restore_application_env(:tokend_http_client, previous_http_client)

      Enum.each(previous_env, fn
        {name, nil} -> System.delete_env(name)
        {name, value} -> System.put_env(name, value)
      end)
    end)

    :ok
  end

  test "live mode reflects complete remote config while OAuth readiness also requires feature flag" do
    configure(api_base_url: "https://api.tokend.tv")

    assert Client.mode() == :local
    refute Client.oauth_ready?()

    assert %{
             enabled: false,
             ready: false,
             configured: false,
             incomplete: false,
             missing: missing
           } = Client.oauth_configuration()

    assert "TOKEND_OAUTH_REDIRECT_URI" in missing

    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret"
    )

    assert Client.mode() == :local
    assert Client.oauth_configuration().incomplete
    assert Client.oauth_configuration().missing == ["TOKEND_OAUTH_REDIRECT_URI"]

    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback"
    )

    assert Client.mode() == :live
    refute Client.oauth_ready?()
    assert Client.oauth_configuration().configured

    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback",
      partner_api_enabled: true
    )

    assert Client.mode() == :live
    assert Client.oauth_ready?()
    assert Client.oauth_configuration().enabled
  end

  test "partner feature flag defaults false and live process env can enable it" do
    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback"
    )

    refute Client.oauth_ready?()
    System.put_env("TOKEND_PARTNER_API_ENABLED", "true")
    assert Client.oauth_ready?()
  end

  test "default scopes expand only when partner OAuth is ready" do
    assert Client.default_oauth_scopes() == "profile:read offline_access"

    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback",
      partner_api_enabled: true
    )

    assert Client.default_oauth_scopes() =~ "posts:write"
    assert Client.default_oauth_scopes() =~ "media:download"
    assert Client.capabilities().publish
  end

  test "mode endpoint exposes enabled and ready states without configuration values" do
    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback"
    )

    conn =
      Plug.Test.conn(:get, "/api/tokend/mode")
      |> TokendController.mode(%{})

    payload = Jason.decode!(conn.resp_body)
    assert payload["mode"] == "live"
    assert payload["oauth_enabled"] == false
    assert payload["oauth_configured"] == true
    assert payload["oauth_ready"] == false
    assert payload["capabilities"]["publish"] == false
    refute conn.resp_body =~ "client-id"
    refute conn.resp_body =~ "secret"
  end

  test "token response validation requires access token, bearer type, and positive expiry" do
    assert {:ok, tokens} =
             Client.validate_token_response(%{
               "access_token" => "access",
               "refresh_token" => "refresh",
               "token_type" => "bearer",
               "expires_in" => 3600,
               "scope" => "profile:read offline_access"
             })

    assert tokens.token_type == "Bearer"

    assert {:error, {:invalid_token_response, :access_token}} =
             Client.validate_token_response(%{"token_type" => "Bearer", "expires_in" => 3600})

    assert {:error, {:invalid_token_response, :token_type}} =
             Client.validate_token_response(%{
               "access_token" => "access",
               "token_type" => "MAC",
               "expires_in" => 3600
             })

    assert {:error, {:invalid_token_response, :expires_in}} =
             Client.validate_token_response(%{
               "access_token" => "access",
               "token_type" => "Bearer",
               "expires_in" => 0
             })
  end

  test "authorization-code exchange uses the shared request boundary and validates response" do
    configure_oauth()
    parent = self()

    stub_http(fn method, url, opts ->
      send(parent, {:request, method, url, opts})

      {:ok,
       %{
         status: 200,
         body: %{
           "access_token" => "access",
           "refresh_token" => "refresh",
           "token_type" => "Bearer",
           "expires_in" => 3600
         }
       }}
    end)

    assert {:ok, %{access_token: "access"}} =
             Client.exchange_authorization_code("code", "verifier")

    assert_receive {:request, :post, "https://api.tokend.tv/api/v1/oauth/token", opts}
    assert opts[:form]["grant_type"] == "authorization_code"
    assert opts[:form]["code_verifier"] == "verifier"
  end

  test "partner profile rejects a missing user id" do
    configure_oauth()

    stub_http(fn :get, _url, _opts ->
      {:ok, %{status: 200, body: %{"data" => %{"email" => "user@example.com"}}}}
    end)

    assert {:error, :missing_partner_user_id} = Client.fetch_partner_me("access")
  end

  test "refresh grant returns rotating refresh token and revoke sends the expected shape" do
    configure_oauth()
    parent = self()

    stub_http(fn :post, url, opts ->
      send(parent, {:request, url, opts[:form]})

      if String.ends_with?(url, "/oauth/revoke") do
        {:ok, %{status: 200, body: ""}}
      else
        {:ok,
         %{
           status: 200,
           body: %{
             "access_token" => "new-access",
             "refresh_token" => "rotated-refresh",
             "token_type" => "Bearer",
             "expires_in" => 3600
           }
         }}
      end
    end)

    assert {:ok, %{refresh_token: "rotated-refresh"}} =
             Client.refresh_access_token("old-refresh")

    assert_receive {:request, token_url, refresh_form}
    assert String.ends_with?(token_url, "/api/v1/oauth/token")
    assert refresh_form["grant_type"] == "refresh_token"
    assert refresh_form["refresh_token"] == "old-refresh"

    assert :ok = Client.revoke_token("rotated-refresh", "refresh_token")
    assert_receive {:request, revoke_url, revoke_form}
    assert String.ends_with?(revoke_url, "/api/v1/oauth/revoke")
    assert revoke_form["token"] == "rotated-refresh"
    assert revoke_form["token_type_hint"] == "refresh_token"
    refute Map.has_key?(revoke_form, "access_token")
  end

  test "OAuth writes fail closed while partner API is disabled" do
    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback"
    )

    stub_http(fn _method, _url, _opts -> flunk("HTTP request must not run") end)

    assert {:error, :oauth_not_ready} =
             Client.exchange_authorization_code("code", "verifier")

    assert {:error, :oauth_not_ready} = Client.refresh_access_token("refresh")
    assert {:error, :oauth_not_ready} = Client.revoke_token("refresh")
  end

  test "empty or reserved slugs fail closed instead of becoming seed-nova" do
    configure()

    assert {:error, :invalid_slug} = Client.creator_catalog("   ")
    assert {:error, :invalid_slug} = Client.live_status("@")
  end

  test "fixtures are returned only in explicit mock mode" do
    configure()

    assert Client.mode() == :mock

    assert {:ok, %{mode: "mock", slug: "seed-nova", streams: [_]}} =
             Client.creator_catalog("seed-nova")

    assert {:ok, %{mode: "mock", isLive: true}} = Client.live_status("seed-nova")
  end

  test "publishing fails closed until partner ready and requires a creator slug" do
    configure([])

    assert {:error, :oauth_not_ready} =
             Client.publish_media("token", "https://media.example/video.mp4", %{
               creator_slug: "seed-nova"
             })

    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback",
      partner_api_enabled: true
    )

    assert {:error, :missing_creator_slug} =
             Client.publish_media("token", "https://media.example/video.mp4", %{})
  end

  test "publish_media uploads then creates a partner post when ready" do
    configure_oauth()
    parent = self()

    stub_http(fn method, url, opts ->
      send(parent, {:request, method, url, opts})

      cond do
        method == :get and String.contains?(url, "media.example") ->
          {:ok, %{status: 200, body: <<0, 1, 2>>, headers: [{"content-type", "video/mp4"}]}}

        method == :post and String.ends_with?(url, "/partner/uploads") ->
          {:ok, %{status: 200, body: %{"data" => %{"url" => "https://cdn.tokend/video.mp4"}}}}

        method == :post and String.contains?(url, "/partner/creators/") ->
          {:ok, %{status: 200, body: %{"data" => %{"id" => "post_123"}}}}

        true ->
          flunk("unexpected request #{method} #{url}")
      end
    end)

    assert {:ok, %{post_id: "post_123", post_url: post_url}} =
             Client.publish_media("access", "https://media.example/video.mp4", %{
               creator_slug: "seed-nova",
               caption: "hello",
               idempotency_key: "idem-1"
             })

    assert post_url =~ "/seed-nova/posts/post_123"
    assert_receive {:request, :get, "https://media.example/video.mp4", _}
    assert_receive {:request, :post, "https://api.tokend.tv/api/v1/partner/uploads", _}
    assert_receive {:request, :post, create_url, create_opts}
    assert create_url =~ "/partner/creators/seed-nova/posts"
    assert create_opts[:json][:idempotency_key] == "idem-1"
  end

  test "local mode propagates upstream failures without fixture fallback" do
    configure(api_base_url: "http://localhost:4101")
    stub_http(fn _url, _opts -> {:error, :econnrefused} end)

    assert {:error, :econnrefused} = Client.creator_catalog("seed-nova")
    assert {:error, :econnrefused} = Client.live_status("seed-nova")
  end

  test "creator 404 produces honest empty and offline local results" do
    configure(api_base_url: "http://localhost:4101")
    stub_http(fn _url, _opts -> {:ok, %{status: 404, body: %{}}} end)

    assert {:ok, %{mode: "local", streams: [], videos: []}} =
             Client.creator_catalog("missing")

    assert {:ok, %{mode: "local", isLive: false, error: "not_found_on_tokend"}} =
             Client.live_status("missing")
  end

  test "live mode labels successful public reads as live" do
    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback"
    )

    stub_http(fn url, _opts ->
      body =
        cond do
          String.contains?(url, "/vods") -> %{"data" => []}
          String.contains?(url, "/clips") -> %{"data" => []}
          true -> %{"data" => %{"profile" => %{"display_name" => "Creator"}, "is_live" => false}}
        end

      {:ok, %{status: 200, body: body}}
    end)

    assert {:ok, %{mode: "live", displayName: "Creator"}} =
             Client.creator_catalog("creator")

    assert {:ok, %{mode: "live", isLive: false, displayName: "Creator"}} =
             Client.live_status("creator")
  end

  test "live mode propagates non-404 HTTP failures" do
    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback"
    )

    stub_http(fn _url, _opts ->
      {:ok, %{status: 503, body: %{"error" => "unavailable"}}}
    end)

    assert {:error, {:http, 503, %{"error" => "unavailable"}}} =
             Client.creator_catalog("creator")

    assert {:error, {:http, 503, %{"error" => "unavailable"}}} =
             Client.live_status("creator")
  end

  test "catalog controller rejects invalid slugs before any upstream call" do
    stub_http(fn _url, _opts -> flunk("HTTP request must not run") end)

    conn =
      Plug.Test.conn(:get, "/api/tokend/channels/%20")
      |> TokendController.get_channel(%{"slug" => "   "})

    assert conn.status == 400
    assert Jason.decode!(conn.resp_body) == %{"error" => "invalid_slug"}
  end

  test "live status controller converts client failures to bad gateway responses" do
    configure(api_base_url: "http://localhost:4101")
    stub_http(fn _url, _opts -> {:error, :timeout} end)

    conn =
      Plug.Test.conn(:get, "/api/tokend/channels/creator/live")
      |> TokendController.get_live_status(%{"slug" => "creator"})

    assert conn.status == 502
    assert Jason.decode!(conn.resp_body) == %{"error" => ":timeout"}
  end

  defp configure(overrides \\ []) do
    defaults = [
      api_base_url: nil,
      web_base_url: "http://localhost:4100",
      oauth_client_id: nil,
      oauth_client_secret: nil,
      oauth_redirect_uri: nil,
      partner_api_enabled: false
    ]

    Application.put_env(:clippster_server, :tokend, Keyword.merge(defaults, overrides))
  end

  defp stub_http(fun) do
    Application.put_env(:clippster_server, :tokend_http_client, fun)
  end

  defp configure_oauth do
    configure(
      api_base_url: "https://api.tokend.tv",
      oauth_client_id: "client-id",
      oauth_client_secret: "secret",
      oauth_redirect_uri: "https://api.clippster.app/api/auth/tokend/callback",
      partner_api_enabled: true
    )
  end

  defp restore_application_env(key, nil), do: Application.delete_env(:clippster_server, key)
  defp restore_application_env(key, value), do: Application.put_env(:clippster_server, key, value)
end
