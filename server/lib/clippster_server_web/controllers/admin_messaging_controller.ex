defmodule ClippsterServerWeb.AdminMessagingController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.AdminMessaging

  @doc """
  POST /api/admin/messaging/preview
  Resolves a campaign audience and returns deliverable counts.
  """
  def preview_campaign(conn, params) do
    case AdminMessaging.preview_campaign(params) do
      {:ok, preview} ->
        json(conn, Map.put(preview, :success, true))

      {:error, reason} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: reason})
    end
  end

  @doc """
  POST /api/admin/messaging/test
  Sends a test email to one address without creating a campaign.
  """
  def send_test_campaign(conn, params) do
    user_id = conn.assigns.current_user.id

    case AdminMessaging.send_test_campaign(params, user_id) do
      {:ok, recipient} ->
        json(conn, %{
          success: true,
          message: "Test email sent to #{recipient}"
        })

      {:error, reason} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: inspect_reason(reason)})
    end
  end

  @doc """
  POST /api/admin/messaging/send
  Sends a bulk email campaign.
  """
  def send_campaign(conn, params) do
    user_id = conn.assigns.current_user.id

    case AdminMessaging.send_campaign(params, user_id) do
      {:ok, campaign, stats} ->
        json(conn, %{
          success: true,
          message:
            "Campaign sent to #{stats.sent_count} recipient(s)" <>
              failed_message(stats.failed_count),
          campaign: serialize_campaign(campaign)
        })

      {:error, reason} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: inspect_reason(reason)})
    end
  end

  @doc """
  POST /api/admin/messaging/campaigns/:id/retry-failed
  Retries only failed recipients for an existing campaign.
  """
  def retry_failed_campaign(conn, %{"id" => id}) do
    case AdminMessaging.retry_failed_recipients(id) do
      {:ok, campaign, stats} ->
        json(conn, %{
          success: true,
          message:
            "Retried #{stats.sent_count} failed recipient(s)" <>
              failed_message(stats.failed_count),
          campaign: serialize_campaign(campaign)
        })

      {:error, reason} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: inspect_reason(reason)})
    end
  end

  @doc """
  GET /api/admin/messaging/campaigns
  Lists all sent campaigns.
  """
  def list_campaigns(conn, _params) do
    campaigns = AdminMessaging.list_campaigns()

    json(conn, %{
      campaigns: Enum.map(campaigns, &serialize_campaign/1)
    })
  end

  @doc """
  GET /email/unsubscribe/:token
  POST /api/email/unsubscribe/:token
  Suppresses a marketing email address from future campaigns.
  """
  def unsubscribe(conn, %{"token" => token}) do
    case AdminMessaging.unsubscribe_with_token(token) do
      {:ok, suppression} ->
        if html_request?(conn) do
          html(conn, unsubscribe_html(suppression.email))
        else
          json(conn, %{success: true, message: "Unsubscribed", email: suppression.email})
        end

      {:error, _reason} ->
        conn = put_status(conn, :bad_request)

        if html_request?(conn) do
          html(conn, unsubscribe_error_html())
        else
          json(conn, %{success: false, error: "Invalid or expired unsubscribe link"})
        end
    end
  end

  defp serialize_campaign(campaign) do
    %{
      id: campaign.id,
      subject: campaign.subject,
      body: campaign.body,
      preheader: campaign.preheader,
      audience: campaign.audience,
      target_email: campaign.target_email,
      recipient_count: campaign.recipient_count,
      sent_count: campaign.sent_count,
      failed_count: campaign.failed_count,
      suppressed_count: campaign.suppressed_count,
      status: campaign.status,
      sent_at: campaign.sent_at,
      inserted_at: campaign.inserted_at
    }
  end

  defp failed_message(0), do: ""
  defp failed_message(count), do: " (#{count} failed)"

  defp inspect_reason(reason) when is_binary(reason), do: reason
  defp inspect_reason(%Ecto.Changeset{} = changeset), do: inspect(changeset.errors)
  defp inspect_reason(reason), do: inspect(reason)

  defp html_request?(conn) do
    get_req_header(conn, "accept")
    |> Enum.any?(&String.contains?(&1, "text/html"))
  end

  defp unsubscribe_html(email) do
    safe_email = html_escape(email)

    """
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Unsubscribed</title>
      </head>
      <body style="margin:0;background:#0b0c0f;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
          <section style="max-width:460px;background:#14161b;border:1px solid #2b3038;border-radius:14px;padding:32px;">
            <p style="margin:0 0 8px;color:#67e8f9;font-size:13px;font-weight:700;">Clippster</p>
            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;">You're unsubscribed</h1>
            <p style="margin:0;color:#aeb7c6;line-height:1.6;">#{safe_email} will no longer receive marketing email blasts from Clippster.</p>
          </section>
        </main>
      </body>
    </html>
    """
  end

  defp unsubscribe_error_html do
    """
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Invalid unsubscribe link</title>
      </head>
      <body style="margin:0;background:#0b0c0f;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
          <section style="max-width:460px;background:#14161b;border:1px solid #2b3038;border-radius:14px;padding:32px;">
            <p style="margin:0 0 8px;color:#67e8f9;font-size:13px;font-weight:700;">Clippster</p>
            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;">This link is no longer valid</h1>
            <p style="margin:0;color:#aeb7c6;line-height:1.6;">Please contact support@clippster.app and we'll help remove you from future email blasts.</p>
          </section>
        </main>
      </body>
    </html>
    """
  end

  defp html_escape(value) do
    value
    |> to_string()
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&#39;")
  end
end
