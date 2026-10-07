defmodule ClippsterServerWeb.WorkspaceGoogleControllerTest do
  use ClippsterServerWeb.ConnCase, async: false
  import ClippsterServer.AccountsFixtures
  alias ClippsterServer.Auth.{WorkspaceOAuth, TokenGenerator}
  @origin "https://app.clippster.app"
  @secret String.duplicate("a", 43)

  setup do
    prior = Application.get_env(:ueberauth, Ueberauth.Strategy.Google.OAuth)

    Application.put_env(:ueberauth, Ueberauth.Strategy.Google.OAuth,
      client_id: "fixture-google-client",
      client_secret: "fixture-secret"
    )

    on_exit(fn ->
      if prior,
        do: Application.put_env(:ueberauth, Ueberauth.Strategy.Google.OAuth, prior),
        else: Application.delete_env(:ueberauth, Ueberauth.Strategy.Google.OAuth)
    end)
  end

  defp challenge, do: :crypto.hash(:sha256, @secret) |> Base.url_encode64(padding: false)

  test "workspace start signs PKCE state and cancellation returns to the browser server", %{
    conn: conn
  } do
    response =
      post(conn, "/api/auth/google/start", %{
        origin: @origin,
        client_state: @secret,
        code_challenge: challenge()
      })

    url = json_response(response, 200)["url"] |> URI.parse()
    assert url.host == "accounts.google.com"
    query = URI.decode_query(url.query)
    assert URI.parse(query["redirect_uri"]).path == "/api/auth/google/callback"

    assert {:ok, state} =
             Phoenix.Token.verify(
               ClippsterServerWeb.Endpoint,
               "google_oauth_state",
               query["state"]
             )

    assert state["workspace"] == true
    assert state["code_challenge"] == challenge()

    callback =
      get(build_conn(), "/api/auth/google/callback", %{
        state: query["state"],
        error: "access_denied"
      })

    target = redirected_to(callback) |> URI.parse()
    assert URI.to_string(%{target | query: nil}) == @origin <> "/api/auth/google/callback"
    assert URI.decode_query(target.query) == %{"state" => @secret, "error" => "google_cancelled"}
  end

  test "desktop and landing requests keep their original callback modes", %{conn: conn} do
    for params <- [%{}, %{"web" => "true", "origin" => "https://clippster.app"}] do
      response = get(conn, "/api/auth/google", params)
      query = redirected_to(response) |> URI.parse() |> Map.fetch!(:query) |> URI.decode_query()

      assert {:ok, state} =
               Phoenix.Token.verify(
                 ClippsterServerWeb.Endpoint,
                 "google_oauth_state",
                 query["state"]
               )

      refute state["workspace"]

      callback =
        get(build_conn(), "/api/auth/google/callback", %{
          state: query["state"],
          error: "access_denied"
        })

      expected =
        if params["web"],
          do: "https://clippster.app/auth/google/callback",
          else: "http://localhost:54321/google-callback"

      assert String.starts_with?(redirected_to(callback), expected <> "?")
    end
  end

  test "exchange returns a valid existing-account JWT and rejects replay", %{conn: conn} do
    user = google_user_fixture()
    code = WorkspaceOAuth.issue(user.id, %{origin: @origin, code_challenge: challenge()})
    params = %{code: code, code_verifier: @secret, origin: @origin}
    response = post(conn, "/api/auth/google/exchange", params)
    result = json_response(response, 200)
    assert {:ok, claims} = TokenGenerator.verify_token(result["token"])
    assert claims["user_id"] == user.id
    assert get_resp_header(response, "cache-control") == ["no-store"]
    assert json_response(post(build_conn(), "/api/auth/google/exchange", params), 400)["error"]
  end

  test "rejects foreign redirects and cannot forge a workspace mode through desktop URL", %{
    conn: conn
  } do
    assert json_response(
             post(conn, "/api/auth/google/start", %{
               origin: "https://evil.example",
               client_state: @secret,
               code_challenge: challenge()
             }),
             400
           )["error"]

    response =
      get(conn, "/api/auth/google", %{workspace: "true", origin: @origin, client_state: @secret})

    query = redirected_to(response) |> URI.parse() |> Map.fetch!(:query) |> URI.decode_query()

    assert {:ok, state} =
             Phoenix.Token.verify(
               ClippsterServerWeb.Endpoint,
               "google_oauth_state",
               query["state"]
             )

    refute state["workspace"]
  end
end
