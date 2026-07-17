defmodule ClippsterServerWeb.SwitchGoogleAccountControllerTest do
  use ClippsterServerWeb.ConnCase, async: true

  import ClippsterServer.AccountsFixtures

  alias ClippsterServer.Accounts
  alias ClippsterServer.Auth.TokenGenerator
  alias ClippsterServer.Credits

  defp auth_conn(conn, user) do
    {:ok, token} =
      TokenGenerator.generate_token(%{
        "sub" => "google:#{user.provider_id}",
        "user_id" => user.id,
        "provider" => "google",
        "provider_id" => user.provider_id,
        "email" => user.email,
        "iat" => DateTime.utc_now() |> DateTime.to_unix(),
        "exp" => DateTime.utc_now() |> DateTime.add(1, :day) |> DateTime.to_unix()
      })

    put_req_header(conn, "authorization", "Bearer #{token}")
  end

  describe "POST /api/auth/switch/google" do
    test "switches Gmail, returns new JWT for same user, preserves credits", %{conn: conn} do
      user =
        google_user_fixture(%{email: "api-original@gmail.com", provider_id: "google-api-orig"})
        |> with_credits!(10.0)

      new_info =
        google_oauth_info(%{
          email: "api-switched@gmail.com",
          provider_id: "google-api-switched",
          name: "API Switched"
        })

      conn =
        conn
        |> auth_conn(user)
        |> post("/api/auth/switch/google", %{
          "google_info" => %{
            "id" => new_info.provider_id,
            "email" => new_info.email,
            "name" => new_info.name,
            "picture" => nil
          }
        })

      assert %{
               "success" => true,
               "token" => token,
               "user" => %{
                 "id" => user_id,
                 "email" => "api-switched@gmail.com",
                 "provider_id" => "google-api-switched"
               }
             } = json_response(conn, 200)

      assert user_id == user.id

      {:ok, claims} = TokenGenerator.verify_token(token)
      assert claims["user_id"] == user.id
      assert claims["provider_id"] == "google-api-switched"
      assert claims["email"] == "api-switched@gmail.com"

      {:ok, %{hours_remaining: hours}} = Credits.get_user_balance(user.id)
      assert Decimal.eq?(hours, Decimal.new("10.0"))

      reloaded = Accounts.get_user(user.id)
      assert reloaded.email == "api-switched@gmail.com"
      assert reloaded.provider_id == "google-api-switched"
    end

    test "rejects when target Google account belongs to another user", %{conn: conn} do
      user_a = google_user_fixture(%{email: "a@gmail.com", provider_id: "google-a"})
      user_b = google_user_fixture(%{email: "b@gmail.com", provider_id: "google-b"})

      conn =
        conn
        |> auth_conn(user_a)
        |> post("/api/auth/switch/google", %{
          "google_info" => %{
            "id" => user_b.provider_id,
            "email" => user_b.email,
            "name" => user_b.name
          }
        })

      assert %{"success" => false, "error" => error} = json_response(conn, 409)
      assert error =~ "already"

      assert Accounts.get_user(user_a.id).provider_id == "google-a"
      assert Accounts.get_user(user_b.id).provider_id == "google-b"
    end

    test "requires authentication", %{conn: conn} do
      conn =
        post(conn, "/api/auth/switch/google", %{
          "google_info" => %{"id" => "x", "email" => "x@gmail.com"}
        })

      assert json_response(conn, 401)
    end
  end

  describe "GET /api/auth/google/switch" do
    test "authenticated start returns OAuth URL or config error", %{conn: conn} do
      user = google_user_fixture()
      conn = conn |> auth_conn(user) |> get("/api/auth/google/switch")

      body = json_response(conn, conn.status)
      assert conn.status in [200, 500]

      if conn.status == 200 do
        assert body["success"] == true
        assert is_binary(body["url"])
        assert body["url"] =~ "accounts.google.com"
        assert body["url"] =~ "select_account"
      else
        assert body["success"] == false
      end
    end

    test "unauthenticated request is rejected", %{conn: conn} do
      conn = get(conn, "/api/auth/google/switch")
      assert json_response(conn, 401)
    end
  end
end
