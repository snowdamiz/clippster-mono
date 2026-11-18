defmodule ClippsterServer.AdminMessaging.SubscriptionOffers do
  @moduledoc false
  import Ecto.Query

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.AdminMessaging.{EmailAddress, EmailCampaign, EmailCampaignRecipient}
  alias ClippsterServer.PromoCodes
  alias ClippsterServer.PromoCodes.{PromoCode, PromoRedemption}
  alias ClippsterServer.{Repo, Subscriptions}
  alias ClippsterServer.Subscriptions.Subscription

  @audiences ~w(never_subscribed win_back)
  @tiers ~w(basic starter creator pro)
  @external_resource Path.expand("../../../priv/email/subscription-offer.html", __DIR__)
  @layout File.read!(@external_resource)

  def audience?(audience), do: audience in @audiences

  def monthly_plans do
    Enum.map(@tiers, fn id ->
      tier = Subscriptions.get_tier_info(id)
      %{id: id, price_usd: tier.usd}
    end)
  end

  def validate(audience, attrs) when audience in @audiences and is_map(attrs) do
    with percent when is_integer(percent) and percent in 1..100 <- attrs["percent"],
         months when is_integer(months) and months in 1..36 <- attrs["months"],
         tiers when is_list(tiers) and tiers != [] <- attrs["tiers"],
         true <- Enum.all?(tiers, &(&1 in @tiers)),
         prefix when is_binary(prefix) <- attrs["prefix"],
         true <- Regex.match?(~r/^[A-Za-z0-9]{1,16}$/, prefix),
         button when is_binary(button) <- attrs["button"],
         true <- String.length(String.trim(button)) in 1..80,
         {:ok, deadline} <- deadline(attrs["redeem_by"]) do
      {:ok,
       %{
         "percent" => percent,
         "months" => months,
         "tiers" => Enum.uniq(tiers),
         "prefix" => String.upcase(prefix),
         "button" => String.trim(button),
         "redeem_by" => deadline
       }}
    else
      _ ->
        {:error,
         "Enter a valid discount, duration, eligible plan, code prefix, button label and optional future redemption date."}
    end
  end

  def validate(audience, _) when audience in @audiences,
    do: {:error, "Configure the subscription offer."}

  def validate(_, _), do: {:ok, nil}

  defp deadline(value) when value in [nil, ""], do: {:ok, nil}

  defp deadline(value) when is_binary(value) do
    with {:ok, date} <- Date.from_iso8601(value),
         dt = DateTime.new!(date, ~T[23:59:59], "Etc/UTC"),
         :gt <- DateTime.compare(dt, DateTime.utc_now()) do
      {:ok, value}
    else
      _ -> :error
    end
  end

  defp deadline(_), do: :error

  def recipients(audience, ids) do
    query = audience_query(audience)
    query = if is_list(ids), do: where(query, [u], u.id in ^ids), else: query

    query
    |> order_by([u], asc: u.id)
    |> select([u], %{user_id: u.id, email: u.email, name: u.name})
    |> Repo.all()
    |> Enum.map(&%{&1 | email: EmailAddress.normalize(&1.email)})
    |> Enum.filter(&EmailAddress.valid?(&1.email))
    |> Enum.uniq_by(& &1.email)
  end

  defp audience_query(audience) do
    now = DateTime.utc_now()

    query =
      from u in User,
        as: :user,
        where: not is_nil(u.email),
        where:
          is_nil(u.subscription_status) or u.subscription_status in ["none", "expired"] or
            (u.subscription_status == "cancelled" and
               not is_nil(u.subscription_end_date) and u.subscription_end_date <= ^now)

    paid =
      from s in Subscription,
        where:
          s.user_id == parent_as(:user).id and
            s.payment_method in ["stripe", "crypto", "promo_bundle"],
        select: 1

    case audience do
      "never_subscribed" ->
        where(
          query,
          [u],
          u.subscription_status in ["none", "expired"] or is_nil(u.subscription_status)
        )
        |> where([u], is_nil(u.stripe_subscription_id))
        |> where([_], not exists(subquery(paid)))

      "win_back" ->
        cancelled = where(paid, [s], s.status == "cancelled" or not is_nil(s.cancelled_at))

        where(
          query,
          [u],
          exists(subquery(cancelled)) or
            (u.subscription_status == "cancelled" and
               u.subscription_renewal_method in ["stripe", "crypto", "promo_bundle"])
        )
    end
  end

  def eligible?(audience, user_id) do
    audience |> audience_query() |> where([u], u.id == ^user_id) |> Repo.exists?()
  end

  def code(%{"prefix" => prefix}) do
    prefix <> "-" <> Base.encode16(:crypto.strong_rand_bytes(10))
  end

  def report(campaign_id) do
    rows =
      Repo.all(
        from r in EmailCampaignRecipient,
          where: r.campaign_id == ^campaign_id,
          left_join: p in PromoCode,
          on: p.campaign_recipient_id == r.id,
          left_join: d in PromoRedemption,
          on: d.promo_code_id == p.id and d.user_id == r.user_id and is_nil(d.organization_id),
          order_by: r.id,
          select: %{
            email: r.email,
            status: r.status,
            sent_at: r.sent_at,
            code: p.code,
            redeemed_at: d.redeemed_at,
            error: r.error
          }
      )

    %{recipients: rows, redeemed_count: Enum.count(rows, & &1.redeemed_at)}
  end

  def issue(%EmailCampaign{} = campaign, %EmailCampaignRecipient{} = recipient) do
    with true <- not is_nil(recipient.user_id) and eligible?(campaign.audience, recipient.user_id),
         {:ok, _} <- deadline(campaign.offer["redeem_by"]),
         %User{} = user <- Repo.get(User, recipient.user_id),
         true <- EmailAddress.normalize(user.email) == recipient.email do
      case Repo.get_by(PromoCode, campaign_recipient_id: recipient.id) do
        %PromoCode{} = promo -> {:ok, promo.code}
        nil -> create_code(campaign, recipient, user)
      end
    else
      _ -> {:error, "Recipient no longer qualifies or the offer has expired"}
    end
  end

  defp create_code(campaign, recipient, user) do
    offer = campaign.offer
    months = offer["months"]

    expires =
      if date = offer["redeem_by"],
        do: DateTime.new!(Date.from_iso8601!(date), ~T[23:59:59], "Etc/UTC")

    attrs = %{
      code: recipient.offer_code,
      name: campaign.subject,
      promo_type: "percent",
      percent_off: offer["percent"],
      duration_kind: if(months == 1, do: "once", else: "repeating"),
      duration_months: months,
      allowed_tiers: offer["tiers"],
      max_redemptions: 1,
      redeem_by: expires,
      created_by_admin_id: campaign.sent_by,
      campaign_recipient_id: recipient.id
    }

    changeset = PromoCode.create_changeset(%PromoCode{}, attrs)

    with {:ok, promo} <- Ecto.Changeset.apply_action(changeset, :insert),
         {:ok, customer_id} <- Subscriptions.ensure_stripe_customer(user.id),
         {:ok, coupon_id} <- ensure_coupon(campaign, promo),
         {:ok, stripe_id} <- ensure_promotion(promo, coupon_id, customer_id, recipient.id),
         {:ok, _} <-
           changeset
           |> Ecto.Changeset.change(stripe_coupon_id: coupon_id, stripe_promo_code_id: stripe_id)
           |> Repo.insert() do
      {:ok, promo.code}
    end
  end

  defp ensure_promotion(promo, coupon_id, customer_id, recipient_id) do
    case PromoCodes.create_stripe_promotion_code(promo, coupon_id, customer_id,
           idempotency_key: "subscription-offer-recipient-#{recipient_id}"
         ) do
      {:ok, _} = result ->
        result

      error ->
        # A request can succeed at Stripe before we persist its result.
        case Stripe.PromotionCode.list(%{code: promo.code, customer: customer_id, active: true}) do
          {:ok, %{data: [%{id: id, coupon: %{id: ^coupon_id}}]}} -> {:ok, id}
          _ -> error
        end
    end
  end

  defp ensure_coupon(campaign, promo) do
    case Repo.get!(EmailCampaign, campaign.id).stripe_coupon_id do
      nil ->
        key = "subscription-offer-#{campaign.id}"
        params = %{id: key, percent_off: promo.percent_off, duration: promo.duration_kind}

        params =
          if promo.duration_kind == "repeating",
            do: Map.put(params, :duration_in_months, promo.duration_months),
            else: params

        with {:ok, coupon} <- get_or_create_coupon(key, params),
             {:ok, _} <-
               campaign |> Ecto.Changeset.change(stripe_coupon_id: coupon.id) |> Repo.update() do
          {:ok, coupon.id}
        end

      id ->
        {:ok, id}
    end
  end

  defp get_or_create_coupon(key, params) do
    case Stripe.Coupon.retrieve(key) do
      {:error, %Stripe.Error{extra: %{http_status: 404}}} ->
        Stripe.Coupon.create(params, idempotency_key: key)

      result ->
        result
    end
  end

  def render(body, offer, code, test? \\ false) do
    period =
      if offer["months"] == 1,
        do: "your first month",
        else: "your first #{offer["months"]} months"

    plans = Enum.map_join(offer["tiers"], ", ", &Subscriptions.get_tier_info(&1).name)

    slots = %{
      "DISCOUNT" => "#{offer["percent"]}% off #{period}",
      "PLANS" => "#{plans} monthly #{if length(offer["tiers"]) == 1, do: "plan", else: "plans"}",
      "CODE" => code,
      "DEADLINE" =>
        if(offer["redeem_by"], do: " · Redeem by #{offer["redeem_by"]} (UTC)", else: ""),
      "URL" =>
        if(test?,
          do: "#sample-offer",
          else: "https://clippster.app/account/billing?promo=#{URI.encode_www_form(code)}"
        ),
      "BUTTON" => offer["button"]
    }

    block =
      Regex.replace(~r/__(DISCOUNT|PLANS|CODE|DEADLINE|URL|BUTTON)__/, @layout, fn _, slot ->
        slots |> Map.fetch!(slot) |> Phoenix.HTML.html_escape() |> Phoenix.HTML.safe_to_string()
      end)

    case String.split(body, ~s(<p class="email-signoff"), parts: 2) do
      [message, signoff] -> message <> block <> ~s(<p class="email-signoff") <> signoff
      [message] -> message <> block
    end
  end
end
