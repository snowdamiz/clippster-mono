defmodule ClippsterServerWeb.OrganizationSubscriptionController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.OrganizationSubscriptions
  alias ClippsterServer.Organizations
  alias ClippsterServer.Accounts
  alias ClippsterServer.PromoCodes
  alias ClippsterServer.AppSettings
  alias ClippsterServer.LemonSqueezy

  @doc """
  GET /organizations/:id/subscription
  Gets current subscription status for an organization.
  """
  def show(conn, %{"id" => organization_id}) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)

    # Verify user is a member/admin of the organization
    unless Organizations.is_member?(org_id, user_id) do
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Not authorized to view this organization's subscription"})
    else
      status = OrganizationSubscriptions.get_subscription_status(org_id)

      conn
      |> json(%{
        success: true,
        subscription: status
      })
    end
  end

  @doc """
  POST /organizations/:id/subscription/promo/validate
  Validates a promo code for organization subscription or credit pack.
  """
  def validate_promo(conn, %{"id" => organization_id, "code" => code, "tier" => tier} = params) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)

    unless Organizations.is_admin?(org_id, user_id) do
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Admin access required"})
    else
      type = case Map.get(params, "type", "subscription") do
        "credit_pack" -> :credit_pack
        _ -> :subscription
      end

      case PromoCodes.validate_org_promo(code, tier, org_id, type) do
        {:ok, promo} ->
          conn
          |> json(%{
            success: true,
            promo: %{
              code: promo.code,
              percent_off: promo.percent_off,
              duration_kind: promo.duration_kind,
              duration_months: promo.duration_months
            }
          })

        {:error, reason} ->
          error_message = case reason do
            :invalid_code -> "Invalid promo code"
            :inactive_code -> "This promo code is not active"
            :expired_code -> "This promo code has expired"
            :tier_not_allowed -> "This promo code is not valid for the selected plan"
            :max_redemptions_reached -> "This promo code has reached its maximum redemption limit"
            :already_redeemed -> "Your organization has already used this promo code"
            _ -> "Invalid promo code"
          end

          conn
          |> put_status(:bad_request)
          |> json(%{success: false, error: error_message})
      end
    end
  end

  @doc """
  GET /organizations/:id/subscription/tiers
  Gets available subscription tiers and add-ons.
  """
  def tiers(conn, %{"id" => organization_id}) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)

    # Verify user is admin of the organization
    unless Organizations.is_admin?(org_id, user_id) do
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Admin access required"})
    else
      base_tiers = OrganizationSubscriptions.get_subscription_tiers()
      addon_tiers = OrganizationSubscriptions.get_addon_tiers()

      # Convert maps to list format for JSON
      base_tiers_list = Enum.map(base_tiers, fn {id, info} ->
        Map.put(info, :id, id)
      end)

      addon_tiers_list = Enum.map(addon_tiers, fn {id, info} ->
        Map.put(info, :id, id)
      end)

      conn
      |> json(%{
        success: true,
        base_tiers: base_tiers_list,
        addon_tiers: addon_tiers_list
      })
    end
  end

  @doc """
  POST /organizations/:id/subscription/checkout
  Creates a Stripe checkout session for a base subscription.
  Optionally accepts promo_code parameter.
  """
  def checkout(conn, %{"id" => organization_id, "tier" => tier} = params) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)
    promo_code = Map.get(params, "promo_code")

    unless Organizations.is_admin?(org_id, user_id) do
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Admin access required"})
    else
      tier_info = OrganizationSubscriptions.get_tier_info(tier)

      if is_nil(tier_info) do
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: "Invalid tier"})
      else
        # Validate promo code if provided
        validated_promo = if promo_code do
          case PromoCodes.validate_org_promo(promo_code, tier, org_id, :subscription) do
            {:ok, promo} -> promo
            {:error, _reason} -> nil
          end
        else
          nil
        end

        user = Accounts.get_user(user_id)

        case AppSettings.get_payment_provider() do
          "lemonsqueezy" ->
            # LemonSqueezy checkout
            opts = if validated_promo, do: [discount_code: validated_promo.code], else: []

            case LemonSqueezy.create_org_checkout(org_id, tier, "base", user.email, opts) do
              {:ok, %{url: url}} ->
                json(conn, %{success: true, url: url})

              {:error, :no_variant_configured} ->
                conn
                |> put_status(:unprocessable_entity)
                |> json(%{success: false, error: "Tier not configured for LemonSqueezy"})

              {:error, reason} ->
                conn
                |> put_status(:internal_server_error)
                |> json(%{success: false, error: "Failed to create checkout: #{inspect(reason)}"})
            end

          _ ->
            # Default to Stripe checkout
            stripe_secret_key = Application.get_env(:clippster_server, :stripe_secret_key)

            headers = [
              {"Authorization", "Bearer #{stripe_secret_key}"},
              {"Content-Type", "application/x-www-form-urlencoded"}
            ]

            success_url = "#{get_base_url()}/stripe-success?session_id={CHECKOUT_SESSION_ID}"
            cancel_url = "#{get_base_url()}/organization/#{organization_id}/billing"

            # Build form data
            line_items = [
              "line_items[0][price_data][currency]": "usd",
              "line_items[0][price_data][product_data][name]": tier_info.name,
              "line_items[0][price_data][product_data][description]": "#{tier_info.seats} seats, #{tier_info.monthly_credits} credits/month",
              "line_items[0][price_data][unit_amount]": round(tier_info.usd * 100),
              "line_items[0][price_data][recurring][interval]": "month",
              "line_items[0][quantity]": 1,
              mode: "subscription",
              success_url: success_url,
              cancel_url: cancel_url,
              client_reference_id: "org_#{org_id}",
              customer_email: user.email,
              "metadata[organization_id]": org_id,
              "metadata[subscription_tier]": tier,
              "metadata[subscription_type]": "base",
              "subscription_data[metadata][organization_id]": org_id,
              "subscription_data[metadata][subscription_tier]": tier,
              "subscription_data[metadata][subscription_type]": "base"
            ]

            # Add promo code to Stripe session if validated
            line_items = if validated_promo && validated_promo.stripe_promo_code_id do
              line_items ++
                [
                  "discounts[0][promotion_code]": validated_promo.stripe_promo_code_id,
                  "metadata[promo_code_id]": validated_promo.id,
                  "metadata[promo_code]": validated_promo.code,
                  "subscription_data[metadata][promo_code_id]": validated_promo.id
                ]
            else
              line_items
            end

            body = URI.encode_query(line_items)

            case HTTPoison.post("https://api.stripe.com/v1/checkout/sessions", body, headers) do
              {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
                case Jason.decode(response_body) do
                  {:ok, %{"url" => url}} ->
                    conn
                    |> json(%{success: true, url: url})

                  _ ->
                    conn
                    |> put_status(:internal_server_error)
                    |> json(%{success: false, error: "Failed to parse Stripe response"})
                end

              {:ok, %HTTPoison.Response{body: error_body}} ->
                IO.puts("[OrgSubscription] Stripe error: #{error_body}")
                conn
                |> put_status(:internal_server_error)
                |> json(%{success: false, error: "Stripe checkout failed"})

              {:error, %HTTPoison.Error{reason: reason}} ->
                IO.puts("[OrgSubscription] HTTP error: #{inspect(reason)}")
                conn
                |> put_status(:internal_server_error)
                |> json(%{success: false, error: "Network error"})
            end
        end
      end
    end
  end

  @doc """
  POST /organizations/:id/subscription/addons/checkout
  Creates a Stripe checkout session for an add-on.
  Optionally accepts promo_code parameter.
  """
  def addon_checkout(conn, %{"id" => organization_id, "addon_tier" => addon_tier} = params) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)
    promo_code = Map.get(params, "promo_code")

    unless Organizations.is_admin?(org_id, user_id) do
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Admin access required"})
      else
        addon_info = OrganizationSubscriptions.get_addon_info(addon_tier)
        org = Organizations.get_organization(org_id)

        cond do
          is_nil(addon_info) ->
            conn
            |> put_status(:bad_request)
            |> json(%{success: false, error: "Invalid addon tier"})

          org.subscription_status != "active" ->
          conn
          |> put_status(:bad_request)
          |> json(%{success: false, error: "Base subscription required before adding add-ons"})

        true ->
          # Validate promo code if provided
          validated_promo = if promo_code do
            case PromoCodes.validate_org_promo(promo_code, addon_tier, org_id, :subscription) do
              {:ok, promo} -> promo
              {:error, _reason} -> nil
            end
          else
            nil
          end

          user = Accounts.get_user(user_id)

          case AppSettings.get_payment_provider() do
            "lemonsqueezy" ->
              # LemonSqueezy checkout for addon
              opts = if validated_promo, do: [discount_code: validated_promo.code], else: []

              case LemonSqueezy.create_org_checkout(org_id, addon_tier, "addon", user.email, opts) do
                {:ok, %{url: url}} ->
                  json(conn, %{success: true, url: url})

                {:error, :no_variant_configured} ->
                  conn
                  |> put_status(:unprocessable_entity)
                  |> json(%{success: false, error: "Add-on tier not configured for LemonSqueezy"})

                {:error, reason} ->
                  conn
                  |> put_status(:internal_server_error)
                  |> json(%{success: false, error: "Failed to create checkout: #{inspect(reason)}"})
              end

            _ ->
              # Default to Stripe checkout
              stripe_secret_key = Application.get_env(:clippster_server, :stripe_secret_key)

              headers = [
                {"Authorization", "Bearer #{stripe_secret_key}"},
                {"Content-Type", "application/x-www-form-urlencoded"}
              ]

              success_url = "#{get_base_url()}/stripe-success?session_id={CHECKOUT_SESSION_ID}"
              cancel_url = "#{get_base_url()}/organization/#{org_id}/billing"

              line_items = [
                "line_items[0][price_data][currency]": "usd",
                "line_items[0][price_data][product_data][name]": addon_info.name,
                "line_items[0][price_data][product_data][description]": "#{addon_info.seats} seats, #{addon_info.monthly_credits} credits/month",
                "line_items[0][price_data][unit_amount]": round(addon_info.usd * 100),
                "line_items[0][price_data][recurring][interval]": "month",
                "line_items[0][quantity]": 1,
                mode: "subscription",
                success_url: success_url,
                cancel_url: cancel_url,
                client_reference_id: "org_#{org_id}_addon",
                customer_email: user.email,
                "metadata[organization_id]": org_id,
                "metadata[addon_tier]": addon_tier,
                "metadata[subscription_type]": "addon",
                "subscription_data[metadata][organization_id]": org_id,
                "subscription_data[metadata][addon_tier]": addon_tier,
                "subscription_data[metadata][subscription_type]": "addon"
              ]

              # Add promo code to Stripe session if validated
              line_items = if validated_promo && validated_promo.stripe_promo_code_id do
                line_items ++
                  [
                    "discounts[0][promotion_code]": validated_promo.stripe_promo_code_id,
                    "metadata[promo_code_id]": validated_promo.id,
                    "metadata[promo_code]": validated_promo.code,
                    "subscription_data[metadata][promo_code_id]": validated_promo.id
                  ]
              else
                line_items
              end

              body = URI.encode_query(line_items)

              case HTTPoison.post("https://api.stripe.com/v1/checkout/sessions", body, headers) do
                {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
                  case Jason.decode(response_body) do
                    {:ok, %{"url" => url}} ->
                      conn
                      |> json(%{success: true, url: url})

                    _ ->
                      conn
                      |> put_status(:internal_server_error)
                      |> json(%{success: false, error: "Failed to parse Stripe response"})
                  end

                {:ok, %HTTPoison.Response{body: error_body}} ->
                  IO.puts("[OrgSubscription] Stripe addon error: #{error_body}")
                  conn
                  |> put_status(:internal_server_error)
                  |> json(%{success: false, error: "Stripe checkout failed"})

                {:error, %HTTPoison.Error{reason: reason}} ->
                  IO.puts("[OrgSubscription] HTTP error: #{inspect(reason)}")
                  conn
                  |> put_status(:internal_server_error)
                  |> json(%{success: false, error: "Network error"})
              end
          end
      end
    end
  end

  @doc """
  POST /organizations/:id/subscription/cancel
  Cancels the organization subscription.
  """
  def cancel(conn, %{"id" => organization_id}) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)

    unless Organizations.is_admin?(org_id, user_id) do
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Admin access required"})
    else
      case OrganizationSubscriptions.cancel_subscription(org_id) do
        {:ok, org} ->
          status = OrganizationSubscriptions.get_subscription_status(org_id)

          conn
          |> json(%{
            success: true,
            message: "Subscription cancelled. Access continues until #{org.subscription_end_date}",
            subscription: status
          })

        {:error, :not_active} ->
          conn
          |> put_status(:bad_request)
          |> json(%{success: false, error: "No active subscription to cancel"})

        {:error, reason} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{success: false, error: "Failed to cancel: #{inspect(reason)}"})
      end
    end
  end

  @doc """
  POST /organizations/:id/subscription/crypto-quote
  Gets a crypto payment quote for a subscription.
  Optionally accepts promo_code parameter.
  """
  def crypto_quote(conn, %{"id" => organization_id, "tier" => tier, "type" => type} = params) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)
    promo_code = Map.get(params, "promo_code")

    unless Organizations.is_admin?(org_id, user_id) do
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Admin access required"})
    else
      tier_info = case type do
        "base" -> OrganizationSubscriptions.get_tier_info(tier)
        "addon" -> OrganizationSubscriptions.get_addon_info(tier)
        _ -> nil
      end

      if is_nil(tier_info) do
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: "Invalid tier"})
      else
        # Calculate base price
        base_usd = tier_info.usd

        # Apply promo code discount if provided and valid
        {final_usd, promo_info} = if promo_code do
          case PromoCodes.validate_org_promo(promo_code, tier, org_id, :subscription) do
            {:ok, promo} ->
              discount = promo.percent_off / 100
              discounted_usd = base_usd * (1 - discount)
              {discounted_usd, %{
                code: promo.code,
                percent_off: promo.percent_off,
                original_usd: base_usd
              }}
            {:error, _reason} ->
              {base_usd, nil}
          end
        else
          {base_usd, nil}
        end

        # Get current SOL/USD rate
        sol_usd_rate = get_sol_usd_rate()
        amount_sol = final_usd / sol_usd_rate
        company_wallet = Application.get_env(:clippster_server, :company_wallet_address)

        quote = %{
          amount_usd: final_usd,
          amount_sol: amount_sol,
          sol_usd_rate: sol_usd_rate,
          company_wallet: company_wallet
        }

        # Add promo info if applied
        quote = if promo_info do
          Map.put(quote, :promo_applied, promo_info)
        else
          quote
        end

        conn
        |> json(%{
          success: true,
          quote: quote
        })
      end
    end
  end

  @doc """
  POST /organizations/:id/subscription/crypto-confirm
  Confirms a crypto payment for a subscription.
  Optionally accepts promo_code parameter.
  """
  def crypto_confirm(conn, %{
        "id" => organization_id,
        "tier" => tier,
        "type" => type,
        "tx_signature" => tx_signature
      } = params) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)
    promo_code = Map.get(params, "promo_code")

    unless Organizations.is_admin?(org_id, user_id) do
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Admin access required"})
    else
      # Validate promo code if provided
      validated_promo = if promo_code do
        case PromoCodes.validate_org_promo(promo_code, tier, org_id, :subscription) do
          {:ok, promo} -> promo
          {:error, _reason} -> nil
        end
      else
        nil
      end

      # Verify transaction on Solana (simplified - in production, verify amount, recipient, etc.)
      result = case type do
        "base" ->
          OrganizationSubscriptions.create_crypto_subscription(org_id, tier, tx_signature)

        "addon" ->
          OrganizationSubscriptions.add_addon_crypto(org_id, tier, tx_signature)

        _ ->
          {:error, :invalid_type}
      end

      case result do
        {:ok, data} ->
          # Record promo code redemption if validated
          if validated_promo do
            subscription_id = case data do
              %{subscription: sub} -> sub.id
              %{org: _org} -> nil
              _ -> nil
            end

            PromoCodes.create_org_redemption(validated_promo.id, org_id, user_id, %{
              subscription_id: subscription_id
            })
          end

          status = OrganizationSubscriptions.get_subscription_status(org_id)

          conn
          |> json(%{
            success: true,
            subscription: status
          })

        {:error, reason} ->
          conn
          |> put_status(:bad_request)
          |> json(%{success: false, error: "Payment confirmation failed: #{inspect(reason)}"})
      end
    end
  end

  # Helper functions

  defp get_base_url do
    domain = Application.get_env(:clippster_server, :domain, "localhost")

    if domain == "localhost" do
      "http://localhost:1420"
    else
      "https://#{domain}"
    end
  end

  defp get_sol_usd_rate do
    # In production, fetch from CoinGecko or similar
    # For now, return a placeholder
    150.0
  end
end
