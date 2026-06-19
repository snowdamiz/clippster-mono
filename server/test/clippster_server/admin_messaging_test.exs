defmodule ClippsterServer.AdminMessagingTest do
  use ClippsterServer.DataCase, async: true

  import Swoosh.TestAssertions

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.AdminMessaging
  alias ClippsterServer.AdminMessaging.{EmailCampaign, EmailCampaignRecipient, EmailSuppression}
  alias ClippsterServer.Emails
  alias ClippsterServer.Waitlist.WaitlistEntry

  describe "email sender identity" do
    test "transactional emails use the transactional sender without list headers" do
      email = Emails.verification_email("user@example.com", "123456", "magic-link-token")

      assert email.from == {"Clippster", "noreply@clippster.app"}
      assert email.reply_to == {"Clippster Support", "support@clippster.app"}
      refute header_value(email, "List-Unsubscribe")
      refute header_value(email, "List-Unsubscribe-Post")
    end

    test "waitlist emails use the marketing sender with one-click unsubscribe headers" do
      email = Emails.waitlist_confirmation_email("waiter@example.com")

      assert email.from == {"Clippster", "updates@clippster.app"}
      assert email.reply_to == {"Clippster Support", "support@clippster.app"}
      assert header_value(email, "List-Unsubscribe") =~ "<mailto:unsubscribe@clippster.app>"

      assert header_value(email, "List-Unsubscribe") =~
               "<http://localhost:4000/email/unsubscribe/"

      assert header_value(email, "List-Unsubscribe-Post") == "List-Unsubscribe=One-Click"
      assert email.html_body =~ "http://localhost:4000/email/unsubscribe/"
    end
  end

  describe "preview_campaign/1" do
    test "deduplicates waitlist emails and excludes suppressed recipients" do
      insert_waitlist!("Alpha@example.com")
      insert_waitlist!("alpha@example.com")
      insert_waitlist!("beta@example.com")
      {:ok, _} = AdminMessaging.suppress_email("alpha@example.com")

      assert {:ok, preview} = AdminMessaging.preview_campaign(%{"audience" => "waitlist"})

      assert preview.requested_count == 2
      assert preview.recipient_count == 1
      assert preview.suppressed_count == 1
      assert preview.sample == ["beta@example.com"]
    end
  end

  describe "send_campaign/2" do
    test "sends only deliverable waitlist recipients and records outcomes" do
      admin = insert_admin!()
      insert_waitlist!("alpha@example.com")
      insert_waitlist!("beta@example.com")
      {:ok, _} = AdminMessaging.suppress_email("beta@example.com")

      assert {:ok, campaign, stats} =
               AdminMessaging.send_campaign(
                 %{
                   "audience" => "waitlist",
                   "subject" => "Launch day",
                   "preheader" => "Your spot is ready",
                   "body" => "<p>Hello waitlist</p>"
                 },
                 admin.id
               )

      assert stats == %{sent_count: 1, failed_count: 0}
      assert campaign.status == "sent"
      assert campaign.recipient_count == 1
      assert campaign.sent_count == 1
      assert campaign.failed_count == 0
      assert campaign.suppressed_count == 1

      assert_email_sent(fn email ->
        assert email.subject == "Launch day"
        assert email.from == {"Clippster", "updates@clippster.app"}
        assert email.reply_to == {"Clippster Support", "support@clippster.app"}
        assert header_value(email, "List-Unsubscribe") =~ "/email/unsubscribe/"
        assert recipient_email?(email, "alpha@example.com")
        assert email.html_body =~ "Hello waitlist"
        assert email.html_body =~ "/email/unsubscribe/"
      end)

      assert [%EmailCampaignRecipient{email: "alpha@example.com", status: "sent"}] =
               Repo.all(EmailCampaignRecipient)
    end

    test "returns an error when every resolved recipient is suppressed" do
      admin = insert_admin!()
      insert_waitlist!("alpha@example.com")
      {:ok, _} = AdminMessaging.suppress_email("alpha@example.com")

      assert {:error, "All resolved recipients have unsubscribed or are suppressed"} =
               AdminMessaging.send_campaign(
                 %{
                   "audience" => "waitlist",
                   "subject" => "Launch day",
                   "body" => "<p>Hello waitlist</p>"
                 },
                 admin.id
               )

      assert Repo.aggregate(EmailCampaign, :count) == 0
      assert_no_email_sent()
    end
  end

  describe "send_test_campaign/2" do
    test "sends one email without creating campaign history" do
      admin = insert_admin!()

      assert {:ok, "owner@example.com"} =
               AdminMessaging.send_test_campaign(
                 %{
                   "test_email" => "owner@example.com",
                   "subject" => "Preview",
                   "body" => "<p>Looks good</p>"
                 },
                 admin.id
               )

      assert Repo.aggregate(EmailCampaign, :count) == 0

      assert_email_sent(fn email ->
        assert email.subject == "Preview"
        assert recipient_email?(email, "owner@example.com")
      end)
    end
  end

  describe "unsubscribe_with_token/1" do
    test "suppresses the email embedded in a signed token" do
      token =
        Phoenix.Token.sign(
          ClippsterServerWeb.Endpoint,
          "email-unsubscribe",
          "Person@Example.com"
        )

      assert {:ok, %EmailSuppression{email: "person@example.com", reason: "unsubscribe"}} =
               AdminMessaging.unsubscribe_with_token(token)
    end
  end

  defp insert_admin! do
    Repo.insert!(%User{
      wallet_address: "admin-#{System.unique_integer([:positive])}",
      email: "admin-#{System.unique_integer([:positive])}@example.com",
      is_admin: true
    })
  end

  defp insert_waitlist!(email) do
    %WaitlistEntry{}
    |> WaitlistEntry.changeset(%{email: email})
    |> Repo.insert!()
  end

  defp recipient_email?(email, expected) do
    Enum.any?(email.to, fn
      {_name, address} -> address == expected
      address -> address == expected
    end)
  end

  defp header_value(%{headers: headers}, expected) when is_map(headers) do
    Map.get(headers, expected)
  end

  defp header_value(%{headers: headers}, expected) do
    Enum.find_value(headers, fn
      {^expected, value} ->
        value

      {name, value} when is_binary(name) ->
        if String.downcase(name) == String.downcase(expected), do: value

      _ ->
        nil
    end)
  end
end
