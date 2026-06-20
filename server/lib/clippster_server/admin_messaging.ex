defmodule ClippsterServer.AdminMessaging do
  @moduledoc """
  Context for admin bulk email messaging.
  """
  import Ecto.Query
  require Logger

  alias ClippsterServer.AdminMessaging.{
    EmailCampaign,
    EmailCampaignRecipient,
    EmailAddress,
    EmailSuppression
  }

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Repo
  alias ClippsterServer.Waitlist.WaitlistEntry
  alias ClippsterServer.{Emails, Mailer}

  @send_interval_ms 300
  @rate_limit_retry_delays_ms [1_000, 2_000, 4_000]
  @unsubscribe_salt "email-unsubscribe"
  @unsubscribe_max_age_seconds 60 * 60 * 24 * 365 * 5

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
  Resolves the requested audience without sending anything.
  """
  def preview_campaign(attrs) do
    audience = input(attrs, "audience")
    target_email = input(attrs, "target_email")

    with {:ok, recipients} <- resolve_recipients(audience, target_email) do
      {deliverable, suppressed} = partition_suppressed(recipients)

      {:ok,
       %{
         audience: audience,
         requested_count: length(recipients),
         recipient_count: length(deliverable),
         suppressed_count: length(suppressed),
         sample: Enum.take(deliverable, 3)
       }}
    end
  end

  @doc """
  Sends a single test email without creating a campaign record.
  """
  def send_test_campaign(attrs, _user_id) do
    subject = input(attrs, "subject")
    body = input(attrs, "body")
    preheader = input(attrs, "preheader")
    test_email = input(attrs, "test_email")

    with :ok <- validate_campaign_content(subject, body),
         {:ok, [recipient]} <- resolve_recipients("individual", test_email) do
      case deliver_email(recipient, subject, body, preheader, "individual") do
        :ok -> {:ok, recipient}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  @doc """
  Sends a broadcast email campaign.
  attrs: %{subject, body, preheader, audience, target_email}
  user_id: admin user sending the campaign
  """
  def send_campaign(attrs, user_id) do
    subject = input(attrs, "subject")
    body = input(attrs, "body")
    preheader = input(attrs, "preheader")
    audience = input(attrs, "audience")
    target_email = input(attrs, "target_email")

    with :ok <- validate_campaign_content(subject, body),
         {:ok, recipients} <- resolve_recipients(audience, target_email),
         {deliverable, suppressed} <- partition_suppressed(recipients),
         :ok <- validate_deliverable_recipients(deliverable, suppressed),
         {:ok, campaign} <-
           create_campaign_record(
             attrs,
             user_id,
             length(deliverable),
             length(suppressed),
             "sending"
           ) do
      recipient_records = create_recipient_records!(campaign, deliverable)
      stats = deliver_recipients(recipient_records, campaign, subject, body, preheader)

      case finalize_campaign(campaign) do
        {:ok, updated_campaign} -> {:ok, updated_campaign, stats}
        {:error, changeset} -> {:error, changeset}
      end
    end
  end

  @doc """
  Retries only failed recipients for an existing campaign.
  """
  def retry_failed_recipients(campaign_id) do
    with {:ok, campaign_id} <- parse_campaign_id(campaign_id),
         %EmailCampaign{} = campaign <- Repo.get(EmailCampaign, campaign_id) do
      retry_failed_recipients_for_campaign(campaign)
    else
      _ -> {:error, "Campaign not found"}
    end
  end

  @doc """
  Adds an email to the marketing suppression list.
  """
  def suppress_email(email, attrs \\ %{}) do
    normalized_email = normalize_email(email)

    suppression_attrs = %{
      "email" => normalized_email,
      "reason" => input(attrs, "reason", "unsubscribe"),
      "source" => input(attrs, "source")
    }

    case Repo.get_by(EmailSuppression, email: normalized_email) do
      nil ->
        %EmailSuppression{}
        |> EmailSuppression.changeset(suppression_attrs)
        |> Repo.insert()

      suppression ->
        suppression
        |> EmailSuppression.changeset(suppression_attrs)
        |> Repo.update()
    end
  end

  @doc """
  Verifies an unsubscribe token and suppresses the embedded email.
  """
  def unsubscribe_with_token(token) when is_binary(token) do
    case Phoenix.Token.verify(
           ClippsterServerWeb.Endpoint,
           @unsubscribe_salt,
           token,
           max_age: @unsubscribe_max_age_seconds
         ) do
      {:ok, email} ->
        suppress_email(email, %{"reason" => "unsubscribe", "source" => "unsubscribe_link"})

      {:error, reason} ->
        {:error, reason}
    end
  end

  def unsubscribe_with_token(_), do: {:error, :invalid}

  defp validate_campaign_content(subject, body) do
    cond do
      subject == "" -> {:error, "Subject is required"}
      body == "" -> {:error, "Body is required"}
      true -> :ok
    end
  end

  defp validate_deliverable_recipients([], suppressed) when length(suppressed) > 0 do
    {:error, "All resolved recipients have unsubscribed or are suppressed"}
  end

  defp validate_deliverable_recipients([], _suppressed) do
    {:error, "No recipients found for this audience"}
  end

  defp validate_deliverable_recipients(_deliverable, _suppressed), do: :ok

  defp resolve_recipients("waitlist", _target_email) do
    emails =
      Repo.all(
        from w in WaitlistEntry,
          where: not is_nil(w.email),
          select: w.email
      )

    {:ok, normalize_recipient_emails(emails)}
  end

  defp resolve_recipients("all_users", _target_email) do
    emails =
      Repo.all(
        from u in User,
          where: not is_nil(u.email),
          select: u.email
      )

    {:ok, normalize_recipient_emails(emails)}
  end

  defp resolve_recipients("individual", target_email) do
    case normalize_recipient_emails([target_email]) do
      [email] -> {:ok, [email]}
      _ -> {:error, "target_email is required for individual audience"}
    end
  end

  defp resolve_recipients(audience, _) do
    {:error, "Invalid audience: #{audience}"}
  end

  defp partition_suppressed(recipients) do
    suppressed = MapSet.new(suppressed_emails())
    Enum.split_with(recipients, &(not MapSet.member?(suppressed, &1)))
  end

  defp suppressed_emails do
    Repo.all(from s in EmailSuppression, select: s.email)
  end

  defp retry_failed_recipients_for_campaign(campaign) do
    if campaign.status == "sending" do
      {:error, "Campaign is already sending"}
    else
      do_retry_failed_recipients_for_campaign(campaign)
    end
  end

  defp do_retry_failed_recipients_for_campaign(campaign) do
    failed_records =
      Repo.all(
        from r in EmailCampaignRecipient,
          where: r.campaign_id == ^campaign.id and r.status == "failed",
          order_by: [asc: r.id]
      )

    {retryable_records, invalid_records} =
      Enum.split_with(failed_records, &EmailAddress.valid?(&1.email))

    Enum.each(invalid_records, fn recipient ->
      update_recipient!(recipient, %{
        status: "failed",
        error: "Invalid recipient email"
      })
    end)

    cond do
      failed_records == [] ->
        {:error, "No failed recipients to retry"}

      retryable_records == [] ->
        finalize_campaign(campaign)
        {:error, "No retryable failed recipients found"}

      true ->
        {:ok, sending_campaign} =
          campaign
          |> EmailCampaign.changeset(%{"status" => "sending"})
          |> Repo.update()

        retryable_records =
          Enum.map(retryable_records, fn recipient ->
            update_recipient!(recipient, %{
              status: "pending",
              sent_at: nil,
              error: nil
            })
          end)

        stats =
          deliver_recipients(
            retryable_records,
            sending_campaign,
            sending_campaign.subject,
            sending_campaign.body,
            sending_campaign.preheader
          )

        case finalize_campaign(sending_campaign) do
          {:ok, updated_campaign} -> {:ok, updated_campaign, stats}
          {:error, changeset} -> {:error, changeset}
        end
    end
  end

  defp parse_campaign_id(id) when is_integer(id), do: {:ok, id}

  defp parse_campaign_id(id) do
    case Integer.parse(to_string(id)) do
      {parsed_id, ""} -> {:ok, parsed_id}
      _ -> {:error, :invalid}
    end
  end

  defp deliver_recipients(recipient_records, campaign, subject, body, preheader) do
    recipient_records
    |> Enum.with_index()
    |> Enum.reduce(%{sent_count: 0, failed_count: 0}, fn {recipient, index}, stats ->
      if index > 0, do: Process.sleep(@send_interval_ms)

      case deliver_recipient(recipient, campaign, subject, body, preheader) do
        :ok ->
          Map.update!(stats, :sent_count, &(&1 + 1))

        {:error, _reason} ->
          Map.update!(stats, :failed_count, &(&1 + 1))
      end
    end)
  end

  defp deliver_recipient(recipient, campaign, subject, body, preheader) do
    case deliver_email(recipient.email, subject, body, preheader, campaign.audience) do
      :ok ->
        update_recipient!(recipient, %{
          status: "sent",
          sent_at: DateTime.utc_now() |> DateTime.truncate(:second),
          error: nil
        })

        :ok

      {:error, reason} ->
        Logger.error(
          "Failed to send campaign #{campaign.id} to #{recipient.email}: #{inspect(reason)}"
        )

        update_recipient!(recipient, %{
          status: "failed",
          error: inspect(reason)
        })

        {:error, reason}
    end
  end

  defp deliver_email(email, subject, body, preheader, audience, attempt \\ 0) do
    result =
      try do
        email
        |> Emails.admin_broadcast_email(subject, body,
          preheader: preheader,
          audience: audience
        )
        |> Mailer.deliver()
      rescue
        error -> {:error, Exception.message(error)}
      catch
        kind, reason -> {:error, {kind, reason}}
      end

    case result do
      {:ok, _} ->
        :ok

      {:error, reason} ->
        case retry_delay_ms(reason, attempt) do
          nil ->
            {:error, reason}

          delay_ms ->
            Logger.warning(
              "Retrying admin campaign email to #{email} after #{delay_ms}ms: #{inspect(reason)}"
            )

            Process.sleep(delay_ms)
            deliver_email(email, subject, body, preheader, audience, attempt + 1)
        end
    end
  end

  defp create_campaign_record(attrs, user_id, recipient_count, suppressed_count, status) do
    %EmailCampaign{}
    |> EmailCampaign.changeset(%{
      "subject" => input(attrs, "subject"),
      "body" => input(attrs, "body"),
      "preheader" => input(attrs, "preheader"),
      "audience" => input(attrs, "audience"),
      "target_email" => input(attrs, "target_email"),
      "sent_by" => user_id,
      "recipient_count" => recipient_count,
      "suppressed_count" => suppressed_count,
      "status" => status
    })
    |> Repo.insert()
  end

  defp create_recipient_records!(campaign, recipients) do
    Enum.map(recipients, fn email ->
      %EmailCampaignRecipient{}
      |> EmailCampaignRecipient.changeset(%{
        campaign_id: campaign.id,
        email: email,
        status: "pending"
      })
      |> Repo.insert!()
    end)
  end

  defp update_recipient!(recipient, attrs) do
    recipient
    |> EmailCampaignRecipient.changeset(attrs)
    |> Repo.update!()
  end

  defp finalize_campaign(campaign) do
    %{sent_count: sent_count, failed_count: failed_count} = campaign_delivery_counts(campaign.id)

    status =
      cond do
        failed_count == 0 and sent_count > 0 -> "sent"
        sent_count > 0 -> "partial_failed"
        true -> "failed"
      end

    campaign
    |> EmailCampaign.changeset(%{
      "status" => status,
      "sent_at" => DateTime.utc_now() |> DateTime.truncate(:second),
      "sent_count" => sent_count,
      "failed_count" => failed_count
    })
    |> Repo.update()
  end

  defp campaign_delivery_counts(campaign_id) do
    counts =
      Repo.all(
        from r in EmailCampaignRecipient,
          where: r.campaign_id == ^campaign_id,
          group_by: r.status,
          select: {r.status, count(r.id)}
      )
      |> Map.new()

    %{
      sent_count: Map.get(counts, "sent", 0),
      failed_count: Map.get(counts, "failed", 0)
    }
  end

  defp normalize_recipient_emails(emails) do
    emails
    |> Enum.map(&normalize_email/1)
    |> Enum.filter(&valid_email?/1)
    |> Enum.uniq()
  end

  defp normalize_email(email) do
    EmailAddress.normalize(email)
  end

  defp valid_email?(email) do
    EmailAddress.valid?(email)
  end

  defp retry_delay_ms(reason, attempt) do
    if retryable_delivery_error?(reason) do
      Enum.at(@rate_limit_retry_delays_ms, attempt)
    end
  end

  defp retryable_delivery_error?(%{status_code: 429}), do: true
  defp retryable_delivery_error?(%{name: "rate_limit_exceeded"}), do: true
  defp retryable_delivery_error?(%{name: :rate_limit_exceeded}), do: true

  defp retryable_delivery_error?(reason) do
    reason
    |> inspect()
    |> String.contains?(["rate_limit_exceeded", "status_code: 429"])
  end

  defp input(attrs, key, default \\ "")

  defp input(attrs, key, default) when is_map(attrs) do
    value = Map.get(attrs, key) || Map.get(attrs, String.to_atom(key)) || default

    value
    |> to_string()
    |> String.trim()
  end

  defp input(_, _, default), do: default
end
