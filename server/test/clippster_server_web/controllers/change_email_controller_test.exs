defmodule ClippsterServerWeb.ChangeEmailControllerTest do
  use ClippsterServerWeb.ConnCase, async: true

  import Swoosh.TestAssertions
  import ClippsterServer.AccountsFixtures

  alias ClippsterServer.Accounts
  alias ClippsterServer.Auth.TokenGenerator

  defp auth_conn(conn, user) do
    {:ok, token} =
      TokenGenerator.generate_token(%{
        "sub" => "#{user.provider}:#{user.provider_id}",
        "user_id" => user.id,
        "provider" => user.provider,
        "provider_id" => user.provider_id,
        "email" => user.email,
        "iat" => DateTime.utc_now() |> DateTime.to_unix(),
        "exp" => DateTime.utc_now() |> DateTime.add(1, :day) |> DateTime.to_unix()
      })

    put_req_header(conn, "authorization", "Bearer #{token}")
  end

  defp last_email! do
    case assert_email_sent() do
      %Swoosh.Email{} = email -> email
      {:email, %Swoosh.Email{} = email} -> email
      other -> flunk("Unexpected assert_email_sent result: #{inspect(other)}")
    end
  end

  defp extract_otp(email) do
    body = email.html_body || email.text_body || ""
    [_, otp] = Regex.run(~r/\b(\d{6})\b/, body)
    otp
  end

  describe "POST /api/account/change-email" do
    test "email user requests change and receives OTP email", %{conn: conn} do
      user = email_user_fixture(%{email: "api-old@example.com", password: "password123"})

      conn =
        conn
        |> auth_conn(user)
        |> post("/api/account/change-email", %{
          "new_email" => "api-new@example.com",
          "password" => "password123"
        })

      assert %{
               "success" => true,
               "pending_email" => "api-new@example.com",
               "otp_required" => true
             } = json_response(conn, 200)

      email = last_email!()
      assert Enum.any?(email.to, fn {_n, addr} -> addr == "api-new@example.com" end)
    end

    test "Google user can convert with new_password", %{conn: conn} do
      user = google_user_fixture(%{email: "g@gmail.com"})

      conn =
        conn
        |> auth_conn(user)
        |> post("/api/account/change-email", %{
          "new_email" => "converted@example.com",
          "new_password" => "password123"
        })

      assert %{"success" => true, "otp_required" => true, "converting_from_oauth" => true} =
               json_response(conn, 200)

      email = last_email!()
      assert Enum.any?(email.to, fn {_n, addr} -> addr == "converted@example.com" end)
    end
  end

  describe "POST /api/account/verify-email-change-otp" do
    test "verifies OTP and returns updated user + token", %{conn: conn} do
      user = email_user_fixture(%{email: "v-old@example.com", password: "password123"})

      {:ok, _} = Accounts.change_email(user.id, "v-new@example.com", "password123")
      otp = extract_otp(last_email!())

      conn =
        conn
        |> auth_conn(user)
        |> post("/api/account/verify-email-change-otp", %{"otp" => otp})

      assert %{
               "success" => true,
               "token" => token,
               "user" => %{"email" => "v-new@example.com", "provider" => "email", "id" => id}
             } = json_response(conn, 200)

      assert id == user.id
      {:ok, claims} = TokenGenerator.verify_token(token)
      assert claims["email"] == "v-new@example.com"
      assert claims["user_id"] == user.id
    end
  end

  describe "POST /api/account/resend-email-change" do
    test "resends OTP for pending change", %{conn: conn} do
      user = email_user_fixture(%{password: "password123"})
      {:ok, _} = Accounts.change_email(user.id, "r@example.com", "password123")
      _ = last_email!()

      conn = conn |> auth_conn(user) |> post("/api/account/resend-email-change", %{})

      assert %{"success" => true} = json_response(conn, 200)
      email = last_email!()
      assert Enum.any?(email.to, fn {_n, addr} -> addr == "r@example.com" end)
    end
  end
end
