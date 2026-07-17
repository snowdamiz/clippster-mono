defmodule ClippsterServer.Accounts.ChangeEmailTest do
  use ClippsterServer.DataCase, async: true

  import Swoosh.TestAssertions
  import ClippsterServer.AccountsFixtures

  alias ClippsterServer.Accounts
  alias ClippsterServer.Credits
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User

  defp last_email! do
    case assert_email_sent() do
      %Swoosh.Email{} = email -> email
      {:email, %Swoosh.Email{} = email} -> email
      other -> flunk("Unexpected assert_email_sent result: #{inspect(other)}")
    end
  end

  defp extract_otp(email) do
    body = email.html_body || email.text_body || ""

    case Regex.run(~r/\b(\d{6})\b/, body) do
      [_, otp] -> otp
      _ -> flunk("Expected 6-digit OTP in email body, got: #{inspect(body)}")
    end
  end

  defp extract_token(email) do
    body = email.html_body || email.text_body || ""

    case Regex.run(~r{/verify-email-change/([A-Za-z0-9_-]+)}, body) do
      [_, token] -> token
      _ -> flunk("Expected magic-link token in email body")
    end
  end

  defp assert_delivered_to!(email, expected) do
    assert Enum.any?(email.to, fn
             {_name, address} -> address == expected
             address when is_binary(address) -> address == expected
           end),
           "Expected email delivered to #{expected}, got #{inspect(email.to)}"

    email
  end

  describe "change_email/3 (email users)" do
    test "sends OTP + magic link to the new address and does not change email yet" do
      user = email_user_fixture(%{email: "old@example.com", password: "password123"})

      assert {:ok, pending} =
               Accounts.change_email(user.id, "new@example.com", "password123")

      assert pending.email == "old@example.com"
      assert pending.email_change_new_email == "new@example.com"
      assert is_binary(pending.email_change_otp)
      assert is_binary(pending.email_change_token)
      assert pending.email_change_attempts == 0

      email = last_email!() |> assert_delivered_to!("new@example.com")
      assert email.subject =~ "Verify your new"
      assert extract_otp(email)
      assert extract_token(email)
    end

    test "rejects invalid current password" do
      user = email_user_fixture(%{password: "password123"})

      assert {:error, :invalid_password} =
               Accounts.change_email(user.id, "new@example.com", "wrong-password")
    end

    test "rejects email already in use" do
      _taken = email_user_fixture(%{email: "taken@example.com"})
      user = email_user_fixture(%{email: "mine@example.com", password: "password123"})

      assert {:error, :email_already_in_use} =
               Accounts.change_email(user.id, "taken@example.com", "password123")
    end
  end

  describe "verify_email_change_otp/2" do
    test "applies new email, updates provider_id, clears pending fields" do
      user = email_user_fixture(%{email: "before@example.com", password: "password123"})
      assert {:ok, _} = Accounts.change_email(user.id, "after@example.com", "password123")
      otp = extract_otp(last_email!())

      assert {:ok, updated} = Accounts.verify_email_change_otp(user.id, otp)

      assert updated.id == user.id
      assert updated.email == "after@example.com"
      assert updated.provider == "email"
      assert updated.provider_id == "after@example.com"
      assert updated.email_verified == true
      assert is_nil(updated.email_change_new_email)
      assert is_nil(updated.email_change_otp)
      assert is_nil(updated.email_change_token)
    end

    test "rejects wrong OTP and increments attempts" do
      user = email_user_fixture(%{password: "password123"})
      assert {:ok, _} = Accounts.change_email(user.id, "after@example.com", "password123")
      _ = last_email!()

      assert {:error, :invalid_otp} = Accounts.verify_email_change_otp(user.id, "000000")
      reloaded = Accounts.get_user(user.id)
      assert reloaded.email_change_attempts == 1
      assert reloaded.email == user.email
    end

    test "locks out after too many attempts" do
      user = email_user_fixture(%{password: "password123"})
      assert {:ok, _} = Accounts.change_email(user.id, "after@example.com", "password123")
      _ = last_email!()

      for _ <- 1..5 do
        assert {:error, reason} = Accounts.verify_email_change_otp(user.id, "000000")
        assert reason in [:invalid_otp, :too_many_attempts]
      end

      assert {:error, :too_many_attempts} =
               Accounts.verify_email_change_otp(user.id, "000000")
    end
  end

  describe "verify_email_change/1 (magic link)" do
    test "still works as a fallback after OTP email is sent" do
      user = email_user_fixture(%{email: "link-before@example.com", password: "password123"})
      assert {:ok, _} = Accounts.change_email(user.id, "link-after@example.com", "password123")
      token = extract_token(last_email!())

      assert {:ok, updated} = Accounts.verify_email_change(token)
      assert updated.email == "link-after@example.com"
      assert updated.id == user.id
    end
  end

  describe "OAuth → non-OAuth email conversion" do
    test "Google user can request email change with a new password (no current password)" do
      user =
        google_user_fixture(%{email: "google@gmail.com"})
        |> with_credits!(15.0)

      assert {:ok, pending} =
               Accounts.change_email(user.id, "personal@example.com", %{
                 new_password: "newpassword123"
               })

      assert pending.id == user.id
      assert pending.email == "google@gmail.com"
      assert pending.email_change_new_email == "personal@example.com"
      assert is_binary(pending.email_change_password_hash)
      assert pending.provider == "google"

      email = last_email!() |> assert_delivered_to!("personal@example.com")
      otp = extract_otp(email)

      assert {:ok, converted} = Accounts.verify_email_change_otp(user.id, otp)

      assert converted.id == user.id
      assert converted.email == "personal@example.com"
      assert converted.provider == "email"
      assert converted.provider_id == "personal@example.com"
      assert converted.email_verified == true
      assert is_binary(converted.password_hash)
      assert User.valid_password?(converted, "newpassword123")
      assert is_nil(converted.email_change_password_hash)

      # Owned data preserved
      {:ok, %{hours_remaining: hours}} = Credits.get_user_balance(converted.id)
      assert Decimal.eq?(hours, Decimal.new("15.0"))

      # Can log in with email/password
      assert {:ok, logged_in} =
               Accounts.authenticate_with_email("personal@example.com", "newpassword123")

      assert logged_in.id == user.id
    end

    test "rejects OAuth conversion without new_password" do
      user = google_user_fixture()

      assert {:error, :new_password_required} =
               Accounts.change_email(user.id, "x@example.com", "anything")
    end

    test "rejects weak new_password for OAuth conversion" do
      user = google_user_fixture()

      assert {:error, changeset} =
               Accounts.change_email(user.id, "x@example.com", %{new_password: "short"})

      assert %{password: _} = errors_on(changeset)
    end

    test "does not create a second user when converting Google → email" do
      user = google_user_fixture()
      count_before = Repo.aggregate(User, :count)

      assert {:ok, _} =
               Accounts.change_email(user.id, "solo@example.com", %{new_password: "password123"})

      otp = extract_otp(last_email!())
      assert {:ok, _} = Accounts.verify_email_change_otp(user.id, otp)

      assert Repo.aggregate(User, :count) == count_before
    end
  end

  describe "resend_email_change_verification/1" do
    test "sends a fresh OTP for a pending change" do
      user = email_user_fixture(%{password: "password123"})
      assert {:ok, _} = Accounts.change_email(user.id, "resend@example.com", "password123")
      first = last_email!()
      first_otp = extract_otp(first)

      assert {:ok, _} = Accounts.resend_email_change_verification(user.id)
      second = last_email!()
      second_otp = extract_otp(second)

      # Old OTP should no longer work after resend
      assert {:error, :invalid_otp} = Accounts.verify_email_change_otp(user.id, first_otp)
      assert {:ok, updated} = Accounts.verify_email_change_otp(user.id, second_otp)
      assert updated.email == "resend@example.com"
    end
  end
end
