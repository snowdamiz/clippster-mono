defmodule ClippsterServer.Workers.FreeTierCreditWorker do
  @moduledoc """
  GenServer that grants 60 credits monthly to free-tier users.
  Runs every 24 hours and checks for users whose free_tier_last_credit_grant
  is >= 30 days ago, granting them 60 new credits and updating the timestamp.
  """
  use GenServer
  require Logger

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Credits

  @check_interval :timer.hours(24)
  @initial_delay :timer.minutes(2)
  @grant_interval_days 30
  @monthly_free_credits 60

  def start_link(opts \\ []) do
    case GenServer.start_link(__MODULE__, opts, name: {:global, __MODULE__}) do
      {:ok, pid} -> {:ok, pid}
      {:error, {:already_started, _pid}} -> :ignore
      error -> error
    end
  end

  @impl true
  def init(_opts) do
    Process.send_after(self(), :grant_credits, @initial_delay)
    {:ok, %{last_run: nil, users_granted: 0}}
  end

  @impl true
  def handle_info(:grant_credits, state) do
    Logger.info("[FreeTierCreditWorker] Starting monthly free tier credit grants...")

    count = grant_due_credits()

    Logger.info("[FreeTierCreditWorker] Granted credits to #{count} free-tier users.")
    schedule_next_run()

    {:noreply, %{state | last_run: DateTime.utc_now(), users_granted: state.users_granted + count}}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, state, state}
  end

  @doc """
  Manually trigger a credit grant run (useful for admin/testing).
  """
  def trigger_grant do
    GenServer.cast({:global, __MODULE__}, :manual_grant)
  end

  @impl true
  def handle_cast(:manual_grant, state) do
    send(self(), :grant_credits)
    {:noreply, state}
  end

  @doc """
  Get the current status of the worker.
  """
  def status do
    GenServer.call({:global, __MODULE__}, :status)
  end

  defp grant_due_credits do
    cutoff = DateTime.utc_now() |> DateTime.add(-@grant_interval_days, :day) |> DateTime.truncate(:second)

    # Find free-tier users whose last grant was >= 30 days ago (or null, for safety)
    eligible_users =
      from(u in User,
        where:
          (u.subscription_status in ["none", "expired"] or is_nil(u.subscription_status)) and
            (is_nil(u.free_tier_last_credit_grant) or u.free_tier_last_credit_grant <= ^cutoff) and
            (is_nil(u.deactivated) or u.deactivated == false)
      )
      |> Repo.all()

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    Enum.reduce(eligible_users, 0, fn user, count ->
      case Credits.add_credits_capped(user.id, @monthly_free_credits) do
        {:ok, _} ->
          user
          |> User.free_tier_changeset(%{free_tier_last_credit_grant: now})
          |> Repo.update()

          count + 1

        {:error, :free_tier_cap_reached} ->
          # User already at cap — still update timestamp to avoid re-checking every day
          user
          |> User.free_tier_changeset(%{free_tier_last_credit_grant: now})
          |> Repo.update()

          count

        {:error, reason} ->
          Logger.warning("[FreeTierCreditWorker] Failed to grant credits to user #{user.id}: #{inspect(reason)}")
          count
      end
    end)
  end

  defp schedule_next_run do
    Process.send_after(self(), :grant_credits, @check_interval)
  end
end
