defmodule ClippsterServer.Waitlist do
  @moduledoc """
  The Waitlist context for managing waitlist entries.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Waitlist.WaitlistEntry
  alias ClippsterServer.{Emails, Mailer}

  @doc """
  Creates a new waitlist entry and sends a confirmation email.
  Returns {:ok, entry} on success or {:error, changeset} on failure.
  """
  def create_entry(attrs) do
    result =
      %WaitlistEntry{}
      |> WaitlistEntry.changeset(attrs)
      |> Repo.insert()

    case result do
      {:ok, entry} ->
        # Send confirmation email
        send_confirmation_email(entry.email)
        {:ok, entry}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  @doc """
  Creates a new waitlist entry and sends confirmation email (admin use).
  Returns {:ok, entry} on success or {:error, changeset} on failure.
  """
  def admin_create_entry(attrs) do
    result =
      %WaitlistEntry{}
      |> WaitlistEntry.changeset(attrs)
      |> Repo.insert()

    case result do
      {:ok, entry} ->
        # Send confirmation email
        send_confirmation_email(entry.email)
        {:ok, entry}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  @doc """
  Lists all waitlist entries ordered by most recent first.
  """
  def list_entries do
    WaitlistEntry
    |> order_by([w], desc: w.inserted_at)
    |> Repo.all()
  end

  @doc """
  Gets statistics about waitlist entries.
  """
  def get_stats do
    total = Repo.aggregate(WaitlistEntry, :count)

    today =
      WaitlistEntry
      |> where([w], fragment("DATE(?) = CURRENT_DATE", w.inserted_at))
      |> Repo.aggregate(:count)

    this_week =
      WaitlistEntry
      |> where([w], fragment("? >= CURRENT_DATE - INTERVAL '7 days'", w.inserted_at))
      |> Repo.aggregate(:count)

    %{
      total: total,
      today: today,
      this_week: this_week
    }
  end

  @doc """
  Checks if an email is already on the waitlist.
  """
  def email_exists?(email) do
    WaitlistEntry
    |> where([w], w.email == ^email)
    |> Repo.exists?()
  end

  @doc """
  Lists all uninvited waitlist entries.
  """
  def list_uninvited_entries do
    WaitlistEntry
    |> where([w], is_nil(w.invited_at))
    |> order_by([w], asc: w.inserted_at)
    |> Repo.all()
  end

  @doc """
  Gets invite statistics.
  """
  def get_invite_stats do
    total = Repo.aggregate(WaitlistEntry, :count)
    invited = WaitlistEntry |> where([w], not is_nil(w.invited_at)) |> Repo.aggregate(:count)
    uninvited = total - invited

    %{
      total: total,
      invited: invited,
      uninvited: uninvited
    }
  end

  @doc """
  Invites a single waitlist entry.
  Uses FOR UPDATE locking to prevent concurrent duplicate invites.
  """
  def invite_entry(entry, admin_id, discount_config) do
    Repo.transaction(fn ->
      # Lock the entry row
      entry = Repo.get!(WaitlistEntry, entry.id, lock: "FOR UPDATE")

      # Check if already invited
      if entry.invited_at do
        Repo.rollback({:already_invited, entry.email})
      end

      # Generate beta code
      {:ok, beta_code} = ClippsterServer.BetaCodes.generate_assigned_code(entry.email)

      # Generate discount code
      case ClippsterServer.PromoCodes.create_waitlist_discount_code(entry.id, admin_id, discount_config) do
        {:ok, %{code: discount_code, stripe_promo_id: stripe_promo_id}} ->
          # Send invite email
          email_result = send_invite_email(entry, beta_code, discount_code, discount_config.percent_off)

          # Update entry with invite tracking
          attrs = %{
            invited_at: DateTime.utc_now() |> DateTime.truncate(:second),
            beta_code_id: beta_code.id,
            discount_code: discount_code,
            discount_stripe_promo_id: stripe_promo_id
          }

          attrs =
            case email_result do
              {:ok, _} ->
                Map.put(attrs, :email_sent_at, DateTime.utc_now() |> DateTime.truncate(:second))

              {:error, reason} ->
                Map.put(attrs, :email_delivery_error, inspect(reason))
            end

          entry
          |> WaitlistEntry.invite_changeset(attrs)
          |> Repo.update!()

        {:error, reason} ->
          Repo.rollback({:discount_code_failed, reason})
      end
    end)
  end

  @doc """
  Invites all uninvited waitlist entries in batches.
  Processes 10 entries per batch with 1 second delay for Stripe rate limiting.
  """
  def invite_all_uninvited(admin_id, discount_config) do
    entries = list_uninvited_entries()

    results =
      entries
      |> Enum.chunk_every(10)
      |> Enum.reduce({0, 0, []}, fn batch, {invited, skipped, errors} ->
        batch_results =
          Enum.map(batch, fn entry ->
            case invite_entry(entry, admin_id, discount_config) do
              {:ok, _} -> {:ok, entry.email}
              {:error, {:already_invited, email}} -> {:skipped, email}
              {:error, reason} -> {:error, {entry.email, reason}}
            end
          end)

        # 1 second delay between batches
        unless Enum.empty?(batch), do: Process.sleep(1000)

        # Aggregate results
        new_invited = Enum.count(batch_results, fn r -> match?({:ok, _}, r) end)
        new_skipped = Enum.count(batch_results, fn r -> match?({:skipped, _}, r) end)
        new_errors = Enum.filter(batch_results, fn r -> match?({:error, _}, r) end)

        {invited + new_invited, skipped + new_skipped, errors ++ new_errors}
      end)

    {:ok, %{invited_count: elem(results, 0), skipped_count: elem(results, 1), errors: elem(results, 2)}}
  end

  defp send_confirmation_email(email) do
    require Logger

    case email
         |> Emails.waitlist_confirmation_email()
         |> Mailer.deliver() do
      {:ok, _} ->
        Logger.info("Waitlist confirmation email sent to #{email}")
        {:ok, :sent}

      {:error, reason} ->
        Logger.error("Failed to send waitlist confirmation email to #{email}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp send_invite_email(entry, beta_code, discount_code, discount_percent) do
    require Logger

    case entry.email
         |> Emails.waitlist_invite_email(beta_code.code, discount_code, discount_percent)
         |> Mailer.deliver() do
      {:ok, _} ->
        Logger.info("Waitlist invite email sent to #{entry.email}")
        {:ok, :sent}

      {:error, reason} ->
        Logger.error("Failed to send waitlist invite email to #{entry.email}: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
