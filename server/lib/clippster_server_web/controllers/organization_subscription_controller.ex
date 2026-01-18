defmodule ClippsterServerWeb.OrganizationSubscriptionController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.OrganizationSubscriptions
  alias ClippsterServer.Organizations
  alias ClippsterServer.Accounts

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
  """
  def checkout(conn, %{"id" => organization_id, "tier" => tier}) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)

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
        _org = Organizations.get_organization(organization_id)
        user = Accounts.get_user(user_id)

        # Create Stripe checkout session
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

  @doc """
  POST /organizations/:id/subscription/addons/checkout
  Creates a Stripe checkout session for an add-on.
  """
  def addon_checkout(conn, %{"id" => organization_id, "addon_tier" => addon_tier}) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)

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
          user = Accounts.get_user(user_id)
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
  """
  def crypto_quote(conn, %{"id" => organization_id, "tier" => tier, "type" => type}) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)

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
        # Get current SOL/USD rate
        sol_usd_rate = get_sol_usd_rate()
        amount_sol = tier_info.usd / sol_usd_rate
        company_wallet = Application.get_env(:clippster_server, :company_wallet_address)

        conn
        |> json(%{
          success: true,
          quote: %{
            amount_usd: tier_info.usd,
            amount_sol: amount_sol,
            sol_usd_rate: sol_usd_rate,
            company_wallet: company_wallet
          }
        })
      end
    end
  end

  @doc """
  POST /organizations/:id/subscription/crypto-confirm
  Confirms a crypto payment for a subscription.
  """
  def crypto_confirm(conn, %{
        "id" => organization_id,
        "tier" => tier,
        "type" => type,
        "tx_signature" => tx_signature
      }) do
    user_id = conn.assigns[:current_user_id]
    org_id = String.to_integer(organization_id)

    unless Organizations.is_admin?(org_id, user_id) do
      conn
      |> put_status(:forbidden)
      |> json(%{success: false, error: "Admin access required"})
    else
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
        {:ok, _data} ->
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
