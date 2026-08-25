defmodule ClippsterServer.Accounts.SwitchGoogleAccountTest do
  use ClippsterServer.DataCase, async: true

  import ClippsterServer.AccountsFixtures

  alias ClippsterServer.Accounts
  alias ClippsterServer.Credits
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User

  describe "switch_google_account/2" do
    test "switches to a new Gmail identity while preserving the same user id" do
      user = google_user_fixture(%{email: "original@gmail.com", name: "Original"})
      original_id = user.id
      original_provider_id = user.provider_id

      oauth_info =
        google_oauth_info(%{
          email: "new-account@gmail.com",
          name: "New Account",
          provider_id: "google-new-123"
        })

      assert {:ok, switched} = Accounts.switch_google_account(user.id, oauth_info)

      assert switched.id == original_id
      assert switched.email == "new-account@gmail.com"
      assert switched.name == "New Account"
      assert switched.provider == "google"
      assert switched.provider_id == "google-new-123"
      assert switched.provider_id != original_provider_id

      # Still only one user row for this identity; original id untouched
      assert Repo.get!(User, original_id).email == "new-account@gmail.com"
      assert Accounts.get_user_by_provider("google", "google-new-123").id == original_id
      assert Accounts.get_user_by_provider("google", original_provider_id) == nil
    end

    test "preserves credits and other user-owned data after switching Gmail" do
      user =
        google_user_fixture(%{email: "keeper@gmail.com"})
        |> with_credits!(25.0)

      {:ok, %{hours_remaining: before_hours}} = Credits.get_user_balance(user.id)
      assert Decimal.eq?(before_hours, Decimal.new("25.0"))

      oauth_info =
        google_oauth_info(%{
          email: "keeper-new@gmail.com",
          provider_id: "google-keeper-new"
        })

      assert {:ok, switched} = Accounts.switch_google_account(user.id, oauth_info)
      assert switched.id == user.id

      {:ok, %{hours_remaining: after_hours}} = Credits.get_user_balance(switched.id)
      assert Decimal.eq?(after_hours, before_hours)

      # Original user record still exists with same primary key — no data orphaned
      reloaded = Accounts.get_user(user.id)
      assert reloaded.email == "keeper-new@gmail.com"
      assert reloaded.subscription_status == user.subscription_status
      assert reloaded.account_type == user.account_type
    end

    test "does not create a second user when switching Gmail accounts" do
      user = google_user_fixture()
      count_before = Repo.aggregate(User, :count)

      assert {:ok, _} =
               Accounts.switch_google_account(
                 user.id,
                 google_oauth_info(%{email: "only-one@gmail.com"})
               )

      assert Repo.aggregate(User, :count) == count_before
    end

    test "is idempotent when switching to the same Google account already linked" do
      user = google_user_fixture(%{email: "same@gmail.com", name: "Same"})

      oauth_info = %{
        provider_id: user.provider_id,
        email: "same-updated@gmail.com",
        name: "Same Updated",
        avatar_url: nil
      }

      assert {:ok, switched} = Accounts.switch_google_account(user.id, oauth_info)
      assert switched.id == user.id
      assert switched.provider_id == user.provider_id
      assert switched.email == "same-updated@gmail.com"
      assert switched.name == "Same Updated"
    end

    test "rejects switching to a Google account already linked to another user" do
      user_a = google_user_fixture(%{email: "a@gmail.com", provider_id: "google-a"})
      user_b = google_user_fixture(%{email: "b@gmail.com", provider_id: "google-b"})

      assert {:error, :google_account_already_linked} =
               Accounts.switch_google_account(user_a.id, %{
                 provider_id: user_b.provider_id,
                 email: user_b.email,
                 name: user_b.name,
                 avatar_url: nil
               })

      # Neither user is mutated — production data safe
      assert Accounts.get_user(user_a.id).provider_id == "google-a"
      assert Accounts.get_user(user_a.id).email == "a@gmail.com"
      assert Accounts.get_user(user_b.id).provider_id == "google-b"
      assert Accounts.get_user(user_b.id).email == "b@gmail.com"
    end

    test "rejects switching to an email already used by another user" do
      user_a = google_user_fixture(%{email: "a@gmail.com"})
      _user_b = google_user_fixture(%{email: "taken@gmail.com"})

      assert {:error, :email_already_in_use} =
               Accounts.switch_google_account(
                 user_a.id,
                 google_oauth_info(%{
                   email: "taken@gmail.com",
                   provider_id: "brand-new-google-id"
                 })
               )

      assert Accounts.get_user(user_a.id).email == "a@gmail.com"
    end

    test "returns not_found for unknown user ids" do
      assert {:error, :not_found} =
               Accounts.switch_google_account(9_999_999, google_oauth_info())
    end

    test "requires provider_id in oauth_info" do
      user = google_user_fixture()

      assert {:error, :missing_provider_id} =
               Accounts.switch_google_account(user.id, %{
                 email: "x@gmail.com",
                 name: "X"
               })
    end
  end

  describe "link_oauth_to_user/2 (legacy path)" do
    test "updates provider_id when linking a different Google identity" do
      user = google_user_fixture(%{email: "legacy@gmail.com", provider_id: "google-legacy"})

      oauth_info = %{
        provider_id: "google-linked-new",
        email: "legacy-new@gmail.com",
        name: "Legacy New",
        avatar_url: nil
      }

      assert {:ok, linked} = Accounts.link_oauth_to_user(user.id, oauth_info)
      assert linked.id == user.id
      assert linked.provider_id == "google-linked-new"
      assert linked.email == "legacy-new@gmail.com"
    end
  end
end
