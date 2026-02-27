defmodule ClippsterServer.Social.PostForMe.Webhooks do
  @moduledoc """
  Post for Me webhook management and verification.

  Handles registering webhooks and verifying incoming webhook payloads.
  """

  require Logger

  alias ClippsterServer.Social.PostForMe.Client

  @doc """
  Registers a webhook endpoint with Post for Me.

  ## Parameters
    - url: The webhook URL (e.g., "https://api.clippster.app/api/postforme/webhook")
    - events: List of events to subscribe to, or ["*"] for all

  ## Returns
    - {:ok, webhook_data}
    - {:error, reason}
  """
  def register_webhook(url, events \\ ["*"]) do
    body = %{
      "url" => url,
      "events" => events
    }

    Client.post("/v1/webhooks", body)
  end

  @doc """
  Lists all registered webhooks.
  """
  def list_webhooks do
    Client.get("/v1/webhooks")
  end

  @doc """
  Gets a single webhook by ID.
  """
  def get_webhook(webhook_id) do
    Client.get("/v1/webhooks/#{webhook_id}")
  end

  @doc """
  Updates a webhook (e.g., change URL or events).
  """
  def update_webhook(webhook_id, attrs) do
    Client.patch("/v1/webhooks/#{webhook_id}", attrs)
  end

  @doc """
  Deletes a webhook.
  """
  def delete_webhook(webhook_id) do
    Client.delete("/v1/webhooks/#{webhook_id}")
  end

  @doc """
  Verifies a webhook payload using the webhook secret.

  Post for Me sends a `Post-For-Me-Webhook-Secret` header
  that should match our configured secret.

  ## Parameters
    - received_secret: The value from the Post-For-Me-Webhook-Secret header
    - expected_secret: Our configured webhook secret (defaults to config)

  ## Returns
    - :ok if valid
    - {:error, :invalid_signature} if not
  """
  def verify_signature(received_secret, expected_secret \\ nil) do
    secret = expected_secret || Client.webhook_secret()

    cond do
      is_nil(secret) or secret == "" ->
        Logger.warning("[PostForMe.Webhooks] Webhook secret not configured, skipping verification")
        :ok

      is_nil(received_secret) ->
        {:error, :missing_signature}

      Plug.Crypto.secure_compare(received_secret, secret) ->
        :ok

      true ->
        {:error, :invalid_signature}
    end
  end
end
