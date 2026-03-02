defmodule ClippsterServer.Social.PostForMeConnectionSessionCleanupWorker do
  @moduledoc """
  Periodically expires stale Post For Me connection sessions.
  """

  use GenServer
  require Logger

  alias ClippsterServer.Social.PostForMeConnectionSessions

  @cleanup_interval :timer.hours(1)
  @initial_delay :timer.minutes(1)

  def start_link(opts \\ []) do
    case GenServer.start_link(__MODULE__, opts, name: {:global, __MODULE__}) do
      {:ok, pid} -> {:ok, pid}
      {:error, {:already_started, _pid}} -> :ignore
      error -> error
    end
  end

  @impl true
  def init(_opts) do
    Process.send_after(self(), :cleanup, @initial_delay)
    {:ok, %{last_cleanup: nil, sessions_expired: 0}}
  end

  @impl true
  def handle_info(:cleanup, state) do
    {:ok, count} = PostForMeConnectionSessions.expire_stale_sessions()

    if count > 0 do
      Logger.info("[PostForMeConnectionSessionCleanupWorker] Expired #{count} stale sessions")
    end

    schedule_next_cleanup()

    {:noreply,
     %{
       state
       | last_cleanup: DateTime.utc_now(),
         sessions_expired: state.sessions_expired + count
     }}
  end

  @impl true
  def handle_call(:status, _from, state), do: {:reply, state, state}

  def status do
    GenServer.call({:global, __MODULE__}, :status)
  end

  defp schedule_next_cleanup do
    Process.send_after(self(), :cleanup, @cleanup_interval)
  end
end
