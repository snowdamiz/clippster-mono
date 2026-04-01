defmodule ClippsterServerWeb.StripeController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Credits
  alias ClippsterServer.Accounts
  alias ClippsterServer.Organizations
  alias ClippsterServer.Subscriptions
  alias ClippsterServer.PromoCodes
  alias ClippsterServer.Affiliates
  alias ClippsterServerWeb.StripeReturn

  @doc """
  Creates a Stripe Checkout session for purchasing a credit pack.
  The user must be authenticated and provide a valid pack_type.
  """
  def create_checkout_session(conn, %{"pack_type" => pack_type} = params) do
    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, user} <- get_user(user_id),
         {:ok, _} <- validate_tier_pack_access(user, pack_type),
         {:ok, pack_info} <- validate_pack_type(pack_type) do
      success_url =
        StripeReturn.success_url(conn, params)
        |> StripeReturn.with_query(session_id: "{CHECKOUT_SESSION_ID}")

      cancel_url = StripeReturn.cancel_url(conn, params)

      # Create Stripe Checkout session
      session_params = %{
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          %{
            price_data: %{
              currency: "usd",
              product_data: %{
                name: "#{String.capitalize(pack_type)} Credit Pack",
                description: "#{pack_info.hours} minutes of video processing credits"
              },
              # Stripe expects cents
              unit_amount: trunc(pack_info.usd * 100)
            },
            quantity: 1
          }
        ],
        metadata: %{
          user_id: to_string(user_id),
          pack_type: pack_type,
          hours: to_string(pack_info.hours),
          amount_usd: to_string(pack_info.usd)
        },
        customer_email: user.email,
        success_url: success_url,
        cancel_url: cancel_url
      }

      case Stripe.Checkout.Session.create(session_params) do
        {:ok, session} ->
          json(conn, %{
            success: true,
            session_id: session.id,
            url: session.url
          })

        {:error, %Stripe.Error{message: message}} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to create checkout session: #{message}"})

        {:error, _} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to create checkout session"})
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

      {:error, :invalid_pack} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid pack type"})

      {:error, :tier_restriction} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Basic tier can only purchase the Large credit pack (1,800 credits)"})
    end
  end

  @doc """
  Creates a Stripe Checkout session for an admin-created org's first-time setup payment.
  The org owner calls this to pay their monthly subscription before accessing the org dashboard.
  Creates a recurring Stripe Subscription at the admin-set price.
  """
  def create_org_setup_checkout(conn, %{"organization_id" => org_id_raw} = params) do
    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, user} <- get_user(user_id),
         {:ok, org} <- get_organization(org_id_raw) do
      # Only the org owner may trigger setup
      unless org.owner_id == user_id do
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only the organization owner can complete setup"})
      else
        unless org.setup_completed == false && org.created_by_admin_id != nil do
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Organization setup is already complete"})
        else
          price_cents = org.admin_price_cents || 0

          # If price is $0, mark setup as completed immediately without Stripe
          if price_cents == 0 do
            alias ClippsterServer.Organizations.Organization
            alias ClippsterServer.Repo

            case org
                 |> Organization.subscription_changeset(%{setup_completed: true})
                 |> Repo.update() do
              {:ok, _updated} ->
                conn
                |> json(%{
                  success: true,
                  message: "Setup completed (no payment required)",
                  redirect_to: "/dashboard/org/#{org.id}"
                })

              {:error, _reason} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Failed to complete setup"})
            end
          else
            success_url =
              StripeReturn.success_url(conn, params)
              |> StripeReturn.with_query(
                session_id: "{CHECKOUT_SESSION_ID}",
                org: to_string(org.id),
                setup: "complete"
              )

            cancel_url =
              StripeReturn.cancel_url(conn, params)
              |> StripeReturn.with_query(org: to_string(org.id))

            tier_label =
              case org.subscription_tier do
                "custom" -> "Custom Plan"
                tier -> String.replace(tier || "Organization", "_", " ") |> String.capitalize()
              end

            session_params = %{
              mode: "subscription",
              payment_method_types: ["card"],
              line_items: [
                %{
                  price_data: %{
                    currency: "usd",
                    product_data: %{
                      name: "#{org.name} — #{tier_label} Subscription",
                      description:
                        "#{org.max_seats || "Unlimited"} seats · #{org.monthly_credits || 0} monthly credits"
                    },
                    unit_amount: price_cents,
                    recurring: %{interval: "month"}
                  },
                  quantity: 1
                }
              ],
              metadata: %{
                user_id: to_string(user_id),
                organization_id: to_string(org.id),
                org_setup: "true"
              },
              customer_email: user.email,
              success_url: success_url,
              cancel_url: cancel_url
            }

            case Stripe.Checkout.Session.create(session_params) do
              {:ok, session} ->
                json(conn, %{
                  success: true,
                  session_id: session.id,
                  url: session.url
                })

              {:error, %Stripe.Error{message: message}} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Failed to create checkout session: #{message}"})

              {:error, _} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Failed to create checkout session"})
            end
          end
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(401) |> json(%{success: false, error: "Unauthorized"})

      {:error, :user_not_found} ->
        conn |> put_status(404) |> json(%{success: false, error: "User not found"})

      {:error, :organization_not_found} ->
        conn |> put_status(404) |> json(%{success: false, error: "Organization not found"})
    end
  end

  @doc """
  Creates a Stripe Checkout session for purchasing credits for an organization.
  Only organization admins can purchase credits for the org pool.
  Optionally accepts promo_code parameter.
  """
  def create_org_checkout_session(
        conn,
        %{"organization_id" => org_id, "pack_type" => pack_type} = params
      ) do
    promo_code = Map.get(params, "promo_code")

    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, user} <- get_user(user_id),
         {:ok, _org} <- get_organization(org_id),
         true <- Organizations.is_admin?(org_id, user_id),
         {:ok, pack_info} <- validate_pack_type(pack_type) do
      # Validate promo code if provided
      validated_promo =
        if promo_code do
          case PromoCodes.validate_org_promo(promo_code, pack_type, org_id, :credit_pack) do
            {:ok, promo} -> promo
            {:error, _reason} -> nil
          end
        else
          nil
        end

      success_url =
        StripeReturn.success_url(conn, params)
        |> StripeReturn.with_query(session_id: "{CHECKOUT_SESSION_ID}", org: org_id)

      cancel_url =
        StripeReturn.cancel_url(conn, params)
        |> StripeReturn.with_query(org: org_id)

      # Create Stripe Checkout session with organization context
      session_params = %{
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          %{
            price_data: %{
              currency: "usd",
              product_data: %{
                name: "#{String.capitalize(pack_type)} Credit Pack (Organization)",
                description:
                  "#{pack_info.hours} minutes of video processing credits for your organization"
              },
              # Stripe expects cents
              unit_amount: trunc(pack_info.usd * 100)
            },
            quantity: 1
          }
        ],
        metadata: %{
          user_id: to_string(user_id),
          # Key addition for org purchases
          organization_id: to_string(org_id),
          pack_type: pack_type,
          hours: to_string(pack_info.hours),
          amount_usd: to_string(pack_info.usd)
        },
        customer_email: user.email,
        success_url: success_url,
        cancel_url: cancel_url
      }

      # Add promo code to Stripe session if validated
      session_params =
        if validated_promo && validated_promo.stripe_promo_code_id do
          session_params
          |> Map.put(:discounts, [%{promotion_code: validated_promo.stripe_promo_code_id}])
          |> update_in(
            [:metadata],
            &Map.merge(&1, %{
              promo_code_id: validated_promo.id,
              promo_code: validated_promo.code
            })
          )
        else
          session_params
        end

      case Stripe.Checkout.Session.create(session_params) do
        {:ok, session} ->
          json(conn, %{
            success: true,
            session_id: session.id,
            url: session.url
          })

        {:error, %Stripe.Error{message: message}} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to create checkout session: #{message}"})

        {:error, _} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to create checkout session"})
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

      {:error, :organization_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found"})

      false ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only organization admins can purchase credits"})

      {:error, :invalid_pack} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid pack type"})
    end
  end

  @doc """
  Handles Stripe webhook events.
  Verifies the webhook signature and processes checkout.session.completed events.
  """
  def webhook(conn, _params) do
    # Get the raw body and signature header
    payload = conn.assigns[:raw_body]
    signature = get_req_header(conn, "stripe-signature") |> List.first()

    stripe_config = Application.get_env(:clippster_server, :stripe)
    webhook_secret = stripe_config[:webhook_secret]

    case verify_and_construct_event(payload, signature, webhook_secret) do
      {:ok, event} ->
        handle_event(event)
        json(conn, %{received: true})

      {:error, reason} ->
        IO.puts("[Stripe Webhook] Verification failed: #{inspect(reason)}")

        conn
        |> put_status(400)
        |> json(%{error: "Webhook verification failed"})
    end
  end

  defp verify_and_construct_event(payload, signature, webhook_secret)
       when is_binary(webhook_secret) and byte_size(webhook_secret) > 0 do
    case Stripe.Webhook.construct_event(payload, signature, webhook_secret) do
      {:ok, event} -> {:ok, event}
      {:error, reason} -> {:error, reason}
    end
  end

  defp verify_and_construct_event(payload, _signature, _webhook_secret) do
    # Only allow unverified payloads outside production.
    if Application.get_env(:clippster_server, :allow_unverified_stripe_webhooks, false) do
      case Jason.decode(payload) do
        {:ok, event} -> {:ok, struct_from_map(event)}
        {:error, _} -> {:error, :invalid_payload}
      end
    else
      {:error, :missing_webhook_secret}
    end
  end

  defp struct_from_map(map) when is_map(map) do
    # Convert string keys to atoms for the event structure
    %{
      type: map["type"],
      data: %{
        object: map["data"]["object"]
      }
    }
  end

  defp handle_event(%{type: "checkout.session.completed", data: %{object: session}}) do
    IO.puts("[Stripe Webhook] Processing checkout.session.completed")

    metadata = safe_get(session, "metadata") || %{}
    user_id = get_metadata_value(metadata, "user_id")
    organization_id = get_metadata_value(metadata, "organization_id")
    pack_type = get_metadata_value(metadata, "pack_type")
    hours = get_metadata_value(metadata, "hours")
    amount_usd = get_metadata_value(metadata, "amount_usd")
    payment_type = get_metadata_value(metadata, "type")
    subscription_tier = get_metadata_value(metadata, "subscription_tier")
    subscription_type = get_metadata_value(metadata, "subscription_type")
    addon_tier = get_metadata_value(metadata, "addon_tier")
    promo_code_id = get_metadata_value(metadata, "promo_code_id")
    affiliate_code = get_metadata_value(metadata, "affiliate_code")
    org_setup = get_metadata_value(metadata, "org_setup")

    session_id = safe_get(session, "id")
    payment_intent = safe_get(session, "payment_intent")
    stripe_subscription_id = safe_get(session, "subscription")
    stripe_customer_id = safe_get(session, "customer")
    amount_total = safe_get(session, "amount_total")

    IO.puts(
      "[Stripe Webhook] User ID: #{user_id}, Org ID: #{organization_id}, Type: #{payment_type}, Sub Type: #{subscription_type}, Tier: #{subscription_tier}, Addon: #{addon_tier}, Pack: #{pack_type}, Hours: #{hours}, OrgSetup: #{org_setup}"
    )

    cond do
      # Handle admin-created org first-login setup payment
      org_setup == "true" && organization_id ->
        handle_org_setup_checkout(
          organization_id,
          stripe_subscription_id,
          stripe_customer_id
        )

      # Handle organization subscription (base)
      subscription_type == "base" && organization_id && subscription_tier ->
        handle_org_subscription_checkout(
          organization_id,
          user_id,
          subscription_tier,
          stripe_subscription_id,
          stripe_customer_id,
          promo_code_id
        )

      # Handle organization addon
      subscription_type == "addon" && organization_id && addon_tier ->
        handle_org_addon_checkout(
          organization_id,
          user_id,
          addon_tier,
          stripe_subscription_id,
          promo_code_id
        )

      # Handle user subscription checkout
      payment_type == "subscription" && user_id && subscription_tier ->
        billing_interval = get_metadata_value(metadata, "billing_interval") || "monthly"

        handle_subscription_checkout(
          user_id,
          subscription_tier,
          stripe_subscription_id,
          stripe_customer_id,
          promo_code_id,
          billing_interval,
          amount_total,
          affiliate_code
        )

      # Handle credit pack purchase for organization
      user_id && pack_type && hours && organization_id ->
        handle_org_stripe_payment(
          organization_id,
          user_id,
          pack_type,
          hours,
          amount_usd,
          amount_total,
          session_id,
          payment_intent,
          promo_code_id
        )

      # Handle credit pack purchase for personal use
      user_id && pack_type && hours ->
        handle_personal_stripe_payment(
          user_id,
          pack_type,
          hours,
          amount_usd,
          amount_total,
          session_id,
          payment_intent
        )

      true ->
        IO.puts("[Stripe Webhook] Missing required metadata for checkout")
    end
  end

  # Handle subscription created via Stripe
  defp handle_event(%{type: "customer.subscription.created", data: %{object: subscription}}) do
    IO.puts("[Stripe Webhook] Processing customer.subscription.created")

    Appsignal.increment_counter("subscriptions.created", 1)

    stripe_subscription_id = safe_get(subscription, "id")
    stripe_customer_id = safe_get(subscription, "customer")
    metadata = safe_get(subscription, "metadata") || %{}

    user_id = get_metadata_value(metadata, "user_id")
    subscription_tier = get_metadata_value(metadata, "subscription_tier")

    if user_id && subscription_tier do
      handle_subscription_created(
        user_id,
        subscription_tier,
        stripe_subscription_id,
        stripe_customer_id
      )
    else
      # Try to find user by customer ID
      case Subscriptions.get_user_by_stripe_customer(stripe_customer_id) do
        nil ->
          IO.puts(
            "[Stripe Webhook] Could not find user for subscription #{stripe_subscription_id}"
          )

        user ->
          # Can't determine tier without metadata, log warning
          IO.puts("[Stripe Webhook] Found user #{user.id} but missing tier metadata")
      end
    end
  end

  # Handle successful invoice payment (subscription renewal)
  defp handle_event(%{type: "invoice.payment_succeeded", data: %{object: invoice}}) do
    IO.puts("[Stripe Webhook] Processing invoice.payment_succeeded")

    stripe_subscription_id = safe_get(invoice, "subscription")
    billing_reason = safe_get(invoice, "billing_reason")

    # Only process renewal invoices, not initial subscription
    if stripe_subscription_id && billing_reason in ["subscription_cycle", "subscription_update"] do
      # Try user subscription first
      case Subscriptions.get_user_by_stripe_subscription(stripe_subscription_id) do
        nil ->
          # Try organization subscription
          case ClippsterServer.OrganizationSubscriptions.get_by_stripe_subscription(
                 stripe_subscription_id
               ) do
            nil ->
              IO.puts(
                "[Stripe Webhook] No user or org found for subscription #{stripe_subscription_id}"
              )

            org ->
              case ClippsterServer.OrganizationSubscriptions.renew_subscription(org.id) do
                {:ok, _result} ->
                  IO.puts("[Stripe Webhook] Renewed org subscription for org #{org.id}")

                {:error, reason} ->
                  IO.puts("[Stripe Webhook] Failed to renew org subscription: #{inspect(reason)}")
              end
          end

        user ->
          case Subscriptions.renew_subscription(user.id) do
            {:ok, _result} ->
              IO.puts("[Stripe Webhook] Renewed subscription for user #{user.id}")

              # Apply pending tier change (downgrade) if any
              case Subscriptions.apply_pending_tier_change(user.id) do
                {:ok, %{type: "downgrade_applied"}} ->
                  IO.puts("[Stripe Webhook] Applied pending downgrade for user #{user.id}")

                _ ->
                  :ok
              end

              # Record affiliate recurring commission
              amount_total = safe_get(invoice, "amount_paid") || 0
              amount_usd = Decimal.div(Decimal.new(amount_total), Decimal.new(100))

              case Affiliates.record_recurring_commission(user.id, amount_usd) do
                {:ok, _} ->
                  IO.puts(
                    "[Stripe Webhook] Recorded affiliate recurring commission for user #{user.id}"
                  )

                _ ->
                  :ok
              end

              # Allocate revenue to platform fund if enabled
              case Subscriptions.get_active_subscription(user.id) do
                nil -> :ok
                subscription ->
                  ClippsterServer.PlatformCampaigns.allocate_subscription_revenue(
                    subscription.id,
                    amount_usd
                  )
              end

            {:error, reason} ->
              IO.puts("[Stripe Webhook] Failed to renew subscription: #{inspect(reason)}")
          end
      end
    else
      IO.puts("[Stripe Webhook] Skipping invoice - billing_reason: #{billing_reason}")
    end
  end

  # Handle failed invoice payment
  defp handle_event(%{type: "invoice.payment_failed", data: %{object: invoice}}) do
    IO.puts("[Stripe Webhook] Processing invoice.payment_failed")

    stripe_subscription_id = safe_get(invoice, "subscription")

    if stripe_subscription_id do
      # Try user subscription first
      case Subscriptions.get_user_by_stripe_subscription(stripe_subscription_id) do
        nil ->
          # Try organization subscription
          case ClippsterServer.OrganizationSubscriptions.get_by_stripe_subscription(
                 stripe_subscription_id
               ) do
            nil ->
              IO.puts(
                "[Stripe Webhook] No user or org found for subscription #{stripe_subscription_id}"
              )

            org ->
              case ClippsterServer.OrganizationSubscriptions.expire_subscription(org.id) do
                {:ok, _org} ->
                  IO.puts(
                    "[Stripe Webhook] Expired org subscription for org #{org.id} due to payment failure"
                  )

                {:error, reason} ->
                  IO.puts(
                    "[Stripe Webhook] Failed to expire org subscription: #{inspect(reason)}"
                  )
              end
          end

        user ->
          # Expire the subscription on payment failure
          case Subscriptions.expire_subscription(user.id) do
            {:ok, _user} ->
              IO.puts(
                "[Stripe Webhook] Expired subscription for user #{user.id} due to payment failure"
              )

              # Cancel pending affiliate commissions
              Affiliates.cancel_pending_commissions(user.id)

            {:error, reason} ->
              IO.puts("[Stripe Webhook] Failed to expire subscription: #{inspect(reason)}")
          end
      end
    end
  end

  # Handle subscription deletion/cancellation
  defp handle_event(%{type: "customer.subscription.deleted", data: %{object: subscription}}) do
    IO.puts("[Stripe Webhook] Processing customer.subscription.deleted")

    Appsignal.increment_counter("subscriptions.deleted", 1)

    stripe_subscription_id = safe_get(subscription, "id")

    # Try user subscription first
    case Subscriptions.get_user_by_stripe_subscription(stripe_subscription_id) do
      nil ->
        # Try organization subscription
        case ClippsterServer.OrganizationSubscriptions.get_by_stripe_subscription(
               stripe_subscription_id
             ) do
          nil ->
            IO.puts(
              "[Stripe Webhook] No user or org found for subscription #{stripe_subscription_id}"
            )

          org ->
            case ClippsterServer.OrganizationSubscriptions.expire_subscription(org.id) do
              {:ok, _org} ->
                IO.puts("[Stripe Webhook] Expired org subscription for org #{org.id}")

              {:error, reason} ->
                IO.puts("[Stripe Webhook] Failed to expire org subscription: #{inspect(reason)}")
            end
        end

      user ->
        case Subscriptions.expire_subscription(user.id) do
          {:ok, _user} ->
            IO.puts("[Stripe Webhook] Expired subscription for user #{user.id}")

            # Cancel pending affiliate commissions
            Affiliates.cancel_pending_commissions(user.id)

            # Cancel any active promo redemptions for this subscription
            case PromoCodes.get_redemption_by_subscription(stripe_subscription_id) do
              nil ->
                IO.puts(
                  "[Stripe Webhook] No promo redemption found for subscription #{stripe_subscription_id}"
                )

              redemption ->
                case PromoCodes.update_redemption_status(redemption, "cancelled") do
                  {:ok, _updated} ->
                    IO.puts("[Stripe Webhook] Cancelled promo redemption for user #{user.id}")

                  {:error, reason} ->
                    IO.puts(
                      "[Stripe Webhook] Failed to cancel promo redemption: #{inspect(reason)}"
                    )
                end
            end

          {:error, reason} ->
            IO.puts("[Stripe Webhook] Failed to expire subscription: #{inspect(reason)}")
        end
    end
  end

  # Handle subscription update (tier change)
  defp handle_event(%{type: "customer.subscription.updated", data: %{object: subscription}}) do
    IO.puts("[Stripe Webhook] Processing customer.subscription.updated")

    stripe_subscription_id = safe_get(subscription, "id")
    status = safe_get(subscription, "status")
    cancel_at_period_end = safe_get(subscription, "cancel_at_period_end")

    case Subscriptions.get_user_by_stripe_subscription(stripe_subscription_id) do
      nil ->
        # Fallback: check org subscriptions
        case ClippsterServer.OrganizationSubscriptions.get_by_stripe_subscription(
               stripe_subscription_id
             ) do
          nil ->
            IO.puts(
              "[Stripe Webhook] No user or org found for subscription #{stripe_subscription_id}"
            )

          org ->
            cond do
              cancel_at_period_end == true ->
                case ClippsterServer.OrganizationSubscriptions.cancel_subscription(org.id) do
                  {:ok, _} ->
                    IO.puts(
                      "[Stripe Webhook] Marked org subscription as cancelled for org #{org.id}"
                    )

                  {:error, reason} ->
                    IO.puts("[Stripe Webhook] Failed to cancel org sub: #{inspect(reason)}")
                end

              status in ["canceled", "unpaid", "incomplete_expired"] ->
                case ClippsterServer.OrganizationSubscriptions.expire_subscription(org.id) do
                  {:ok, _} ->
                    IO.puts("[Stripe Webhook] Expired org subscription for org #{org.id}")

                  {:error, reason} ->
                    IO.puts("[Stripe Webhook] Failed to expire org sub: #{inspect(reason)}")
                end

              true ->
                # Check for pending tier change on org
                if org.pending_subscription_tier do
                  case ClippsterServer.OrganizationSubscriptions.apply_pending_tier_change(org.id) do
                    {:ok, _} ->
                      IO.puts("[Stripe Webhook] Applied pending tier change for org #{org.id}")

                    {:error, reason} ->
                      IO.puts(
                        "[Stripe Webhook] Failed to apply pending tier change: #{inspect(reason)}"
                      )
                  end
                else
                  IO.puts("[Stripe Webhook] Org subscription update - status: #{status}")
                end
            end
        end

      user ->
        cond do
          cancel_at_period_end == true ->
            # User has requested cancellation
            case Subscriptions.cancel_subscription(user.id) do
              {:ok, _} ->
                IO.puts("[Stripe Webhook] Marked subscription as cancelled for user #{user.id}")

              {:error, reason} ->
                IO.puts("[Stripe Webhook] Failed to cancel: #{inspect(reason)}")
            end

          status in ["canceled", "unpaid", "incomplete_expired"] ->
            # Subscription is no longer active
            case Subscriptions.expire_subscription(user.id) do
              {:ok, _} -> IO.puts("[Stripe Webhook] Expired subscription for user #{user.id}")
              {:error, reason} -> IO.puts("[Stripe Webhook] Failed to expire: #{inspect(reason)}")
            end

          true ->
            IO.puts("[Stripe Webhook] Subscription update - status: #{status}")
        end
    end
  end

  defp handle_event(%{type: event_type}) do
    IO.puts("[Stripe Webhook] Unhandled event type: #{event_type}")
  end

  defp handle_event(_), do: :ok

  # Handle subscription checkout completion
  defp handle_subscription_checkout(
         user_id,
         tier,
         stripe_subscription_id,
         stripe_customer_id,
         promo_code_id,
         billing_interval,
         amount_total_cents,
         affiliate_code
       ) do
    user_id_int = if is_binary(user_id), do: String.to_integer(user_id), else: user_id

    IO.puts(
      "[Stripe Webhook] Creating subscription: user=#{user_id_int}, tier=#{tier}, interval=#{billing_interval}, sub_id=#{stripe_subscription_id}, promo_code_id=#{promo_code_id}, affiliate_code=#{inspect(affiliate_code)}"
    )

    # If an affiliate code was entered at checkout, link the user to that affiliate
    # so that commission tracking works. This handles the case where the user signed up
    # without a referral code but entered an affiliate code in the promo field at checkout.
    if affiliate_code do
      case Affiliates.link_user_to_affiliate(user_id_int, affiliate_code) do
        {:ok, affiliate} ->
          IO.puts(
            "[Stripe Webhook] Linked user #{user_id_int} to affiliate #{affiliate.id} via checkout code '#{affiliate_code}'"
          )

        {:error, reason} ->
          IO.puts(
            "[Stripe Webhook] Could not link user #{user_id_int} to affiliate code '#{affiliate_code}': #{inspect(reason)}"
          )
      end
    end

    case Subscriptions.create_stripe_subscription(
           user_id_int,
           tier,
           stripe_subscription_id,
           stripe_customer_id,
           billing_interval
         ) do
      {:ok, _result} ->
        IO.puts(
          "[Stripe Webhook] Successfully created #{tier} subscription for user #{user_id_int}"
        )

        Appsignal.increment_counter("subscriptions.checkout_completed", 1, %{tier: tier})

        # Create promo code redemption if promo_code_id is provided
        if promo_code_id do
          case PromoCodes.create_redemption(promo_code_id, user_id_int, %{
                 customer_id: stripe_customer_id,
                 subscription_id: stripe_subscription_id
               }) do
            {:ok, _redemption} ->
              IO.puts(
                "[Stripe Webhook] Created promo redemption for user #{user_id_int}, promo #{promo_code_id}"
              )

            {:error, reason} ->
              IO.puts("[Stripe Webhook] Failed to create promo redemption: #{inspect(reason)}")
          end
        end

        # Record affiliate signup commission using the actual amount Stripe charged
        # (amount_total_cents comes from session.amount_total which reflects any promo discounts)
        # Fall back to hardcoded tier price only if Stripe didn't report an amount
        amount =
          case amount_total_cents do
            nil -> get_subscription_amount(tier)
            0 -> get_subscription_amount(tier)
            cents -> Decimal.div(Decimal.new(cents), Decimal.new(100))
          end

        # Allocate revenue to platform fund if enabled
        case Subscriptions.get_active_subscription(user_id_int) do
          nil -> :ok
          subscription ->
            ClippsterServer.PlatformCampaigns.allocate_subscription_revenue(
              subscription.id,
              amount
            )
        end

        case Affiliates.record_signup_commission(user_id_int, tier, amount) do
          {:ok, _} ->
            IO.puts(
              "[Stripe Webhook] Recorded affiliate signup commission for user #{user_id_int} on amount $#{amount}"
            )

          _ ->
            :ok
        end

      {:error, reason} ->
        IO.puts("[Stripe Webhook] Failed to create subscription: #{inspect(reason)}")
    end
  end

  # Handle subscription created event (backup for checkout)
  defp handle_subscription_created(user_id, tier, stripe_subscription_id, stripe_customer_id) do
    user_id_int = if is_binary(user_id), do: String.to_integer(user_id), else: user_id

    # Check if user already has this subscription (from checkout handler)
    user = Accounts.get_user(user_id_int)

    if user && user.stripe_subscription_id == stripe_subscription_id do
      IO.puts("[Stripe Webhook] Subscription already created for user #{user_id_int}")
    else
      case Subscriptions.create_stripe_subscription(
             user_id_int,
             tier,
             stripe_subscription_id,
             stripe_customer_id
           ) do
        {:ok, _result} ->
          IO.puts("[Stripe Webhook] Created #{tier} subscription for user #{user_id_int}")

        {:error, reason} ->
          IO.puts("[Stripe Webhook] Failed to create subscription: #{inspect(reason)}")
      end
    end
  end

  defp handle_personal_stripe_payment(
         user_id,
         pack_type,
         hours,
         amount_usd,
         amount_total,
         session_id,
         payment_intent
       ) do
    # Create and confirm the transaction for personal credits
    attrs = %{
      user_id: String.to_integer(user_id),
      pack_type: pack_type,
      hours_purchased: String.to_integer(hours),
      amount_usd: parse_decimal(amount_usd) || Decimal.div(Decimal.new(amount_total || 0), 100),
      # No SOL for Stripe payments
      amount_sol: Decimal.new("0"),
      # N/A for Stripe
      sol_usd_rate: Decimal.new("0"),
      # Use session ID as unique identifier
      tx_signature: "stripe_#{session_id}",
      payment_method: "stripe",
      stripe_session_id: session_id,
      stripe_payment_intent_id: payment_intent,
      # Stripe webhook means payment is already confirmed
      status: "confirmed"
    }

    case Credits.create_stripe_transaction(attrs) do
      {:ok, _transaction} ->
        IO.puts("[Stripe Webhook] Transaction created and credits added for user #{user_id}")

        # Record affiliate credit pack commission
        user_id_int = if is_binary(user_id), do: String.to_integer(user_id), else: user_id

        credit_amount =
          parse_decimal(amount_usd) ||
            Decimal.div(Decimal.new(amount_total || 0), Decimal.new(100))

        case Affiliates.record_credit_pack_commission(user_id_int, credit_amount) do
          {:ok, _} ->
            IO.puts(
              "[Stripe Webhook] Recorded affiliate credit pack commission for user #{user_id}"
            )

          _ ->
            :ok
        end

      {:error, :already_processed} ->
        IO.puts("[Stripe Webhook] Transaction already processed for session #{session_id}")

      {:error, reason} ->
        IO.puts("[Stripe Webhook] Failed to create transaction: #{inspect(reason)}")
    end
  end

  defp handle_org_stripe_payment(
         organization_id,
         user_id,
         pack_type,
         hours,
         amount_usd,
         amount_total,
         session_id,
         payment_intent,
         promo_code_id
       ) do
    # Add credits to organization pool with transaction record
    org_id =
      if is_binary(organization_id), do: String.to_integer(organization_id), else: organization_id

    user_id_int = if is_binary(user_id), do: String.to_integer(user_id), else: user_id
    hours_int = if is_binary(hours), do: String.to_integer(hours), else: hours
    amount = parse_decimal(amount_usd) || Decimal.div(Decimal.new(amount_total || 0), 100)

    IO.puts("[Stripe Webhook] Adding #{hours_int} hours to organization #{org_id} pool")

    case Organizations.create_org_credit_transaction_and_add_credits(
           org_id,
           user_id_int,
           pack_type,
           hours_int,
           amount,
           # No SOL amount for Stripe
           nil,
           # No SOL rate for Stripe
           nil,
           # Use session ID as unique identifier
           "stripe_#{session_id}",
           "stripe",
           stripe_session_id: session_id,
           stripe_payment_intent_id: payment_intent
         ) do
      {:ok, %{transaction: _transaction, org_credit: _org_credit}} ->
        IO.puts(
          "[Stripe Webhook] Successfully added #{hours_int} hours to organization #{org_id} with transaction record"
        )

        # Record promo code redemption if present
        if promo_code_id do
          PromoCodes.create_org_redemption(promo_code_id, org_id, user_id_int)
          IO.puts("[Stripe Webhook] Recorded promo code redemption for org #{org_id}")
        end

      {:error, :already_processed} ->
        IO.puts("[Stripe Webhook] Transaction already processed for session #{session_id}")

      {:error, reason} ->
        IO.puts("[Stripe Webhook] Failed to add org credits: #{inspect(reason)}")
    end
  end

  defp handle_org_subscription_checkout(
         organization_id,
         user_id,
         subscription_tier,
         stripe_subscription_id,
         stripe_customer_id,
         promo_code_id
       ) do
    org_id =
      if is_binary(organization_id), do: String.to_integer(organization_id), else: organization_id

    user_id_int = if is_binary(user_id), do: String.to_integer(user_id), else: user_id

    IO.puts(
      "[Stripe Webhook] Creating organization subscription: org #{org_id}, tier: #{subscription_tier}"
    )

    case ClippsterServer.OrganizationSubscriptions.create_stripe_subscription(
           org_id,
           subscription_tier,
           stripe_subscription_id,
           stripe_customer_id
         ) do
      {:ok, _result} ->
        IO.puts("[Stripe Webhook] Successfully created org subscription for org #{org_id}")

        # Record promo code redemption if present
        if promo_code_id do
          PromoCodes.create_org_redemption(promo_code_id, org_id, user_id_int, %{
            subscription_id: stripe_subscription_id,
            customer_id: stripe_customer_id
          })

          IO.puts("[Stripe Webhook] Recorded promo code redemption for org #{org_id}")
        end

      {:error, reason} ->
        IO.puts("[Stripe Webhook] Failed to create org subscription: #{inspect(reason)}")
    end
  end

  defp handle_org_setup_checkout(organization_id, stripe_subscription_id, stripe_customer_id) do
    org_id =
      if is_binary(organization_id), do: String.to_integer(organization_id), else: organization_id

    IO.puts("[Stripe Webhook] Completing org setup payment for org #{org_id}")

    alias ClippsterServer.Organizations.Organization
    alias ClippsterServer.Repo

    case Repo.get(Organization, org_id) do
      nil ->
        IO.puts("[Stripe Webhook] Org not found for setup checkout: #{org_id}")

      org ->
        case org
             |> Organization.subscription_changeset(%{
               setup_completed: true,
               stripe_subscription_id: stripe_subscription_id,
               stripe_customer_id: stripe_customer_id,
               subscription_renewal_method: "stripe"
             })
             |> Repo.update() do
          {:ok, _updated} ->
            IO.puts("[Stripe Webhook] Org #{org_id} setup completed, Stripe sub linked")

          {:error, reason} ->
            IO.puts("[Stripe Webhook] Failed to complete org setup: #{inspect(reason)}")
        end
    end
  end

  defp handle_org_addon_checkout(
         organization_id,
         user_id,
         addon_tier,
         stripe_subscription_id,
         promo_code_id
       ) do
    org_id =
      if is_binary(organization_id), do: String.to_integer(organization_id), else: organization_id

    user_id_int = if is_binary(user_id), do: String.to_integer(user_id), else: user_id

    IO.puts("[Stripe Webhook] Adding org addon: org #{org_id}, addon: #{addon_tier}")

    case ClippsterServer.OrganizationSubscriptions.add_addon_stripe(
           org_id,
           addon_tier,
           stripe_subscription_id
         ) do
      {:ok, _result} ->
        IO.puts("[Stripe Webhook] Successfully added addon #{addon_tier} to org #{org_id}")

        # Record promo code redemption if present
        if promo_code_id do
          PromoCodes.create_org_redemption(promo_code_id, org_id, user_id_int, %{
            subscription_id: stripe_subscription_id
          })

          IO.puts("[Stripe Webhook] Recorded promo code redemption for org #{org_id}")
        end

      {:error, reason} ->
        IO.puts("[Stripe Webhook] Failed to add org addon: #{inspect(reason)}")
    end
  end

  # Map subscription tier to approximate USD amount for commission calculation
  defp get_subscription_amount("starter"), do: Decimal.new("29.99")
  defp get_subscription_amount("creator"), do: Decimal.new("54.99")
  defp get_subscription_amount("pro"), do: Decimal.new("204.99")
  defp get_subscription_amount(_), do: Decimal.new("0")

  # Safely access a field from either a Stripe struct (dot notation) or a plain map (bracket access).
  # Stripe structs do NOT implement the Access behaviour, so obj["key"] crashes.
  defp safe_get(obj, key) when is_struct(obj) do
    atom_key = if is_binary(key), do: String.to_existing_atom(key), else: key
    Map.get(obj, atom_key)
  rescue
    ArgumentError -> nil
  end

  defp safe_get(obj, key) when is_map(obj) do
    case Map.get(obj, key) do
      nil when is_binary(key) ->
        try do
          Map.get(obj, String.to_existing_atom(key))
        rescue
          ArgumentError -> nil
        end
      val -> val
    end
  end

  defp safe_get(_, _), do: nil

  defp get_metadata_value(metadata, key) when is_map(metadata) do
    # Handle both string and atom keys
    Map.get(metadata, key) || Map.get(metadata, String.to_atom(key))
  end

  defp parse_decimal(nil), do: nil

  defp parse_decimal(value) when is_binary(value) do
    case Decimal.parse(value) do
      {decimal, _} -> decimal
      :error -> nil
    end
  end

  defp parse_decimal(value) when is_number(value), do: Decimal.new(to_string(value))

  # Helper functions (similar to PaymentController)

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

  defp get_organization(org_id) do
    org_id = if is_binary(org_id), do: String.to_integer(org_id), else: org_id

    case Organizations.get_organization(org_id) do
      nil -> {:error, :organization_not_found}
      org -> {:ok, org}
    end
  end

  defp validate_pack_type(pack_type) do
    case Credits.get_pack_info(pack_type) do
      nil -> {:error, :invalid_pack}
      pack_info -> {:ok, pack_info}
    end
  end

  defp validate_tier_pack_access(user, pack_type) do
    # Basic tier can only purchase large pack
    if user.subscription_tier == "basic" && pack_type != "large" do
      {:error, :tier_restriction}
    else
      {:ok, :allowed}
    end
  end
end
