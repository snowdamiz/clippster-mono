defmodule ClippsterServer.Organizations.SharedClipCleanupWorker do
  @moduledoc """
  GenServer that periodically cleans up expired shared clips.
  Runs once per day at 3:00 AM UTC to delete clips that have passed their expiration date.
  """
  use GenServer
  require Logger

  alias ClippsterServer.Organizations

  @cleanup_interval :timer.hours(24)
  @initial_delay :timer.minutes(1)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    # Schedule initial cleanup after a short delay
    Process.send_after(self(), :cleanup, @initial_delay)
    {:ok, %{last_cleanup: nil, clips_deleted: 0}}
  end

  @impl true
  def handle_info(:cleanup, state) do
    Logger.info("[SharedClipCleanupWorker] Starting expired clips cleanup...")

    {:ok, count} = Organizations.cleanup_expired_shared_clips()
    Logger.info("[SharedClipCleanupWorker] Cleanup complete. Deleted #{count} expired clips.")
    schedule_next_cleanup()
    {:noreply, %{state | last_cleanup: DateTime.utc_now(), clips_deleted: state.clips_deleted + count}}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, state, state}
  end

  @doc """
  Manually trigger a cleanup (useful for testing or admin actions).
  """
  def trigger_cleanup do
    GenServer.cast(__MODULE__, :manual_cleanup)
  end

  @impl true
  def handle_cast(:manual_cleanup, state) do
    send(self(), :cleanup)
    {:noreply, state}
  end

  @doc """
  Get the current status of the cleanup worker.
  """
  def status do
    GenServer.call(__MODULE__, :status)
  end

  defp schedule_next_cleanup do
    Process.send_after(self(), :cleanup, @cleanup_interval)
  end
end
