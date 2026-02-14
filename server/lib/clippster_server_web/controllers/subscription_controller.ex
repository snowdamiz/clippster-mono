defmodule ClippsterServerWeb.SubscriptionController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Subscriptions
  alias ClippsterServer.Accounts
  alias ClippsterServer.PromoCodes

  @doc """
  Get subscription status for the authenticated user.
  """
  def get_status(conn, _params) do
    with {:ok, user_id} <- get_user_id_from_token(conn) do
      status = Subscriptions.get_subscription_status(user_id)

      json(conn, %{
        success: true,
        subscription: status
      })
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})
    end
  end

  @doc """
  Get available subscription tiers and pricing.
  """
  def get_tiers(conn, _params) do
    tiers = Subscriptions.get_subscription_tiers()

    # Convert to list format for frontend
    tiers_list =
      Enum.map(tiers, fn {key, info} ->
        %{
          id: key,
          name: info.name,
          monthly_credits: info.monthly_credits,
          price_usd: info.usd
        }
      end)
      |> Enum.sort_by(& &1.price_usd)

    json(conn, %{
      success: true,
      tiers: tiers_list
    })
  end

  @doc """
  Validate a promo code for a specific subscription tier.
  Returns promo code details if valid, error message if invalid.
  """
  def validate_promo(conn, %{"code" => code, "tier" => tier})
      when is_binary(code) and is_binary(tier) do
    with {:ok, user_id} <- get_user_id_from_token(conn) do
      case PromoCodes.validate_promo(code, tier, user_id) do
        {:ok, promo} ->
          json(conn, %{
            success: true,
            promo: %{
              code: promo.code,
              percent_off: promo.percent_off,
              duration_kind: promo.duration_kind,
              duration_months: promo.duration_months
            }
          })

        {:error, reason} ->
          error_message =
            case reason do
              :invalid_code ->
                "Invalid promo code"

              :inactive_code ->
                "This promo code is not active"

              :expired_code ->
                "This promo code has expired"

              :tier_not_allowed ->
                "This promo code is not valid for the selected plan"

              :max_redemptions_reached ->
                "This promo code has reached its maximum redemption limit"

              :already_redeemed ->
                "You have already used this promo code"

              _ ->
                "Invalid promo code"
            end

          conn
          |> put_status(400)
          |> json(%{success: false, error: error_message})
      end
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})
    end
  end

  def validate_promo(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameters: code and tier"})
  end

  @doc """
  Create a Stripe Checkout session for a subscription.
  """
  def create_checkout(conn, %{"tier" => tier} = params) do
    require Logger

    # Check if Stripe is configured
    stripe_api_key = Application.get_env(:stripity_stripe, :api_key)

    if is_nil(stripe_api_key) or stripe_api_key == "" do
      Logger.error("Stripe API key is not configured")

      conn
      |> put_status(503)
      |> json(%{
        success: false,
        error: "Payment service is not configured. Please contact support."
      })
    else
      billing_interval = Map.get(params, "billing_interval", "monthly")
      create_checkout_with_stripe(conn, tier, Map.get(params, "promo_code"), billing_interval)
    end
  end

  defp create_checkout_with_stripe(conn, tier, promo_code, billing_interval) do
    require Logger

    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, user} <- get_user(user_id),
         {:ok, tier_info} <- validate_tier(tier) do
      # Validate promo code if provided
      promo_code_info =
        if promo_code do
          case PromoCodes.validate_promo(promo_code, tier, user_id) do
            {:ok, promo} -> {:ok, promo}
            error -> error
          end
        else
          nil
        end

      # Return error if promo code is invalid
      case promo_code_info do
        {:error, reason} ->
          error_message =
            case reason do
              :invalid_code ->
                "Invalid promo code"

              :inactive_code ->
                "This promo code is not active"

              :expired_code ->
                "This promo code has expired"

              :tier_not_allowed ->
                "This promo code is not valid for the selected plan"

              :max_redemptions_reached ->
                "This promo code has reached its maximum redemption limit"

              :already_redeemed ->
                "You have already used this promo code"

              _ ->
                "Invalid promo code"
            end

          conn
          |> put_status(400)
          |> json(%{success: false, error: error_message})

        _ ->
          nil
      end

      # Get Stripe price IDs from config
      stripe_config = Application.get_env(:clippster_server, :stripe)
      success_url = stripe_config[:success_url] || "http://localhost:48276/stripe-success"
      cancel_url = stripe_config[:cancel_url] || "http://localhost:48276/stripe-cancel"

      Logger.debug(
        "Creating checkout for tier: #{tier}, user: #{user_id}, promo_code: #{inspect(promo_code)}"
      )

      # Create or get Stripe customer
      customer_id =
        case user.stripe_customer_id do
          nil ->
            Logger.debug("Creating new Stripe customer for user #{user_id}")

            case create_stripe_customer(user) do
              {:ok, customer} ->
                Logger.debug("Created Stripe customer: #{customer.id}")
                customer.id

              {:error, err} ->
                Logger.error("Failed to create Stripe customer: #{inspect(err)}")
                nil
            end

          id ->
            Logger.debug("Using existing Stripe customer: #{id}")
            id
        end

      # Update user with customer ID if new
      if customer_id && is_nil(user.stripe_customer_id) do
        Subscriptions.update_stripe_customer(user_id, customer_id)
      end

      # Calculate price and interval based on billing_interval
      {stripe_interval, unit_amount_cents, product_description, credits_to_grant} =
        if billing_interval == "yearly" do
          # Yearly = 11 months price, but grant 12 months of credits upfront
          yearly_price = tier_info.usd * 11
          yearly_credits = tier_info.monthly_credits * 12
          {"year", trunc(yearly_price * 100), "#{yearly_credits} credits upfront (12 months)", yearly_credits}
        else
          {"month", trunc(tier_info.usd * 100), "#{tier_info.monthly_credits} credits per month", tier_info.monthly_credits}
        end

      # Create Stripe Checkout session for subscription
      base_session_params = %{
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          %{
            price_data: %{
              currency: "usd",
              product_data: %{
                name: "#{tier_info.name} Subscription#{if billing_interval == "yearly", do: " (Annual)", else: ""}",
                description: product_description
              },
              unit_amount: unit_amount_cents,
              recurring: %{
                interval: stripe_interval
              }
            },
            quantity: 1
          }
        ],
        metadata: %{
          user_id: to_string(user_id),
          subscription_tier: tier,
          monthly_credits: to_string(tier_info.monthly_credits),
          credits_to_grant: to_string(credits_to_grant),
          billing_interval: billing_interval,
          type: "subscription"
        },
        success_url: "#{success_url}?session_id={CHECKOUT_SESSION_ID}&type=subscription",
        cancel_url: "#{cancel_url}?type=subscription"
      }

      # Add promo code to Stripe session if valid
      base_session_params =
        case promo_code_info do
          {:ok, promo} ->
            base_session_params
            |> Map.put(:discounts, [%{promotion_code: promo.stripe_promo_code_id}])
            |> update_in([:metadata], &Map.put(&1, :promo_code_id, promo.id))
            |> update_in([:metadata], &Map.put(&1, :promo_code, promo.code))

          _ ->
            base_session_params
        end

      # Add customer info - either existing customer ID or email for new customer
      session_params =
        cond do
          customer_id ->
            Map.put(base_session_params, :customer, customer_id)

          user.email && user.email != "" ->
            Map.put(base_session_params, :customer_email, user.email)

          true ->
            # No customer ID and no email - Stripe requires one of these
            nil
        end

      # Check if we have valid session params
      if is_nil(session_params) do
        Logger.error("Cannot create checkout: user has no email and no Stripe customer ID")

        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "Cannot create checkout session: user email is required"
        })
      else
        Logger.debug("Stripe session params: #{inspect(session_params)}")

        case Stripe.Checkout.Session.create(session_params) do
          {:ok, session} ->
            json(conn, %{
              success: true,
              session_id: session.id,
              url: session.url
            })

          {:error, %Stripe.Error{message: message}} ->
            Logger.error("Stripe checkout error: #{message}")

            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to create checkout session: #{message}"})

          {:error, error} ->
            Logger.error("Stripe checkout error: #{inspect(error)}")

            error_message =
              case error do
                %{message: msg} -> msg
                msg when is_binary(msg) -> msg
                _ -> "Unknown error"
              end

            conn
            |> put_status(500)
            |> json(%{
              success: false,
              error: "Failed to create checkout session: #{error_message}"
            })
        end
      end
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, :user_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User not found"})

      {:error, :invalid_tier} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid subscription tier"})
    end
  end

  @doc """
  Generate a crypto payment quote for subscription.
  Optionally accepts a promo_code parameter to apply discounts.
  """
  def get_crypto_quote(conn, %{"tier" => tier} = params) do
    alias ClippsterServer.Credits

    promo_code = Map.get(params, "promo_code")
    billing_interval = Map.get(params, "billing_interval", "monthly")

    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, tier_info} <- validate_tier(tier),
         {:ok, sol_usd_rate} <- ClippsterServer.PriceService.get_sol_price() do
      # Calculate base price (yearly = 11 months)
      base_usd = if billing_interval == "yearly", do: tier_info.usd * 11, else: tier_info.usd
      credits_to_grant = if billing_interval == "yearly", do: tier_info.monthly_credits * 12, else: tier_info.monthly_credits

      # Apply promo code discount if provided and valid
      {final_usd, promo_info} =
        if promo_code do
          case PromoCodes.validate_promo(promo_code, tier, user_id) do
            {:ok, promo} ->
              discount = promo.percent_off / 100
              discounted_usd = base_usd * (1 - discount)

              {discounted_usd,
               %{
                 code: promo.code,
                 percent_off: promo.percent_off,
                 original_usd: base_usd
               }}

            {:error, _reason} ->
              # If promo code is invalid, use base price without discount
              {base_usd, nil}
          end
        else
          {base_usd, nil}
        end

      sol_amount = final_usd / sol_usd_rate
      company_wallet = Credits.get_company_wallet_address()

      quote = %{
        tier: tier,
        tier_name: tier_info.name,
        monthly_credits: tier_info.monthly_credits,
        credits_to_grant: credits_to_grant,
        billing_interval: billing_interval,
        amount_usd: final_usd,
        amount_sol: sol_amount,
        sol_usd_rate: sol_usd_rate,
        company_wallet: company_wallet,
        user_id: user_id,
        expires_at: DateTime.utc_now() |> DateTime.add(300, :second) |> DateTime.to_iso8601(),
        quote_id: generate_quote_id(),
        type: "subscription"
      }

      # Add promo info to quote if applied
      quote =
        if promo_info do
          Map.put(quote, :promo_applied, promo_info)
        else
          quote
        end

      json(conn, %{
        success: true,
        quote: quote
      })
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, :invalid_tier} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid subscription tier"})

      {:error, _reason} ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Price service unavailable"})
    end
  end

  @doc """
  Confirm crypto payment for subscription.
  """
  def confirm_crypto_payment(conn, %{
        "tier" => tier,
        "tx_signature" => tx_signature,
        "from_address" => from_address
      } = params) do
    alias ClippsterServer.Credits

    promo_code = Map.get(params, "promo_code")

    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, tier_info} <- validate_tier(tier),
         {:ok, sol_usd_rate} <- ClippsterServer.PriceService.get_sol_price() do
      # Calculate expected amount with promo code discount if provided
      {expected_usd, validated_promo} =
        if promo_code do
          case PromoCodes.validate_promo(promo_code, tier, user_id) do
            {:ok, promo} ->
              discount = promo.percent_off / 100
              discounted_usd = tier_info.usd * (1 - discount)
              {discounted_usd, promo}

            {:error, _reason} ->
              # If promo code is invalid, use base price
              {tier_info.usd, nil}
          end
        else
          {tier_info.usd, nil}
        end

      expected_sol_amount = expected_usd / sol_usd_rate

      case verify_crypto_payment(tx_signature, from_address, expected_sol_amount) do
        {:ok, :verified} ->
          case Subscriptions.create_crypto_subscription(user_id, tier, tx_signature) do
            {:ok, %{user: _user, subscription: subscription}} ->
              # Record promo code redemption if a valid promo was used
              if validated_promo do
                PromoCodes.create_redemption(validated_promo.id, user_id, %{
                  subscription_id: subscription.id
                })
              end

              {:ok, balance} = Credits.get_user_balance(user_id)
              status = Subscriptions.get_subscription_status(user_id)

              json(conn, %{
                success: true,
                message: "Subscription activated! #{tier_info.monthly_credits} credits added.",
                subscription: status,
                balance: %{
                  hours_remaining: Decimal.to_float(balance.hours_remaining),
                  hours_used: Decimal.to_float(balance.hours_used)
                }
              })

            {:error, reason} ->
              conn
              |> put_status(500)
              |> json(%{
                success: false,
                error: "Failed to create subscription: #{inspect(reason)}"
              })
          end

        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Payment verification failed: #{inspect(reason)}"})
      end
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, :invalid_tier} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid subscription tier"})

      {:error, _reason} ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Price service unavailable"})
    end
  end

  @doc """
  Cancel the user's subscription.
  """
  def cancel(conn, _params) do
    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, user} <- get_user(user_id) do
      # If Stripe subscription, cancel via Stripe
      if user.stripe_subscription_id && user.subscription_renewal_method == "stripe" do
        case Stripe.Subscription.update(user.stripe_subscription_id, %{cancel_at_period_end: true}) do
          {:ok, _} ->
            {:ok, updated_user} = Subscriptions.cancel_subscription(user_id)
            status = Subscriptions.get_subscription_status(user_id)

            json(conn, %{
              success: true,
              message:
                "Subscription cancelled. Access continues until #{DateTime.to_iso8601(updated_user.subscription_end_date)}",
              subscription: status
            })

          {:error, %Stripe.Error{message: message}} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to cancel subscription: #{message}"})
        end
      else
        # Crypto or other subscription - just mark as cancelled
        case Subscriptions.cancel_subscription(user_id) do
          {:ok, updated_user} ->
            status = Subscriptions.get_subscription_status(user_id)

            json(conn, %{
              success: true,
              message:
                "Subscription cancelled. Access continues until #{DateTime.to_iso8601(updated_user.subscription_end_date)}",
              subscription: status
            })

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: to_string(reason)})
        end
      end
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, :user_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User not found"})
    end
  end

  @doc """
  Get subscription history for the user.
  """
  def history(conn, _params) do
    with {:ok, user_id} <- get_user_id_from_token(conn) do
      subscriptions = Subscriptions.list_user_subscriptions(user_id)

      history =
        Enum.map(subscriptions, fn sub ->
          %{
            id: sub.id,
            tier: sub.subscription_tier,
            status: sub.status,
            start_date: sub.start_date,
            end_date: sub.end_date,
            credits_granted:
              if(sub.credits_granted, do: Decimal.to_float(sub.credits_granted), else: 0),
            amount_usd: if(sub.amount_usd, do: Decimal.to_float(sub.amount_usd), else: 0),
            payment_method: sub.payment_method,
            created_at: sub.inserted_at
          }
        end)

      json(conn, %{
        success: true,
        history: history
      })
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})
    end
  end

  # Private helpers

  defp get_user_id_from_token(conn) do
    case get_token_claims(conn) do
      {:ok, claims} ->
        {:ok, claims["user_id"]}

      {:error, _} ->
        {:error, :unauthorized}
    end
  end

  defp get_token_claims(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        decode_token(token)

      _ ->
        {:error, :unauthorized}
    end
  end

  defp decode_token(token) do
    case String.split(token, ".") do
      [_header, payload, _signature] ->
        try do
          payload
          |> Base.url_decode64!(padding: false)
          |> Jason.decode()
        rescue
          _ -> {:error, :invalid_token}
        end

      _ ->
        {:error, :invalid_token}
    end
  end

  defp get_user(user_id) do
    case Accounts.get_user(user_id) do
      nil -> {:error, :user_not_found}
      user -> {:ok, user}
    end
  end

  defp validate_tier(tier) do
    case Subscriptions.get_tier_info(tier) do
      nil -> {:error, :invalid_tier}
      tier_info -> {:ok, tier_info}
    end
  end

  defp generate_quote_id do
    :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
  end

  defp create_stripe_customer(user) do
    params = %{
      email: user.email,
      metadata: %{
        user_id: to_string(user.id)
      }
    }

    if user.name do
      Stripe.Customer.create(Map.put(params, :name, user.name))
    else
      Stripe.Customer.create(params)
    end
  end

  defp verify_crypto_payment(tx_signature, from_address, expected_sol_amount) do
    alias ClippsterServer.Credits
    alias ClippsterServer.JsScripts

    company_wallet = Credits.get_company_wallet_address()

    payload =
      Jason.encode!(%{
        tx_signature: tx_signature,
        from_address: from_address,
        to_address: company_wallet,
        expected_sol_amount: expected_sol_amount,
        rpc_url: System.get_env("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
      })

    temp_file =
      Path.join(System.tmp_dir!(), "sub_verify_#{:erlang.unique_integer([:positive])}.json")

    File.write!(temp_file, payload)

    script_path = JsScripts.script_path("payment_verify.js")
    node_path = JsScripts.find_node_executable()

    result =
      case System.cmd(node_path, [script_path, temp_file], stderr_to_stdout: true) do
        {output, 0} ->
          case Jason.decode(output) do
            {:ok, %{"valid" => true}} -> {:ok, :verified}
            {:ok, %{"valid" => false, "error" => error}} -> {:error, error}
            _ -> {:error, :verification_failed}
          end

        {_output, _exit_code} ->
          {:error, :verification_failed}
      end

    File.rm(temp_file)
    result
  end
end
