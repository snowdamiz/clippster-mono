defmodule ClippsterServerWeb.LemonSqueezyController do
  @moduledoc """
  Controller for LemonSqueezy payment integration.
  Handles checkout session creation and webhook processing.
  """
  use ClippsterServerWeb, :controller
  alias ClippsterServer.LemonSqueezy
  alias ClippsterServer.Subscriptions
  alias ClippsterServer.OrganizationSubscriptions
  alias ClippsterServer.PromoCodes

  require Logger

  # ============================================================================
  # Checkout
  # ============================================================================

  @doc """
  Creates a LemonSqueezy checkout session for a subscription.
  Called when the payment provider is set to "lemonsqueezy".
  """
  def create_checkout(conn, %{"tier" => tier} = params) do
    user = conn.assigns.current_user

    unless LemonSqueezy.configured?() do
      conn
      |> put_status(:service_unavailable)
      |> json(%{success: false, error: "LemonSqueezy is not configured"})
    else
      # Validate promo code if provided
      promo_code = Map.get(params, "promo_code")
      opts = []

      opts =
        if promo_code do
          case PromoCodes.validate_promo(promo_code, tier, user.id) do
            {:ok, promo} ->
              Keyword.put(opts, :discount_code, promo.code)
            {:error, _reason} ->
              opts
          end
        else
          opts
        end

      case LemonSqueezy.create_checkout(user.id, tier, opts) do
        {:ok, %{url: url}} ->
          json(conn, %{success: true, url: url})

        {:error, :no_variant_configured} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{success: false, error: "Subscription tier not configured for LemonSqueezy"})

        {:error, reason} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{success: false, error: "Failed to create checkout: #{inspect(reason)}"})
      end
    end
  end

  # ============================================================================
  # Webhooks
  # ============================================================================

  @doc """
  Handles LemonSqueezy webhook events.
  Processes subscription_created and subscription_payment_success events.
  """
  def webhook(conn, _params) do
    raw_body = conn.assigns[:raw_body] || ""
    signature = get_req_header(conn, "x-signature") |> List.first() || ""
    event_name = get_req_header(conn, "x-event-name") |> List.first() || ""

    unless LemonSqueezy.verify_webhook_signature(raw_body, signature) do
      Logger.warning("[LemonSqueezy] Invalid webhook signature")
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Invalid signature"})
    else
      Logger.info("[LemonSqueezy] Processing webhook event: #{event_name}")
      handle_webhook_event(conn, event_name, Jason.decode!(raw_body))
    end
  end

  defp handle_webhook_event(conn, "subscription_created", payload) do
    with %{"data" => %{"id" => ls_subscription_id}} <- payload,
         %{"meta" => %{"custom_data" => custom_data}} <- payload do

      organization_id = Map.get(custom_data, "organization_id")
      tier = Map.get(custom_data, "tier")
      subscription_type = Map.get(custom_data, "subscription_type")

      cond do
        # Organization base subscription
        organization_id && subscription_type == "base" && tier ->
          org_id = parse_id(organization_id)

          case OrganizationSubscriptions.create_lemonsqueezy_subscription(
            org_id,
            tier,
            to_string(ls_subscription_id)
          ) do
            {:ok, _result} ->
              Logger.info("[LemonSqueezy] Created org subscription for org #{org_id}, tier: #{tier}")
              json(conn, %{success: true})

            {:error, reason} ->
              Logger.error("[LemonSqueezy] Failed to create org subscription: #{inspect(reason)}")
              conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to create org subscription"})
          end

        # Organization add-on subscription
        organization_id && subscription_type == "addon" && tier ->
          org_id = parse_id(organization_id)

          case OrganizationSubscriptions.add_addon_lemonsqueezy(
            org_id,
            tier,
            to_string(ls_subscription_id)
          ) do
            {:ok, _result} ->
              Logger.info("[LemonSqueezy] Created org addon #{tier} for org #{org_id}")
              json(conn, %{success: true})

            {:error, reason} ->
              Logger.error("[LemonSqueezy] Failed to create org addon: #{inspect(reason)}")
              conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to create addon"})
          end

        # User subscription (original behavior)
        true ->
          user_id_str = Map.get(custom_data, "user_id")
          user_tier = tier

          if user_id_str && user_tier do
            user_id = parse_id(user_id_str)

            case Subscriptions.create_lemonsqueezy_subscription(
              user_id,
              user_tier,
              to_string(ls_subscription_id)
            ) do
              {:ok, _result} ->
                Logger.info("[LemonSqueezy] Created subscription for user #{user_id}, tier: #{user_tier}")
                maybe_track_redemption(custom_data, user_id, ls_subscription_id)
                json(conn, %{success: true})

              {:error, reason} ->
                Logger.error("[LemonSqueezy] Failed to create subscription: #{inspect(reason)}")
                conn |> put_status(:unprocessable_entity) |> json(%{error: "Failed to create subscription"})
            end
          else
            Logger.warning("[LemonSqueezy] Invalid subscription_created payload")
            conn |> put_status(:bad_request) |> json(%{error: "Invalid payload"})
          end
      end
    else
      _ ->
        Logger.warning("[LemonSqueezy] Invalid subscription_created payload")
        conn |> put_status(:bad_request) |> json(%{error: "Invalid payload"})
    end
  end

  defp handle_webhook_event(conn, "subscription_payment_success", payload) do
    with %{"data" => %{"attributes" => %{"subscription_id" => _ls_subscription_id}}} <- payload,
         %{"meta" => %{"custom_data" => custom_data}} <- payload do

      organization_id = Map.get(custom_data, "organization_id")

      if organization_id do
        org_id = parse_id(organization_id)

        case OrganizationSubscriptions.renew_subscription(org_id) do
          {:ok, _result} ->
            Logger.info("[LemonSqueezy] Renewed org subscription for org #{org_id}")
          {:error, reason} ->
            Logger.error("[LemonSqueezy] Failed to renew org subscription: #{inspect(reason)}")
        end
      else
        user_id_str = Map.get(custom_data, "user_id")
        if user_id_str do
          user_id = parse_id(user_id_str)
          case Subscriptions.renew_subscription(user_id) do
            {:ok, _result} ->
              Logger.info("[LemonSqueezy] Renewed subscription for user #{user_id}")
            {:error, reason} ->
              Logger.error("[LemonSqueezy] Failed to renew subscription: #{inspect(reason)}")
          end
        end
      end

      json(conn, %{success: true})
    else
      _ -> json(conn, %{success: true})
    end
  end

  defp handle_webhook_event(conn, "subscription_cancelled", payload) do
    with %{"meta" => %{"custom_data" => custom_data}} <- payload do
      organization_id = Map.get(custom_data, "organization_id")

      if organization_id do
        org_id = parse_id(organization_id)

        case OrganizationSubscriptions.cancel_subscription(org_id) do
          {:ok, _} ->
            Logger.info("[LemonSqueezy] Cancelled org subscription for org #{org_id}")
          {:error, reason} ->
            Logger.warning("[LemonSqueezy] Cancel failed for org #{org_id}: #{inspect(reason)}")
        end
      else
        user_id_str = Map.get(custom_data, "user_id")
        if user_id_str do
          user_id = parse_id(user_id_str)
          case Subscriptions.cancel_subscription(user_id) do
            {:ok, _} ->
              Logger.info("[LemonSqueezy] Cancelled subscription for user #{user_id}")
            {:error, reason} ->
              Logger.warning("[LemonSqueezy] Cancel failed for user #{user_id}: #{inspect(reason)}")
          end
        end
      end

      json(conn, %{success: true})
    else
      _ -> json(conn, %{success: true})
    end
  end

  defp handle_webhook_event(conn, event_name, _payload) do
    Logger.info("[LemonSqueezy] Ignoring unhandled event: #{event_name}")
    json(conn, %{success: true})
  end

  # ============================================================================
  # Helpers
  # ============================================================================

  defp parse_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {parsed, _} -> parsed
      :error -> id
    end
  end
  defp parse_id(id) when is_integer(id), do: id

  defp maybe_track_redemption(%{"promo_code" => code}, user_id, ls_subscription_id) when is_binary(code) do
    case PromoCodes.validate_promo(code, nil, user_id) do
      {:ok, promo} ->
        PromoCodes.create_redemption(promo.id, user_id, %{
          subscription_id: "ls_#{ls_subscription_id}"
        })
      _ -> :ok
    end
  end
  defp maybe_track_redemption(_, _, _), do: :ok
end
