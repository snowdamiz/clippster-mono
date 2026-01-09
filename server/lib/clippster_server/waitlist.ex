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

  defp send_confirmation_email(email) do
    email
    |> Emails.waitlist_confirmation_email()
    |> Mailer.deliver()
  end
end
