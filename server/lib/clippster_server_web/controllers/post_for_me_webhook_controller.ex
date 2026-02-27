defmodule ClippsterServerWeb.PostForMeWebhookController do
  @moduledoc """
  Handles incoming webhooks from Post for Me.

  Events handled:
  - social.post.result.created: A post has been published (or failed) on a platform
  - social.post.created/updated/deleted: Post lifecycle events
  - social.account.created/updated: Account status changes

  Webhook verification uses the `Post-For-Me-Webhook-Secret` header.
  """

  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.Social
  alias ClippsterServer.Social.PostForMe.Webhooks

  @doc """
  POST /api/postforme/webhook

  Receives and processes webhook events from Post for Me.
  """
  def handle(conn, params) do
    # Verify webhook signature
    received_secret = get_req_header(conn, "post-for-me-webhook-secret") |> List.first()

    case Webhooks.verify_signature(received_secret) do
      :ok ->
        process_event(conn, params)

      {:error, reason} ->
        Logger.warning("[PostForMe.Webhook] Signature verification failed: #{inspect(reason)}")
        conn
        |> put_status(401)
        |> json(%{error: "Invalid webhook signature"})
    end
  end

  # ============================================================================
  # Event Processing
  # ============================================================================

  defp process_event(conn, %{"event" => event_type} = payload) do
    Logger.info("[PostForMe.Webhook] Received event: #{event_type}")

    pulse_capture(%{
      type: "pfm_webhook.received",
      level: :info,
      message: "Post for Me webhook: #{event_type}",
      metadata: %{event_type: event_type, payload_keys: Map.keys(payload)},
      tags: %{platform: "post_for_me", action: "webhook_received"}
    })

    case event_type do
      "social.post.result.created" ->
        handle_post_result(conn, payload)

      "social.post.created" ->
        handle_post_lifecycle(conn, "created", payload)

      "social.post.updated" ->
        handle_post_lifecycle(conn, "updated", payload)

      "social.post.deleted" ->
        handle_post_lifecycle(conn, "deleted", payload)

      "social.account.created" ->
        handle_account_event(conn, "created", payload)

      "social.account.updated" ->
        handle_account_event(conn, "updated", payload)

      _ ->
        Logger.info("[PostForMe.Webhook] Unhandled event type: #{event_type}")
        conn |> put_status(200) |> json(%{status: "ignored", event: event_type})
    end
  end

  defp process_event(conn, params) do
    Logger.warning("[PostForMe.Webhook] Missing event type in payload: #{inspect(Map.keys(params))}")
    conn |> put_status(200) |> json(%{status: "ok"})
  end

  # ============================================================================
  # Post Result Handler
  # ============================================================================

  defp handle_post_result(conn, payload) do
    data = payload["data"] || %{}
    pfm_post_id = data["social_post_id"] || data["post_id"]
    status = data["status"]
    platform_post_id = data["platform_post_id"] || data["external_id"]
    platform_post_url = data["platform_post_url"] || data["url"]
    error_message = data["error"] || data["error_message"]

    Logger.info("[PostForMe.Webhook] Post result: pfm_post=#{pfm_post_id}, status=#{status}")

    if pfm_post_id do
      # Find our local post by pfm_post_id
      case Social.get_post_by_pfm_id(pfm_post_id) do
        nil ->
          Logger.warning("[PostForMe.Webhook] No local post found for PFM post #{pfm_post_id}")

        post ->
          case status do
            s when s in ["published", "success", "completed"] ->
              attrs = %{
                post_id: platform_post_id || pfm_post_id,
                post_url: platform_post_url || "",
                posted_at: DateTime.utc_now()
              }
              Social.mark_post_published(post, attrs)
              Logger.info("[PostForMe.Webhook] Marked post #{post.id} as published")

            s when s in ["failed", "error"] ->
              Social.mark_post_failed(post, error_message || "Publishing failed on platform")
              Logger.warning("[PostForMe.Webhook] Marked post #{post.id} as failed: #{error_message}")

            _ ->
              Logger.info("[PostForMe.Webhook] Post #{post.id} result status: #{status}")
          end
      end
    end

    conn |> put_status(200) |> json(%{status: "processed"})
  end

  # ============================================================================
  # Post Lifecycle Handler
  # ============================================================================

  defp handle_post_lifecycle(conn, action, payload) do
    Logger.info("[PostForMe.Webhook] Post #{action}: #{inspect(payload["data"])}")
    # Currently just log - future: sync post status
    conn |> put_status(200) |> json(%{status: "ok", action: action})
  end

  # ============================================================================
  # Account Event Handler
  # ============================================================================

  defp handle_account_event(conn, action, payload) do
    data = payload["data"] || %{}
    pfm_account_id = data["id"] || data["social_account_id"]

    Logger.info("[PostForMe.Webhook] Account #{action}: #{pfm_account_id}")

    if action == "updated" && pfm_account_id do
      # Sync account status if it was deactivated/disconnected
      account_status = data["status"] || data["connection_status"]

      if account_status in ["disconnected", "expired", "revoked"] do
        case Social.get_social_account_by_pfm_id(pfm_account_id) do
          nil -> :ok
          account ->
            Social.update_social_account(account, %{is_active: false})
            Logger.info("[PostForMe.Webhook] Deactivated local account for PFM #{pfm_account_id}")
        end
      end
    end

    conn |> put_status(200) |> json(%{status: "ok", action: action})
  end

  # ============================================================================
  # Helpers
  # ============================================================================

  defp pulse_capture(event) do
    if Code.ensure_loaded?(PulseKit) do
      try do
        PulseKit.capture(event)
      rescue
        _ -> :ok
      end
    end
  end
end
