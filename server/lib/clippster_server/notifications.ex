defmodule ClippsterServer.Notifications do
  @moduledoc """
  Context for managing in-app notifications.
  """
  import Ecto.Query
  alias ClippsterServer.Repo
  alias ClippsterServer.Notifications.Notification

  @doc """
  Create a notification and broadcast it to the user.
  """
  def create_notification(attrs) do
    {:ok, notification} =
      %Notification{}
      |> Notification.create_changeset(attrs)
      |> Repo.insert()

    notification = Repo.preload(notification, :user)
    broadcast_notification(notification)

    {:ok, notification}
  end

  @doc """
  Create a payment verified notification.
  """
  def notify_payment_verified(payment) do
    payment = Repo.preload(payment, [:campaign, :user])

    create_notification(%{
      user_id: payment.user_id,
      type: "payment_verified",
      title: "Payment Received!",
      message: "You received $#{payment.amount} for #{payment.campaign.title}",
      data: %{
        payment_id: payment.id,
        campaign_id: payment.campaign_id,
        amount: Decimal.to_string(payment.amount),
        campaign_title: payment.campaign.title
      },
      action_url: "/earnings"
    })
  end

  @doc """
  Create a submission verified notification.
  """
  def notify_submission_verified(submission) do
    submission = Repo.preload(submission, [:campaign, :user])

    create_notification(%{
      user_id: submission.user_id,
      type: "submission_verified",
      title: "Clip Verified!",
      message: "Your clip for #{submission.campaign.title} was approved",
      data: %{
        submission_id: submission.id,
        campaign_id: submission.campaign_id,
        campaign_title: submission.campaign.title
      },
      action_url: "/campaigns/#{submission.campaign_id}"
    })
  end

  @doc """
  Create a submission rejected notification.
  """
  def notify_submission_rejected(submission, reason) do
    submission = Repo.preload(submission, [:campaign, :user])

    create_notification(%{
      user_id: submission.user_id,
      type: "submission_rejected",
      title: "Clip Rejected",
      message: "Your clip for #{submission.campaign.title} was rejected",
      data: %{
        submission_id: submission.id,
        campaign_id: submission.campaign_id,
        campaign_title: submission.campaign.title,
        reason: reason
      },
      action_url: "/campaigns/#{submission.campaign_id}"
    })
  end

  @doc """
  Create a campaign approved notification.
  """
  def notify_campaign_approved(participant) do
    participant = Repo.preload(participant, [:campaign, :user])

    create_notification(%{
      user_id: participant.user_id,
      type: "campaign_approved",
      title: "Campaign Application Approved!",
      message: "You've been approved for #{participant.campaign.title}",
      data: %{
        campaign_id: participant.campaign_id,
        campaign_title: participant.campaign.title
      },
      action_url: "/campaigns/#{participant.campaign_id}"
    })
  end

  @doc """
  Create a campaign rejected notification.
  """
  def notify_campaign_rejected(participant) do
    participant = Repo.preload(participant, [:campaign, :user])

    create_notification(%{
      user_id: participant.user_id,
      type: "campaign_rejected",
      title: "Campaign Application Rejected",
      message: "Your application for #{participant.campaign.title} was not approved",
      data: %{
        campaign_id: participant.campaign_id,
        campaign_title: participant.campaign.title
      },
      action_url: "/campaigns"
    })
  end

  @doc """
  List notifications for a user.
  """
  def list_user_notifications(user_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    unread_only = Keyword.get(opts, :unread_only, false)

    query =
      from n in Notification,
        where: n.user_id == ^user_id,
        order_by: [desc: n.inserted_at],
        limit: ^limit

    query =
      if unread_only do
        from n in query, where: is_nil(n.read_at)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Get unread notification count.
  """
  def get_unread_count(user_id) do
    from(n in Notification,
      where: n.user_id == ^user_id,
      where: is_nil(n.read_at),
      select: count(n.id)
    )
    |> Repo.one()
  end

  @doc """
  Mark notification as read.
  """
  def mark_as_read(notification_id, user_id) do
    notification =
      from(n in Notification,
        where: n.id == ^notification_id,
        where: n.user_id == ^user_id
      )
      |> Repo.one()

    if notification do
      notification
      |> Notification.mark_read_changeset()
      |> Repo.update()
    else
      {:error, :not_found}
    end
  end

  @doc """
  Mark all notifications as read.
  """
  def mark_all_as_read(user_id) do
    from(n in Notification,
      where: n.user_id == ^user_id,
      where: is_nil(n.read_at)
    )
    |> Repo.update_all(set: [read_at: DateTime.utc_now() |> DateTime.truncate(:second)])
  end

  @doc """
  Delete old read notifications (cleanup job).
  """
  def delete_old_notifications(days_old \\ 30) do
    cutoff = DateTime.utc_now() |> DateTime.add(-days_old * 24 * 60 * 60, :second)

    from(n in Notification,
      where: not is_nil(n.read_at),
      where: n.read_at < ^cutoff
    )
    |> Repo.delete_all()
  end

  # Private

  defp broadcast_notification(notification) do
    ClippsterServerWeb.Endpoint.broadcast(
      "messaging:user:#{notification.user_id}",
      "notification",
      %{
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        action_url: notification.action_url,
        inserted_at: notification.inserted_at
      }
    )
  end
end
