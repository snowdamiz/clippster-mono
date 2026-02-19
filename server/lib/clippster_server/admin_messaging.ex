defmodule ClippsterServer.AdminMessaging do
  @moduledoc """
  Context for admin bulk email messaging.
  """
  import Ecto.Query

  alias ClippsterServer.Repo
  alias ClippsterServer.AdminMessaging.EmailCampaign
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Waitlist.WaitlistEntry
  alias ClippsterServer.Emails
  alias ClippsterServer.Mailer

  @doc """
  Returns all campaigns ordered by most recent.
  """
  def list_campaigns do
    Repo.all(
      from c in EmailCampaign,
        order_by: [desc: c.inserted_at],
        preload: [:sender]
    )
  end

  @doc """
  Sends a broadcast email campaign.
  attrs: %{subject, body, audience, target_email (if individual)}
  user_id: admin user sending the campaign
  """
  def send_campaign(attrs, user_id) do
    subject = Map.get(attrs, "subject", "")
    body = Map.get(attrs, "body", "")
    audience = Map.get(attrs, "audience", "")
    target_email = Map.get(attrs, "target_email")

    with {:ok, recipients} <- resolve_recipients(audience, target_email),
         {:ok, campaign} <- create_campaign_record(attrs, user_id, length(recipients), "sent") do
      deliver_emails(recipients, subject, body)
      {:ok, campaign, length(recipients)}
    else
      {:error, reason} ->
        create_campaign_record(attrs, user_id, 0, "failed")
        {:error, reason}
    end
  end

  defp resolve_recipients("waitlist", _target_email) do
    emails =
      Repo.all(from w in WaitlistEntry, select: w.email)

    {:ok, emails}
  end

  defp resolve_recipients("all_users", _target_email) do
    emails =
      Repo.all(
        from u in User,
          where: not is_nil(u.email),
          select: u.email
      )

    {:ok, emails}
  end

  defp resolve_recipients("individual", target_email) when is_binary(target_email) and target_email != "" do
    {:ok, [target_email]}
  end

  defp resolve_recipients("individual", _) do
    {:error, "target_email is required for individual audience"}
  end

  defp resolve_recipients(audience, _) do
    {:error, "Invalid audience: #{audience}"}
  end

  defp deliver_emails(recipients, subject, body) do
    emails =
      Enum.map(recipients, fn email ->
        Emails.admin_broadcast_email(email, subject, body)
      end)

    Mailer.deliver_many(emails)
  end

  defp create_campaign_record(attrs, user_id, recipient_count, status) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    %EmailCampaign{}
    |> EmailCampaign.changeset(
      Map.merge(attrs, %{
        "sent_by" => user_id,
        "sent_at" => now,
        "recipient_count" => recipient_count,
        "status" => status
      })
    )
    |> Repo.insert()
  end
end
