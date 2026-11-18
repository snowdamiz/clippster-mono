defmodule ClippsterServer.SubscriptionOffersTest do
  use ClippsterServer.DataCase, async: false

  import ClippsterServer.AccountsFixtures
  import Plug.Conn
  import Swoosh.TestAssertions

  alias ClippsterServer.{AdminMessaging, PromoCodes}
  alias ClippsterServer.AdminMessaging.EmailCampaignRecipient
  alias ClippsterServer.Auth.TokenGenerator
  alias ClippsterServer.Subscriptions.Subscription
  alias ClippsterServerWeb.{StripeController, SubscriptionController}

  @webhook_secret "whsec_subscription_offer_integration_test"

  defmodule StripeStub do
    def request(method, url, _headers, body, _opts) do
      path = URI.parse(url).path
      params = if method == :post, do: URI.decode_query(IO.iodata_to_binary(body)), else: %{}
      send(self(), {:stripe_request, method, path, params})

      {status, payload} =
        case {method, path} do
          {:get, "/v1/coupons/" <> _id} ->
            {404, %{error: %{type: "invalid_request_error", code: "resource_missing"}}}

          {:post, "/v1/coupons"} ->
            {200, %{object: "coupon", id: params["id"]}}

          {:post, "/v1/customers"} ->
            {200, %{object: "customer", id: "cus_#{params["metadata[user_id]"]}"}}

          {:post, "/v1/promotion_codes"} ->
            {200, %{object: "promotion_code", id: "promo_#{params["code"]}"}}

          {:post, "/v1/checkout/sessions"} ->
            {200,
             %{object: "checkout.session", id: "cs_test", url: "https://checkout.stripe.com/test"}}
        end

      {:ok, status, [], Jason.encode!(payload)}
    end
  end

  setup do
    keys = [http_module: StripeStub, api_key: "sk_test_subscription_offers"]
    stripe = Application.get_env(:clippster_server, :stripe, [])

    Application.put_env(
      :clippster_server,
      :stripe,
      Keyword.put(stripe, :webhook_secret, @webhook_secret)
    )

    on_exit(fn -> Application.put_env(:clippster_server, :stripe, stripe) end)

    for {key, value} <- keys do
      original = Application.get_env(:stripity_stripe, key)
      Application.put_env(:stripity_stripe, key, value)

      on_exit(fn ->
        if original,
          do: Application.put_env(:stripity_stripe, key, original),
          else: Application.delete_env(:stripity_stripe, key)
      end)
    end

    :ok
  end

  test "selected recipients get unique customer-bound Stripe codes and checkout redemption is attributed" do
    sender = google_user_fixture()
    first = google_user_fixture()
    second = google_user_fixture()
    suppressed = google_user_fixture()
    unselected = google_user_fixture()
    {:ok, _} = AdminMessaging.suppress_email(suppressed.email)

    params = campaign("never_subscribed", [first.id, second.id, suppressed.id])

    assert {:ok, %{recipient_count: 2, suppressed_count: 1}} =
             AdminMessaging.preview_campaign(params)

    assert {:ok, campaign, %{queued: true}} = AdminMessaging.send_campaign(params, sender.id)
    assert_no_email_sent()
    AdminMessaging.process_queued_offers()

    assert {:ok, %{recipients: [first_row, second_row], redeemed_count: 0}} =
             AdminMessaging.campaign_report(campaign.id)

    assert first_row.email == first.email
    assert second_row.email == second.email
    assert first_row.status == "sent"
    assert second_row.status == "sent"
    assert first_row.code != second_row.code

    assert_receive {:stripe_request, :post, "/v1/coupons",
                    %{"percent_off" => "30", "duration_in_months" => "3"}}

    refute_received {:stripe_request, :post, "/v1/coupons", _}

    assert_receive {:stripe_request, :post, "/v1/promotion_codes",
                    %{"customer" => customer, "max_redemptions" => "1"}}

    assert customer == "cus_#{first.id}"

    assert_email_sent(fn email ->
      assert email.html_body =~ "/account/billing?promo=#{first_row.code}"
      true
    end)

    assert {:error, :offer_not_available} =
             PromoCodes.validate_promo(first_row.code, "creator", unselected.id)

    assert {:error, :offer_not_available} =
             PromoCodes.validate_promo(first_row.code, "creator", first.id, :crypto)

    assert {:error, :tier_not_allowed} =
             PromoCodes.validate_promo(first_row.code, "pro", first.id)

    invalid = checkout(first, first_row.code, "yearly")
    assert invalid.status == 400
    refute_received {:stripe_request, :post, "/v1/checkout/sessions", _}

    assert checkout(unselected, first_row.code, "monthly").status == 400
    refute_received {:stripe_request, :post, "/v1/checkout/sessions", _}

    assert checkout(first, first_row.code, "monthly").status == 200
    assert_receive {:stripe_request, :post, "/v1/checkout/sessions", checkout_params}
    assert checkout_params["customer"] == customer
    assert checkout_params["discounts[0][promotion_code]"] == "promo_#{first_row.code}"

    # Reuse the existing code when a provider failure is retried.
    recipient = Repo.get_by!(EmailCampaignRecipient, offer_code: second_row.code)
    Repo.update!(Ecto.Changeset.change(recipient, status: "failed"))
    assert {:ok, _, %{queued: true}} = AdminMessaging.retry_failed_recipients(campaign.id)
    AdminMessaging.process_queued_offers()
    assert {:ok, %{recipients: [_, retried]}} = AdminMessaging.campaign_report(campaign.id)
    assert retried.code == second_row.code
    assert retried.status == "sent"

    payload = %{
      object: "event",
      type: "checkout.session.completed",
      data: %{
        object: %{
          object: "checkout.session",
          subscription: "sub_test_first",
          customer: customer,
          payment_status: "paid",
          amount_total: 3499,
          metadata: %{
            user_id: to_string(first.id),
            type: "subscription",
            subscription_tier: "creator",
            promo_code_id: checkout_params["metadata[promo_code_id]"]
          }
        }
      }
    }

    assert webhook(payload).status == 200
    assert webhook(payload).status == 200

    assert {:ok, %{recipients: [redeemed, untouched], redeemed_count: 1}} =
             AdminMessaging.campaign_report(campaign.id)

    assert redeemed.email == first.email
    assert redeemed.redeemed_at
    refute untouched.redeemed_at
    assert Repo.aggregate(Subscription, :count) == 1
    assert Repo.aggregate(ClippsterServer.PromoCodes.PromoRedemption, :count) == 1
  end

  test "win-back includes ended cancellations and excludes users still in their paid period" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    eligible = google_user_fixture()
    still_active = google_user_fixture()
    never = google_user_fixture()

    Repo.insert!(%Subscription{
      user_id: eligible.id,
      status: "expired",
      subscription_tier: "starter",
      cancelled_at: now,
      payment_method: "stripe",
      start_date: DateTime.add(now, -40, :day),
      end_date: DateTime.add(now, -10, :day)
    })

    still_active
    |> Ecto.Changeset.change(
      subscription_status: "cancelled",
      subscription_end_date: DateTime.add(now, 3, :day),
      subscription_renewal_method: "stripe"
    )
    |> Repo.update!()

    ids = [eligible.id, still_active.id, never.id]

    assert {:ok, %{recipients: [%{user_id: eligible_id}]}} =
             AdminMessaging.preview_campaign(campaign("win_back", ids))

    assert eligible_id == eligible.id

    assert {:ok, %{recipients: [%{user_id: never_id}]}} =
             AdminMessaging.preview_campaign(campaign("never_subscribed", ids))

    assert never_id == never.id
  end

  defp campaign(audience, ids) do
    %{
      "audience" => audience,
      "recipient_ids" => ids,
      "subject" => "A Clippster offer",
      "body" => "<p>Here is a discount on a monthly plan.</p>",
      "offer" => %{
        "percent" => 30,
        "months" => 3,
        "tiers" => ["creator"],
        "prefix" => "TEST",
        "button" => "Claim offer"
      }
    }
  end

  defp checkout(user, code, interval) do
    {:ok, token} = TokenGenerator.generate_token(%{"user_id" => user.id, "sub" => user.email})
    conn = Phoenix.ConnTest.build_conn() |> put_req_header("authorization", "Bearer #{token}")

    SubscriptionController.create_checkout(conn, %{
      "tier" => "creator",
      "promo_code" => code,
      "billing_interval" => interval
    })
  end

  defp webhook(payload) do
    body = Jason.encode!(payload)
    timestamp = System.system_time(:second)

    digest =
      :crypto.mac(:hmac, :sha256, @webhook_secret, "#{timestamp}.#{body}")
      |> Base.encode16(case: :lower)

    Phoenix.ConnTest.build_conn()
    |> put_req_header("stripe-signature", "t=#{timestamp},v1=#{digest}")
    |> assign(:raw_body, body)
    |> StripeController.webhook(%{})
  end
end
