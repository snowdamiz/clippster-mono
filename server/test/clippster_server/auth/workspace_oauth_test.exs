defmodule ClippsterServer.Auth.WorkspaceOAuthTest do
  use ClippsterServer.DataCase, async: true
  import ClippsterServer.AccountsFixtures
  alias ClippsterServer.Auth.WorkspaceOAuth

  @origin "https://app.clippster.app"
  @verifier String.duplicate("a", 43)
  defp challenge, do: :crypto.hash(:sha256, @verifier) |> Base.url_encode64(padding: false)

  test "accepts the exact workspace origin and rejects lookalikes, paths and malformed PKCE" do
    params = %{"origin" => @origin, "client_state" => @verifier, "code_challenge" => challenge()}
    assert {:ok, %{"workspace" => true}} = WorkspaceOAuth.start_params(params)

    for origin <- [
          "https://app.clippster.app:8443",
          "https://clippster.app",
          "https://evil.app.clippster.app",
          "https://app.clippster.app.evil.com",
          "http://app.clippster.app",
          @origin <> "/path",
          @origin <> "?x=1"
        ] do
      assert {:error, _} = WorkspaceOAuth.start_params(Map.put(params, "origin", origin))
    end

    assert {:error, _} = WorkspaceOAuth.start_params(Map.put(params, "code_challenge", "plain"))
    assert {:error, _} = WorkspaceOAuth.start_params(Map.put(params, "client_state", ""))
  end

  test "handoff requires the verifier and origin, and can only be exchanged once" do
    user = google_user_fixture()
    code = WorkspaceOAuth.issue(user.id, %{origin: @origin, code_challenge: challenge()})
    params = %{"code" => code, "code_verifier" => @verifier, "origin" => @origin}

    assert {:error, :invalid_code} =
             WorkspaceOAuth.exchange(Map.put(params, "code_verifier", String.duplicate("b", 43)))

    assert {:error, :invalid_code} =
             WorkspaceOAuth.exchange(Map.put(params, "origin", "https://clippster.app"))

    assert {:ok, id} = WorkspaceOAuth.exchange(params)
    assert id == user.id
    assert {:error, :invalid_code} = WorkspaceOAuth.exchange(params)
  end

  test "expired and malformed codes cannot establish a session" do
    user = google_user_fixture()
    code = WorkspaceOAuth.issue(user.id, %{origin: @origin, code_challenge: challenge()})

    Repo.update_all("workspace_oauth_codes",
      set: [expires_at: DateTime.add(DateTime.utc_now(), -1, :day) |> DateTime.truncate(:second)]
    )

    assert {:error, :invalid_code} =
             WorkspaceOAuth.exchange(%{
               "code" => code,
               "code_verifier" => @verifier,
               "origin" => @origin
             })

    assert {:error, :invalid_code} = WorkspaceOAuth.exchange(%{"code" => nil})
  end
end
