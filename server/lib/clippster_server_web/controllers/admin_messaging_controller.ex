defmodule ClippsterServerWeb.AdminMessagingController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.AdminMessaging

  @doc """
  POST /api/admin/messaging/send
  Sends a bulk email campaign.
  """
  def send_campaign(conn, params) do
    user_id = conn.assigns.current_user.id

    case AdminMessaging.send_campaign(params, user_id) do
      {:ok, campaign, recipient_count} ->
        json(conn, %{
          success: true,
          message: "Campaign sent to #{recipient_count} recipient(s)",
          campaign: serialize_campaign(campaign)
        })

      {:error, reason} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: reason})
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

  defp serialize_campaign(campaign) do
    %{
      id: campaign.id,
      subject: campaign.subject,
      body: campaign.body,
      audience: campaign.audience,
      target_email: campaign.target_email,
      recipient_count: campaign.recipient_count,
      status: campaign.status,
      sent_at: campaign.sent_at,
      inserted_at: campaign.inserted_at
    }
  end
end
