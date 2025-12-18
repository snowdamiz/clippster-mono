defmodule ClippsterServerWeb.StripeController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Credits
  alias ClippsterServer.Accounts
  alias ClippsterServer.Organizations

  @doc """
  Creates a Stripe Checkout session for purchasing a credit pack.
  The user must be authenticated and provide a valid pack_type.
  """
  def create_checkout_session(conn, %{"pack_type" => pack_type}) do
    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, user} <- get_user(user_id),
         {:ok, pack_info} <- validate_pack_type(pack_type) do
      
      # Get Stripe configuration
      stripe_config = Application.get_env(:clippster_server, :stripe)
      success_url = stripe_config[:success_url] || "http://localhost:48276/stripe-success"
      cancel_url = stripe_config[:cancel_url] || "http://localhost:48276/stripe-cancel"

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
                description: "#{pack_info.hours} hours of video processing credits"
              },
              unit_amount: trunc(pack_info.usd * 100)  # Stripe expects cents
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
        success_url: "#{success_url}?session_id={CHECKOUT_SESSION_ID}",
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
    end
  end

  @doc """
  Creates a Stripe Checkout session for purchasing credits for an organization.
  Only organization admins can purchase credits for the org pool.
  """
  def create_org_checkout_session(conn, %{"organization_id" => org_id, "pack_type" => pack_type}) do
    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, user} <- get_user(user_id),
         {:ok, _org} <- get_organization(org_id),
         true <- Organizations.is_admin?(org_id, user_id),
         {:ok, pack_info} <- validate_pack_type(pack_type) do
      
      # Get Stripe configuration
      stripe_config = Application.get_env(:clippster_server, :stripe)
      success_url = stripe_config[:success_url] || "http://localhost:48276/stripe-success"
      cancel_url = stripe_config[:cancel_url] || "http://localhost:48276/stripe-cancel"

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
                description: "#{pack_info.hours} hours of video processing credits for your organization"
              },
              unit_amount: trunc(pack_info.usd * 100)  # Stripe expects cents
            },
            quantity: 1
          }
        ],
        metadata: %{
          user_id: to_string(user_id),
          organization_id: to_string(org_id),  # Key addition for org purchases
          pack_type: pack_type,
          hours: to_string(pack_info.hours),
          amount_usd: to_string(pack_info.usd)
        },
        customer_email: user.email,
        success_url: "#{success_url}?session_id={CHECKOUT_SESSION_ID}&org=#{org_id}",
        cancel_url: "#{cancel_url}?org=#{org_id}"
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

  defp verify_and_construct_event(payload, signature, webhook_secret) when is_binary(webhook_secret) and byte_size(webhook_secret) > 0 do
    case Stripe.Webhook.construct_event(payload, signature, webhook_secret) do
      {:ok, event} -> {:ok, event}
      {:error, reason} -> {:error, reason}
    end
  end

  defp verify_and_construct_event(payload, _signature, _webhook_secret) do
    # In development without webhook secret, just decode the event
    case Jason.decode(payload) do
      {:ok, event} -> {:ok, struct_from_map(event)}
      {:error, _} -> {:error, :invalid_payload}
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
    
    metadata = session["metadata"] || session.metadata || %{}
    user_id = get_metadata_value(metadata, "user_id")
    organization_id = get_metadata_value(metadata, "organization_id")
    pack_type = get_metadata_value(metadata, "pack_type")
    hours = get_metadata_value(metadata, "hours")
    amount_usd = get_metadata_value(metadata, "amount_usd")
    
    session_id = session["id"] || session.id
    payment_intent = session["payment_intent"] || Map.get(session, :payment_intent)
    amount_total = session["amount_total"] || Map.get(session, :amount_total)

    IO.puts("[Stripe Webhook] User ID: #{user_id}, Org ID: #{organization_id}, Pack: #{pack_type}, Hours: #{hours}")

    if user_id && pack_type && hours do
      # Check if this is an organization purchase
      if organization_id do
        # Add credits to organization pool with transaction record
        handle_org_stripe_payment(organization_id, user_id, pack_type, hours, amount_usd, amount_total, session_id, payment_intent)
      else
        # Add credits to personal user balance (original flow)
        handle_personal_stripe_payment(user_id, pack_type, hours, amount_usd, amount_total, session_id, payment_intent)
      end
    else
      IO.puts("[Stripe Webhook] Missing required metadata: user_id=#{user_id}, pack_type=#{pack_type}, hours=#{hours}")
    end
  end

  defp handle_event(%{type: event_type}) do
    IO.puts("[Stripe Webhook] Unhandled event type: #{event_type}")
  end

  defp handle_event(_), do: :ok

  defp handle_personal_stripe_payment(user_id, pack_type, hours, amount_usd, amount_total, session_id, payment_intent) do
    # Create and confirm the transaction for personal credits
    attrs = %{
      user_id: String.to_integer(user_id),
      pack_type: pack_type,
      hours_purchased: String.to_integer(hours),
      amount_usd: parse_decimal(amount_usd) || Decimal.div(Decimal.new(amount_total || 0), 100),
      amount_sol: Decimal.new("0"),  # No SOL for Stripe payments
      sol_usd_rate: Decimal.new("0"),  # N/A for Stripe
      tx_signature: "stripe_#{session_id}",  # Use session ID as unique identifier
      payment_method: "stripe",
      stripe_session_id: session_id,
      stripe_payment_intent_id: payment_intent,
      status: "confirmed"  # Stripe webhook means payment is already confirmed
    }

    case Credits.create_stripe_transaction(attrs) do
      {:ok, _transaction} ->
        IO.puts("[Stripe Webhook] Transaction created and credits added for user #{user_id}")

      {:error, :already_processed} ->
        IO.puts("[Stripe Webhook] Transaction already processed for session #{session_id}")

      {:error, reason} ->
        IO.puts("[Stripe Webhook] Failed to create transaction: #{inspect(reason)}")
    end
  end

  defp handle_org_stripe_payment(organization_id, user_id, pack_type, hours, amount_usd, amount_total, session_id, payment_intent) do
    # Add credits to organization pool with transaction record
    org_id = if is_binary(organization_id), do: String.to_integer(organization_id), else: organization_id
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
      nil,  # No SOL amount for Stripe
      nil,  # No SOL rate for Stripe
      "stripe_#{session_id}",  # Use session ID as unique identifier
      "stripe",
      stripe_session_id: session_id,
      stripe_payment_intent_id: payment_intent
    ) do
      {:ok, %{transaction: _transaction, org_credit: _org_credit}} ->
        IO.puts("[Stripe Webhook] Successfully added #{hours_int} hours to organization #{org_id} with transaction record")

      {:error, :already_processed} ->
        IO.puts("[Stripe Webhook] Transaction already processed for session #{session_id}")

      {:error, reason} ->
        IO.puts("[Stripe Webhook] Failed to add org credits: #{inspect(reason)}")
    end
  end

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
end

